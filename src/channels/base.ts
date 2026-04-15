import type { ClawMessage, ClawResponse, ChannelType } from '../types/index.js';

export type MessageHandler = (message: ClawMessage) => Promise<void>;

export abstract class BaseChannel {
  abstract readonly channelType: ChannelType;
  protected onMessage?: MessageHandler;

  setMessageHandler(handler: MessageHandler): void {
    this.onMessage = handler;
  }

  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(chatId: string, response: ClawResponse): Promise<void>;
  abstract sendText(chatId: string, text: string): Promise<void>;
}
