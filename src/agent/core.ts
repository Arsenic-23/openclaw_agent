import { skillRegistry } from '../skills/registry.js';
import { getDb } from '../firebase-admin.js';
import { skillExecutor } from '../skills/executor.js';
import { linkResolver } from '../pairing/link-resolver.js';
import { sessionStore, type PendingWizard } from './context.js';
import { getMemory, injectMemoryIntoPrompt, updateMemory, addDailyNote } from '../memory/user-memory.js';
import { handleScheduleCommand } from '../commands/schedule.js';
import { studioUrl } from '../config.js';
import { generationStore } from '../generations/store.js';
import {
  IMAGE_WIZARD_MODELS,
  VIDEO_WIZARD_MODELS,
  TEMPLATE_PRESETS,
  findTemplatePreset,
  findImageWizardModel,
  findVideoWizardModel,
  type WizardImageModel,
  type WizardVideoModel,
  type WizardTemplatePreset,
} from './wizard-config.js';
import {
  DIRECTOR_GOALS,
  DIRECTOR_PLATFORMS,
  DIRECTOR_STYLES,
  DIRECTOR_VARIATION_OPTIONS,
  buildDirectorBlueprint,
  findDirectorGoal,
  findDirectorPlatform,
  findDirectorStyle,
} from './director-config.js';
import type { ChannelType, ClawMessage, ClawResponse, ClawUser, SelectionOption } from '../types/index.js';

const CONFIRM_YES = ['yes', 'y', 'ok', 'sure', 'proceed', 'confirm', 'do it', 'go', 'yep', 'yeah', '1'];
const CONFIRM_NO = ['no', 'n', 'cancel', 'stop', 'nope', 'nah', 'abort', '2'];
const CONFIRM_THRESHOLD = 50;
const REMIX_STRENGTH_OPTIONS = ['0.3', '0.5', '0.7', '0.9'];
const TEMPLATE_VIDEO_DURATION_OPTIONS = ['5', '10'];

export class AgentCore {
  async handle(message: ClawMessage): Promise<ClawResponse> {
    const { channelType, channelUserId, chatId, text } = message;
    const trimmed = text.trim();
    const firebaseUID = await linkResolver.resolve(channelType, channelUserId);

    if (trimmed.startsWith('/pair')) {
      return this.handlePair(channelType, channelUserId, chatId);
    }

    if (trimmed.startsWith('/credits') || trimmed.startsWith('/balance')) {
      return this.handleCredits(firebaseUID);
    }

    if (trimmed.startsWith('/start')) {
      return this.handleStart(firebaseUID !== null);
    }

    if (trimmed.startsWith('/help')) {
      return this.handleHelp();
    }

    const session = sessionStore.get(channelType, channelUserId);

    if (session?.pendingWizard || session?.pendingConfirmation) {
      if (this.isCancelText(trimmed)) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        sessionStore.clearPendingConfirmation(channelType, channelUserId);
        return { text: '👍 Cancelled. Send /image, /video, /template, or /remix to start again.' };
      }
    }

    if (session?.pendingWizard && firebaseUID) {
      return this.handlePendingWizard(trimmed, session.pendingWizard, firebaseUID, channelType, channelUserId, chatId);
    }

    if (session?.pendingConfirmation && firebaseUID) {
      const lower = trimmed.toLowerCase();
      if (CONFIRM_YES.some((w) => lower === w || lower.startsWith(`${w} `))) {
        return this.executeConfirmed(session.pendingConfirmation, firebaseUID, channelType, channelUserId);
      }
      if (CONFIRM_NO.some((w) => lower === w || lower.startsWith(`${w} `))) {
        sessionStore.clearPendingConfirmation(channelType, channelUserId);
        return { text: '👍 Cancelled. What would you like to create?' };
      }
      return { text: 'Reply with "yes" or "no" (or 1 / 2).' };
    }

    if (
      trimmed.startsWith('/schedule') ||
      trimmed.startsWith('/jobs') ||
      trimmed.startsWith('/pause') ||
      trimmed.startsWith('/resume') ||
      trimmed.startsWith('/cancel')
    ) {
      if (!firebaseUID) {
        return { text: '❌ Please /pair your account first to use scheduling.' };
      }
      return handleScheduleCommand(trimmed, firebaseUID, channelType, channelUserId, chatId);
    }

    if (!firebaseUID) {
      return {
        text:
          `👋 Welcome to StudioX Claw 🦞!\n\nTo get started, link your StudioX account:\n\n1. Run /pair\n2. Enter the code at ${studioUrl('/claw/pair')}\n\nThen you can generate images and videos right here in chat!`,
      };
    }

    if (trimmed.startsWith('/image')) {
      return this.startImageWizard(firebaseUID, channelType, channelUserId, chatId, this.extractPromptFromCommand(trimmed, '/image'));
    }

    if (trimmed.startsWith('/video')) {
      return this.startVideoWizard(firebaseUID, channelType, channelUserId, chatId, this.extractPromptFromCommand(trimmed, '/video'));
    }

    if (trimmed.startsWith('/template')) {
      return this.startTemplateWizard(firebaseUID, channelType, channelUserId, chatId, undefined);
    }

    if (trimmed.startsWith('/remix')) {
      return this.startRemixWizard(firebaseUID, channelType, channelUserId, chatId, trimmed);
    }

    if (trimmed.startsWith('/director')) {
      return this.startDirectorWizard(firebaseUID, channelType, channelUserId, chatId, this.extractPromptFromCommand(trimmed, '/director'));
    }

    if (!this.hasJobReference(trimmed) && this.looksLikeImagePrompt(trimmed)) {
      return this.startImageWizard(
        firebaseUID,
        channelType,
        channelUserId,
        chatId,
        this.extractNaturalPrompt(trimmed, 'image')
      );
    }

    if (!this.hasJobReference(trimmed) && this.looksLikeVideoPrompt(trimmed)) {
      return this.startVideoWizard(
        firebaseUID,
        channelType,
        channelUserId,
        chatId,
        this.extractNaturalPrompt(trimmed, 'video')
      );
    }

    const skill = skillRegistry.findByTrigger(text);

    if (!this.hasJobReference(trimmed) && skill?.name === 'image-gen') {
      const prompt = this.extractArgs(text, skill.triggers)['prompt'] ?? '';
      return this.startImageWizard(firebaseUID, channelType, channelUserId, chatId, prompt);
    }

    if (!this.hasJobReference(trimmed) && skill?.name === 'video-gen') {
      const prompt = this.extractArgs(text, skill.triggers)['prompt'] ?? '';
      return this.startVideoWizard(firebaseUID, channelType, channelUserId, chatId, prompt);
    }

    if (skill?.name?.startsWith('template-')) {
      return this.startTemplateWizard(firebaseUID, channelType, channelUserId, chatId, skill.name);
    }

    if (skill?.name === 'remix' || trimmed.startsWith('remix job:')) {
      return this.startRemixWizard(firebaseUID, channelType, channelUserId, chatId, trimmed);
    }

    if (!skill) {
      return {
        text:
          "🦞 I can guide you step-by-step like Studio.\n\nUse:\n• /image [prompt]\n• /video [prompt]\n• /template\n• /remix [jobId]\n• /director [brief]\n\nOr send a natural prompt like \"create an image of a tiger\".",
      };
    }

    const args = this.extractArgs(text, skill.triggers);
    const memory = await getMemory(firebaseUID);
    if (args['prompt']) {
      args['prompt'] = injectMemoryIntoPrompt(args['prompt'], memory);
    }
    if (!args['model'] && memory.preferredModel) {
      args['model'] = memory.preferredModel;
    }
    if (!args['aspect'] && memory.preferredAspect) {
      args['aspect'] = memory.preferredAspect;
    }

    const user: ClawUser = { firebaseUID, channelType, channelUserId, tokenBalance: 0, memory };
    const estimatedCost = this.estimateCost(skill);

    if (estimatedCost >= CONFIRM_THRESHOLD) {
      sessionStore.set({ firebaseUID, channelType, channelUserId, chatId });
      sessionStore.setPendingConfirmation(channelType, channelUserId, {
        skillName: skill.name,
        args,
        cost: estimatedCost,
        prompt: args['prompt'] ?? '',
      });

      const model = args['model'] ?? 'seedream-4.5';
      const aspect = args['aspect'] ?? '1:1';
      return {
        text:
          `🦞 Ready to generate!\n\n` +
          `📝 ${args['prompt'] ?? text}\n` +
          `🤖 Model: ${model}\n` +
          `📐 Aspect: ${aspect}\n` +
          `💰 Estimated cost: ~${estimatedCost} credits\n\n` +
          `Tap a button below or reply "yes" to confirm or "no" to cancel.`,
        selectionOptions: this.buildConfirmOptions('Generate'),
      };
    }

    return this.executeSkill(skill.name, args, user);
  }

  private async handlePendingWizard(
    input: string,
    wizard: PendingWizard,
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    chatId: string
  ): Promise<ClawResponse> {
    if (wizard.type === 'image') {
      return this.handleImageWizardInput(input, wizard, firebaseUID, channelType, channelUserId, chatId);
    }
    if (wizard.type === 'video') {
      return this.handleVideoWizardInput(input, wizard, firebaseUID, channelType, channelUserId, chatId);
    }
    if (wizard.type === 'template') {
      return this.handleTemplateWizardInput(input, wizard, firebaseUID, channelType, channelUserId, chatId);
    }
    if (wizard.type === 'director') {
      return this.handleDirectorWizardInput(input, wizard, firebaseUID, channelType, channelUserId, chatId);
    }
    return this.handleRemixWizardInput(input, wizard, firebaseUID, channelType, channelUserId, chatId);
  }

  private startImageWizard(
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    chatId: string,
    prompt: string
  ): ClawResponse {
    sessionStore.set({ firebaseUID, channelType, channelUserId, chatId });
    sessionStore.clearPendingConfirmation(channelType, channelUserId);

    const normalizedPrompt = this.normalizePrompt(prompt);
    if (!normalizedPrompt) {
      sessionStore.setPendingWizard(channelType, channelUserId, {
        type: 'image',
        step: 'awaiting_prompt',
        args: {},
      });
      return { text: '🖼️ What image do you want to create? Send your prompt text first.' };
    }

    sessionStore.setPendingWizard(channelType, channelUserId, {
      type: 'image',
      step: 'awaiting_model',
      prompt: normalizedPrompt,
      args: { prompt: normalizedPrompt },
    });

    return this.askImageModel(normalizedPrompt);
  }

  private startVideoWizard(
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    chatId: string,
    prompt: string
  ): ClawResponse {
    sessionStore.set({ firebaseUID, channelType, channelUserId, chatId });
    sessionStore.clearPendingConfirmation(channelType, channelUserId);

    const normalizedPrompt = this.normalizePrompt(prompt);
    if (!normalizedPrompt) {
      sessionStore.setPendingWizard(channelType, channelUserId, {
        type: 'video',
        step: 'awaiting_prompt',
        args: {},
      });
      return { text: '🎬 What video do you want to create? Send your prompt text first.' };
    }

    sessionStore.setPendingWizard(channelType, channelUserId, {
      type: 'video',
      step: 'awaiting_model',
      prompt: normalizedPrompt,
      args: { prompt: normalizedPrompt },
    });

    return this.askVideoModel(normalizedPrompt);
  }

  private startTemplateWizard(
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    chatId: string,
    preselectedSkillName?: string
  ): ClawResponse {
    sessionStore.set({ firebaseUID, channelType, channelUserId, chatId });
    sessionStore.clearPendingConfirmation(channelType, channelUserId);

    if (preselectedSkillName) {
      const preset = TEMPLATE_PRESETS.find((item) => item.id === preselectedSkillName);
      if (preset) {
        sessionStore.setPendingWizard(channelType, channelUserId, {
          type: 'template',
          step: 'awaiting_subject',
          templateId: preset.id,
          skillName: preset.mode === 'image' ? 'image-gen' : 'video-gen',
          args: {},
        });
        return { text: `✨ Template selected: *${preset.label}*\n\nWhat should be the subject?` };
      }
    }

    sessionStore.setPendingWizard(channelType, channelUserId, {
      type: 'template',
      step: 'awaiting_template',
      args: {},
    });
    return this.askTemplateChoice();
  }

  private startDirectorWizard(
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    chatId: string,
    brief: string
  ): ClawResponse {
    sessionStore.set({ firebaseUID, channelType, channelUserId, chatId });
    sessionStore.clearPendingConfirmation(channelType, channelUserId);

    const normalizedBrief = this.normalizePrompt(brief);

    sessionStore.setPendingWizard(channelType, channelUserId, {
      type: 'director',
      step: 'awaiting_goal',
      prompt: normalizedBrief || undefined,
      args: normalizedBrief ? { subject: normalizedBrief } : {},
    });

    return this.askDirectorGoal(normalizedBrief);
  }

  private startRemixWizard(
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    chatId: string,
    input: string
  ): ClawResponse {
    sessionStore.set({ firebaseUID, channelType, channelUserId, chatId });
    sessionStore.clearPendingConfirmation(channelType, channelUserId);

    const jobId = this.extractJobId(input);
    if (jobId) {
      sessionStore.setPendingWizard(channelType, channelUserId, {
        type: 'remix',
        step: 'awaiting_strength',
        args: { jobId },
      });
      return this.askRemixStrength(jobId);
    }

    sessionStore.setPendingWizard(channelType, channelUserId, {
      type: 'remix',
      step: 'awaiting_job_id',
      args: {},
      });
      return { text: '🔁 Send the Job ID you want to remix.\n\nExample: `abc123xyz`' };
  }

  private async handleImageWizardInput(
    input: string,
    wizard: PendingWizard,
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    _chatId: string
  ): Promise<ClawResponse> {
    if (wizard.step === 'awaiting_prompt') {
      const prompt = this.normalizePrompt(input);
      if (!prompt) {
        return { text: 'Please send a valid prompt text (or /cancel).' };
      }
      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_model',
        prompt,
        args: { ...wizard.args, prompt },
      });
      return this.askImageModel(prompt);
    }

    if (wizard.step === 'awaiting_model') {
      const model = this.pickObjectChoice(input, IMAGE_WIZARD_MODELS);
      if (!model) {
        return this.askImageModel(wizard.prompt ?? wizard.args['prompt'] ?? '');
      }

      const nextWizard: PendingWizard = {
        ...wizard,
        step: 'awaiting_aspect',
        selectedModelId: model.id,
        args: { ...wizard.args, model: model.id },
      };
      sessionStore.setPendingWizard(channelType, channelUserId, nextWizard);
      return this.askAspect(model.name, model.aspectOptions);
    }

    if (wizard.step === 'awaiting_aspect') {
      const model = wizard.selectedModelId ? findImageWizardModel(wizard.selectedModelId) : undefined;
      if (!model) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /image.' };
      }

      const aspect = this.pickStringChoice(input, model.aspectOptions);
      if (!aspect) {
        return this.askAspect(model.name, model.aspectOptions);
      }

      const updated: PendingWizard = {
        ...wizard,
        args: { ...wizard.args, aspect },
      };

      if (model.resolutionOptions.length > 0) {
        updated.step = 'awaiting_resolution';
        sessionStore.setPendingWizard(channelType, channelUserId, updated);
        return this.askResolution(model.name, model.resolutionOptions);
      }

      if (model.outputFormatOptions.length > 0) {
        updated.step = 'awaiting_output_format';
        sessionStore.setPendingWizard(channelType, channelUserId, updated);
        return this.askOutputFormat(model.name, model.outputFormatOptions);
      }

      updated.step = 'awaiting_confirm';
      sessionStore.setPendingWizard(channelType, channelUserId, updated);
      return this.askImageConfirm(updated.args, model.name);
    }

    if (wizard.step === 'awaiting_resolution') {
      const model = wizard.selectedModelId ? findImageWizardModel(wizard.selectedModelId) : undefined;
      if (!model) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /image.' };
      }

      const resolution = this.pickStringChoice(input, model.resolutionOptions);
      if (!resolution) {
        return this.askResolution(model.name, model.resolutionOptions);
      }

      const updated: PendingWizard = {
        ...wizard,
        args: { ...wizard.args, quality: resolution },
      };

      if (model.outputFormatOptions.length > 0) {
        updated.step = 'awaiting_output_format';
        sessionStore.setPendingWizard(channelType, channelUserId, updated);
        return this.askOutputFormat(model.name, model.outputFormatOptions);
      }

      updated.step = 'awaiting_confirm';
      sessionStore.setPendingWizard(channelType, channelUserId, updated);
      return this.askImageConfirm(updated.args, model.name);
    }

    if (wizard.step === 'awaiting_output_format') {
      const model = wizard.selectedModelId ? findImageWizardModel(wizard.selectedModelId) : undefined;
      if (!model) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /image.' };
      }

      const outputFormat = this.pickStringChoice(input, model.outputFormatOptions);
      if (!outputFormat) {
        return this.askOutputFormat(model.name, model.outputFormatOptions);
      }

      const updated: PendingWizard = {
        ...wizard,
        step: 'awaiting_confirm',
        args: { ...wizard.args, outputFormat },
      };
      sessionStore.setPendingWizard(channelType, channelUserId, updated);
      return this.askImageConfirm(updated.args, model.name);
    }

    if (wizard.step === 'awaiting_confirm') {
      const lower = input.toLowerCase().trim();
      if (CONFIRM_NO.some((w) => lower === w || lower.startsWith(`${w} `))) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '👍 Image generation cancelled.' };
      }
      if (!CONFIRM_YES.some((w) => lower === w || lower.startsWith(`${w} `))) {
        const modelName = wizard.selectedModelId
          ? (findImageWizardModel(wizard.selectedModelId)?.name ?? wizard.selectedModelId)
          : (wizard.args['model'] ?? 'Selected model');
        return this.askImageConfirm(wizard.args, modelName);
      }
      sessionStore.clearPendingWizard(channelType, channelUserId);
      const user: ClawUser = { firebaseUID, channelType, channelUserId, tokenBalance: 0 };
      return this.executeGuidedSkill('image-gen', wizard.args, user);
    }

    sessionStore.clearPendingWizard(channelType, channelUserId);
    return { text: '❌ Session expired. Start again with /image.' };
  }

  private async handleVideoWizardInput(
    input: string,
    wizard: PendingWizard,
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    _chatId: string
  ): Promise<ClawResponse> {
    if (wizard.step === 'awaiting_prompt') {
      const prompt = this.normalizePrompt(input);
      if (!prompt) return { text: 'Please send a valid prompt text (or /cancel).' };
      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_model',
        prompt,
        args: { ...wizard.args, prompt },
      });
      return this.askVideoModel(prompt);
    }

    if (wizard.step === 'awaiting_model') {
      const model = this.pickObjectChoice(input, VIDEO_WIZARD_MODELS);
      if (!model) return this.askVideoModel(wizard.prompt ?? wizard.args['prompt'] ?? '');
      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_aspect',
        selectedModelId: model.id,
        args: { ...wizard.args, model: model.id },
      });
      return this.askAspect(model.name, model.aspectOptions);
    }

    if (wizard.step === 'awaiting_aspect') {
      const model = wizard.selectedModelId ? findVideoWizardModel(wizard.selectedModelId) : undefined;
      if (!model) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /video.' };
      }
      const aspect = this.pickStringChoice(input, model.aspectOptions);
      if (!aspect) return this.askAspect(model.name, model.aspectOptions);

      const updated: PendingWizard = { ...wizard, args: { ...wizard.args, aspect } };

      if (model.durationOptions.length > 0 || model.durationRange) {
        updated.step = 'awaiting_duration';
        sessionStore.setPendingWizard(channelType, channelUserId, updated);
        return this.askDuration(model);
      }

      if (model.resolutionOptions.length > 0) {
        updated.step = 'awaiting_resolution';
        sessionStore.setPendingWizard(channelType, channelUserId, updated);
        return this.askResolution(model.name, model.resolutionOptions);
      }

      updated.step = 'awaiting_confirm';
      sessionStore.setPendingWizard(channelType, channelUserId, updated);
      return this.askVideoConfirm(updated.args, model.name);
    }

    if (wizard.step === 'awaiting_duration') {
      const model = wizard.selectedModelId ? findVideoWizardModel(wizard.selectedModelId) : undefined;
      if (!model) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /video.' };
      }

      const duration = this.pickDuration(input, model);
      if (!duration) return this.askDuration(model);

      const updated: PendingWizard = { ...wizard, args: { ...wizard.args, duration } };

      if (model.resolutionOptions.length > 0) {
        updated.step = 'awaiting_resolution';
        sessionStore.setPendingWizard(channelType, channelUserId, updated);
        return this.askResolution(model.name, model.resolutionOptions);
      }

      updated.step = 'awaiting_confirm';
      sessionStore.setPendingWizard(channelType, channelUserId, updated);
      return this.askVideoConfirm(updated.args, model.name);
    }

    if (wizard.step === 'awaiting_resolution') {
      const model = wizard.selectedModelId ? findVideoWizardModel(wizard.selectedModelId) : undefined;
      if (!model) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /video.' };
      }
      const resolution = this.pickStringChoice(input, model.resolutionOptions);
      if (!resolution) return this.askResolution(model.name, model.resolutionOptions);

      const updated: PendingWizard = {
        ...wizard,
        step: 'awaiting_confirm',
        args: { ...wizard.args, resolution },
      };
      sessionStore.setPendingWizard(channelType, channelUserId, updated);
      return this.askVideoConfirm(updated.args, model.name);
    }

    if (wizard.step === 'awaiting_confirm') {
      const lower = input.toLowerCase().trim();
      if (CONFIRM_NO.some((w) => lower === w || lower.startsWith(`${w} `))) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '👍 Video generation cancelled.' };
      }
      if (!CONFIRM_YES.some((w) => lower === w || lower.startsWith(`${w} `))) {
        const modelName = wizard.selectedModelId
          ? (findVideoWizardModel(wizard.selectedModelId)?.name ?? wizard.selectedModelId)
          : (wizard.args['model'] ?? 'Selected model');
        return this.askVideoConfirm(wizard.args, modelName);
      }
      sessionStore.clearPendingWizard(channelType, channelUserId);
      const user: ClawUser = { firebaseUID, channelType, channelUserId, tokenBalance: 0 };
      return this.executeGuidedSkill('video-gen', wizard.args, user);
    }

    sessionStore.clearPendingWizard(channelType, channelUserId);
    return { text: '❌ Session expired. Start again with /video.' };
  }

  private async handleTemplateWizardInput(
    input: string,
    wizard: PendingWizard,
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    _chatId: string
  ): Promise<ClawResponse> {
    if (wizard.step === 'awaiting_template') {
      const preset = this.pickObjectChoice(input, TEMPLATE_PRESETS);
      if (!preset) return this.askTemplateChoice();
      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_subject',
        templateId: preset.id,
        skillName: preset.mode === 'image' ? 'image-gen' : 'video-gen',
      });
      return { text: `✨ Template selected: *${preset.label}*\n\nWhat should be the subject?` };
    }

    if (wizard.step === 'awaiting_subject') {
      const subject = this.normalizePrompt(input);
      if (!subject) return { text: 'Please send the subject text (or /cancel).' };

      const preset = wizard.templateId ? findTemplatePreset(wizard.templateId) : undefined;
      if (!preset) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /template.' };
      }

      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_aspect',
        args: { ...wizard.args, subject },
      });
      return this.askAspect(preset.label, preset.aspectOptions);
    }

    if (wizard.step === 'awaiting_aspect') {
      const preset = wizard.templateId ? findTemplatePreset(wizard.templateId) : undefined;
      if (!preset) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /template.' };
      }

      const aspect = this.pickStringChoice(input, preset.aspectOptions);
      if (!aspect) return this.askAspect(preset.label, preset.aspectOptions);

      const updated: PendingWizard = {
        ...wizard,
        args: { ...wizard.args, aspect },
      };

      if (preset.mode === 'video') {
        updated.step = 'awaiting_duration';
        sessionStore.setPendingWizard(channelType, channelUserId, updated);
        return this.askResolution('Template video duration (seconds)', TEMPLATE_VIDEO_DURATION_OPTIONS);
      }

      updated.step = 'awaiting_confirm';
      sessionStore.setPendingWizard(channelType, channelUserId, updated);
      return this.askTemplateConfirm(updated.args, preset);
    }

    if (wizard.step === 'awaiting_duration') {
      const duration = this.pickStringChoice(input, TEMPLATE_VIDEO_DURATION_OPTIONS);
      if (!duration) return this.askResolution('Template video duration (seconds)', TEMPLATE_VIDEO_DURATION_OPTIONS);

      const preset = wizard.templateId ? findTemplatePreset(wizard.templateId) : undefined;
      if (!preset) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /template.' };
      }

      const updated: PendingWizard = {
        ...wizard,
        step: 'awaiting_confirm',
        args: { ...wizard.args, duration },
      };
      sessionStore.setPendingWizard(channelType, channelUserId, updated);
      return this.askTemplateConfirm(updated.args, preset);
    }

    if (wizard.step === 'awaiting_confirm') {
      const lower = input.toLowerCase().trim();
      if (CONFIRM_NO.some((w) => lower === w || lower.startsWith(`${w} `))) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '👍 Template generation cancelled.' };
      }
      if (!CONFIRM_YES.some((w) => lower === w || lower.startsWith(`${w} `))) {
        const preset = wizard.templateId ? findTemplatePreset(wizard.templateId) : undefined;
        if (!preset) {
          sessionStore.clearPendingWizard(channelType, channelUserId);
          return { text: '❌ Session expired. Start again with /template.' };
        }
        return this.askTemplateConfirm(wizard.args, preset);
      }

      const preset = wizard.templateId ? findTemplatePreset(wizard.templateId) : undefined;
      if (!preset) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '❌ Session expired. Start again with /template.' };
      }

      const subject = wizard.args['subject'] ?? '';
      const prompt = preset.buildPrompt(subject);
      const args: Record<string, string> = {
        prompt,
        model: preset.defaultModel,
        aspect: wizard.args['aspect'] ?? preset.aspectOptions[0] ?? '16:9',
      };
      if (wizard.args['duration']) {
        args['duration'] = wizard.args['duration'];
      }

      sessionStore.clearPendingWizard(channelType, channelUserId);
      const user: ClawUser = { firebaseUID, channelType, channelUserId, tokenBalance: 0 };
      const skillName = preset.mode === 'image' ? 'image-gen' : 'video-gen';
      return this.executeGuidedSkill(skillName, args, user);
    }

    sessionStore.clearPendingWizard(channelType, channelUserId);
    return { text: '❌ Session expired. Start again with /template.' };
  }

  private async handleDirectorWizardInput(
    input: string,
    wizard: PendingWizard,
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    _chatId: string
  ): Promise<ClawResponse> {
    if (wizard.step === 'awaiting_goal') {
      const goal = this.pickObjectChoice(input, DIRECTOR_GOALS);
      if (!goal) return this.askDirectorGoal(wizard.args['subject']);

      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_platform',
        args: { ...wizard.args, director_goal: goal.id },
      });
      return this.askDirectorPlatform(goal.label);
    }

    if (wizard.step === 'awaiting_platform') {
      const platform = this.pickObjectChoice(input, DIRECTOR_PLATFORMS);
      if (!platform) {
        const selectedGoal = wizard.args['director_goal'] ? findDirectorGoal(wizard.args['director_goal']) : undefined;
        return this.askDirectorPlatform(selectedGoal?.label ?? 'your campaign');
      }

      const nextWizard: PendingWizard = {
        ...wizard,
        args: { ...wizard.args, director_platform: platform.id },
      };

      if (!wizard.args['subject']) {
        nextWizard.step = 'awaiting_subject';
        sessionStore.setPendingWizard(channelType, channelUserId, nextWizard);
        return { text: `✍️ What is the subject or product for this ${platform.label} campaign?` };
      }

      nextWizard.step = 'awaiting_style';
      sessionStore.setPendingWizard(channelType, channelUserId, nextWizard);
      return this.askDirectorStyle(wizard.args['subject']);
    }

    if (wizard.step === 'awaiting_subject') {
      const subject = this.normalizePrompt(input);
      if (!subject) return { text: 'Please send the subject or product name (or /cancel).' };

      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_style',
        args: { ...wizard.args, subject },
      });
      return this.askDirectorStyle(subject);
    }

    if (wizard.step === 'awaiting_style') {
      const style = this.pickObjectChoice(input, DIRECTOR_STYLES);
      if (!style) {
        return this.askDirectorStyle(wizard.args['subject'] ?? 'your campaign');
      }

      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_variations',
        args: { ...wizard.args, director_style: style.id },
      });
      return this.askDirectorVariations();
    }

    if (wizard.step === 'awaiting_variations') {
      const variationCount = this.pickStringChoice(input, DIRECTOR_VARIATION_OPTIONS);
      if (!variationCount) return this.askDirectorVariations();

      const subject = wizard.args['subject'] ?? wizard.prompt ?? 'StudioX campaign';
      const blueprint = buildDirectorBlueprint({
        subject,
        goalId: wizard.args['director_goal'] ?? DIRECTOR_GOALS[0]!.id,
        platformId: wizard.args['director_platform'] ?? DIRECTOR_PLATFORMS[0]!.id,
        styleId: wizard.args['director_style'] ?? DIRECTOR_STYLES[0]!.id,
        variationCount: Number(variationCount),
      });

      const args: Record<string, string> = {
        ...wizard.args,
        prompt: blueprint.prompt,
        model: blueprint.model,
        aspect: blueprint.aspect,
        provider: blueprint.provider,
        director_goal: blueprint.campaign.goal ?? '',
        director_platform: blueprint.campaign.platform ?? '',
        director_style: blueprint.campaign.style ?? '',
        director_variations: String(blueprint.campaign.variationCount ?? variationCount),
        campaign_brief: blueprint.campaign.brief ?? subject,
      };

      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_confirm',
        args,
      });
      return this.askDirectorConfirm(args);
    }

    if (wizard.step === 'awaiting_confirm') {
      const lower = input.toLowerCase().trim();
      if (CONFIRM_NO.some((w) => lower === w || lower.startsWith(`${w} `))) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '👍 Director Mode cancelled.' };
      }
      if (!CONFIRM_YES.some((w) => lower === w || lower.startsWith(`${w} `))) {
        return this.askDirectorConfirm(wizard.args);
      }

      sessionStore.clearPendingWizard(channelType, channelUserId);
      const user: ClawUser = { firebaseUID, channelType, channelUserId, tokenBalance: 0 };
      return this.executeGuidedSkill('image-gen', wizard.args, user);
    }

    sessionStore.clearPendingWizard(channelType, channelUserId);
    return { text: '❌ Session expired. Start again with /director.' };
  }

  private async handleRemixWizardInput(
    input: string,
    wizard: PendingWizard,
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string,
    _chatId: string
  ): Promise<ClawResponse> {
    if (wizard.step === 'awaiting_job_id') {
      const jobId = this.extractJobId(input) ?? this.normalizePrompt(input);
      if (!jobId) return { text: 'Please send a valid Job ID (or /cancel).' };
      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_strength',
        args: { ...wizard.args, jobId },
      });
      return this.askRemixStrength(jobId);
    }

    if (wizard.step === 'awaiting_strength') {
      const strength = this.pickStringChoice(input, REMIX_STRENGTH_OPTIONS) ?? this.parseStrength(input);
      if (!strength) return this.askRemixStrength(wizard.args['jobId'] ?? '');
      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_remix_prompt',
        args: { ...wizard.args, strength },
      });
      return {
        text: '✍️ Optional: send a new direction prompt for remix.\n\nSend `skip` to keep original prompt.',
        selectionOptions: [{ label: 'Skip', value: 'skip', row: 0 }],
      };
    }

    if (wizard.step === 'awaiting_remix_prompt') {
      const normalized = input.trim();
      const withPrompt =
        normalized.toLowerCase() === 'skip'
          ? { ...wizard.args }
          : { ...wizard.args, prompt: this.normalizePrompt(normalized) || normalized };
      sessionStore.setPendingWizard(channelType, channelUserId, {
        ...wizard,
        step: 'awaiting_confirm',
        args: withPrompt,
      });
      return this.askRemixConfirm(withPrompt);
    }

    if (wizard.step === 'awaiting_confirm') {
      const lower = input.toLowerCase().trim();
      if (CONFIRM_NO.some((w) => lower === w || lower.startsWith(`${w} `))) {
        sessionStore.clearPendingWizard(channelType, channelUserId);
        return { text: '👍 Remix cancelled.' };
      }
      if (!CONFIRM_YES.some((w) => lower === w || lower.startsWith(`${w} `))) {
        return this.askRemixConfirm(wizard.args);
      }
      sessionStore.clearPendingWizard(channelType, channelUserId);
      const user: ClawUser = { firebaseUID, channelType, channelUserId, tokenBalance: 0 };
      return this.executeGuidedSkill('remix', wizard.args, user);
    }

    sessionStore.clearPendingWizard(channelType, channelUserId);
    return { text: '❌ Session expired. Start again with /remix.' };
  }

  private askImageModel(prompt: string): ClawResponse {
    return {
      text:
        `🖼️ *Image Wizard*\n\n` +
        `Prompt: ${prompt}\n\n` +
        `Choose image model (tap a button or reply with number):\n` +
        this.toNumberedList(IMAGE_WIZARD_MODELS.map((m) => `${m.name} \`${m.id}\``)) +
        `\n\nSend /cancel anytime.`,
      selectionOptions: this.buildIndexedSelectionOptions(IMAGE_WIZARD_MODELS.map((m) => m.name), 1),
    };
  }

  private askVideoModel(prompt: string): ClawResponse {
    return {
      text:
        `🎬 *Video Wizard*\n\n` +
        `Prompt: ${prompt}\n\n` +
        `Choose video model (tap a button or reply with number):\n` +
        this.toNumberedList(VIDEO_WIZARD_MODELS.map((m) => `${m.name} \`${m.id}\``)) +
        `\n\nSend /cancel anytime.`,
      selectionOptions: this.buildIndexedSelectionOptions(VIDEO_WIZARD_MODELS.map((m) => m.name), 1),
    };
  }

  private askDirectorGoal(brief?: string): ClawResponse {
    return {
      text:
        `🎯 *Director Mode*\n\n` +
        `${brief ? `Brief: ${brief}\n\n` : ''}` +
        `What are we making?\n` +
        this.toNumberedList(DIRECTOR_GOALS.map((goal) => goal.label)),
      selectionOptions: this.buildIndexedSelectionOptions(DIRECTOR_GOALS.map((goal) => goal.label), 2),
    };
  }

  private askDirectorPlatform(goalLabel: string): ClawResponse {
    return {
      text:
        `📍 *${goalLabel}*\n\n` +
        `Where should this campaign land first?\n` +
        this.toNumberedList(DIRECTOR_PLATFORMS.map((platform) => `${platform.label} (${platform.aspect})`)),
      selectionOptions: this.buildIndexedSelectionOptions(
        DIRECTOR_PLATFORMS.map((platform) => `${platform.label} (${platform.aspect})`),
        2
      ),
    };
  }

  private askDirectorStyle(subject: string): ClawResponse {
    return {
      text:
        `🎨 *Creative Direction*\n\n` +
        `Subject: ${subject}\n\n` +
        `Pick the visual style:\n` +
        this.toNumberedList(DIRECTOR_STYLES.map((style) => style.label)),
      selectionOptions: this.buildIndexedSelectionOptions(DIRECTOR_STYLES.map((style) => style.label), 2),
    };
  }

  private askDirectorVariations(): ClawResponse {
    return {
      text:
        `🧪 *Concept Count*\n\n` +
        `How many campaign concepts should Director Mode plan for?\n` +
        this.toNumberedList(DIRECTOR_VARIATION_OPTIONS),
      selectionOptions: this.buildIndexedSelectionOptions(DIRECTOR_VARIATION_OPTIONS, 3),
    };
  }

  private askTemplateChoice(): ClawResponse {
    return {
      text:
        `✨ *Template Wizard*\n\n` +
        `Choose template (tap a button or reply with number):\n` +
        this.toNumberedList(TEMPLATE_PRESETS.map((t) => `${t.label} (${t.mode})`)) +
        `\n\nSend /cancel anytime.`,
      selectionOptions: this.buildIndexedSelectionOptions(TEMPLATE_PRESETS.map((t) => `${t.label} (${t.mode})`), 1),
    };
  }

  private askAspect(modelName: string, options: string[]): ClawResponse {
    return {
      text:
        `📐 *${modelName}*\n` +
        `Choose aspect ratio (tap a button or reply with number):\n` +
        this.toNumberedList(options),
      selectionOptions: this.buildIndexedSelectionOptions(options, 2),
    };
  }

  private askResolution(modelName: string, options: string[]): ClawResponse {
    return {
      text:
        `⚙️ *${modelName}*\n` +
        `Choose option (tap a button or reply with number):\n` +
        this.toNumberedList(options),
      selectionOptions: this.buildIndexedSelectionOptions(options, 2),
    };
  }

  private askOutputFormat(modelName: string, options: string[]): ClawResponse {
    return {
      text:
        `🧾 *${modelName}*\n` +
        `Choose output format (tap a button or reply with number):\n` +
        this.toNumberedList(options),
      selectionOptions: this.buildIndexedSelectionOptions(options, 2),
    };
  }

  private askDuration(model: WizardVideoModel): ClawResponse {
    if (model.durationOptions.length > 0) {
      return {
        text:
          `⏱ *${model.name}*\n` +
          `Choose duration in seconds (tap a button or reply with number):\n` +
          this.toNumberedList(model.durationOptions),
        selectionOptions: this.buildIndexedSelectionOptions(
          model.durationOptions.map((value) => `${value}s`),
          2
        ),
      };
    }

    const range = model.durationRange;
    if (range) {
      return { text: `⏱ *${model.name}*\nSend duration in seconds (${range.min}-${range.max}).` };
    }

    return { text: `⏱ *${model.name}*\nSend duration in seconds.` };
  }

  private askImageConfirm(args: Record<string, string>, modelName: string): ClawResponse {
    return {
      text:
        `✅ *Confirm Image Generation*\n\n` +
        `Prompt: ${args['prompt'] ?? ''}\n` +
        `Model: ${modelName}\n` +
        `Aspect: ${args['aspect'] ?? '1:1'}\n` +
        `Resolution: ${args['quality'] ?? 'Default'}\n` +
        `Format: ${args['outputFormat'] ?? 'Default'}\n\n` +
        `Tap a button below or reply *1* to generate or *2* to cancel.`,
      selectionOptions: this.buildConfirmOptions('Generate'),
    };
  }

  private askVideoConfirm(args: Record<string, string>, modelName: string): ClawResponse {
    return {
      text:
        `✅ *Confirm Video Generation*\n\n` +
        `Prompt: ${args['prompt'] ?? ''}\n` +
        `Model: ${modelName}\n` +
        `Aspect: ${args['aspect'] ?? '16:9'}\n` +
        `Duration: ${args['duration'] ?? 'Default'} sec\n` +
        `Resolution: ${args['resolution'] ?? 'Default'}\n\n` +
        `Tap a button below or reply *1* to generate or *2* to cancel.`,
      selectionOptions: this.buildConfirmOptions('Generate'),
    };
  }

  private askDirectorConfirm(args: Record<string, string>): ClawResponse {
    return {
      text:
        `✅ *Confirm Director Plan*\n\n` +
        `Goal: ${args['director_goal'] ?? 'Campaign'}\n` +
        `Platform: ${args['director_platform'] ?? 'Multi-platform'}\n` +
        `Style: ${args['director_style'] ?? 'Original'}\n` +
        `Concepts: ${args['director_variations'] ?? '1'}\n` +
        `Provider: ${args['provider'] ?? 'poyo'}\n` +
        `Model: ${args['model'] ?? 'Auto'}\n` +
        `Aspect: ${args['aspect'] ?? '1:1'}\n` +
        `Brief: ${args['campaign_brief'] ?? args['subject'] ?? ''}\n\n` +
        `Tap a button below or reply *1* to generate the hero concept or *2* to cancel.`,
      selectionOptions: this.buildConfirmOptions('Generate'),
    };
  }

  private askTemplateConfirm(args: Record<string, string>, preset: WizardTemplatePreset): ClawResponse {
    return {
      text:
        `✅ *Confirm Template*\n\n` +
        `Template: ${preset.label}\n` +
        `Mode: ${preset.mode}\n` +
        `Subject: ${args['subject'] ?? ''}\n` +
        `Model: ${preset.defaultModel}\n` +
        `Aspect: ${args['aspect'] ?? (preset.aspectOptions[0] ?? '16:9')}\n` +
        `${preset.mode === 'video' ? `Duration: ${args['duration'] ?? '5'} sec\n` : ''}` +
        `\nTap a button below or reply *1* to generate or *2* to cancel.`,
      selectionOptions: this.buildConfirmOptions('Generate'),
    };
  }

  private askRemixStrength(jobId: string): ClawResponse {
    return {
      text:
        `🔁 Remix job: \`${jobId}\`\n\n` +
        `Choose remix strength (tap a button or reply with number):\n` +
        this.toNumberedList(REMIX_STRENGTH_OPTIONS),
      selectionOptions: this.buildIndexedSelectionOptions(REMIX_STRENGTH_OPTIONS, 2),
    };
  }

  private askRemixConfirm(args: Record<string, string>): ClawResponse {
    return {
      text:
        `✅ *Confirm Remix*\n\n` +
        `Job ID: ${args['jobId'] ?? ''}\n` +
        `Strength: ${args['strength'] ?? '0.7'}\n` +
        `Direction: ${args['prompt'] ?? 'Keep original'}\n\n` +
        `Tap a button below or reply *1* to remix or *2* to cancel.`,
      selectionOptions: this.buildConfirmOptions('Remix'),
    };
  }

  private async executeGuidedSkill(skillName: string, args: Record<string, string>, user: ClawUser): Promise<ClawResponse> {
    const memory = await getMemory(user.firebaseUID);
    const finalArgs = { ...args };
    if (finalArgs['prompt']) {
      finalArgs['prompt'] = injectMemoryIntoPrompt(finalArgs['prompt'], memory);
    }
    if (!finalArgs['aspect'] && memory.preferredAspect) {
      finalArgs['aspect'] = memory.preferredAspect;
    }
    return this.executeSkill(skillName, finalArgs, { ...user, memory });
  }

  private pickObjectChoice<T extends { id: string }>(input: string, options: T[]): T | undefined {
    const idx = this.parseIndex(input);
    if (idx !== undefined) {
      return options[idx];
    }
    const lower = input.trim().toLowerCase();
    return options.find((opt) => {
      const asNamed = opt as T & { name?: string; label?: string };
      return (
        opt.id.toLowerCase() === lower ||
        (asNamed.name?.toLowerCase() === lower) ||
        (asNamed.label?.toLowerCase() === lower)
      );
    });
  }

  private pickStringChoice(input: string, options: string[]): string | undefined {
    const idx = this.parseIndex(input);
    if (idx !== undefined) {
      return options[idx];
    }
    const lower = input.trim().toLowerCase();
    return options.find((opt) => opt.toLowerCase() === lower);
  }

  private parseIndex(input: string): number | undefined {
    const n = Number.parseInt(input.trim(), 10);
    if (Number.isNaN(n)) return undefined;
    if (n < 1) return undefined;
    return n - 1;
  }

  private pickDuration(input: string, model: WizardVideoModel): string | undefined {
    if (model.durationOptions.length > 0) {
      return this.pickStringChoice(input, model.durationOptions);
    }

    const maybeDuration = Number.parseInt(input.trim(), 10);
    if (Number.isNaN(maybeDuration)) return undefined;
    if (!model.durationRange) return maybeDuration.toString();
    if (maybeDuration < model.durationRange.min || maybeDuration > model.durationRange.max) return undefined;
    return maybeDuration.toString();
  }

  private parseStrength(input: string): string | undefined {
    const parsed = Number.parseFloat(input.trim());
    if (Number.isNaN(parsed)) return undefined;
    if (parsed < 0.1 || parsed > 1) return undefined;
    return parsed.toFixed(1);
  }

  private toNumberedList(options: string[]): string {
    return options.map((value, idx) => `${idx + 1}. ${value}`).join('\n');
  }

  private buildIndexedSelectionOptions(labels: string[], columns: number): SelectionOption[] {
    const safeColumns = Math.max(1, columns);
    return labels.map((label, idx) => ({
      label,
      value: String(idx + 1),
      row: Math.floor(idx / safeColumns),
    }));
  }

  private buildConfirmOptions(primaryLabel: string): SelectionOption[] {
    return [
      { label: `✅ ${primaryLabel}`, value: '1', row: 0 },
      { label: '✖️ Cancel', value: '2', row: 0 },
    ];
  }

  private extractPromptFromCommand(text: string, command: string): string {
    const trimmed = text.trim();
    if (!trimmed.toLowerCase().startsWith(command.toLowerCase())) return '';
    return this.normalizePrompt(trimmed.slice(command.length).trim());
  }

  private extractJobId(text: string): string | undefined {
    const match = text.match(/job:([A-Za-z0-9_-]+)/i);
    return match?.[1];
  }

  private hasJobReference(text: string): boolean {
    return /job:[A-Za-z0-9_-]+/i.test(text);
  }

  private normalizePrompt(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private looksLikeImagePrompt(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('image of') ||
      lower.includes('photo of') ||
      lower.startsWith('create image') ||
      lower.startsWith('create an image') ||
      lower.startsWith('create a photo') ||
      lower.startsWith('generate image') ||
      lower.startsWith('generate an image') ||
      lower.startsWith('make an image') ||
      lower.startsWith('/imagine')
    );
  }

  private looksLikeVideoPrompt(text: string): boolean {
    const lower = text.toLowerCase();
    return (
      lower.includes('video of') ||
      lower.startsWith('create video') ||
      lower.startsWith('create a video') ||
      lower.startsWith('generate video') ||
      lower.startsWith('generate a video') ||
      lower.startsWith('cinematic video') ||
      lower.startsWith('animate ')
    );
  }

  private extractNaturalPrompt(text: string, mode: 'image' | 'video'): string {
    const patterns =
      mode === 'image'
        ? [
            /^\/imagine\s+/i,
            /^create (an )?image( of)?\s+/i,
            /^create (a )?photo( of)?\s+/i,
            /^generate (an )?image( of)?\s+/i,
            /^make (an )?image( of)?\s+/i,
            /^make (a )?photo( of)?\s+/i,
            /^image of\s+/i,
            /^photo of\s+/i,
          ]
        : [
            /^create (a )?video( of)?\s+/i,
            /^generate (a )?video( of)?\s+/i,
            /^video of\s+/i,
            /^cinematic video( of)?\s+/i,
            /^animate\s+/i,
          ];

    let prompt = text.trim();
    for (const re of patterns) {
      prompt = prompt.replace(re, '').trim();
    }
    return this.normalizePrompt(prompt);
  }

  private isCancelText(text: string): boolean {
    const lower = text.trim().toLowerCase();
    return lower === '/cancel' || lower === 'cancel' || lower === 'stop' || lower === 'exit';
  }

  private async handlePair(channelType: ChannelType, channelUserId: string, chatId: string): Promise<ClawResponse> {
    const { pairingService } = await import('../pairing/pairing-service.js');
    const code = await pairingService.createCode(channelType, channelUserId, chatId);
    return {
      text:
        `🦞 Your pairing code is:\n\n` +
        `*${code}*\n\n` +
        `Go to ${studioUrl('/claw/pair')} and enter this code to link your account.\n\n` +
        `⏰ Expires in 10 minutes.`,
      pairingCode: code,
    };
  }

  private async handleCredits(firebaseUID: string | null): Promise<ClawResponse> {
    if (!firebaseUID) {
      return { text: '❌ Not paired yet. Run /pair to link your StudioX account.' };
    }

    let balance: number | null = null;
    try {
      const db = getDb();
      const userDoc = await db.collection('users').doc(firebaseUID).get();
      if (userDoc.exists) {
        balance = (userDoc.data()?.['tokenBalance'] as number) ?? 0;
      }
    } catch {
      // Firebase unavailable — fall through to fallback message
    }

    const memory = await getMemory(firebaseUID);

    if (balance !== null) {
      return {
        text:
          `💰 *Credit Balance*\n\n` +
          `Available: *${balance} credits*\n` +
          `Generations so far: ${memory.generationCount}\n\n` +
          `Top up anytime at ${studioUrl('/pricing')} 💳\n\n` +
          `Use /help to see what you can create!`,
        quickActions: [
          { label: '💳 Top Up', url: studioUrl('/pricing'), row: 0 },
          { label: '🖼️ Image', action: 'command', jobId: '/image', row: 0 },
          { label: '🎬 Video', action: 'command', jobId: '/video', row: 0 },
        ],
      };
    }

    return {
      text:
        `💰 *Credit Balance*\n\n` +
        `Generations so far: ${memory.generationCount}\n\n` +
        `Could not fetch your live balance right now. Check ${studioUrl('/studio')} for details.\n\n` +
        `Use /help to see what you can create!`,
    };
  }

  private handleHelp(): ClawResponse {
    return {
      text:
        `🦞 *StudioX Claw Commands*\n\n` +
        `*Guided Creation (Recommended):*\n` +
        `/image [prompt] — guided image wizard\n` +
        `/video [prompt] — guided video wizard\n` +
        `/template — guided template wizard\n` +
        `/remix [jobId] — guided remix wizard\n` +
        `/director [brief] — campaign director mode\n\n` +
        `*Manage:*\n` +
        `/credits — check balance\n` +
        `/pair — link account\n` +
        `/help — show this message\n\n` +
        `You can also type natural prompts like "create an image of a tiger".`,
    };
  }

  private handleStart(isPaired: boolean): ClawResponse {
    if (isPaired) {
      return {
        text:
          `🦞 Welcome back to StudioX Claw!\n\n` +
          `Try:\n` +
          `• /image cinematic tiger portrait\n` +
          `• /video neon city drone shot\n` +
          `• /template\n` +
          `• /director launch ad for cold brew bottle\n\n` +
          `I will ask follow-up options (model, aspect, etc.) just like Studio.`,
      };
    }
    return {
      text: `🦞 Welcome to StudioX Claw!\n\nI'm your AI creative assistant in Telegram.\n\nFirst, link your StudioX account with /pair.`,
    };
  }

  private async executeConfirmed(
    pending: { skillName: string; args: Record<string, string>; cost: number; prompt: string },
    firebaseUID: string,
    channelType: ChannelType,
    channelUserId: string
  ): Promise<ClawResponse> {
    sessionStore.clearPendingConfirmation(channelType, channelUserId);
    const skill = skillRegistry.get(pending.skillName);
    if (!skill) return { text: '❌ Skill not found. Please try again.' };
    const user: ClawUser = { firebaseUID, channelType, channelUserId, tokenBalance: 0 };
    return this.executeSkill(skill.name, pending.args, user);
  }

  private buildCampaignMeta(args: Record<string, string>) {
    if (!args['director_goal'] && !args['director_platform'] && !args['director_style'] && !args['campaign_brief']) {
      return undefined;
    }

    return {
      directed: true,
      goal: args['director_goal'],
      platform: args['director_platform'],
      style: args['director_style'],
      variationCount: args['director_variations'] ? Number(args['director_variations']) : undefined,
      brief: args['campaign_brief'] ?? args['prompt'],
    };
  }

  private inferLineage(args: Record<string, string>) {
    if (args['jobId']) {
      const source = generationStore.get(args['jobId']);
      return {
        parentCreationId: source?.taskId ?? source?.jobId ?? args['jobId'],
        rootCreationId: source?.rootCreationId ?? source?.taskId ?? source?.jobId ?? args['jobId'],
        remixDepth: (source?.remixDepth ?? 0) + 1,
        sourcePostId: source?.sourcePostId,
      };
    }

    if (args['originalCreationId']) {
      return {
        parentCreationId: args['originalCreationId'],
        rootCreationId: args['rootCreationId'] ?? args['originalCreationId'],
        remixDepth: args['remixDepth'] ? Number(args['remixDepth']) : 1,
        sourcePostId: args['sourcePostId'],
      };
    }

    return {
      parentCreationId: undefined,
      rootCreationId: undefined,
      remixDepth: 0,
      sourcePostId: undefined,
    };
  }

  private buildExportPackUrl(
    assetUrl: string,
    mediaType: 'image' | 'video' | undefined,
    jobId: string | undefined,
    args: Record<string, string>,
    platform?: 'poyo' | 'apimart'
  ): string {
    const params = new URLSearchParams();
    params.set('assetUrl', assetUrl);
    params.set('type', mediaType ?? 'image');
    params.set('title', args['campaign_brief'] ?? args['prompt'] ?? 'StudioX Export');
    if (args['prompt']) params.set('prompt', args['prompt']);
    if (args['model']) params.set('model', args['model']);
    if (args['aspect']) params.set('aspect', args['aspect']);
    if (jobId) params.set('creationId', jobId);
    if (platform) params.set('generationPlatform', platform);
    if (args['director_goal']) params.set('campaignGoal', args['director_goal']);
    if (args['director_platform']) params.set('campaignPlatform', args['director_platform']);
    if (args['director_style']) params.set('campaignStyle', args['director_style']);
    if (args['director_variations']) params.set('campaignVariationCount', args['director_variations']);
    if (args['campaign_brief']) params.set('campaignBrief', args['campaign_brief']);
    if (args['director_goal'] || args['campaign_brief']) {
      params.set('campaignDirected', '1');
      params.set('autoDownload', '1');
    }
    return studioUrl(`/export-pack?${params.toString()}`);
  }

  private async executeSkill(skillName: string, args: Record<string, string>, user: ClawUser): Promise<ClawResponse> {
    const skill = skillRegistry.get(skillName);
    if (!skill) return { text: '❌ Skill not found.' };

    const result = await skillExecutor.execute(skill, args, user);

    if (result.status === 'insufficient_credits') {
      return {
        text:
          `❌ Not enough credits!\n\n` +
          `Need: ${result.needed} credits\n` +
          `Available: ${result.available} credits\n\n` +
          `Top up at ${studioUrl('/pricing')} 💳`,
      };
    }

    if (result.status === 'failed') {
      return { text: `❌ Generation failed: ${result.error ?? 'Unknown error'}. Please try again.` };
    }

    if (result.status === 'timeout') {
      return { text: `⏱ Generation timed out. Your job (${result.jobId}) may still be processing. Check ${studioUrl('/studio')}` };
    }

    const creditLine = `\n\n💰 ${result.creditsUsed} credits used | Balance: ${result.balanceRemaining} credits`;

    if (user.firebaseUID) {
      const memory = await getMemory(user.firebaseUID);
      await updateMemory(user.firebaseUID, {
        generationCount: memory.generationCount + 1,
        preferredModel: args['model'] ?? memory.preferredModel,
        preferredAspect: args['aspect'] ?? memory.preferredAspect,
      });
      await addDailyNote(user.firebaseUID, `Generated: ${args['prompt'] ?? skillName}`);
    }

    const campaign = this.buildCampaignMeta(args);
    const lineage = this.inferLineage(args);
    const generationPlatform = result.platform ?? ((args['provider'] as 'poyo' | 'apimart' | undefined) ?? 'poyo');

    if (result.jobId && result.assetUrl && result.mediaType) {
      generationStore.set({
        jobId: result.jobId,
        firebaseUID: user.firebaseUID,
        channelType: user.channelType,
        channelUserId: user.channelUserId,
        chatId: user.channelUserId,
        prompt: args['prompt'] ?? skillName,
        model: args['model'],
        aspect: args['aspect'],
        mediaType: result.mediaType,
        mediaUrl: result.assetUrl,
        generationPlatform,
        taskId: result.jobId,
        parentCreationId: lineage.parentCreationId,
        rootCreationId: lineage.rootCreationId,
        remixDepth: lineage.remixDepth,
        sourcePostId: lineage.sourcePostId,
        campaign,
      });
    }

    const exportPackUrl =
      result.assetUrl && result.mediaType
        ? this.buildExportPackUrl(result.assetUrl, result.mediaType, result.jobId, args, generationPlatform)
        : undefined;

    const completionPrefix = campaign?.directed ? '✅ Director hero concept ready!' : '✅ Done!';
    const exportLabel = campaign?.directed ? '📦 Director Pack' : '📦 Export Pack';

    return {
      text: `${completionPrefix}${creditLine}\n\nUse the buttons below to download, share, export, remix, or publish this creation.`,
      mediaUrl: result.assetUrl,
      mediaType: result.mediaType,
      quickActions: [
        { label: '⬇️ Download', url: result.assetUrl, jobId: result.jobId, row: 0 },
        { label: '📣 Share', action: 'share', jobId: result.jobId, row: 0 },
        ...(exportPackUrl ? [{ label: exportLabel, url: exportPackUrl, jobId: result.jobId, row: 1 }] : []),
        { label: '🌍 Community', action: 'post', jobId: result.jobId, row: 1 },
        { label: '🔄 Remix', action: 'remix', jobId: result.jobId, row: 2 },
        { label: '🎲 Again', action: 'again', jobId: result.jobId, row: 2 },
        { label: '💾 Studio', url: studioUrl('/studio'), jobId: result.jobId, row: 3 },
      ],
    };
  }

  private extractArgs(text: string, triggers: string[]): Record<string, string> {
    let prompt = text;
    for (const trigger of triggers) {
      const re = new RegExp(trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      prompt = prompt.replace(re, '').trim();
    }

    const modelMatch = prompt.match(/(?:using|with|model:)\s*([\w-/.]+)/i);
    const model = modelMatch?.[1];
    if (model) prompt = prompt.replace(modelMatch[0], '').trim();

    const aspectMatch = prompt.match(/\b(\d+:\d+)\b/);
    const aspect = aspectMatch?.[1];
    if (aspect) prompt = prompt.replace(aspect, '').trim();

    prompt = prompt.replace(/\s+/g, ' ').trim();
    return {
      prompt: prompt || text,
      ...(model ? { model } : {}),
      ...(aspect ? { aspect } : {}),
    };
  }

  private estimateCost(skill: { cost_estimate: string }): number {
    const match = skill.cost_estimate.match(/(\d+)/);
    return match ? parseInt(match[1] ?? '5', 10) : 5;
  }
}

export const agentCore = new AgentCore();
