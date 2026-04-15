import type { ChannelType } from '../types/index.js';

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export type WizardType = 'image' | 'video' | 'template' | 'remix' | 'director';

export interface PendingWizard {
  type: WizardType;
  step:
    | 'awaiting_prompt'
    | 'awaiting_model'
    | 'awaiting_aspect'
    | 'awaiting_resolution'
    | 'awaiting_output_format'
    | 'awaiting_duration'
    | 'awaiting_template'
    | 'awaiting_subject'
    | 'awaiting_goal'
    | 'awaiting_platform'
    | 'awaiting_style'
    | 'awaiting_variations'
    | 'awaiting_job_id'
    | 'awaiting_strength'
    | 'awaiting_remix_prompt'
    | 'awaiting_confirm';
  prompt?: string;
  skillName?: string;
  args: Record<string, string>;
  templateId?: string;
  selectedModelId?: string;
}

interface Session {
  firebaseUID: string;
  channelType: ChannelType;
  channelUserId: string;
  chatId: string;
  lastActive: number;
  pendingConfirmation?: {
    skillName: string;
    args: Record<string, string>;
    cost: number;
    prompt: string;
  };
  pendingWizard?: PendingWizard;
}

class SessionStore {
  private sessions = new Map<string, Session>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Cleanup expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private key(channelType: ChannelType, channelUserId: string): string {
    return `${channelType}:${channelUserId}`;
  }

  get(channelType: ChannelType, channelUserId: string): Session | undefined {
    const k = this.key(channelType, channelUserId);
    const session = this.sessions.get(k);
    if (!session) return undefined;

    if (Date.now() - session.lastActive > SESSION_TTL_MS) {
      this.sessions.delete(k);
      return undefined;
    }

    session.lastActive = Date.now();
    return session;
  }

  set(session: Omit<Session, 'lastActive'>): void {
    const k = this.key(session.channelType, session.channelUserId);
    this.sessions.set(k, { ...session, lastActive: Date.now() });
  }

  delete(channelType: ChannelType, channelUserId: string): void {
    this.sessions.delete(this.key(channelType, channelUserId));
  }

  setPendingConfirmation(
    channelType: ChannelType,
    channelUserId: string,
    confirmation: NonNullable<Session['pendingConfirmation']>
  ): void {
    const session = this.get(channelType, channelUserId);
    if (session) {
      (session as { pendingConfirmation?: Session['pendingConfirmation'] }).pendingConfirmation = confirmation;
    }
  }

  clearPendingConfirmation(channelType: ChannelType, channelUserId: string): void {
    const session = this.get(channelType, channelUserId);
    if (session) {
      delete (session as { pendingConfirmation?: Session['pendingConfirmation'] }).pendingConfirmation;
    }
  }

  setPendingWizard(
    channelType: ChannelType,
    channelUserId: string,
    wizard: PendingWizard
  ): void {
    const session = this.get(channelType, channelUserId);
    if (session) {
      (session as { pendingWizard?: PendingWizard }).pendingWizard = wizard;
    }
  }

  clearPendingWizard(channelType: ChannelType, channelUserId: string): void {
    const session = this.get(channelType, channelUserId);
    if (session) {
      delete (session as { pendingWizard?: PendingWizard }).pendingWizard;
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastActive > SESSION_TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
  }
}

export const sessionStore = new SessionStore();
