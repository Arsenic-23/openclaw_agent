import express from 'express';
import { initFirebase } from './firebase-admin.js';
import { skillRegistry } from './skills/registry.js';
import { gateway } from './gateway.js';
import { TelegramChannel } from './channels/telegram.js';
import { schedulerEngine } from './scheduler/engine.js';
import { heartbeatEngine } from './scheduler/heartbeat.js';
import { CONFIG } from './config.js';

async function main(): Promise<void> {
  console.log('🦞 Starting StudioX Claw Gateway...');

  initFirebase();

  await skillRegistry.loadAll();

  const app = express();
  app.use(express.json());

  app.get('/', (_req, res) => {
    const skillCount = skillRegistry.getAll().length;
    const modeLabel = CONFIG.telegram.mode === 'webhook' ? 'Webhook mode' : 'Polling mode';
    const webhookLine =
      CONFIG.telegram.mode === 'webhook'
        ? `<li><strong>Webhook:</strong> <code>${CONFIG.telegram.webhookPath}</code></li>`
        : '<li><strong>Webhook:</strong> not enabled in this environment</li>';

    res
      .status(200)
      .type('html')
      .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>StudioX Claw Gateway</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #05070b;
        --panel: rgba(12, 16, 24, 0.92);
        --border: rgba(118, 136, 169, 0.22);
        --text: #f3f6fb;
        --muted: #98a6c2;
        --accent: #7dd3fc;
        --accent-soft: rgba(125, 211, 252, 0.14);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top, rgba(26, 69, 90, 0.35), transparent 34%),
          radial-gradient(circle at bottom right, rgba(86, 123, 35, 0.18), transparent 26%),
          var(--bg);
        color: var(--text);
      }
      .card {
        width: min(760px, 100%);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 28px;
        padding: 32px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.34);
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 18px;
        padding: 10px 14px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.18em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 12px;
        font-size: clamp(32px, 5vw, 52px);
        line-height: 0.98;
        letter-spacing: -0.04em;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.7;
      }
      ul {
        margin: 28px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 12px;
      }
      li {
        padding: 14px 16px;
        border: 1px solid var(--border);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.02);
        color: var(--text);
      }
      strong { color: var(--text); }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        color: var(--accent);
      }
      .footer {
        margin-top: 22px;
        font-size: 14px;
        color: var(--muted);
      }
      a {
        color: var(--accent);
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="eyebrow">StudioX Claw Gateway</div>
      <h1>Staging bot is online</h1>
      <p>
        This endpoint powers the StudioX Telegram staging bot. It is a service endpoint for development and testing,
        not a public product page.
      </p>
      <ul>
        <li><strong>Status:</strong> healthy</li>
        <li><strong>Mode:</strong> ${modeLabel}</li>
        <li><strong>Loaded skills:</strong> ${skillCount}</li>
        <li><strong>Health check:</strong> <a href="/health"><code>/health</code></a></li>
        ${webhookLine}
      </ul>
      <p class="footer">
        If you are a developer, use this host for staging bot validation only.
      </p>
    </main>
  </body>
</html>`);
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'studiox-claw-gateway', skills: skillRegistry.getAll().length });
  });

  const telegram = new TelegramChannel();
  gateway.registerChannel(telegram);
  schedulerEngine.registerChannel(telegram);
  heartbeatEngine.registerChannel(telegram);

  if (CONFIG.telegram.mode === 'webhook') {
    telegram.mountWebhook(app);
  } else {
    telegram.startPolling();
  }

  await schedulerEngine.start();
  heartbeatEngine.start();

  // 6. Start Express
  app.listen(CONFIG.gateway.port, async () => {
    console.log(`🚀 Gateway running on port ${CONFIG.gateway.port}`);
    console.log(`   Health: http://localhost:${CONFIG.gateway.port}/health`);
    if (CONFIG.telegram.mode === 'webhook') {
      try {
        await telegram.startWebhook();
        console.log(`   Telegram: webhook mode (${CONFIG.telegram.webhookPath})`);
      } catch (error) {
        console.error('❌ Failed to configure Telegram webhook:', error);
      }
    } else {
      console.log('   Telegram: polling mode (dev)');
    }
  });

  const shutdown = async (): Promise<void> => {
    console.log('\n👋 Shutting down...');
    schedulerEngine.stop();
    heartbeatEngine.stop();
    await gateway.stopAll();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
