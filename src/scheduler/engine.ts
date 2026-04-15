import { schedule as nodeSchedule, ScheduledTask } from 'node-cron';
import { getDb } from '../firebase-admin.js';
import { skillRegistry } from '../skills/registry.js';
import { skillExecutor } from '../skills/executor.js';
import { linkResolver } from '../pairing/link-resolver.js';
import { studioUrl } from '../config.js';
import type { ScheduledJob, ClawUser, ChannelType } from '../types/index.js';
import type { BaseChannel } from '../channels/base.js';

const MAX_RETRY = 3;
const POLL_INTERVAL_MS = 60_000; // re-check Firestore every 60s for new/changed jobs
const STARTUP_SYNC_TIMEOUT_MS = 10_000;

export class SchedulerEngine {
  private tasks = new Map<string, ScheduledTask | NodeJS.Timeout>();
  private channels = new Map<ChannelType, BaseChannel>();
  private pollTimer: NodeJS.Timeout | null = null;
  private running = false;

  registerChannel(channel: BaseChannel): void {
    this.channels.set(channel.channelType, channel);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log('🕐 Scheduler engine started');
    void this.loadAndScheduleAllWithGuard('startup');
    this.pollTimer = setInterval(() => {
      void this.loadAndScheduleAllWithGuard('poll');
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    for (const task of this.tasks.values()) {
      if (typeof (task as ScheduledTask).stop === 'function') {
        (task as ScheduledTask).stop();
      } else {
        clearInterval(task as NodeJS.Timeout);
        clearTimeout(task as NodeJS.Timeout);
      }
    }
    this.tasks.clear();
    console.log('🛑 Scheduler engine stopped');
  }

  async scheduleJob(job: Omit<ScheduledJob, 'jobId' | 'status' | 'retryCount' | 'createdAt'>): Promise<ScheduledJob> {
    const db = getDb();
    const ref = db.collection('claw_scheduled_jobs').doc();
    const scheduledJob: ScheduledJob = {
      ...job,
      jobId: ref.id,
      status: 'active',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      nextRunAt: this.computeNextRun(job.schedule),
    };

    await ref.set(scheduledJob);
    this.scheduleInProcess(scheduledJob);
    return scheduledJob;
  }

  async pauseJob(jobId: string, uid: string): Promise<boolean> {
    const success = await this.updateJobStatus(jobId, uid, 'paused');
    if (success) {
      this.cancelInProcess(jobId);
    }
    return success;
  }

  async cancelJob(jobId: string, uid: string): Promise<boolean> {
    this.cancelInProcess(jobId);
    return this.updateJobStatus(jobId, uid, 'cancelled');
  }

  async resumeJob(jobId: string, uid: string): Promise<boolean> {
    const db = getDb();
    const snap = await db.collection('claw_scheduled_jobs').doc(jobId).get();
    if (!snap.exists) return false;
    const job = snap.data() as ScheduledJob;
    if (job.firebaseUID !== uid) return false;

    await db.collection('claw_scheduled_jobs').doc(jobId).update({ status: 'active' });
    job.status = 'active';
    this.scheduleInProcess(job);
    return true;
  }

  async listJobs(uid: string): Promise<ScheduledJob[]> {
    try {
      const db = getDb();
      const snap = await db
        .collection('claw_scheduled_jobs')
        .where('firebaseUID', '==', uid)
        .where('status', 'in', ['active', 'paused'])
        .get();
      return snap.docs.map((d) => d.data() as ScheduledJob);
    } catch {
      return [];
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  private async loadAndScheduleAllWithGuard(context: 'startup' | 'poll'): Promise<void> {
    try {
      await Promise.race([
        this.loadAndScheduleAll(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Scheduler sync timed out')), STARTUP_SYNC_TIMEOUT_MS);
        }),
      ]);
    } catch (error) {
      const label = context === 'startup' ? 'startup' : 'poll';
      const message = error instanceof Error ? error.message : 'unknown error';
      console.warn(`⚠️ Scheduler ${label} sync skipped: ${message}`);
    }
  }
  private async loadAndScheduleAll(): Promise<void> {
    try {
      const db = getDb();
      const snap = await db
        .collection('claw_scheduled_jobs')
        .where('status', '==', 'active')
        .get();

      for (const doc of snap.docs) {
        const job = doc.data() as ScheduledJob;
        if (!this.tasks.has(job.jobId)) {
          this.scheduleInProcess(job);
        }
      }
    } catch {
      
    }
  }

  private scheduleInProcess(job: ScheduledJob): void {
    if (this.tasks.has(job.jobId)) return; 

    const { schedule } = job;

    if (schedule.type === 'once') {
      const delay = new Date(schedule.at).getTime() - Date.now();
      if (delay <= 0) {
        
        void this.runJob(job);
        return;
      }
      const t = setTimeout(() => {
        void this.runJob(job);
        this.tasks.delete(job.jobId);
      }, delay);
      this.tasks.set(job.jobId, t);
    } else if (schedule.type === 'interval') {
      const ms = this.parseInterval(schedule.every);
      const t = setInterval(() => void this.runJob(job), ms);
      this.tasks.set(job.jobId, t);
    } else if (schedule.type === 'cron') {
      const task = nodeSchedule(
        schedule.cron,
        () => void this.runJob(job),
        { timezone: schedule.timezone, scheduled: true }
      );
      this.tasks.set(job.jobId, task);
    }
  }

  private cancelInProcess(jobId: string): void {
    const task = this.tasks.get(jobId);
    if (!task) return;
    if (typeof (task as ScheduledTask).stop === 'function') {
      (task as ScheduledTask).stop();
    } else {
      clearInterval(task as NodeJS.Timeout);
      clearTimeout(task as NodeJS.Timeout);
    }
    this.tasks.delete(jobId);
  }

  private async runJob(job: ScheduledJob): Promise<void> {
    console.log(`🕐 Running scheduled job ${job.jobId} (skill: ${job.skillName})`);

    const skill = skillRegistry.get(job.skillName);
    if (!skill) {
      console.error(`❌ Scheduler: skill "${job.skillName}" not found`);
      await this.markPermanentlyFailed(job.jobId);
      return;
    }

    const user: ClawUser = {
      firebaseUID: job.firebaseUID,
      channelType: job.channelType,
      channelUserId: job.channelUserId,
      tokenBalance: 0,
    };

    const result = await skillExecutor.execute(skill, job.args, user);

    await this.recordRun(job.jobId, job.schedule);

    const channel = this.channels.get(job.channelType);
    if (channel) {
      if (result.status === 'complete') {
        await channel.send(job.chatId, {
          text: `✅ Scheduled job done!\n💰 ${result.creditsUsed ?? 0} credits used`,
          mediaUrl: result.assetUrl,
          mediaType: result.mediaType,
        });
      } else if (result.status === 'insufficient_credits') {
        await channel.send(job.chatId, {
          text: `❌ Scheduled job failed — not enough credits.\nNeeded: ${result.needed} | Available: ${result.available}\n\nTop up at ${studioUrl('/pricing')}`,
        });
        await this.markPermanentlyFailed(job.jobId);
      } else if (result.status === 'failed') {
        const retryCount = (job.retryCount ?? 0) + 1;
        if (retryCount >= MAX_RETRY) {
          await channel.send(job.chatId, {
            text: `❌ Scheduled job permanently failed after ${MAX_RETRY} attempts: ${result.error ?? 'Unknown error'}`,
          });
          await this.markPermanentlyFailed(job.jobId);
        } else {
          await this.incrementRetry(job.jobId, retryCount);
        }
      }
    }

    if (job.schedule.type === 'once') {
      await this.updateJobStatus(job.jobId, job.firebaseUID, 'cancelled');
    }
  }

  private async recordRun(jobId: string, schedule: ScheduledJob['schedule']): Promise<void> {
    try {
      const db = getDb();
      await db.collection('claw_scheduled_jobs').doc(jobId).update({
        lastRunAt: new Date().toISOString(),
        nextRunAt: this.computeNextRun(schedule),
      });
    } catch {  }
  }

  private async updateJobStatus(jobId: string, uid: string, status: ScheduledJob['status']): Promise<boolean> {
    try {
      const db = getDb();
      const ref = db.collection('claw_scheduled_jobs').doc(jobId);
      const snap = await ref.get();
      if (!snap.exists) return false;
      const job = snap.data() as ScheduledJob;
      if (job.firebaseUID !== uid) return false;
      await ref.update({ status });
      return true;
    } catch {
      return false;
    }
  }

  private async markPermanentlyFailed(jobId: string): Promise<void> {
    try {
      this.cancelInProcess(jobId);
      const db = getDb();
      await db.collection('claw_scheduled_jobs').doc(jobId).update({ status: 'permanently_failed' });
    } catch {  }
  }

  private async incrementRetry(jobId: string, retryCount: number): Promise<void> {
    try {
      const db = getDb();
      await db.collection('claw_scheduled_jobs').doc(jobId).update({ retryCount });
    } catch {  }
  }

  private parseInterval(every: string): number {
    
    const num = parseInt(every, 10);
    if (!isNaN(num) && every === String(num)) return num; 
    const match = every.match(/^(\d+)([smhd])$/);
    if (!match) return 3_600_000; 
    const val = parseInt(match[1]!, 10);
    const unit = match[2]!;
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return val * (multipliers[unit] ?? 3_600_000);
  }

  private computeNextRun(schedule: ScheduledJob['schedule']): string | undefined {
    if (schedule.type === 'once') return schedule.at;
    if (schedule.type === 'interval') {
      const ms = this.parseInterval(schedule.every);
      return new Date(Date.now() + ms).toISOString();
    }
    
    return undefined;
  }
}

export const schedulerEngine = new SchedulerEngine();
