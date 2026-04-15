import { getDb } from '../firebase-admin.js';
import { studioUrl } from '../config.js';
import type { BaseChannel } from '../channels/base.js';
import type { ChannelType } from '../types/index.js';

const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; 
const LOW_CREDIT_THRESHOLD = 100; 

interface HeartbeatTask {
  name: string;
  run: () => Promise<void>;
}

export class HeartbeatEngine {
  private interval: NodeJS.Timeout | null = null;
  private channels = new Map<ChannelType, BaseChannel>();

  registerChannel(channel: BaseChannel): void {
    this.channels.set(channel.channelType, channel);
  }

  start(): void {
    if (this.interval) return;
    console.log('💓 Heartbeat engine started (every 30m)');
    
    setTimeout(() => void this.tick(), 5000);
    this.interval = setInterval(() => void this.tick(), HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('💓 Heartbeat engine stopped');
  }

  private async tick(): Promise<void> {
    const tasks: HeartbeatTask[] = [
      { name: 'check-stuck-jobs', run: () => this.checkStuckJobs() },
      { name: 'credit-low-alerts', run: () => this.checkLowCredits() },
      { name: 'memory-maintenance', run: () => this.consolidateMemory() },
      { name: 'cleanup-expired-pairings', run: () => this.cleanupExpiredPairings() },
    ];

    for (const task of tasks) {
      try {
        await task.run();
      } catch (err) {
        console.error(`💓 Heartbeat task "${task.name}" failed:`, err);
      }
    }
  }

  private async checkStuckJobs(): Promise<void> {
    try {
      const db = getDb();
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const snap = await db
        .collection('jobs')
        .where('status', '==', 'pending')
        .where('source', '==', 'claw')
        .where('createdAt', '<', tenMinutesAgo)
        .get();

      if (snap.empty) return;

      console.log(`💓 Found ${snap.size} stuck job(s) — marking failed`);

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.update(doc.ref, {
          status: 'failed',
          error: 'Job timed out in heartbeat check',
        });
      }
      await batch.commit();
    } catch {  }
  }

  private async checkLowCredits(): Promise<void> {
    try {
      const db = getDb();
      const today = new Date().toISOString().slice(0, 10); 

      const linksSnap = await db.collection('claw_user_links').limit(500).get();
      const uidsChecked = new Set<string>();

      for (const doc of linksSnap.docs) {
        const link = doc.data();
        const uid: string = link['firebaseUID'];
        if (!uid || uidsChecked.has(uid)) continue;
        uidsChecked.add(uid);

        const stateRef = db.collection('claw_heartbeat_state').doc(`credit-alert:${uid}:${today}`);
        const stateSnap = await stateRef.get();
        if (stateSnap.exists) continue;

        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists) continue;
        const balance = (userDoc.data()?.['tokenBalance'] as number) ?? 0;

        if (balance < LOW_CREDIT_THRESHOLD) {
          
          const channelType = link['channelType'] as ChannelType;
          const chatId = link['chatId'] as string;
          const channel = this.channels.get(channelType);

          if (channel && chatId) {
            await channel.send(chatId, {
              text:
                `⚠️ Low credits alert!\n\n` +
                `Your StudioX balance is only ${balance} credits.\n` +
                `Top up at ${studioUrl('/pricing')} to keep generating! 💳`,
            });
          }

          await stateRef.set({ alertedAt: new Date().toISOString(), balance });
        }
      }
    } catch {  }
  }

  private async consolidateMemory(): Promise<void> {
    try {
      const db = getDb();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const snap = await db.collection('claw_memory').limit(200).get();

      for (const doc of snap.docs) {
        const memory = doc.data();
        const dailyNotes: Record<string, string> = (memory['dailyNotes'] as Record<string, string>) ?? {};

        const oldDates = Object.keys(dailyNotes).filter((d) => d < sevenDaysAgo);
        if (oldDates.length < 7) continue; 

        const summary = oldDates.map((d) => `${d}: ${dailyNotes[d]}`).join('\n');
        const weekKey = `week-${sevenDaysAgo}`;

        const updatedNotes = { ...dailyNotes };
        for (const d of oldDates) delete updatedNotes[d];
        updatedNotes[weekKey] = `[SUMMARY] ${oldDates.length} sessions: ${summary.slice(0, 200)}...`;

        await db.collection('claw_memory').doc(doc.id).update({ dailyNotes: updatedNotes });
      }
    } catch {  }
  }

  private async cleanupExpiredPairings(): Promise<void> {
    try {
      const db = getDb();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const snap = await db
        .collection('claw_pairings')
        .where('status', '==', 'pending')
        .where('expiresAt', '<', oneHourAgo)
        .get();

      if (snap.empty) return;

      const batch = db.batch();
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();

      console.log(`💓 Cleaned up ${snap.size} expired pairing code(s)`);
    } catch {  }
  }
}

export const heartbeatEngine = new HeartbeatEngine();
