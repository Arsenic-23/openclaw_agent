import { agentCore } from './agent/core.js';
import type { BaseChannel } from './channels/base.js';
import { studioUrl } from './config.js';
import { pairingService } from './pairing/pairing-service.js';
import type { ClawMessage } from './types/index.js';

export class GatewayServer {
  private channels: BaseChannel[] = [];

  registerChannel(channel: BaseChannel): void {
    channel.setMessageHandler(async (message: ClawMessage) => {
      await this.routeMessage(message, channel);
    });
    this.channels.push(channel);
  }

  async routeMessage(message: ClawMessage, channel: BaseChannel): Promise<void> {
    try {
      const response = await agentCore.handle(message);
      await channel.send(message.chatId, response);

      if (response.pairingCode) {
        pairingService.listenForApproval(response.pairingCode, async () => {
          try {
            await channel.send(
              message.chatId,
              {
                text:
                  '✅ Your StudioX account is linked successfully.\n\n' +
                  'You can start now with a tap below or type /help for all commands.',
                quickActions: [
                  { label: '🖼️ Image Wizard', action: 'command', jobId: '/image', row: 0 },
                  { label: '🎬 Video Wizard', action: 'command', jobId: '/video', row: 0 },
                  { label: '🎛️ Director', action: 'command', jobId: '/director', row: 1 },
                  { label: '🧩 Template', action: 'command', jobId: '/template', row: 1 },
                  { label: '🌍 Community', url: studioUrl('/community'), row: 2 },
                  { label: '🦞 Claw Hub', url: studioUrl('/claw/hub'), row: 2 },
                ],
              }
            );
          } catch (sendError) {
            console.error('Failed to send Telegram pairing confirmation:', sendError);
          }
        });
      }
    } catch (err) {
      console.error('Error routing message:', err);
      try {
        await channel.sendText(
          message.chatId,
          '❌ Something went wrong. Please try again.'
        );
      } catch {
        
      }
    }
  }

  async startAll(): Promise<void> {
    for (const channel of this.channels) {
      await channel.start();
    }
  }

  async stopAll(): Promise<void> {
    for (const channel of this.channels) {
      await channel.stop();
    }
  }
}

export const gateway = new GatewayServer();
