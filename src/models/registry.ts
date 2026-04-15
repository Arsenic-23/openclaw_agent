import type { ModelConfig } from '../types/index.js';

export const IMAGE_MODELS: ModelConfig[] = [
  {
    id: 'z-image',
    name: 'Z-Image',
    type: 'image',
    provider: 'apimart',
    cost: 2,
    description: 'Fast & affordable',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['1K'],
    defaultAspect: '1:1',
    defaultQuality: '1K',
    icon: '💲',
  },
  {
    id: 'gpt-4o-image',
    name: 'GPT-4o Image',
    type: 'image',
    provider: 'poyo',
    cost: 4,
    description: 'Photorealistic, OpenAI quality',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['1:1', '16:9', '9:16'],
    qualities: ['1K', '2K'],
    defaultAspect: '1:1',
    defaultQuality: '1K',
    icon: '📸',
  },
  {
    id: 'nano-banana-2-new',
    name: 'Nano Banana 2',
    type: 'image',
    provider: 'poyo',
    cost: 5,
    description: 'Versatile general purpose',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['1:1', '16:9', '9:16', '4:3'],
    qualities: ['1K'],
    defaultAspect: '1:1',
    defaultQuality: '1K',
    icon: '🍌',
  },
  {
    id: 'seedream-4',
    name: 'SeeDream 4',
    type: 'image',
    provider: 'apimart',
    cost: 5,
    description: 'Batch generation (up to 15)',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['1K'],
    defaultAspect: '1:1',
    defaultQuality: '1K',
    maxBatch: 15,
    icon: '⭐',
  },
  {
    id: 'seedream-4.5',
    name: 'SeeDream 4.5',
    type: 'image',
    provider: 'apimart',
    cost: 5,
    description: 'Best general purpose (default)',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['1K'],
    defaultAspect: '1:1',
    defaultQuality: '1K',
    icon: '🌟',
  },
  {
    id: 'flux-2-pro',
    name: 'Flux 2 Pro',
    type: 'image',
    provider: 'apimart',
    cost: 6,
    description: 'Artistic & creative',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['1K'],
    defaultAspect: '1:1',
    defaultQuality: '1K',
    icon: '🎨',
  },
  {
    id: 'flux-kontext-pro',
    name: 'Flux Kontext Pro',
    type: 'image',
    provider: 'apimart',
    cost: 6,
    description: 'Reference image editing',
    supportsRefImage: true,
    requiresRefImage: false,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['1K'],
    defaultAspect: '1:1',
    defaultQuality: '1K',
    icon: '🖌️',
  },
  {
    id: 'flux-kontext-max',
    name: 'Flux Kontext Max',
    type: 'image',
    provider: 'apimart',
    cost: 10,
    description: 'Premium reference image editing',
    supportsRefImage: true,
    requiresRefImage: false,
    aspects: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    qualities: ['1K'],
    defaultAspect: '1:1',
    defaultQuality: '1K',
    icon: '💎',
  },
];

export const VIDEO_MODELS: ModelConfig[] = [
  {
    id: 'wan2.6-image-to-video',
    name: 'Wan 2.6 I2V',
    type: 'video',
    provider: 'apimart',
    cost: 15,
    description: 'Image-to-video, ref image required',
    supportsRefImage: true,
    requiresRefImage: true,
    aspects: ['16:9', '9:16', '1:1'],
    qualities: ['720p'],
    defaultAspect: '16:9',
    defaultQuality: '720p',
    durationRange: [3, 5],
    defaultDuration: 5,
    icon: '🎬',
  },
  {
    id: 'veo3.1-fast',
    name: 'Veo 3.1 Fast',
    type: 'video',
    provider: 'apimart',
    cost: 20,
    description: 'Fastest video generation',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['16:9', '9:16', '1:1'],
    qualities: ['720p'],
    defaultAspect: '16:9',
    defaultQuality: '720p',
    durationRange: [5, 8],
    defaultDuration: 5,
    icon: '⚡',
  },
  {
    id: 'seedance-1.0-pro',
    name: 'SeeDance 1.0 Pro',
    type: 'video',
    provider: 'apimart',
    cost: 21,
    description: 'Dance/motion from reference image',
    supportsRefImage: true,
    requiresRefImage: false,
    aspects: ['16:9', '9:16', '1:1'],
    qualities: ['720p'],
    defaultAspect: '16:9',
    defaultQuality: '720p',
    durationRange: [5, 5],
    defaultDuration: 5,
    icon: '💃',
  },
  {
    id: 'kling-3.0/standard',
    name: 'Kling 3.0 Standard',
    type: 'video',
    provider: 'apimart',
    cost: 45,
    description: 'Best value video (default)',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['16:9', '9:16', '1:1'],
    qualities: ['720p'],
    defaultAspect: '16:9',
    defaultQuality: '720p',
    durationRange: [3, 15],
    defaultDuration: 5,
    icon: '🎬',
  },
  {
    id: 'sora-2',
    name: 'Sora 2',
    type: 'video',
    provider: 'apimart',
    cost: 48,
    description: 'High quality OpenAI video',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['16:9', '9:16', '1:1'],
    qualities: ['720p'],
    defaultAspect: '16:9',
    defaultQuality: '720p',
    durationRange: [10, 15],
    defaultDuration: 10,
    icon: '✨',
  },
  {
    id: 'kling-3.0/pro',
    name: 'Kling 3.0 Pro',
    type: 'video',
    provider: 'apimart',
    cost: 75,
    description: 'Professional quality, 1080p',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['16:9', '9:16', '1:1'],
    qualities: ['1080p'],
    defaultAspect: '16:9',
    defaultQuality: '1080p',
    durationRange: [3, 15],
    defaultDuration: 5,
    icon: '👑',
  },
  {
    id: 'sora-2-pro',
    name: 'Sora 2 Pro',
    type: 'video',
    provider: 'apimart',
    cost: 100,
    description: 'Premium quality, longest duration',
    supportsRefImage: false,
    requiresRefImage: false,
    aspects: ['16:9', '9:16', '1:1'],
    qualities: ['1080p'],
    defaultAspect: '16:9',
    defaultQuality: '1080p',
    durationRange: [15, 25],
    defaultDuration: 15,
    icon: '💎',
  },
];

export const ALL_MODELS: ModelConfig[] = [...IMAGE_MODELS, ...VIDEO_MODELS];

export function getModelById(id: string): ModelConfig | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}

export function getImageModels(): ModelConfig[] {
  return IMAGE_MODELS;
}

export function getVideoModels(): ModelConfig[] {
  return VIDEO_MODELS;
}

export function getModelCost(modelId: string): number {
  const model = getModelById(modelId);
  return model?.cost ?? 5;
}

export function formatImageModelsList(): string {
  return IMAGE_MODELS.map(
    (m) => `${m.icon} *${m.name}* (${m.id}) — ${m.cost}cr\n   ${m.description}${m.supportsRefImage ? ' | 📎 Ref Image' : ''}`
  ).join('\n');
}

export function formatVideoModelsList(): string {
  return VIDEO_MODELS.map(
    (m) =>
      `${m.icon} *${m.name}* (${m.id}) — ${m.cost}cr\n   ${m.description}` +
      (m.durationRange ? ` | ${m.durationRange[0]}-${m.durationRange[1]}s` : '') +
      (m.supportsRefImage ? ' | 📎 Ref Image' : '') +
      (m.requiresRefImage ? ' ⚠️ Required' : '')
  ).join('\n');
}
