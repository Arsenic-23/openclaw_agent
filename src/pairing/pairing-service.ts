import crypto from 'crypto';
import { getDb } from '../firebase-admin.js';
import type { ChannelType, PairingRecord } from '../types/index.js';

const CODE_TTL_MS = 10 * 60 * 1000; 

export class PairingError extends Error {
  constructor(
    public readonly code: 'not_found' | 'expired' | 'already_used',
    message: string
  ) {
    super(message);
    this.name = 'PairingError';
  }
}

class PairingService {
  async createCode(
    channelType: ChannelType,
    channelUserId: string,
    chatId: string
  ): Promise<string> {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    const record: PairingRecord = {
      code,
      channelType,
      channelUserId,
      chatId,
      status: 'pending',
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    try {
      const db = getDb();
      await db.collection('claw_pairings').doc(code).set(record);
    } catch {
      
    }

    return code;
  }

  listenForApproval(code: string, callback: (approvedCode: string) => void): () => void {
    let unsubscribed = false;

    const timeout = setTimeout(() => {
      unsubscribed = true;
    }, CODE_TTL_MS);

    try {
      const db = getDb();
      const unsubscribe = db
        .collection('claw_pairings')
        .doc(code)
        .onSnapshot((snap) => {
          if (unsubscribed) return;
          const data = snap.data() as PairingRecord | undefined;
          if (data?.status === 'approved' && data?.channelUserId) {
            clearTimeout(timeout);
            unsubscribed = true;
            callback(code);
          }
        });

      return () => {
        clearTimeout(timeout);
        unsubscribed = true;
        unsubscribe();
      };
    } catch {
      clearTimeout(timeout);
      return () => {};
    }
  }

  async verifyCode(code: string): Promise<PairingRecord> {
    try {
      const db = getDb();
      const doc = await db.collection('claw_pairings').doc(code).get();

      if (!doc.exists) throw new PairingError('not_found', 'Code not found');

      const record = doc.data() as PairingRecord;

      if (new Date(record.expiresAt) < new Date()) {
        throw new PairingError('expired', 'Code has expired. Run /pair again.');
      }

      if (record.status === 'approved') {
        throw new PairingError('already_used', 'Code already used.');
      }

      return record;
    } catch (err) {
      if (err instanceof PairingError) throw err;
      throw new PairingError('not_found', 'Could not verify code.');
    }
  }
}

export const pairingService = new PairingService();
