import { config } from 'dotenv';
import { z } from 'zod';

config();

const EnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(10),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default('studiox-claw-secret'),
  TELEGRAM_MODE: z.enum(['polling', 'webhook']).optional().default('polling'),
  TELEGRAM_WEBHOOK_URL: z.string().optional().default(''),
  TELEGRAM_WEBHOOK_PATH: z.string().optional().default('/webhooks/telegram'),

  FIREBASE_ADMIN_PROJECT_ID: z.string().optional().default(''),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().optional().default(''),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().optional().default(''),

  CLAW_GATEWAY_PORT: z.string().optional().default('3001'),
  CLAW_GATEWAY_HOST: z.string().optional().default('http://localhost:3001'),
  STUDIOX_APP_BASE_URL: z.string().optional().default('https://sp-website-staging-new.vercel.app'),
  APIMART_API_KEY: z.string().optional().default(''),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const CONFIG = {
  telegram: {
    token: parsed.data.TELEGRAM_BOT_TOKEN,
    webhookSecret: parsed.data.TELEGRAM_WEBHOOK_SECRET,
    mode: parsed.data.TELEGRAM_MODE,
    webhookUrl: normalizeWebhookUrl(parsed.data.TELEGRAM_WEBHOOK_URL, parsed.data.TELEGRAM_WEBHOOK_PATH),
    webhookPath: normalizeWebhookPath(parsed.data.TELEGRAM_WEBHOOK_PATH),
  },
  firebase: {
    projectId: parsed.data.FIREBASE_ADMIN_PROJECT_ID,
    privateKey: parsed.data.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: parsed.data.FIREBASE_ADMIN_CLIENT_EMAIL,
  },
  gateway: {
    port: parseInt(parsed.data.CLAW_GATEWAY_PORT, 10),
    host: parsed.data.CLAW_GATEWAY_HOST,
  },
  studio: {
    appBaseUrl: normalizeBaseUrl(parsed.data.STUDIOX_APP_BASE_URL),
  },
  apimart: {
    apiKey: parsed.data.APIMART_API_KEY,
  },
} as const;

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

function normalizeWebhookPath(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '/webhooks/telegram';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeWebhookUrl(raw: string, path: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const normalizedPath = normalizeWebhookPath(path);
  const base = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsedUrl = new URL(base);
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
    parsedUrl.pathname = normalizedPath;
  }
  return parsedUrl.toString().replace(/\/+$/, parsedUrl.pathname === '/' ? '/' : '');
}

export function studioUrl(path = ''): string {
  if (!path) return CONFIG.studio.appBaseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${CONFIG.studio.appBaseUrl}${normalizedPath}`;
}
