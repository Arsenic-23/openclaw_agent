import { getDb } from '../firebase-admin.js';
import type { UserMemorySnapshot } from '../types/index.js';

export interface UserMemory extends UserMemorySnapshot {
  generationCount: number;
  lastActive: string;
  dailyNotes: Array<{ date: string; note: string }>;
}

const DEFAULT_MEMORY: UserMemory = {
  preferredModel: 'seedream-4.5',
  preferredAspect: '1:1',
  preferredQuality: '1K',
  promptStyle: '',
  favoriteTemplates: [],
  generationCount: 0,
  lastActive: new Date().toISOString(),
  dailyNotes: [],
};

export async function getMemory(uid: string): Promise<UserMemory> {
  try {
    const db = getDb();
    const doc = await db.collection('claw_memory').doc(uid).get();
    if (!doc.exists) return { ...DEFAULT_MEMORY };
    return { ...DEFAULT_MEMORY, ...(doc.data() as Partial<UserMemory>) };
  } catch {
    
    return { ...DEFAULT_MEMORY };
  }
}

export async function updateMemory(uid: string, partial: Partial<UserMemory>): Promise<void> {
  try {
    const db = getDb();
    await db
      .collection('claw_memory')
      .doc(uid)
      .set({ ...partial, lastActive: new Date().toISOString() }, { merge: true });
  } catch {
    
  }
}

export function injectMemoryIntoPrompt(prompt: string, memory: UserMemory): string {
  const parts: string[] = [prompt];

  if (memory.promptStyle) {
    parts.push(memory.promptStyle);
  }

  if (memory.preferredModel && memory.generationCount > 3) {
    
  }

  return parts.join(', ');
}

export async function consolidateDailyNotes(uid: string): Promise<void> {
  try {
    const memory = await getMemory(uid);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const filtered = memory.dailyNotes.filter(
      (note) => new Date(note.date) > thirtyDaysAgo
    );

    if (filtered.length !== memory.dailyNotes.length) {
      await updateMemory(uid, { dailyNotes: filtered });
    }
  } catch {
    
  }
}

export async function addDailyNote(uid: string, note: string): Promise<void> {
  try {
    const memory = await getMemory(uid);
    const today = new Date().toISOString().split('T')[0] ?? new Date().toISOString();
    const notes = [...memory.dailyNotes, { date: today, note }].slice(-90);
    await updateMemory(uid, { dailyNotes: notes });
  } catch {
    
  }
}
