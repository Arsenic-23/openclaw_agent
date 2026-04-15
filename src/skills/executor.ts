import type {
  SkillManifest,
  ClawUser,
  JobResult,
  MediaType,
  GenerationPlatform,
} from '../types/index.js';
import { getDb } from '../firebase-admin.js';
import { studioUrl, CONFIG } from '../config.js';
import { generationStore } from '../generations/store.js';

const JOB_TIMEOUT_MS = 5 * 60 * 1000;
const APIMART_TASK_TIMEOUT_MS = 5 * 60 * 1000;
const APIMART_POLL_INTERVAL_MS = 3500;
const APIMART_REQUEST_TIMEOUT_MS = 30_000;
const TRANSIENT_RETRY_COUNT = 3;
const TRANSIENT_RETRY_BASE_MS = 1500;
const TRANSIENT_HTTP_CODES = new Set([429, 502, 503, 504]);

const DEFAULT_IMAGE_MODEL = 'seedream-4.5';
const DEFAULT_VIDEO_MODEL = 'kling-3.0/standard';

type GenerationMode = 'image' | 'video' | 'remix';

interface ApiMartSubmissionItem {
  status?: string;
  task_id?: string;
}

interface ApiMartDirectImageItem {
  url?: string;
  b64_json?: string;
}

interface ApiMartSubmissionResponse {
  code?: number;
  data?: ApiMartSubmissionItem[] | ApiMartDirectImageItem[];
}

interface ApiMartTaskResponse {
  code?: number;
  data?: {
    status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | string;
    progress?: number;
    result?: {
      images?: Array<{ url?: string[] }>;
      videos?: Array<{ url?: string; thumbnail_url?: string }>;
      thumbnail_url?: string;
    };
    error?: {
      message?: string;
    } | string;
  };
}

const APIMART_IMAGE_MODELS = new Set([
  'gpt-4o-image',
  'gpt-image-1.5',
  'nano-banana',
  'nano-banana-2',
  'nano-banana-2-new',
  'seedream-4',
  'seedream-4.5',
  'seedream-5.0-lite',
  'flux-kontext-pro',
  'flux-kontext-max',
  'z-image',
  'grok-imagine-image',
  // Claw-safe fallback routing while queue workers are unavailable.
  'flux-2-pro',
  'flux-2-flex',
]);

const APIMART_VIDEO_MODELS = new Set([
  'sora-2',
  'sora-2-pro',
  'sora-2-official',
  'veo3.1-fast',
  'veo3.1-quality',
  'kling-3.0/standard',
  'kling-3.0/pro',
  'kling-3.0-motion-control',
  'kling-2.6',
  'kling-2.5-turbo-pro',
  'hailuo-02',
  'hailuo-02-pro',
  'hailuo-2.3',
  'wan2.6-text-to-video',
  'wan2.6-image-to-video',
  'wan-animate-replace',
  'wan-animate-move',
  'seedance-1.0-pro',
  'seedance-1.5-pro',
  'grok-vid',
]);

export class SkillExecutor {
  async execute(
    skill: SkillManifest,
    args: Record<string, string>,
    user: ClawUser
  ): Promise<JobResult> {
    if (!this.isFirebaseAvailable()) {
      const estimatedCost = this.estimateCost(skill, args);
      return this.mockResult(skill, args, estimatedCost, 9999);
    }

    const balance = await this.getLiveBalance(user.firebaseUID);
    const estimatedCost = this.estimateCost(skill, args);

    if (balance < estimatedCost) {
      return {
        status: 'insufficient_credits',
        jobId: undefined,
        assetUrl: undefined,
        mediaType: undefined,
        creditsUsed: undefined,
        balanceRemaining: undefined,
        error: undefined,
        needed: estimatedCost,
        available: balance,
      };
    }

    const mode = this.inferMode(skill.name, args);
    const explicitProvider = this.parseProvider(args['provider']);
    const resolvedProvider = explicitProvider ?? this.chooseProvider(mode, args);

    if (resolvedProvider === 'apimart') {
      const apimartResult = await this.executeViaApiMart(mode, args, estimatedCost, balance);
      if (apimartResult.status === 'complete') {
        return apimartResult;
      }

      // Try one safe fallback model if the selected model is not accepted by ApiMart.
      if (this.shouldRetryWithFallbackModel(mode, args, apimartResult.error)) {
        const fallbackArgs = {
          ...args,
          model: mode === 'video' ? DEFAULT_VIDEO_MODEL : DEFAULT_IMAGE_MODEL,
        };
        const fallbackResult = await this.executeViaApiMart(mode, fallbackArgs, estimatedCost, balance);
        if (fallbackResult.status === 'complete') {
          return fallbackResult;
        }
        return fallbackResult;
      }

      return apimartResult;
    }

    const queueResult = await this.executeViaLegacyQueue(
      user.firebaseUID,
      skill,
      args,
      resolvedProvider,
      estimatedCost,
      balance
    );
    if (queueResult) {
      return queueResult;
    }

    return this.mockResult(skill, args, estimatedCost, balance);
  }

  private isFirebaseAvailable(): boolean {
    try {
      getDb();
      return true;
    } catch {
      return false;
    }
  }

  private inferMode(skillName: string, args: Record<string, string>): GenerationMode {
    if (skillName === 'remix' || args['jobId']) return 'remix';
    if (skillName.includes('video')) return 'video';
    return 'image';
  }

  private parseProvider(value: string | undefined): GenerationPlatform | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    if (normalized === 'apimart') return 'apimart';
    if (normalized === 'poyo') return 'poyo';
    return undefined;
  }

  private chooseProvider(mode: GenerationMode, args: Record<string, string>): GenerationPlatform {
    const model = (args['model'] ?? '').trim();
    if (!model) return 'apimart';
    if (APIMART_VIDEO_MODELS.has(model) || APIMART_IMAGE_MODELS.has(model)) {
      return 'apimart';
    }
    return 'poyo';
  }

  private shouldRetryWithFallbackModel(
    mode: GenerationMode,
    args: Record<string, string>,
    error: string | undefined
  ): boolean {
    if (!error) return false;
    if (mode === 'remix') return false;
    const currentModel = args['model'] ?? '';
    const fallbackModel = mode === 'video' ? DEFAULT_VIDEO_MODEL : DEFAULT_IMAGE_MODEL;
    if (!currentModel || currentModel === fallbackModel) return false;

    const lower = error.toLowerCase();
    return lower.includes('model') && (lower.includes('not') || lower.includes('invalid') || lower.includes('unsupported'));
  }

  private mapToApiMartModel(rawModel: string): string {
    const model = rawModel.toLowerCase();
    
    if (model.includes('sora-2-pro')) return 'sora-2-pro';
    if (model.includes('sora-2-vip')) return 'sora-2-vip';
    if (model.includes('sora-2')) return 'sora-2-pro'; // fallback to valid sora
    
    if (model.includes('kling-3.0/standard') || model === 'kling-3.0') return 'kling-v3';
    if (model.includes('kling-3.0/pro')) return 'kling-v3-omni';
    if (model.includes('kling-2.6')) return 'kling-v2-6';
    if (model.includes('kling')) return 'kling-v3';
    
    if (model.includes('seedream-4.5')) return 'doubao-seedream-5-0-lite';
    if (model.includes('seedream')) return 'doubao-seedream-5-0-lite';
    
    if (model.includes('seedance-1.0')) return 'doubao-seedance-1-0-pro-quality';
    if (model.includes('seedance')) return 'doubao-seedance-4-0';
    
    if (model.includes('hailuo-02')) return 'MiniMax-Hailuo-02';
    if (model.includes('hailuo-2.3')) return 'MiniMax-Hailuo-2.3';
    
    if (model.includes('nano-banana-2-new')) return 'flux-2-flex';
    if (model.includes('nano-banana-2')) return 'flux-2-pro';
    if (model.includes('nano-banana')) return 'flux-2-pro';

    if (model === 'z-image') return 'z-image-turbo';
    
    if (model.includes('veo3.1-quality')) return 'veo3.1-quality';
    if (model.includes('veo3.1-fast')) return 'veo3.1-fast';
    if (model.includes('veo')) return 'veo3.1-quality';
    
    if (model.includes('grok-vid')) return 'grok-imagine-1.0-video-apimart';
    if (model.includes('grok-imagine-image')) return 'grok-imagine-1.0-apimart';
    
    return rawModel;
  }

  private async executeViaApiMart(
    mode: GenerationMode,
    args: Record<string, string>,
    estimatedCost: number,
    prevBalance: number
  ): Promise<JobResult> {
    let model = args['model'] ?? (mode === 'video' ? DEFAULT_VIDEO_MODEL : DEFAULT_IMAGE_MODEL);
    model = this.mapToApiMartModel(model);

    const prompt = args['prompt'] ?? '';
    const n = this.parsePositiveInt(args['n']) ?? this.parsePositiveInt(args['count']) ?? 1;

    const sourceGeneration = args['jobId'] ? generationStore.get(args['jobId']) : undefined;
    const remixTaskId = sourceGeneration?.taskId ?? args['jobId'];
    const remixPrompt = prompt || sourceGeneration?.prompt || '';

    let endpoint = '';
    let payload: Record<string, unknown> = {};
    let expectedMediaType: MediaType = mode === 'video' ? 'video' : 'image';
    const isKling = model.toLowerCase().includes('kling');

    if (mode === 'remix' && sourceGeneration?.mediaType === 'video' && remixTaskId) {
      endpoint = `https://api.apimart.ai/v1/videos/${encodeURIComponent(remixTaskId)}/remix`;
      payload = {
        model,
        ...(remixPrompt ? { prompt: remixPrompt } : {}),
        ...(args['strength'] ? { strength: Number.parseFloat(args['strength']) } : {}),
        ...(args['duration'] ? { duration: this.parsePositiveInt(args['duration']) ?? undefined } : {}),
        ...(args['aspect'] ? { aspect_ratio: args['aspect'] } : {}),
        ...(args['resolution'] ? { resolution: args['resolution'] } : {}),
        ...(isKling ? { camerafixed: true, enable_gif: false } : {}),
      };
      expectedMediaType = 'video';
    } else if (mode === 'video' || mode === 'remix') {
      endpoint = 'https://api.apimart.ai/v1/videos/generations';
      payload = {
        model,
        prompt: remixPrompt || prompt,
        ...(args['aspect'] ? { aspect_ratio: args['aspect'] } : {}),
        ...(args['duration'] ? { duration: this.parsePositiveInt(args['duration']) ?? undefined } : {}),
        ...(args['resolution'] ? { resolution: args['resolution'] } : {}),
        ...(isKling ? { camerafixed: true, enable_gif: false } : {}),
      };
      expectedMediaType = 'video';
    } else {
      endpoint = 'https://api.apimart.ai/v1/images/generations';
      payload = {
        model,
        prompt,
        ...(args['aspect'] ? { size: args['aspect'] } : {}),
        ...(args['outputFormat'] ? { output_format: args['outputFormat'] } : {}),
        ...(n > 1 ? { n } : {}),
      };
      expectedMediaType = 'image';
    }

    try {
      const submission = await this.fetchJson<ApiMartSubmissionResponse>(endpoint, {
        method: 'POST',
        body: payload,
      });

      const directImageUrl = this.extractDirectImageUrl(submission);
      if (directImageUrl && expectedMediaType === 'image') {
        return {
          status: 'complete',
          jobId: `apimart-direct-${Date.now()}`,
          assetUrl: directImageUrl,
          mediaType: 'image',
          platform: 'apimart',
          creditsUsed: estimatedCost,
          balanceRemaining: prevBalance - estimatedCost,
          error: undefined,
          needed: undefined,
          available: undefined,
        };
      }

      const taskId = this.extractTaskId(submission);
      if (!taskId) {
        return {
          status: 'failed',
          jobId: undefined,
          error: 'ApiMart did not return a task ID',
          assetUrl: undefined,
          mediaType: undefined,
          creditsUsed: undefined,
          balanceRemaining: undefined,
          needed: undefined,
          available: undefined,
        };
      }

      const taskResult = await this.pollApiMartTask(taskId, expectedMediaType);
      if (taskResult.status !== 'complete') {
        return taskResult;
      }

      return {
        ...taskResult,
        creditsUsed: estimatedCost,
        balanceRemaining: prevBalance - estimatedCost,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ApiMart request failed';
      return {
        status: 'failed',
        jobId: undefined,
        error: message,
        assetUrl: undefined,
        mediaType: undefined,
        creditsUsed: undefined,
        balanceRemaining: undefined,
        needed: undefined,
        available: undefined,
      };
    }
  }

  private async pollApiMartTask(taskId: string, fallbackMediaType: MediaType): Promise<JobResult> {
    const deadline = Date.now() + APIMART_TASK_TIMEOUT_MS;
    const taskUrl = `https://api.apimart.ai/v1/tasks/${encodeURIComponent(taskId)}?language=en`;

    while (Date.now() < deadline) {
      const payload = await this.fetchJson<ApiMartTaskResponse>(taskUrl, { method: 'GET' });
      const data = payload.data;
      const status = (data?.status ?? '').toLowerCase();

      if (status === 'completed') {
        const asset = this.extractTaskAsset(data, fallbackMediaType);
        if (!asset.assetUrl) {
          return {
            status: 'failed',
            jobId: taskId,
            error: 'ApiMart finished but did not return an asset URL',
            assetUrl: undefined,
            mediaType: undefined,
            platform: 'apimart',
            creditsUsed: undefined,
            balanceRemaining: undefined,
            needed: undefined,
            available: undefined,
          };
        }
        return {
          status: 'complete',
          jobId: taskId,
          assetUrl: asset.assetUrl,
          mediaType: asset.mediaType,
          platform: 'apimart',
          creditsUsed: undefined,
          balanceRemaining: undefined,
          error: undefined,
          needed: undefined,
          available: undefined,
        };
      }

      if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
        return {
          status: 'failed',
          jobId: taskId,
          error: this.extractTaskError(data) ?? 'ApiMart generation failed',
          assetUrl: undefined,
          mediaType: undefined,
          platform: 'apimart',
          creditsUsed: undefined,
          balanceRemaining: undefined,
          needed: undefined,
          available: undefined,
        };
      }

      await this.sleep(APIMART_POLL_INTERVAL_MS);
    }

    return {
      status: 'timeout',
      jobId: taskId,
      assetUrl: undefined,
      mediaType: undefined,
      platform: 'apimart',
      creditsUsed: undefined,
      balanceRemaining: undefined,
      error: undefined,
      needed: undefined,
      available: undefined,
    };
  }

  private extractTaskAsset(
    data: ApiMartTaskResponse['data'],
    fallbackMediaType: MediaType
  ): { assetUrl?: string; mediaType: MediaType } {
    const result = data?.result;

    const firstVideo = result?.videos?.[0];
    if (firstVideo?.url) {
      return {
        assetUrl: firstVideo.url,
        mediaType: 'video',
      };
    }

    const firstImage = result?.images?.[0]?.url?.[0];
    if (firstImage) {
      return {
        assetUrl: firstImage,
        mediaType: 'image',
      };
    }

    return {
      assetUrl: undefined,
      mediaType: fallbackMediaType,
    };
  }

  private extractTaskError(data: ApiMartTaskResponse['data']): string | undefined {
    if (!data?.error) return undefined;
    if (typeof data.error === 'string') return data.error;
    return data.error.message;
  }

  private extractTaskId(submission: ApiMartSubmissionResponse): string | undefined {
    if (!Array.isArray(submission.data)) return undefined;
    for (const item of submission.data) {
      if ('task_id' in item && typeof item.task_id === 'string' && item.task_id.length > 0) {
        return item.task_id;
      }
    }
    return undefined;
  }

  private extractDirectImageUrl(submission: ApiMartSubmissionResponse): string | undefined {
    if (!Array.isArray(submission.data)) return undefined;
    for (const item of submission.data) {
      if ('url' in item && typeof item.url === 'string' && item.url.length > 0) {
        return item.url;
      }
    }
    return undefined;
  }

  private async fetchJson<T>(
    url: string,
    init: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
    }
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < TRANSIENT_RETRY_COUNT; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), APIMART_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: init.method,
          headers: {
            'Authorization': `Bearer ${CONFIG.apimart.apiKey}`,
            'Content-Type': 'application/json',
          },
          ...(init.body ? { body: JSON.stringify(init.body) } : {}),
          signal: controller.signal,
        });

        const raw = await response.text();
        const parsed = raw ? (JSON.parse(raw) as T | { error?: string }) : ({} as T);

        if (!response.ok) {
          const message =
            typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof parsed.error === 'string'
              ? parsed.error
              : `ApiMart request failed with ${response.status}`;

          if (TRANSIENT_HTTP_CODES.has(response.status) && attempt < TRANSIENT_RETRY_COUNT - 1) {
            lastError = new Error(message);
            console.warn(`⚠️ Transient ${response.status} from ApiMart (attempt ${attempt + 1}/${TRANSIENT_RETRY_COUNT}), retrying...`);
            clearTimeout(timeout);
            await this.sleep(TRANSIENT_RETRY_BASE_MS * Math.pow(2, attempt));
            continue;
          }

          throw new Error(message);
        }

        return parsed as T;
      } catch (err) {
        clearTimeout(timeout);

        const isAbort = err instanceof Error && err.name === 'AbortError';
        if (isAbort && attempt < TRANSIENT_RETRY_COUNT - 1) {
          lastError = new Error('Request timed out');
          console.warn(`⚠️ ApiMart request timed out (attempt ${attempt + 1}/${TRANSIENT_RETRY_COUNT}), retrying...`);
          await this.sleep(TRANSIENT_RETRY_BASE_MS * Math.pow(2, attempt));
          continue;
        }

        throw err;
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError ?? new Error('ApiMart request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private parsePositiveInt(value: string | undefined): number | undefined {
    if (!value) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed;
  }

  private async executeViaLegacyQueue(
    uid: string,
    skill: SkillManifest,
    args: Record<string, string>,
    provider: GenerationPlatform,
    estimatedCost: number,
    prevBalance: number
  ): Promise<JobResult | null> {
    const jobId = await this.createJob(uid, skill, args, provider, estimatedCost);
    if (!jobId) return null;
    return this.awaitJob(jobId, estimatedCost, prevBalance, provider);
  }

  private async getLiveBalance(uid: string): Promise<number> {
    try {
      const db = getDb();
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) return 0;
      const data = userDoc.data();
      return (data?.['tokenBalance'] as number) ?? 0;
    } catch {
      return 9999;
    }
  }

  private estimateCost(skill: SkillManifest, _args: Record<string, string>): number {
    const match = skill.cost_estimate.match(/(\d+)/);
    return match ? parseInt(match[1] ?? '5', 10) : 5;
  }

  private buildLegacyParameters(mode: GenerationMode, args: Record<string, string>): Record<string, unknown> {
    const n = this.parsePositiveInt(args['n']) ?? this.parsePositiveInt(args['count']) ?? 1;
    const prompt = args['prompt'] ?? '';
    const sourceGeneration = args['jobId'] ? generationStore.get(args['jobId']) : undefined;
    const originalCreationId = sourceGeneration?.taskId ?? sourceGeneration?.jobId ?? null;

    if (mode === 'video') {
      return {
        prompt,
        originalCreationId,
        aspect_ratio: args['aspect'] ?? '16:9',
        duration: this.parsePositiveInt(args['duration']) ?? 6,
        ...(args['resolution'] ? { resolution: args['resolution'] } : {}),
        ...(sourceGeneration?.mediaUrl ? { image_url: sourceGeneration.mediaUrl } : {}),
        n,
      };
    }

    return {
      prompt,
      originalCreationId,
      size: args['aspect'] ?? '1:1',
      ...(args['quality'] ? { quality: args['quality'] } : {}),
      ...(args['outputFormat'] ? { output_format: args['outputFormat'] } : {}),
      n,
    };
  }

  private async createJob(
    uid: string,
    skill: SkillManifest,
    args: Record<string, string>,
    provider: GenerationPlatform,
    estimatedCost: number
  ): Promise<string | null> {
    try {
      const db = getDb();
      const jobRef = db.collection('jobs').doc();
      const mode = this.inferMode(skill.name, args);
      const model = args['model'] ?? (mode === 'video' ? DEFAULT_VIDEO_MODEL : DEFAULT_IMAGE_MODEL);
      const prompt = args['prompt'] ?? '';
      const aspect = args['aspect'] ?? (mode === 'video' ? '16:9' : '1:1');
      const parameters = this.buildLegacyParameters(mode, args);
      const batchCountRaw = parameters['n'];
      const batchCount =
        typeof batchCountRaw === 'number' && Number.isFinite(batchCountRaw) && batchCountRaw > 0 ? batchCountRaw : 1;

      await jobRef.set({
        // Legacy claw fields
        uid,
        skillName: skill.name,
        prompt,
        aspect,
        args,

        // Studio-compatible job shape
        jobId: jobRef.id,
        userId: uid,
        provider,
        platform: provider,
        model,
        parameters,
        batchCount,
        costPerUnit: estimatedCost,
        costTokens: estimatedCost * batchCount,
        status: 'pending',
        source: 'claw',
        createdAt: new Date(),
      });

      return jobRef.id;
    } catch {
      return null;
    }
  }

  private awaitJob(
    jobId: string,
    estimatedCost: number,
    prevBalance: number,
    provider: GenerationPlatform
  ): Promise<JobResult> {
    return new Promise((resolve) => {
      let unsubscribe: (() => void) | null = null;

      const timeout = setTimeout(() => {
        unsubscribe?.();
        resolve({
          status: 'timeout',
          jobId,
          assetUrl: undefined,
          mediaType: undefined,
          platform: provider,
          creditsUsed: undefined,
          balanceRemaining: undefined,
          error: undefined,
          needed: undefined,
          available: undefined,
        });
      }, JOB_TIMEOUT_MS);

      try {
        const db = getDb();
        unsubscribe = db
          .collection('jobs')
          .doc(jobId)
          .onSnapshot((snap) => {
            const data = snap.data();
            if (!data) return;

            const status = String(data['status'] ?? '').toLowerCase();
            if (status === 'complete' || status === 'completed') {
              clearTimeout(timeout);
              unsubscribe?.();

              const creditsUsed =
                (data['creditsUsed'] as number | undefined) ??
                (data['costTokens'] as number | undefined) ??
                estimatedCost;
              const balanceRemaining = prevBalance - creditsUsed;
              const assetUrl = this.extractLegacyAssetUrl(data);
              const mediaType = this.inferLegacyMediaType(data, assetUrl);

              resolve({
                status: 'complete',
                jobId,
                assetUrl: assetUrl ?? undefined,
                mediaType,
                platform:
                  (data['platform'] as GenerationPlatform | undefined) ??
                  (data['provider'] as GenerationPlatform | undefined) ??
                  provider,
                creditsUsed,
                balanceRemaining,
                error: undefined,
                needed: undefined,
                available: undefined,
              });
            } else if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
              clearTimeout(timeout);
              unsubscribe?.();
              resolve({
                status: 'failed',
                jobId,
                error: (data['error'] as string | undefined) ?? undefined,
                assetUrl: undefined,
                mediaType: undefined,
                platform:
                  (data['platform'] as GenerationPlatform | undefined) ??
                  (data['provider'] as GenerationPlatform | undefined) ??
                  provider,
                creditsUsed: undefined,
                balanceRemaining: undefined,
                needed: undefined,
                available: undefined,
              });
            }
          });
      } catch {
        clearTimeout(timeout);
        resolve({
          status: 'failed',
          jobId: undefined,
          error: 'Firebase not configured',
          assetUrl: undefined,
          mediaType: undefined,
          platform: provider,
          creditsUsed: undefined,
          balanceRemaining: undefined,
          needed: undefined,
          available: undefined,
        });
      }
    });
  }

  private extractLegacyAssetUrl(data: Record<string, unknown>): string | undefined {
    const directAsset = data['assetUrl'];
    if (typeof directAsset === 'string' && directAsset.length > 0) return directAsset;

    const outputUrl = data['outputUrl'];
    if (typeof outputUrl === 'string' && outputUrl.length > 0) return outputUrl;

    const outputUrls = data['outputUrls'];
    if (Array.isArray(outputUrls)) {
      const first = outputUrls.find((value) => typeof value === 'string' && value.length > 0);
      if (typeof first === 'string') return first;
    }

    return undefined;
  }

  private inferLegacyMediaType(data: Record<string, unknown>, assetUrl: string | undefined): MediaType {
    const explicitMediaType = data['mediaType'];
    if (explicitMediaType === 'video') return 'video';
    if (explicitMediaType === 'image') return 'image';

    if (assetUrl) {
      const lower = assetUrl.toLowerCase();
      if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.webm')) {
        return 'video';
      }
    }

    const parameters = data['parameters'];
    if (typeof parameters === 'object' && parameters !== null) {
      const maybeVideo = (parameters as Record<string, unknown>)['duration'];
      if (typeof maybeVideo === 'number' && maybeVideo > 0) return 'video';
    }

    return 'image';
  }

  private mockResult(
    skill: SkillManifest,
    args: Record<string, string>,
    cost: number,
    balance: number
  ): JobResult {
    const prompt = args['prompt'] ?? 'test generation';
    console.log(`🎭 MOCK: Would generate "${prompt}" using skill "${skill.name}"`);
    return {
      status: 'complete',
      jobId: `mock-${Date.now()}`,
      assetUrl: 'https://via.placeholder.com/512x512.png?text=StudioX+Claw+Mock',
      mediaType: skill.name.includes('video') ? 'video' : 'image',
      platform: (args['provider'] as GenerationPlatform | undefined) ?? 'apimart',
      creditsUsed: cost,
      balanceRemaining: balance - cost,
      error: undefined,
      needed: undefined,
      available: undefined,
    };
  }
}

export const skillExecutor = new SkillExecutor();
