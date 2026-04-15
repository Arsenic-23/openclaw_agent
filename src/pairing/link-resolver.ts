import { getDb } from '../firebase-admin.js';
import type { ChannelType } from '../types/index.js';

class LinkResolver {
  async resolve(channelType: ChannelType, channelUserId: string): Promise<string | null> {
    try {
      const db = getDb();
      const key = `${channelType}:${channelUserId}`;
      const doc = await db.collection('claw_user_links').doc(key).get();
      if (!doc.exists) return null;
      return (doc.data()?.['firebaseUID'] as string) ?? null;
    } catch {
      return null;
    }
  }

  async getLink(channelType: ChannelType, channelUserId: string) {
    try {
      const db = getDb();
      const key = `${channelType}:${channelUserId}`;
      const doc = await db.collection('claw_user_links').doc(key).get();
      if (!doc.exists) return null;
      return doc.data() ?? null;
    } catch {
      return null;
    }
  }
}

export const linkResolver = new LinkResolver();
