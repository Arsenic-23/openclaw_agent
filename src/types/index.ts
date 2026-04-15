export type ChannelType = 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'web-chat';
export type AgentRole = 'creative' | 'social' | 'admin';
export type MediaType = 'image' | 'video';
export type GenerationPlatform = 'poyo' | 'apimart';
export type ModelProvider = GenerationPlatform;

export interface ModelConfig {
  id: string;
  name: string;
  type: 'image' | 'video';
  provider: ModelProvider;
  cost: number;
  description: string;
  supportsRefImage: boolean;
  requiresRefImage: boolean;
  aspects: string[];
  qualities: string[];
  defaultAspect: string;
  defaultQuality: string;
  durationRange?: [number, number];
  defaultDuration?: number;
  maxBatch?: number;
  icon: string;
}

export interface GenerationSession {
  skillName: string;
  prompt: string;
  model: string;
  aspect: string;
  quality: string;
  duration?: number;
  referenceImageUrl?: string;
  step: 'prompt' | 'model' | 'options' | 'confirm';
  args: Record<string, string>;
}

export interface CampaignMeta {
  directed?: boolean;
  goal?: string;
  platform?: string;
  style?: string;
  variationCount?: number;
  brief?: string;
}

export interface ClawMessage {
  channelType: ChannelType;
  channelUserId: string;
  chatId: string;
  text: string;
  attachmentUrl?: string;
  messageId?: string;
}

export interface ClawUser {
  firebaseUID: string;
  channelType: ChannelType;
  channelUserId: string;
  tokenBalance: number;
  memory?: UserMemorySnapshot;
}

export interface UserMemorySnapshot {
  preferredModel: string;
  preferredAspect: string;
  preferredQuality: string;
  promptStyle: string;
  favoriteTemplates: string[];
}

export interface SkillArg {
  name: string;
  required: boolean;
  default?: string;
  description?: string;
}

export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  author: string;
  triggers: string[];
  args: SkillArg[];
  cost_estimate: string;
  channels: ChannelType[];
  agent: AgentRole;
  body: string; 
}

export interface ClawResponse {
  text: string;
  mediaUrl?: string;
  mediaType?: MediaType;
  quickActions?: QuickAction[];
  selectionOptions?: SelectionOption[];
  creditsUsed?: number;
  balanceRemaining?: number;
  pairingCode?: string;
}

export interface QuickAction {
  label: string;
  action?: string;
  jobId?: string;
  url?: string;
  row?: number;
}

export interface SelectionOption {
  label: string;
  value: string;
  row?: number;
}

export interface JobResult {
  status: 'complete' | 'failed' | 'timeout' | 'insufficient_credits';
  jobId?: string;
  assetUrl?: string;
  mediaType?: MediaType;
  platform?: GenerationPlatform;
  creditsUsed?: number;
  balanceRemaining?: number;
  error?: string;
  needed?: number;
  available?: number;
}

export interface ScheduledJob {
  jobId: string;
  firebaseUID: string;
  channelType: ChannelType;
  channelUserId: string;
  chatId: string;
  skillName: string;
  args: Record<string, string>;
  schedule: JobSchedule;
  status: 'active' | 'paused' | 'cancelled' | 'permanently_failed';
  retryCount: number;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export type JobSchedule =
  | { type: 'once'; at: string }
  | { type: 'interval'; every: string }
  | { type: 'cron'; cron: string; timezone: string };

export interface PairingRecord {
  code: string;
  channelType: ChannelType;
  channelUserId: string;
  chatId: string;
  status: 'pending' | 'approved';
  expiresAt: string;
  createdAt: string;
}

export interface UserLink {
  firebaseUID: string;
  channelType: ChannelType;
  channelUserId: string;
  chatId: string;
  linkedAt: string;
}

