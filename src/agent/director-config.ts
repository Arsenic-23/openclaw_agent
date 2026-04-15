import type { CampaignMeta, GenerationPlatform } from '../types/index.js';

export interface DirectorGoal {
  id: string;
  label: string;
  description: string;
}

export interface DirectorPlatform {
  id: string;
  label: string;
  aspect: string;
}

export interface DirectorStyle {
  id: string;
  label: string;
  direction: string;
}

export interface DirectorBlueprint {
  prompt: string;
  model: string;
  aspect: string;
  provider: GenerationPlatform;
  campaign: CampaignMeta;
}

export const DIRECTOR_GOALS: DirectorGoal[] = [
  { id: 'launch-ad', label: 'Launch Ad', description: 'Product or offer led creative for paid/social' },
  { id: 'brand-poster', label: 'Brand Poster', description: 'Hero visual for launch pages and promos' },
  { id: 'community-teaser', label: 'Community Teaser', description: 'High-scroll post for StudioX community and socials' },
  { id: 'thumbnail', label: 'Thumbnail', description: 'YouTube or promo thumb with strong focus and contrast' },
];

export const DIRECTOR_PLATFORMS: DirectorPlatform[] = [
  { id: 'instagram-post', label: 'Instagram Post', aspect: '1:1' },
  { id: 'instagram-story', label: 'Instagram Story', aspect: '9:16' },
  { id: 'x-post', label: 'X Post', aspect: '16:9' },
  { id: 'youtube-thumb', label: 'YouTube Thumbnail', aspect: '16:9' },
];

export const DIRECTOR_STYLES: DirectorStyle[] = [
  { id: 'cinematic', label: 'Cinematic', direction: 'cinematic lighting, polished grading, premium composition' },
  { id: 'luxury', label: 'Luxury', direction: 'luxury product styling, high-end editorial finish, premium textures' },
  { id: 'playful', label: 'Playful', direction: 'playful visual energy, punchy colors, bold shapes, social-first impact' },
  { id: 'futuristic', label: 'Futuristic', direction: 'futuristic art direction, sleek surfaces, advanced tech atmosphere' },
  { id: 'editorial', label: 'Editorial', direction: 'editorial storytelling, magazine-grade composition, premium typography space' },
];

export const DIRECTOR_VARIATION_OPTIONS = ['1', '2', '3'];

const APIMART_DIRECTOR_MODELS = new Set([
  'flux-kontext-max',
  'gpt-4o-image',
  'seedream-4',
  'seedream-4.5',
]);

export function findDirectorGoal(value: string): DirectorGoal | undefined {
  return DIRECTOR_GOALS.find((item) => item.id === value || item.label.toLowerCase() === value.toLowerCase());
}

export function findDirectorPlatform(value: string): DirectorPlatform | undefined {
  return DIRECTOR_PLATFORMS.find((item) => item.id === value || item.label.toLowerCase() === value.toLowerCase());
}

export function findDirectorStyle(value: string): DirectorStyle | undefined {
  return DIRECTOR_STYLES.find((item) => item.id === value || item.label.toLowerCase() === value.toLowerCase());
}

export function buildDirectorBlueprint(input: {
  subject: string;
  goalId: string;
  platformId: string;
  styleId: string;
  variationCount: number;
}): DirectorBlueprint {
  const goal = findDirectorGoal(input.goalId) ?? DIRECTOR_GOALS[0]!;
  const platform = findDirectorPlatform(input.platformId) ?? DIRECTOR_PLATFORMS[0]!;
  const style = findDirectorStyle(input.styleId) ?? DIRECTOR_STYLES[0]!;
  const model =
    goal.id === 'launch-ad' || goal.id === 'brand-poster'
      ? 'flux-kontext-max'
      : goal.id === 'thumbnail'
        ? 'gpt-4o-image'
        : 'seedream-4';
  const provider: GenerationPlatform = APIMART_DIRECTOR_MODELS.has(model) ? 'apimart' : 'poyo';

  const prompt =
    `${input.subject}, ${goal.description.toLowerCase()}, designed for ${platform.label.toLowerCase()}, ` +
    `${style.direction}, clean focal hierarchy, strong CTA-safe composition, high-quality commercial creative`;

  return {
    prompt,
    model,
    aspect: platform.aspect,
    provider,
    campaign: {
      directed: true,
      goal: goal.label,
      platform: platform.label,
      style: style.label,
      variationCount: input.variationCount,
      brief: input.subject,
    },
  };
}
