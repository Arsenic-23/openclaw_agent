import { Bot, webhookCallback, InlineKeyboard } from 'grammy';
import type { Context } from 'grammy';
import type { Express } from 'express';
import { sessionStore } from '../agent/context.js';
import { publishGenerationToCommunity } from '../community/publish-service.js';
import { CONFIG, studioUrl } from '../config.js';
import { generationStore, type GenerationRecord } from '../generations/store.js';
import type { ClawMessage, ClawResponse, ChannelType, QuickAction, SelectionOption } from '../types/index.js';
import { BaseChannel } from './base.js';

type TelegramChatAction = 'typing' | 'upload_photo' | 'upload_video';

const CHAT_ACTION_INTERVAL_MS = 4_000;
const CONFIRM_YES = new Set(['1', 'yes', 'y', 'ok', 'sure', 'proceed', 'confirm', 'do it', 'go', 'yep', 'yeah']);
const CANCEL_WORDS = new Set(['cancel', '/cancel', 'stop', 'never mind']);

interface PendingCommunityPost {
  firebaseUID: string;
  jobId: string;
  suggestedTitle: string;
  awaitingCustomTitle: boolean;
}

interface ActivityPlan {
  action?: TelegramChatAction;
  startText?: string;
}

export class TelegramChannel extends BaseChannel {
  readonly channelType: ChannelType = 'telegram';
  private bot: Bot<Context>;
  private pendingCommunityPosts = new Map<string, PendingCommunityPost>();

  constructor() {
    super();
    this.bot = new Bot<Context>(CONFIG.telegram.token);
    this.registerHandlers();
  }

  private registerHandlers(): void {
    const bot = this.bot;

    bot.command('start', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/start');
    });

    bot.command('help', async (ctx) => {
      await this.dispatchMessage(ctx, '/help');
    });

    bot.command('pair', async (ctx) => {
      await this.dispatchMessage(ctx, '/pair');
    });

    bot.command('credits', async (ctx) => {
      await this.dispatchMessage(ctx, '/credits');
    });

    bot.command('director', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/director');
    });

    bot.command('image', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/image');
    });

    bot.command('video', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/video');
    });

    bot.command('template', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/template');
    });

    bot.command('remix', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/remix');
    });

    bot.command('schedule', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/schedule');
    });

    bot.command('jobs', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/jobs');
    });

    bot.command('pause', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/pause');
    });

    bot.command('resume', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/resume');
    });

    bot.command('cancel', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/cancel');
    });

    bot.command('credits', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message?.text ?? '/credits');
    });

    bot.on('message:text', async (ctx) => {
      await this.dispatchMessage(ctx, ctx.message.text);
    });

    bot.on('message:photo', async (ctx) => {
      await this.handleMediaUpload(ctx, 'photo');
    });

    bot.on('message:video', async (ctx) => {
      await this.handleMediaUpload(ctx, 'video');
    });

    bot.on('message:document', async (ctx) => {
      await this.handleMediaUpload(ctx, 'document');
    });

    bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const [action, value = '', originalUserId = ''] = data.split(':');
      const presserId = ctx.from?.id.toString();

      if (originalUserId && presserId !== originalUserId) {
        await ctx.answerCallbackQuery({ text: '❌ Not your generation!', show_alert: true });
        return;
      }

      await ctx.answerCallbackQuery();

      const chatId = ctx.chat?.id.toString() ?? '';
      const userId = ctx.from?.id.toString() ?? '';
      if (!chatId || !userId) return;

      if (action === 'select') {
        await this.processInboundText(chatId, userId, value, ctx.callbackQuery.id, false);
        return;
      }

      if (action === 'again' || action === 'remix') {
        await ctx.reply(action === 'again' ? '🎲 Creating another version...' : '🔄 Remixing your creation...');
        const messageText = action === 'again' ? `generate again job:${value}` : `remix job:${value}`;
        const chatAction = this.actionForStoredGeneration(value);

        await this.runWithChatAction(chatId, chatAction, async () => {
          const msg: ClawMessage = {
            channelType: 'telegram',
            channelUserId: userId,
            chatId,
            text: messageText,
            attachmentUrl: undefined,
            messageId: ctx.callbackQuery.id,
          };
          if (this.onMessage) {
            await this.onMessage(msg);
          }
        });
        return;
      }

      if (action === 'command') {
        await this.processInboundText(chatId, userId, value, ctx.callbackQuery.id, true, ctx);
        return;
      }

      if (action === 'share') {
        await this.sendShareOptions(chatId, value, userId);
        return;
      }

      if (action === 'post') {
        const generation = generationStore.get(value);
        if (!generation) {
          await ctx.reply('❌ I could not find that creation anymore. Please generate it again, then post it.');
          return;
        }

        const suggestedTitle = this.buildSuggestedCommunityTitle(generation);
        this.pendingCommunityPosts.set(userId, {
          firebaseUID: generation.firebaseUID,
          jobId: generation.jobId,
          suggestedTitle,
          awaitingCustomTitle: false,
        });

        await ctx.reply(
          `🌍 Ready to post this to StudioX Community.\n\nSuggested title:\n*${suggestedTitle}*\n\n` +
            `Choose an option below.`,
          {
            parse_mode: 'Markdown',
            reply_markup: this.buildCommunityPostDraftKeyboard(generation.jobId, userId),
          }
        );
        return;
      }

      if (action === 'postnow') {
        const generation = generationStore.get(value);
        if (!generation) {
          await ctx.reply('❌ I could not find that creation anymore. Please generate it again, then post it.');
          return;
        }

        const pending = this.pendingCommunityPosts.get(userId);
        const suggestedTitle = pending?.suggestedTitle || this.buildSuggestedCommunityTitle(generation);

        await ctx.reply('🌍 Publishing to the StudioX community...');
        await this.publishCommunityPost(chatId, {
          firebaseUID: generation.firebaseUID,
          jobId: generation.jobId,
          title: suggestedTitle,
        });
        this.pendingCommunityPosts.delete(userId);
        return;
      }

      if (action === 'postedit') {
        const generation = generationStore.get(value);
        if (!generation) {
          await ctx.reply('❌ I could not find that creation anymore. Please generate it again, then post it.');
          return;
        }

        const pending = this.pendingCommunityPosts.get(userId);
        const suggestedTitle = pending?.suggestedTitle || this.buildSuggestedCommunityTitle(generation);

        this.pendingCommunityPosts.set(userId, {
          firebaseUID: generation.firebaseUID,
          jobId: generation.jobId,
          suggestedTitle,
          awaitingCustomTitle: true,
        });

        await ctx.reply(
          `✏️ Send your custom title now.\n\nSuggested title:\n*${suggestedTitle}*\n\n` +
            `Reply with your title, or type \`cancel\` to stop.`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      if (action === 'postcancel') {
        this.pendingCommunityPosts.delete(userId);
        await ctx.reply('👍 Community post cancelled.');
        return;
      }

      if (action === 'save') {
        await ctx.reply(`💾 Open your Studio workspace here: ${studioUrl('/studio')}`);
      }
    });

    bot.catch((err) => {
      console.error('Telegram bot error:', err);
    });
  }

  private async dispatchMessage(ctx: Context, text: string): Promise<void> {
    const chatId = ctx.chat?.id.toString() ?? '';
    const userId = ctx.from?.id.toString() ?? '';

    if (!userId || !chatId) return;

    const handledCommunityPost = await this.handlePendingCommunityPost(ctx, userId, chatId, text);
    if (handledCommunityPost) {
      return;
    }

    await this.processInboundText(chatId, userId, text, ctx.message?.message_id?.toString() ?? undefined, true, ctx);
  }

  private async handleMediaUpload(ctx: Context, type: 'photo' | 'video' | 'document'): Promise<void> {
    const chatId = ctx.chat?.id.toString() ?? '';
    const userId = ctx.from?.id.toString() ?? '';
    if (!userId || !chatId) return;

    let fileId: string | undefined;
    if (type === 'photo') {
      const photos = ctx.message?.photo || [];
      if (photos.length > 0) {
        fileId = photos[photos.length - 1]?.file_id;
      }
    } else if (type === 'video') {
      fileId = ctx.message?.video?.file_id;
    } else if (type === 'document') {
      fileId = ctx.message?.document?.file_id;
    }

    if (!fileId) return;

    try {
      const file = await ctx.api.getFile(fileId);
      if (!file.file_path) {
        await ctx.reply('❌ Could not get a valid URL for your upload.');
        return;
      }
      
      const fileUrl = `https://api.telegram.org/file/bot${CONFIG.telegram.token}/${file.file_path}`;
      const caption = ctx.message?.caption ?? '';
      
      const handledCommunityPost = await this.handlePendingCommunityPost(ctx, userId, chatId, caption);
      if (handledCommunityPost) {
        return;
      }

      const activity = this.getActivityPlan(userId, caption);
      if (activity.startText) {
        await ctx.reply(activity.startText);
      }

      await this.runWithChatAction(chatId, activity.action, async () => {
        const message: ClawMessage = {
          channelType: 'telegram',
          channelUserId: userId,
          chatId,
          text: caption,
          attachmentUrl: fileUrl,
          messageId: ctx.message?.message_id?.toString(),
        };

        if (this.onMessage) {
          await this.onMessage(message);
        }
      });
    } catch (err) {
      console.error('Error handling Telegram media upload:', err);
      try {
        await ctx.reply('❌ Could not process your upload.');
      } catch {
        // ignore
      }
    }
  }

  private async processInboundText(
    chatId: string,
    userId: string,
    text: string,
    messageId?: string,
    emitStartText = true,
    ctx?: Context
  ): Promise<void> {
    const activity = this.getActivityPlan(userId, text);
    if (emitStartText && activity.startText && ctx) {
      await ctx.reply(activity.startText);
    }

    await this.runWithChatAction(chatId, activity.action, async () => {
      const message: ClawMessage = {
        channelType: 'telegram',
        channelUserId: userId,
        chatId,
        text,
        attachmentUrl: undefined,
        messageId,
      };

      if (this.onMessage) {
        await this.onMessage(message);
      }
    });
  }

  private getActivityPlan(userId: string, text: string): ActivityPlan {
    const session = sessionStore.get('telegram', userId);
    const normalized = text.trim().toLowerCase();

    if (session?.pendingWizard?.step === 'awaiting_confirm' && this.isPositiveReply(normalized)) {
      if (session.pendingWizard.type === 'video') {
        return { action: 'upload_video', startText: '🦞 Creating your video...' };
      }
      if (session.pendingWizard.type === 'image') {
        return { action: 'upload_photo', startText: '🦞 Creating your image...' };
      }
      if (session.pendingWizard.type === 'director') {
        return { action: 'upload_photo', startText: '🦞 Building your campaign hero concept...' };
      }
      return { action: 'typing', startText: '🦞 Working on your creation...' };
    }

    if (session?.pendingConfirmation && this.isPositiveReply(normalized)) {
      return { action: 'typing', startText: '🦞 Starting the generation...' };
    }

    if (normalized.includes('job:') && (normalized.includes('again') || normalized.includes('remix'))) {
      return { action: this.actionForText(text), startText: '🦞 Working on it...' };
    }

    return {};
  }

  private isPositiveReply(text: string): boolean {
    return CONFIRM_YES.has(text) || Array.from(CONFIRM_YES).some((word) => text.startsWith(`${word} `));
  }

  private actionForStoredGeneration(jobId: string): TelegramChatAction {
    const generation = generationStore.get(jobId);
    if (generation?.mediaType === 'video') return 'upload_video';
    if (generation?.mediaType === 'image') return 'upload_photo';
    return 'typing';
  }

  private actionForText(text: string): TelegramChatAction {
    const lower = text.toLowerCase();
    if (lower.includes('video')) return 'upload_video';
    if (lower.includes('image') || lower.includes('photo')) return 'upload_photo';
    return 'typing';
  }

  private startChatActionLoop(chatId: string, action: TelegramChatAction): () => void {
    const cid = parseInt(chatId, 10);
    let active = true;

    const send = async (): Promise<void> => {
      if (!active) return;
      try {
        await this.bot.api.sendChatAction(cid, action);
      } catch {
        // Ignore chat action failures and keep the main flow alive.
      }
    };

    void send();
    const interval = setInterval(() => {
      void send();
    }, CHAT_ACTION_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }

  private async runWithChatAction<T>(
    chatId: string,
    action: TelegramChatAction | undefined,
    work: () => Promise<T>
  ): Promise<T> {
    const stop = action ? this.startChatActionLoop(chatId, action) : () => {};
    try {
      return await work();
    } finally {
      stop();
    }
  }

  private async handlePendingCommunityPost(
    ctx: Context,
    userId: string,
    chatId: string,
    text: string
  ): Promise<boolean> {
    const pending = this.pendingCommunityPosts.get(userId);
    if (!pending) return false;
    if (!pending.awaitingCustomTitle) return false;

    const title = text.trim();

    if (CANCEL_WORDS.has(title.toLowerCase())) {
      this.pendingCommunityPosts.delete(userId);
      await ctx.reply('👍 Community post cancelled.');
      return true;
    }

    if (!title) {
      await ctx.reply('Please send a title for the community post, or type `cancel`.');
      return true;
    }

    await ctx.reply('🌍 Publishing to the StudioX community...');
    await this.publishCommunityPost(chatId, {
      firebaseUID: pending.firebaseUID,
      jobId: pending.jobId,
      title: title.slice(0, 120),
    });
    this.pendingCommunityPosts.delete(userId);

    return true;
  }

  private buildSuggestedCommunityTitle(generation: GenerationRecord): string {
    const prompt = (generation.prompt || '').trim();
    if (!prompt) {
      return generation.mediaType === 'video' ? 'StudioX Video Concept' : 'StudioX Image Concept';
    }

    const normalized = prompt
      .replace(/^(create|generate|make)\s+(an?\s+)?(image|video)\s*(of)?\s*/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '')
      .trim();

    const source = normalized || prompt;
    const words = source.split(' ').filter(Boolean).slice(0, 8);
    const title = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .slice(0, 80);

    if (title.length >= 4) return title;
    return generation.mediaType === 'video' ? 'StudioX Video Concept' : 'StudioX Image Concept';
  }

  private buildCommunityPostDraftKeyboard(jobId: string, userId: string): InlineKeyboard {
    return new InlineKeyboard()
      .text('✅ Post Now', `postnow:${jobId}:${userId}`)
      .text('✏️ Edit Title', `postedit:${jobId}:${userId}`)
      .row()
      .text('❌ Cancel', `postcancel:${jobId}:${userId}`);
  }

  private async publishCommunityPost(
    chatId: string,
    input: {
      firebaseUID: string;
      jobId: string;
      title: string;
    }
  ): Promise<void> {
    try {
      const { postId } = await this.runWithChatAction(chatId, 'typing', async () =>
        publishGenerationToCommunity({
          firebaseUID: input.firebaseUID,
          jobId: input.jobId,
          title: input.title,
        })
      );

      const postUrl = studioUrl(`/community/${postId}`);
      await this.bot.api.sendMessage(
        parseInt(chatId, 10),
        `✅ Posted to the StudioX community.\n\nView it here: ${postUrl}`,
        {
          reply_markup: this.buildCommunityShareKeyboard(postUrl),
        }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not publish right now.';
      await this.bot.api.sendMessage(parseInt(chatId, 10), `❌ ${message}`);
    }
  }

  private async sendShareOptions(chatId: string, jobId: string, userId: string): Promise<void> {
    const generation = generationStore.get(jobId);
    if (!generation) {
      await this.sendText(chatId, '❌ I could not find that creation anymore. Please generate it again to share it.');
      return;
    }

    const keyboard = this.buildShareKeyboard(generation, userId);
    await this.bot.api.sendMessage(parseInt(chatId, 10), this.buildShareText(), {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }

  private buildShareText(): string {
    return (
      '📣 Share options\n\n' +
      'Use the buttons below to share this creation. Instagram does not allow direct bot posting, so use *Download* first and then upload it in Instagram manually.'
    );
  }

  private buildShareKeyboard(generation: GenerationRecord, userId: string): InlineKeyboard {
    const assetUrl = encodeURIComponent(generation.mediaUrl);
    const text = encodeURIComponent('Made with StudioX Claw');
    const instagramCaption = encodeURIComponent('Made with StudioX Claw');

    return new InlineKeyboard()
      .url('⬇️ Download', generation.mediaUrl)
      .url('𝕏 X', `https://twitter.com/intent/tweet?text=${text}&url=${assetUrl}`)
      .row()
      .url('📘 Facebook', `https://www.facebook.com/sharer/sharer.php?u=${assetUrl}`)
      .url('✈️ Telegram', `https://t.me/share/url?url=${assetUrl}&text=${text}`)
      .row()
      .url('📸 Instagram', `https://www.instagram.com/?url=${assetUrl}&caption=${instagramCaption}`)
      .text('🌍 Community', `post:${generation.jobId}:${userId}`)
      .row()
      .url('🌐 Open Asset', generation.mediaUrl);
  }

  private buildCommunityShareKeyboard(postUrl: string): InlineKeyboard {
    const encodedUrl = encodeURIComponent(postUrl);
    const encodedText = encodeURIComponent('Check out this creation on StudioX');

    return new InlineKeyboard()
      .url('🌍 Open Post', postUrl)
      .url('𝕏 X', `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`)
      .row()
      .url('📘 Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)
      .url('👽 Reddit', `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedText}`)
      .row()
      .url('✈️ Telegram', `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`);
  }

  async send(chatId: string, response: ClawResponse): Promise<void> {
    const cid = parseInt(chatId, 10);
    const keyboard =
      this.buildSelectionKeyboard(response.selectionOptions, chatId) ??
      this.buildQuickActionKeyboard(response.quickActions, chatId);

    if (response.mediaUrl && response.mediaType === 'image') {
      try {
        await this.bot.api.sendPhoto(cid, response.mediaUrl, {
          caption: response.text,
          parse_mode: 'Markdown',
          ...(keyboard ? { reply_markup: keyboard } : {}),
        });
        return;
      } catch {
        // Fall through to text reply.
      }
    }

    if (response.mediaUrl && response.mediaType === 'video') {
      try {
        await this.bot.api.sendVideo(cid, response.mediaUrl, {
          caption: response.text,
          parse_mode: 'Markdown',
          ...(keyboard ? { reply_markup: keyboard } : {}),
        });
        return;
      } catch {
        // Fall through to text reply.
      }
    }

    await this.bot.api.sendMessage(cid, response.text, {
      parse_mode: 'Markdown',
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
  }

  private buildQuickActionKeyboard(actions: QuickAction[] | undefined, chatId: string): InlineKeyboard | undefined {
    if (!actions || actions.length === 0) return undefined;

    const keyboard = new InlineKeyboard();
    let currentRow: number | undefined;

    for (const action of actions) {
      const nextRow = action.row ?? 0;
      if (currentRow !== undefined && nextRow !== currentRow) {
        keyboard.row();
      }
      currentRow = nextRow;

      if (action.url) {
        keyboard.url(action.label, action.url);
        continue;
      }

      if (action.action) {
        keyboard.text(action.label, `${action.action}:${action.jobId ?? ''}:${chatId}`);
      }
    }

    return keyboard;
  }

  private buildSelectionKeyboard(options: SelectionOption[] | undefined, chatId: string): InlineKeyboard | undefined {
    if (!options || options.length === 0) return undefined;

    const keyboard = new InlineKeyboard();
    let currentRow: number | undefined;

    for (const option of options) {
      const nextRow = option.row ?? 0;
      if (currentRow !== undefined && nextRow !== currentRow) {
        keyboard.row();
      }
      currentRow = nextRow;
      keyboard.text(option.label, `select:${option.value}:${chatId}`);
    }

    return keyboard;
  }

  async sendText(chatId: string, text: string): Promise<void> {
    await this.bot.api.sendMessage(parseInt(chatId, 10), text, { parse_mode: 'Markdown' });
  }

  async start(): Promise<void> {
    console.log('✅ Telegram channel ready (long polling mode)');
  }

  async stop(): Promise<void> {
    this.bot.stop();
  }

  async setupCommands(): Promise<void> {
    try {
      await this.bot.api.setMyCommands([
        { command: 'start', description: 'Start the bot' },
        { command: 'pair', description: 'Link your StudioX account' },
        { command: 'help', description: 'Show help and commands' },
        { command: 'image', description: 'Generate an AI image' },
        { command: 'video', description: 'Generate an AI video' },
        { command: 'template', description: 'Create from presets' },
        { command: 'remix', description: 'Remix a creation' },
        { command: 'director', description: 'Run an AI campaign' },
        { command: 'schedule', description: 'Schedule repeated generations' },
        { command: 'jobs', description: 'List your scheduled jobs' },
        { command: 'pause', description: 'Pause a scheduled job' },
        { command: 'resume', description: 'Resume a scheduled job' },
        { command: 'cancel', description: 'Cancel a scheduled job' },
        { command: 'credits', description: 'Check your balance' }
      ]);
      console.log('✅ Telegram bot commands menu updated');
    } catch (err) {
      console.error('❌ Failed to update bot commands menu:', err);
    }
  }

  mountWebhook(app: Express): void {
    app.post(
      CONFIG.telegram.webhookPath,
      webhookCallback(this.bot, 'express', { secretToken: CONFIG.telegram.webhookSecret })
    );
    console.log(`✅ Telegram webhook mounted at POST ${CONFIG.telegram.webhookPath}`);
  }

  async startPolling(): Promise<void> {
    await this.setupCommands();
    this.bot.start({
      onStart: () => console.log('🤖 Telegram bot polling started'),
    });
  }

  async startWebhook(): Promise<void> {
    if (!CONFIG.telegram.webhookUrl) {
      throw new Error('TELEGRAM_WEBHOOK_URL must be set when TELEGRAM_MODE=webhook');
    }

    await this.setupCommands();
    await this.bot.api.setWebhook(CONFIG.telegram.webhookUrl, {
      secret_token: CONFIG.telegram.webhookSecret,
      drop_pending_updates: true,
    });

    console.log(`🤖 Telegram webhook configured: ${CONFIG.telegram.webhookUrl}`);
  }
}
