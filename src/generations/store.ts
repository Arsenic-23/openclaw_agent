import type { CampaignMeta, ChannelType, GenerationPlatform, MediaType } from '../types/index.js';

const GENERATION_TTL_MS = 24 * 60 * 60 * 1000;

export interface GenerationRecord {
  jobId: string;
  firebaseUID: string;
  channelType: ChannelType;
  channelUserId: string;
  chatId: string;
  prompt: string;
  model?: string;
  aspect?: string;
  mediaType: MediaType;
  mediaUrl: string;
  generationPlatform?: GenerationPlatform;
  taskId?: string;
  parentCreationId?: string;
  rootCreationId?: string;
  remixDepth?: number;
  sourcePostId?: string;
  campaign?: CampaignMeta;
  createdAt: number;
}

class GenerationStore {
  private readonly records = new Map<string, GenerationRecord>();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 30 * 60 * 1000);
  }

  set(record: Omit<GenerationRecord, 'createdAt'>): void {
    this.records.set(record.jobId, { ...record, createdAt: Date.now() });
  }

  get(jobId: string): GenerationRecord | undefined {
    const record = this.records.get(jobId);
    if (!record) return undefined;
    if (Date.now() - record.createdAt > GENERATION_TTL_MS) {
      this.records.delete(jobId);
      return undefined;
    }
    return record;
  }

  delete(jobId: string): void {
    this.records.delete(jobId);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.records.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [jobId, record] of this.records.entries()) {
      if (now - record.createdAt > GENERATION_TTL_MS) {
        this.records.delete(jobId);
      }
    }
  }
}

export const generationStore = new GenerationStore();
