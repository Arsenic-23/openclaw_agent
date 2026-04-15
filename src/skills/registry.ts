import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { z } from 'zod';
import type { SkillManifest, ChannelType, AgentRole } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SkillFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  author: z.string().min(1),
  triggers: z.array(z.string()).min(1),
  args: z.array(
    z.object({
      name: z.string(),
      required: z.boolean(),
      default: z.string().optional(),
      description: z.string().optional(),
    })
  ),
  cost_estimate: z.string(),
  channels: z.array(z.enum(['telegram', 'discord', 'slack', 'whatsapp', 'web-chat'])),
  agent: z.enum(['creative', 'social', 'admin']),
});

export class SkillValidationError extends Error {
  constructor(
    public readonly skillFile: string,
    message: string
  ) {
    super(`Skill validation failed for ${skillFile}: ${message}`);
    this.name = 'SkillValidationError';
  }
}

class SkillRegistry {
  private skills = new Map<string, SkillManifest>();
  private loaded = false;

  async loadAll(): Promise<void> {
    const skillsDir = path.resolve(__dirname, '../../skills');

    if (!fs.existsSync(skillsDir)) {
      console.warn('⚠️  Skills directory not found:', skillsDir);
      this.loaded = true;
      return;
    }

    const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(skillsDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const { data, content: body } = matter(content);

        const parsed = SkillFrontmatterSchema.safeParse(data);
        if (!parsed.success) {
          throw new SkillValidationError(file, parsed.error.message);
        }

        const manifest: SkillManifest = {
          ...parsed.data,
          channels: parsed.data.channels as ChannelType[],
          agent: parsed.data.agent as AgentRole,
          body: body.trim(),
        };

        this.skills.set(manifest.name, manifest);
      } catch (err) {
        if (err instanceof SkillValidationError) throw err;
        console.error(`Failed to load skill ${file}:`, err);
      }
    }

    this.loaded = true;
    console.log(`✅ Loaded ${this.skills.size} skills`);
  }

  findByTrigger(text: string): SkillManifest | null {
    if (!this.loaded) return null;

    const lower = text.toLowerCase().trim();
    let bestMatch: SkillManifest | null = null;
    let bestLength = 0;

    for (const skill of this.skills.values()) {
      for (const trigger of skill.triggers) {
        const t = trigger.toLowerCase();
        if (lower.includes(t) && t.length > bestLength) {
          bestMatch = skill;
          bestLength = t.length;
        }
      }
    }

    return bestMatch;
  }

  get(name: string): SkillManifest | undefined {
    return this.skills.get(name);
  }

  getAll(): SkillManifest[] {
    return Array.from(this.skills.values());
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export const skillRegistry = new SkillRegistry();
