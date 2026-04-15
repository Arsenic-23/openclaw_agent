import { schedulerEngine } from '../scheduler/engine.js';
import type { ClawResponse, ScheduledJob, JobSchedule } from '../types/index.js';

export async function handleScheduleCommand(
  text: string,
  firebaseUID: string,
  channelType: ScheduledJob['channelType'],
  channelUserId: string,
  chatId: string
): Promise<ClawResponse> {
  const trimmed = text.trim();

  if (/^\/jobs?\b/i.test(trimmed)) {
    return listJobs(firebaseUID);
  }

  const pauseMatch = trimmed.match(/^\/pause\s+(\S+)/i);
  if (pauseMatch) {
    const jobId = pauseMatch[1]!;
    const ok = await schedulerEngine.pauseJob(jobId, firebaseUID);
    return ok
      ? { 
          text: `⏸ Job \`${jobId}\` paused.\n\nResume with /resume ${jobId}`,
          quickActions: [
            { label: '▶️ Resume', action: 'resume', jobId },
            { label: '🗑 Cancel', action: 'cancel', jobId },
            { label: '📋 Jobs', action: 'jobs', jobId: undefined }
          ]
        }
      : { text: `❌ Job not found or you don't own it.` };
  }

  const resumeMatch = trimmed.match(/^\/resume\s+(\S+)/i);
  if (resumeMatch) {
    const jobId = resumeMatch[1]!;
    const ok = await schedulerEngine.resumeJob(jobId, firebaseUID);
    return ok
      ? { 
          text: `▶️ Job \`${jobId}\` resumed.`,
          quickActions: [
            { label: '⏸ Pause', action: 'pause', jobId },
            { label: '🗑 Cancel', action: 'cancel', jobId },
            { label: '📋 Jobs', action: 'jobs', jobId: undefined }
          ]
        }
      : { text: `❌ Job not found or you don't own it.` };
  }

  const cancelMatch = trimmed.match(/^\/cancel\s+(\S+)/i);
  if (cancelMatch) {
    const jobId = cancelMatch[1]!;
    const ok = await schedulerEngine.cancelJob(jobId, firebaseUID);
    return ok
      ? { 
          text: `🗑 Job \`${jobId}\` cancelled.`,
          quickActions: [
            { label: '📋 Jobs', action: 'jobs', jobId: undefined }
          ]
        }
      : { text: `❌ Job not found or you don't own it.` };
  }

  const scheduleMatch = trimmed.match(/^\/schedule\s+(.+)/i);
  if (!scheduleMatch) {
    return { text: scheduleHelp() };
  }

  const rest = scheduleMatch[1]!.trim();
  const parsed = parseScheduleExpression(rest);

  if (!parsed) {
    return {
      text:
        `❌ Couldn't parse schedule expression.\n\n` + scheduleHelp(),
    };
  }

  const { schedule, prompt } = parsed;

  if (!prompt) {
    return { text: `❌ Please include what you want to generate.\n\nExample: /schedule every 1h generate a sunset` };
  }

  const job = await schedulerEngine.scheduleJob({
    firebaseUID,
    channelType,
    channelUserId,
    chatId,
    skillName: 'image-gen', 
    args: { prompt },
    schedule,
  });

  const scheduleDesc = describeSchedule(schedule);

  return {
    text:
      `🕐 Scheduled!\n\n` +
      `📝 "${prompt}"\n` +
      `⏰ ${scheduleDesc}\n` +
      `🆔 Job ID: \`${job.jobId}\`\n\n` +
      `You can use buttons below to manage this job:`,
    quickActions: [
      { label: '⏸ Pause', action: 'pause', jobId: job.jobId },
      { label: '🗑 Cancel', action: 'cancel', jobId: job.jobId },
      { label: '📋 All Jobs', action: 'jobs', jobId: undefined },
    ]
  };
}

function parseScheduleExpression(text: string): { schedule: JobSchedule; prompt: string } | null {
  
  const everyMatch = text.match(/^every\s+(\d+[smhd]|\d+\s*hour|\d+\s*min|\d+\s*day)\s+(.+)/i);
  if (everyMatch) {
    const rawEvery = everyMatch[1]!.replace(/\s*(hour|min|day)/, (_, u: string) => ({ hour: 'h', min: 'm', day: 'd' }[u] ?? u));
    return {
      schedule: { type: 'interval', every: rawEvery },
      prompt: everyMatch[2]!.trim(),
    };
  }

  const cronDayMatch = text.match(
    /^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|day)\s+(?:at\s+)?(\d+(?::\d+)?(?:am|pm)?)\s+(.+)/i
  );
  if (cronDayMatch) {
    const dayMap: Record<string, string> = {
      monday: '1', tuesday: '2', wednesday: '3', thursday: '4',
      friday: '5', saturday: '6', sunday: '0', weekday: '1-5', day: '*',
    };
    const day = dayMap[cronDayMatch[1]!.toLowerCase()] ?? '*';
    const time = parseTimeToCron(cronDayMatch[2]!);
    if (!time) return null;
    return {
      schedule: { type: 'cron', cron: `${time.minute} ${time.hour} * * ${day}`, timezone: 'UTC' },
      prompt: cronDayMatch[3]!.trim(),
    };
  }

  const dailyMatch = text.match(/^daily\s+(?:at\s+)?(\S+)\s+(.+)/i);
  if (dailyMatch) {
    const time = parseTimeToCron(dailyMatch[1]!);
    if (!time) return null;
    return {
      schedule: { type: 'cron', cron: `${time.minute} ${time.hour} * * *`, timezone: 'UTC' },
      prompt: dailyMatch[2]!.trim(),
    };
  }

  const atMatch = text.match(/^at\s+(\d{4}-\d{2}-\d{2}T[\d:]+Z?)\s+(.+)/i);
  if (atMatch) {
    const at = atMatch[1]!;
    if (isNaN(Date.parse(at))) return null;
    return {
      schedule: { type: 'once', at },
      prompt: atMatch[2]!.trim(),
    };
  }

  return null;
}

function parseTimeToCron(timeStr: string): { hour: string; minute: string } | null {
  
  const lower = timeStr.toLowerCase();
  if (lower === 'noon') return { hour: '12', minute: '0' };
  if (lower === 'midnight') return { hour: '0', minute: '0' };

  const ampmMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1]!, 10);
    const m = parseInt(ampmMatch[2] ?? '0', 10);
    const ampm = ampmMatch[3]!;
    if (ampm === 'pm' && h !== 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return { hour: String(h), minute: String(m) };
  }

  const militaryMatch = lower.match(/^(\d{1,2}):(\d{2})$/);
  if (militaryMatch) {
    return { hour: militaryMatch[1]!, minute: militaryMatch[2]! };
  }

  return null;
}

function describeSchedule(schedule: JobSchedule): string {
  if (schedule.type === 'once') {
    return `Once at ${new Date(schedule.at).toUTCString()}`;
  }
  if (schedule.type === 'interval') {
    return `Every ${schedule.every}`;
  }
  return `Cron: \`${schedule.cron}\` (${schedule.timezone})`;
}

async function listJobs(firebaseUID: string): Promise<ClawResponse> {
  const jobs = await schedulerEngine.listJobs(firebaseUID);

  if (jobs.length === 0) {
    return {
      text:
        `📅 No active scheduled jobs.\n\n` +
        `Create one with:\n/schedule every 1h generate a sunset`,
    };
  }

  const lines = jobs.map((j) => {
    const status = j.status === 'paused' ? '⏸' : '▶️';
    const schedule = describeSchedule(j.schedule);
    const prompt = j.args['prompt'] ?? j.skillName;
    return `${status} \`${j.jobId.slice(0, 8)}\` — ${schedule}\n   "${prompt}"`;
  });

  return {
    text: `📅 Your scheduled jobs (${jobs.length}):\n\n${lines.join('\n\n')}\n\n/pause <id> · /cancel <id> · /resume <id>`,
  };
}

function scheduleHelp(): string {
  return (
    `🕐 *Schedule Commands*\n\n` +
    `*Create:*\n` +
    `• /schedule every 1h generate a sunset\n` +
    `• /schedule every monday 9am generate product shots\n` +
    `• /schedule daily at noon generate my daily post\n` +
    `• /schedule at 2026-04-01T09:00:00Z generate birthday card\n\n` +
    `*Manage:*\n` +
    `• /jobs — list active jobs\n` +
    `• /pause <id> — pause a job\n` +
    `• /resume <id> — resume a paused job\n` +
    `• /cancel <id> — delete a job`
  );
}
