import { admin, getDb } from '../firebase-admin.js';
import { generationStore } from '../generations/store.js';
import type { MediaType } from '../types/index.js';

interface PublishInput {
  firebaseUID: string;
  jobId: string;
  title: string;
}

interface PublishResult {
  postId: string;
}

interface UserProfile {
  name: string;
  avatar: string;
}

export function deriveAspectRatio(aspect: string | undefined, mediaType: MediaType): 'square' | 'portrait' | 'landscape' {
  if (!aspect) {
    return mediaType === 'video' ? 'landscape' : 'square';
  }

  const [widthRaw, heightRaw] = aspect.split(':');
  const width = Number(widthRaw);
  const height = Number(heightRaw);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return mediaType === 'video' ? 'landscape' : 'square';
  }

  if (width === height) return 'square';
  return width > height ? 'landscape' : 'portrait';
}

function fallbackNameFromEmail(email: string | undefined, uid: string): string {
  if (email && email.includes('@')) {
    const local = email.split('@')[0] ?? '';
    const cleaned = local.replace(/[._-]+/g, ' ').trim();
    if (cleaned) {
      return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    }
  }
  return `StudioX Creator ${uid.slice(0, 6)}`;
}

async function getUserProfile(firebaseUID: string): Promise<UserProfile> {
  const db = getDb();
  const doc = await db.collection('users').doc(firebaseUID).get();
  const data = doc.data();

  const avatarSeed = firebaseUID.slice(0, 12);
  return {
    name:
      (data?.['displayName'] as string | undefined) ??
      (data?.['name'] as string | undefined) ??
      fallbackNameFromEmail(data?.['email'] as string | undefined, firebaseUID),
    avatar:
      (data?.['photoURL'] as string | undefined) ??
      (data?.['avatar'] as string | undefined) ??
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`,
  };
}

export async function publishGenerationToCommunity(input: PublishInput): Promise<PublishResult> {
  const generation = generationStore.get(input.jobId);
  if (!generation) {
    throw new Error('Generation not found. Please generate again and then post it to the community.');
  }

  if (generation.firebaseUID !== input.firebaseUID) {
    throw new Error('That generation belongs to a different account.');
  }

  const db = getDb();
  const postRef = db.collection('posts').doc();
  const user = await getUserProfile(input.firebaseUID);

  await postRef.set({
    type: generation.mediaType,
    title: input.title,
    description: generation.prompt,
    prompt: generation.prompt,
    author: {
      uid: input.firebaseUID,
      name: user.name,
      avatar: user.avatar,
    },
    assetUrl: generation.mediaUrl,
    thumbnailUrl: generation.mediaUrl,
    aspectRatio: deriveAspectRatio(generation.aspect, generation.mediaType),
    likes: 0,
    views: 0,
    allowRemix: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    creationId: generation.jobId,
    tags: ['community', 'claw', generation.mediaType],
    model: generation.model ?? 'Unknown',
    preset: 'Claw',
    quality: 'Standard',
    size: generation.aspect ?? 'Auto',
    status: 'published',
    source: 'claw',
    parentCreationId: generation.parentCreationId ?? null,
    rootCreationId: generation.rootCreationId ?? generation.parentCreationId ?? generation.jobId,
    remixDepth: generation.remixDepth ?? 0,
    sourcePostId: generation.sourcePostId ?? null,
    campaign: generation.campaign ?? null,
    generationPlatform: generation.generationPlatform ?? 'poyo',
    taskId: generation.taskId ?? generation.jobId,
  });

  return { postId: postRef.id };
}
