export interface WizardImageModel {
  id: string;
  name: string;
  aspectOptions: string[];
  resolutionOptions: string[];
  outputFormatOptions: string[];
}

export interface WizardVideoModel {
  id: string;
  name: string;
  aspectOptions: string[];
  durationOptions: string[];
  durationRange?: { min: number; max: number };
  resolutionOptions: string[];
}

export interface WizardTemplatePreset {
  id: string;
  label: string;
  mode: 'image' | 'video';
  defaultModel: string;
  aspectOptions: string[];
  buildPrompt: (subject: string) => string;
}

export const IMAGE_WIZARD_MODELS: WizardImageModel[] = [
  { id: 'gpt-4o-image', name: 'GPT 4o Image', aspectOptions: ['1:1', '2:3', '3:2'], resolutionOptions: [], outputFormatOptions: [] },
  { id: 'gpt-image-1.5', name: 'GPT Image 1.5', aspectOptions: ['1:1', '2:3', '3:2'], resolutionOptions: [], outputFormatOptions: [] },
  { id: 'nano-banana', name: 'Nano Banana', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], resolutionOptions: [], outputFormatOptions: [] },
  { id: 'nano-banana-2', name: 'Nano Banana 2 Pro', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], resolutionOptions: ['1K', '2K'], outputFormatOptions: [] },
  { id: 'nano-banana-2-new', name: 'Nano Banana 2 (New)', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], resolutionOptions: ['1K', '2K'], outputFormatOptions: [] },
  { id: 'flux-2-pro', name: 'Flux 2 Pro', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], resolutionOptions: ['1K', '2K'], outputFormatOptions: [] },
  { id: 'flux-2-flex', name: 'Flux 2 Flex', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], resolutionOptions: ['1K', '2K'], outputFormatOptions: [] },
  { id: 'flux-kontext-pro', name: 'Flux Kontext Pro', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9', '16:21'], resolutionOptions: [], outputFormatOptions: ['png', 'jpg'] },
  { id: 'flux-kontext-max', name: 'Flux Kontext Max', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9', '16:21'], resolutionOptions: [], outputFormatOptions: ['png', 'jpg'] },
  { id: 'seedream-4', name: 'SeeDream 4', aspectOptions: ['1:1', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3', '21:9'], resolutionOptions: ['1K', '2K', '4K'], outputFormatOptions: [] },
  { id: 'seedream-4.5', name: 'SeeDream 4.5', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], resolutionOptions: [], outputFormatOptions: [] },
  { id: 'seedream-5.0-lite', name: 'SeeDream 5.0 Lite', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], resolutionOptions: [], outputFormatOptions: [] },
  { id: 'z-image', name: 'Z-Image', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], resolutionOptions: [], outputFormatOptions: [] },
  { id: 'grok-imagine-image', name: 'Grok Imagine (Image)', aspectOptions: ['1:1', '2:3', '3:2', '16:9', '9:16'], resolutionOptions: [], outputFormatOptions: [] },
];

export const VIDEO_WIZARD_MODELS: WizardVideoModel[] = [
  { id: 'sora-2', name: 'Sora 2', aspectOptions: ['16:9', '9:16'], durationOptions: ['10', '15'], resolutionOptions: [] },
  { id: 'sora-2-pro', name: 'Sora 2 Pro', aspectOptions: ['16:9', '9:16'], durationOptions: ['15', '25'], resolutionOptions: [] },
  { id: 'sora-2-official', name: 'Sora 2 Official', aspectOptions: ['16:9', '9:16'], durationOptions: ['4', '8', '12', '16', '20'], resolutionOptions: [] },
  { id: 'veo3.1-fast', name: 'Veo 3.1 Fast', aspectOptions: ['16:9', '9:16'], durationOptions: [], resolutionOptions: ['720p', '1080p', '4k'] },
  { id: 'veo3.1-quality', name: 'Veo 3.1 Quality', aspectOptions: ['16:9', '9:16'], durationOptions: [], resolutionOptions: ['720p', '1080p', '4k'] },
  { id: 'kling-3.0/standard', name: 'Kling 3.0 Standard', aspectOptions: ['1:1', '16:9', '9:16'], durationOptions: [], durationRange: { min: 3, max: 15 }, resolutionOptions: [] },
  { id: 'kling-3.0/pro', name: 'Kling 3.0 Pro', aspectOptions: ['1:1', '16:9', '9:16'], durationOptions: [], durationRange: { min: 3, max: 15 }, resolutionOptions: [] },
  { id: 'kling-2.6', name: 'Kling 2.6', aspectOptions: ['1:1', '16:9', '9:16'], durationOptions: ['5', '10'], resolutionOptions: [] },
  { id: 'kling-2.5-turbo-pro', name: 'Kling 2.5 Turbo Pro', aspectOptions: ['16:9'], durationOptions: ['5', '10'], resolutionOptions: [] },
  { id: 'kling-3.0-motion-control', name: 'Kling 3.0 Motion Control', aspectOptions: ['16:9', '9:16'], durationOptions: [], resolutionOptions: ['720p', '1080p'] },
  { id: 'grok-vid', name: 'Grok Imagine (Video)', aspectOptions: ['1:1', '2:3', '3:2', '16:9', '9:16'], durationOptions: ['6', '10'], resolutionOptions: [] },
  { id: 'hailuo-02', name: 'Hailuo 02', aspectOptions: ['16:9', '9:16'], durationOptions: ['6', '10'], resolutionOptions: [] },
  { id: 'hailuo-02-pro', name: 'Hailuo 02 Pro', aspectOptions: ['16:9', '9:16'], durationOptions: [], resolutionOptions: ['1080p'] },
  { id: 'hailuo-2.3', name: 'Hailuo 2.3', aspectOptions: ['16:9', '9:16'], durationOptions: ['6', '10'], resolutionOptions: ['768p', '1080p'] },
  { id: 'wan2.6-text-to-video', name: 'Wan 2.6 (Text)', aspectOptions: ['16:9', '9:16'], durationOptions: ['5', '10', '15'], resolutionOptions: ['720p', '1080p'] },
  { id: 'wan2.6-image-to-video', name: 'Wan 2.6 (Image)', aspectOptions: ['16:9', '9:16'], durationOptions: ['5', '10', '15'], resolutionOptions: ['720p', '1080p'] },
  { id: 'wan-animate-replace', name: 'Wan Animate Replace', aspectOptions: ['16:9', '9:16'], durationOptions: ['5', '10'], resolutionOptions: ['480p', '580p', '720p'] },
  { id: 'wan-animate-move', name: 'Wan Animate Move', aspectOptions: ['16:9', '9:16'], durationOptions: ['5', '10'], resolutionOptions: ['480p', '580p', '720p'] },
  { id: 'seedance-1.0-pro', name: 'SeeDance 1.0 Pro', aspectOptions: ['16:9', '9:16'], durationOptions: ['5', '10'], resolutionOptions: ['720p', '1080p'] },
  { id: 'seedance-1.5-pro', name: 'SeeDance 1.5 Pro', aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'], durationOptions: ['4', '8', '12'], resolutionOptions: ['480p', '720p'] },
];

export const TEMPLATE_PRESETS: WizardTemplatePreset[] = [
  {
    id: 'template-air-bending',
    label: 'Air Bending',
    mode: 'video',
    defaultModel: 'kling-3.0/standard',
    aspectOptions: ['16:9', '9:16'],
    buildPrompt: (subject: string) =>
      `${subject}, controlling swirling wind currents, air bending, dynamic motion blur, cinematic, ethereal blue-white energy, dramatic sky, wide shot, 4K`,
  },
  {
    id: 'template-animalization',
    label: 'Animalization',
    mode: 'image',
    defaultModel: 'flux-2-pro',
    aspectOptions: ['1:1', '4:3', '3:4', '16:9', '9:16'],
    buildPrompt: (subject: string) =>
      `${subject} transformed into a majestic spirit animal hybrid, detailed fur or feathers, cinematic portrait, dramatic lighting, fantasy art style, 4K`,
  },
  {
    id: 'template-earth-zoom',
    label: 'Earth Zoom',
    mode: 'video',
    defaultModel: 'sora-2',
    aspectOptions: ['16:9', '9:16'],
    buildPrompt: (subject: string) =>
      `Starting from ${subject}, camera pulls back dramatically through clouds and atmosphere, revealing the curvature of Earth from space, epic cinematic zoom out, 4K IMAX quality`,
  },
  {
    id: 'template-fire-lava',
    label: 'Fire Lava',
    mode: 'video',
    defaultModel: 'kling-3.0/standard',
    aspectOptions: ['16:9', '9:16', '1:1'],
    buildPrompt: (subject: string) =>
      `${subject}, surrounded by flowing lava and fire, cinematic lighting, dramatic volcanic atmosphere, 4K, film grain, shallow depth of field, orange and red color grade`,
  },
  {
    id: 'template-mouth-in',
    label: 'Mouth In',
    mode: 'video',
    defaultModel: 'sora-2',
    aspectOptions: ['16:9', '9:16'],
    buildPrompt: (subject: string) =>
      `Close up of ${subject}, camera flies into an open mouth revealing a surreal world inside, dreamlike transition, cinematic smooth motion, 4K`,
  },
  {
    id: 'template-raven-transform',
    label: 'Raven Transform',
    mode: 'video',
    defaultModel: 'kling-3.0/pro',
    aspectOptions: ['16:9', '9:16'],
    buildPrompt: (subject: string) =>
      `${subject} dramatically transforming into a massive raven, dark feathers exploding outward, cinematic slow motion, black and blue color grade, gothic atmosphere, 4K`,
  },
  {
    id: 'template-shadow-smoke',
    label: 'Shadow Smoke',
    mode: 'video',
    defaultModel: 'kling-3.0/standard',
    aspectOptions: ['16:9', '9:16'],
    buildPrompt: (subject: string) =>
      `${subject}, shrouded in dark volumetric smoke, mysterious atmosphere, cinematic noir lighting, deep shadows, fog machine effect, 4K dramatic composition`,
  },
  {
    id: 'template-train-rush',
    label: 'Train Rush',
    mode: 'video',
    defaultModel: 'kling-3.0/standard',
    aspectOptions: ['16:9', '9:16'],
    buildPrompt: (subject: string) =>
      `High-speed bullet train rushing through ${subject}, dramatic motion blur, cinematic tracking shot, golden hour lighting, powerful velocity, 4K film grain`,
  },
];

export function findImageWizardModel(modelId: string): WizardImageModel | undefined {
  return IMAGE_WIZARD_MODELS.find((m) => m.id === modelId);
}

export function findVideoWizardModel(modelId: string): WizardVideoModel | undefined {
  return VIDEO_WIZARD_MODELS.find((m) => m.id === modelId);
}

export function findTemplatePreset(templateId: string): WizardTemplatePreset | undefined {
  return TEMPLATE_PRESETS.find((t) => t.id === templateId);
}
