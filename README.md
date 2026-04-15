<div align="center">

<br />

# 🦞 StudioX Claw Gateway

**The omnichannel AI agent gateway powering StudioX creative generation — right inside your chat.**

<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Admin_13-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot_API-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

<br />

> *"Your creative AI in every chat."*

<br />

</div>

---

## 📖 Overview

**StudioX Claw** is a production-grade, omnichannel AI agent that bridges the StudioX creative platform with messaging apps. It brings state-of-the-art image and video generation directly into conversations — no browser switching, no friction.

The **Claw Gateway** is the TypeScript backend that powers Claw. It is a skill-driven, multi-provider AI agent built on a clean channel-abstraction architecture, capable of running on **Telegram** today and expanding to **Discord**, **Slack**, and **WhatsApp** without changing a single line of business logic.

**What makes it different:**

- 🧠 **Agent-first design** — a conversational state machine handles free-form messages, multi-step wizards, callbacks, and commands with consistent, context-aware responses.
- 📦 **Skill registry system** — AI capabilities are defined as markdown + YAML skill files, hot-loaded at runtime. Adding a new skill requires zero TypeScript changes.
- 🔗 **Secure account pairing** — links a Telegram identity to a StudioX account via Firebase-backed deep link tokens, with real-time approval listeners.
- 🗓️ **Scheduling engine** — users can schedule recurring generation jobs (daily, weekly, cron) that run autonomously and deliver results to their chat.
- 💾 **Persistent user memory** — the agent remembers preferred models, styles, and aspect ratios across sessions and applies smart defaults after enough generations.

---

## ✨ Feature Highlights

<table>
<tr>
<td width="50%">

### 🖼️ Image Generation
Generate stunning images through natural conversation. The agent extracts intent, picks the optimal model, confirms cost, and delivers — all in one round trip.

- 8 image models from **GPT-4o Image** to **Flux Kontext Max**
- Reference-image editing with **Flux Kontext Pro/Max**
- Batch generation up to **15 variations** in one job
- Prompt enhancement built-in

</td>
<td width="50%">

### 🎬 Video Generation
From text or reference images to cinematic video clips, directly in chat.

- 7 video models from **Veo 3.1 Fast** to **Sora 2 Pro**
- Image-to-video with **Wan 2.6 I2V** & **SeeDance 1.0**
- Durations from **3 to 25 seconds**
- Up to **1080p** output quality

</td>
</tr>
<tr>
<td width="50%">

### 🔁 Remix & Upscale
Iterate without starting over.

- Remix any past job with adjustable strength (`0.1–1.0`)
- Steer the remix with a new prompt direction
- Upscale output to higher resolution
- Character consistency across generations

</td>
<td width="50%">

### 🗓️ Scheduled Generations
Automate your creative pipeline.

- Natural language scheduling: *"every morning at 8am"*
- Cron expression support for power users
- Heartbeat engine for missed-job recovery
- Per-user job management via `/schedule` commands

</td>
</tr>
<tr>
<td width="50%">

### 🧩 Creative Templates
Pre-built cinematic workflows, one tap away.

| Template | Description |
|---|---|
| 🌬️ Air Bending | Elemental air effects |
| 🐾 Animalization | Transform into animals |
| 🌍 Earth Zoom | Dramatic earth zoom-out |
| 🔥 Fire Lava | Molten fire effects |
| 👁️ Mouth In | Surreal mouth-reveal |
| 🦅 Raven Transform | Dark raven morphing |
| 🌫️ Shadow Smoke | Smoky silhouette art |
| 🚂 Train Rush | Fast-motion train rush |

</td>
<td width="50%">

### 🤝 Account Pairing
Secure, seamless identity linking.

- Deep-link QR pairing flow from StudioX web
- Firebase Firestore-backed token verification
- Real-time approval listener — bot confirms the moment you approve on web
- Mutual exclusivity — one Telegram account, one StudioX identity

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       StudioX Claw Gateway                          │
│                                                                     │
│   ┌──────────────┐    ┌───────────────────────────────────────┐    │
│   │   Channels   │    │              Agent Core               │    │
│   │              │    │                                       │    │
│   │  ┌────────┐  │    │  ┌──────────┐  ┌──────────────────┐  │    │
│   │  │Telegram│──┼────┼─▶│ Gateway  │  │  Wizard Config   │  │    │
│   │  └────────┘  │    │  │ Server   │  │  (Image/Video/   │  │    │
│   │  ┌─────────┐ │    │  └────┬─────┘  │   Director)      │  │    │
│   │  │ Discord │ │    │       │        └──────────────────┘  │    │
│   │  │ (soon)  │ │    │       ▼                               │    │
│   │  └─────────┘ │    │  ┌──────────────────────────────┐    │    │
│   │  ┌───────┐   │    │  │        Agent Core.ts          │    │    │
│   │  │ Slack │   │    │  │  ┌──────────┐ ┌───────────┐  │    │    │
│   │  │ (soon)│   │    │  │  │ Skill    │ │  User     │  │    │    │
│   │  └───────┘   │    │  │  │ Registry │ │  Memory   │  │    │    │
│   └──────────────┘    │  │  └──────────┘ └───────────┘  │    │    │
│                       │  │  ┌──────────┐ ┌───────────┐  │    │    │
│   ┌──────────────┐    │  │  │  Model   │ │  Pairing  │  │    │    │
│   │  Scheduler   │    │  │  │ Registry │ │  Service  │  │    │    │
│   │  ┌─────────┐ │    │  │  └──────────┘ └───────────┘  │    │    │
│   │  │ Engine  │ │    │  └──────────────────────────────┘    │    │
│   │  ├─────────┤ │    │                                       │    │
│   │  │Heartbeat│ │    │  ┌────────────────────────────────┐   │    │
│   │  └─────────┘ │    │  │         AI Providers           │   │    │
│   └──────────────┘    │  │  ApiMart API  │  Poyo Queue    │   │    │
│                       │  └────────────────────────────────┘   │    │
└─────────────────────────────────────────────────────────────────────┘
              │                                 │
              ▼                                 ▼
     Firebase Firestore                   StudioX Backend
     (Auth / Pairing /                   (Job Dispatch /
      Scheduled Jobs)                     Media Storage)
```

### Key Design Decisions

| Concern | Approach |
|---|---|
| **Channel abstraction** | `BaseChannel` interface — swap Telegram for Discord with zero agent changes |
| **Skill loading** | Markdown + YAML frontmatter files parsed at boot, registered to the agent dynamically |
| **State machine** | Explicit `ConversationState` enum per user — handles wizard steps, pending confirmations, and free-form chat cleanly |
| **Multi-provider routing** | `apimart` vs `poyo` provider per model — router selects the correct queue automatically |
| **Cost enforcement** | Agent always surfaces credit cost before dispatching; requests >50cr require explicit confirmation |
| **Config validation** | Zod schema on startup — fails fast with a clear error if any required env var is missing |

---

## 🤖 Bot Commands

| Command | Description |
|---|---|
| `/start` | Onboard a new user, display pairing link |
| `/image` | Launch the Image Generation Wizard |
| `/video` | Launch the Video Generation Wizard |
| `/director` | Advanced multi-step Director mode |
| `/template` | Browse and apply cinematic templates |
| `/remix` | Remix a previous creation |
| `/schedule` | Manage scheduled generation jobs |
| `/creations` | View recent generations |
| `/credits` | Check credit balance |
| `/models` | List all available AI models with costs |
| `/community` | Browse community creations |
| `/help` | Show all commands and tips |

---

## 📂 Project Structure

```
studiox-claw-gateway/
│
├── src/
│   ├── index.ts              # Entry point — Express + Telegram bootstrap
│   ├── gateway.ts            # GatewayServer — routes messages to agent, handles pairing
│   ├── config.ts             # Zod-validated environment configuration
│   ├── firebase-admin.ts     # Firebase Admin SDK initialisation
│   │
│   ├── agent/
│   │   ├── core.ts           # Main agent state machine (~1200 lines)
│   │   ├── context.ts        # Per-user conversation context manager
│   │   ├── wizard-config.ts  # Image & video wizard step definitions
│   │   └── director-config.ts# Director mode configuration
│   │
│   ├── channels/
│   │   ├── base.ts           # BaseChannel interface
│   │   └── telegram.ts       # Telegram channel (grammY) — polls or webhook
│   │
│   ├── commands/
│   │   └── schedule.ts       # /schedule command handler
│   │
│   ├── generations/
│   │   └── store.ts          # In-memory generation result store
│   │
│   ├── memory/
│   │   └── user-memory.ts    # Persistent user preference manager
│   │
│   ├── models/
│   │   └── registry.ts       # All image & video model definitions + formatters
│   │
│   ├── pairing/
│   │   ├── pairing-service.ts# Firebase deep-link pairing flow
│   │   └── link-resolver.ts  # Resolves pairing tokens to StudioX user IDs
│   │
│   ├── scheduler/
│   │   ├── engine.ts         # Cron-based scheduled generation engine
│   │   └── heartbeat.ts      # Missed-job recovery / heartbeat
│   │
│   ├── skills/               # (mirrors skills/ but runtime-loaded)
│   └── types/                # Shared TypeScript type definitions
│
├── skills/                   # Skill definitions (Markdown + YAML frontmatter)
│   ├── image-gen.md
│   ├── video-gen.md
│   ├── batch.md
│   ├── remix.md
│   ├── upscale.md
│   ├── prompt-enhance.md
│   ├── smart-model-picker.md
│   ├── style-profile.md
│   ├── character-consistency.md
│   ├── community-post.md
│   ├── credit-check.md
│   ├── template-air-bending.md
│   ├── template-animalization.md
│   ├── template-earth-zoom.md
│   ├── template-fire-lava.md
│   ├── template-mouth-in.md
│   ├── template-raven-transform.md
│   ├── template-shadow-smoke.md
│   └── template-train-rush.md
│
├── identity/
│   ├── IDENTITY.md           # Bot name, emoji, personality traits, voice examples
│   └── SOUL.md               # Agent behaviour rules, boundaries, intelligence guide
│
├── .env.example              # All required environment variables documented
├── tsconfig.json
└── package.json
```

---

## 🧠 Skill System

Skills are the atomic units of agent capability. Each skill is a **Markdown file with YAML frontmatter** that defines:

- **Triggers** — natural-language phrases that activate this skill
- **Arguments** — required and optional parameters with defaults
- **Channels** — which platforms support this skill
- **Cost estimate** — shown to users before execution
- **Instructions** — prose describing what the agent should do

```yaml
---
name: image-gen
description: "Generate images using StudioX's AI models"
version: "1.0.0"
triggers:
  - "generate image"
  - "create a photo"
  - "/imagine"
args:
  - name: prompt
    required: true
  - name: model
    required: false
    default: "seedream-4.5"
  - name: aspect
    required: false
    default: "1:1"
cost_estimate: "5-20 credits"
channels:
  - telegram
  - discord
  - slack
---

# Image Generation

When the user asks to generate an image:
1. Extract the prompt from their message
2. Use their preferred model (or seedream-4.5 as default)
3. Apply their preferred aspect ratio from memory
4. Call createStudioJob with model, prompt, aspect, quality
5. Deliver result with credit summary and quick actions
```

The skill registry scans the `skills/` directory at startup and automatically registers all loaded skills to the agent. **Adding a new capability = adding one `.md` file.**

---

## 🎨 Supported AI Models

### Image Models

| Icon | Model | Cost | Best For |
|------|-------|------|----------|
| 💲 | Z-Image | 2 cr | Fast & affordable |
| 📸 | GPT-4o Image | 4 cr | Photorealistic, OpenAI quality |
| 🍌 | Nano Banana 2 | 5 cr | Versatile general purpose |
| ⭐ | SeeDream 4 | 5 cr | Batch generation (up to 15) |
| 🌟 | SeeDream 4.5 | 5 cr | Best general purpose *(default)* |
| 🎨 | Flux 2 Pro | 6 cr | Artistic & creative |
| 🖌️ | Flux Kontext Pro | 6 cr | Reference image editing |
| 💎 | Flux Kontext Max | 10 cr | Premium reference editing |

### Video Models

| Icon | Model | Cost | Duration | Best For |
|------|-------|------|----------|----------|
| 🎬 | Wan 2.6 I2V | 15 cr | 3–5s | Image-to-video |
| ⚡ | Veo 3.1 Fast | 20 cr | 5–8s | Fastest generation |
| 💃 | SeeDance 1.0 Pro | 21 cr | 5s | Dance & motion |
| 🎬 | Kling 3.0 Standard | 45 cr | 3–15s | Best value *(default)* |
| ✨ | Sora 2 | 48 cr | 10–15s | High quality OpenAI |
| 👑 | Kling 3.0 Pro | 75 cr | 3–15s | Professional 1080p |
| 💎 | Sora 2 Pro | 100 cr | 15–25s | Premium, longest |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 22
- A **Telegram Bot Token** from [@BotFather](https://t.me/BotFather)
- A **Firebase** project with Admin SDK credentials
- An **ApiMart** API key for AI model access
- A running **StudioX backend** instance

### 1. Clone the repository

```bash
git clone https://github.com/your-username/studiox-claw-gateway.git
cd studiox-claw-gateway
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_MODE=polling                          # or 'webhook' for production

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com

# Gateway
CLAW_GATEWAY_PORT=3001
STUDIOX_APP_BASE_URL=https://your-studiox-app.vercel.app

# AI Providers
APIMART_API_KEY=your_apimart_api_key_here
```

### 4. Start in development (polling mode)

```bash
npm run dev
```

The gateway will start on `http://localhost:3001`. Visit it in your browser to see a live status page.

### 5. Build for production

```bash
npm run build
npm start
```

### 6. Webhook mode (production)

Set the following in your `.env` for production webhook delivery:

```env
TELEGRAM_MODE=webhook
TELEGRAM_WEBHOOK_URL=https://your-domain.com
TELEGRAM_WEBHOOK_PATH=/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=your-random-secret-here
```

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from BotFather |
| `TELEGRAM_MODE` | | `polling` (dev) or `webhook` (prod). Default: `polling` |
| `TELEGRAM_WEBHOOK_URL` | | Public HTTPS URL for webhook mode |
| `TELEGRAM_WEBHOOK_PATH` | | Webhook path. Default: `/webhooks/telegram` |
| `TELEGRAM_WEBHOOK_SECRET` | | Shared secret to verify Telegram requests |
| `FIREBASE_ADMIN_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_ADMIN_PRIVATE_KEY` | ✅ | Service account private key (PEM format) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | ✅ | Service account client email |
| `CLAW_GATEWAY_PORT` | | Server port. Default: `3001` |
| `CLAW_GATEWAY_HOST` | | Public host for self-referencing. Default: `http://localhost:3001` |
| `STUDIOX_APP_BASE_URL` | | StudioX frontend base URL |
| `APIMART_API_KEY` | ✅ | ApiMart API key for AI model access |

---

## 🛠️ Development Scripts

```bash
npm run dev              # Start with hot-reload (ts-node/esm --watch)
npm run build            # Compile TypeScript → dist/
npm start                # Run compiled output
npm test                 # Run tests with Vitest
npm run test:watch       # Vitest in watch mode
npm run register-commands# Register Telegram bot commands with BotFather
```

---

## 🧩 Adding a New Skill

1. Create a new file in `skills/`:

```bash
touch skills/my-new-skill.md
```

2. Define it with YAML frontmatter + prose instructions:

```yaml
---
name: my-new-skill
description: "Does something awesome"
version: "1.0.0"
triggers:
  - "do the thing"
  - "activate awesome"
args:
  - name: target
    required: true
    description: "What to apply it to"
cost_estimate: "0 credits"
channels:
  - telegram
agent: creative
---

# My New Skill

Instructions for the agent go here in natural language.
The agent will read these when this skill is triggered.
```

3. Restart the gateway — the skill is automatically registered.

---

## 🔌 Adding a New Channel

The gateway is built around a `BaseChannel` interface. To add Discord, Slack, or any other platform:

```typescript
// src/channels/discord.ts
export class DiscordChannel extends BaseChannel {
  async start(): Promise<void> { /* ... */ }
  async stop(): Promise<void> { /* ... */ }
  async send(chatId: string, response: ClawResponse): Promise<void> { /* ... */ }
  async sendText(chatId: string, text: string): Promise<void> { /* ... */ }
}
```

Then register it in `src/index.ts`:

```typescript
const discord = new DiscordChannel();
gateway.registerChannel(discord);
schedulerEngine.registerChannel(discord);
```

The **entire agent logic, skill system, and memory layer remain unchanged.**

---

## 📡 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Live status page (HTML) — shows mode, loaded skills, health link |
| `GET` | `/health` | JSON health check — `{ status: 'ok', skills: N }` |
| `POST` | `/webhooks/telegram` | Telegram webhook receiver (webhook mode only) |

---

## 🤝 Account Pairing Flow

```
User taps "Link Telegram" on StudioX web
        │
        ▼
StudioX generates a short-lived pairing token
writes { token, userId, expiresAt } → Firestore
        │
        ▼
User sends /start?code=<token> to Claw bot
        │
        ▼
Claw resolves token → fetches StudioX userId from Firestore
        │
        ▼
Claw writes { telegramId, studioUserId } → Firestore
        │
        ▼
Real-time listener fires → bot sends ✅ confirmation
+ quick-action buttons to start generating
```

---

## 🗓️ Scheduler

The scheduling engine supports:

- **Natural language**: *"every day at 9am"*, *"every Friday"*, *"weekly on Monday morning"*
- **Cron expressions** for power users
- **Heartbeat engine** that checks for missed jobs on startup and re-runs them
- **Per-user job isolation** — users can only see and cancel their own jobs

---

## 🧪 Testing

```bash
npm test
```

Tests are written with [Vitest](https://vitest.dev/) and cover core agent logic, skill loading, and model registry utilities.

---

## 🗺️ Roadmap

- [x] Telegram channel (polling + webhook)
- [x] Image generation wizard (8 models)
- [x] Video generation wizard (7 models)
- [x] Remix, upscale, batch generation
- [x] Cinematic template library (8 templates)
- [x] Firebase account pairing
- [x] Persistent user memory
- [x] Scheduling engine + heartbeat
- [ ] Discord channel
- [ ] Slack channel
- [ ] WhatsApp channel
- [ ] Web Chat embed (in StudioX Studio)
- [ ] Multi-modal input (voice notes → generation)
- [ ] Community feed integration
- [ ] Style profile learning (adaptive defaults)

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js 22, TypeScript 5.7 |
| **Web server** | Express 4.x |
| **Telegram** | [grammY](https://grammy.dev/) v1.31 |
| **Discord** | discord.js v14 *(scaffolded)* |
| **Auth / DB** | Firebase Admin SDK 13 (Firestore) |
| **Scheduling** | node-cron, node-schedule |
| **Config** | dotenv + Zod schema validation |
| **Testing** | Vitest |
| **AI Models** | ApiMart API, Poyo Queue |

---

## 📄 License

[MIT](LICENSE) — built with 🦞 by the StudioX team.

---

<div align="center">

**StudioX Claw** · *Your creative AI in every chat*

[![Telegram](https://img.shields.io/badge/Try_on_Telegram-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/your_bot)
[![StudioX](https://img.shields.io/badge/StudioX_Platform-6366f1?style=for-the-badge&logo=sparkles&logoColor=white)](https://studiox.app)

</div>
