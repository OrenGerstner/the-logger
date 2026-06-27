import { db } from './db';
import type { Hand } from '@/domain/types';

export const handRepo = {
  async create(hand: Hand): Promise<void> {
    await db.hands.add(hand);
  },

  async getById(id: string): Promise<Hand | undefined> {
    return db.hands.get(id);
  },

  async getBySession(sessionId: string): Promise<Hand[]> {
    return db.hands
      .where('sessionId')
      .equals(sessionId)
      .sortBy('handNumber');
  },

  async getNextHandNumber(sessionId: string): Promise<number> {
    const hands = await db.hands.where('sessionId').equals(sessionId).toArray();
    if (hands.length === 0) return 1;
    return Math.max(...hands.map((h) => h.handNumber)) + 1;
  },

  async update(id: string, changes: Partial<Hand>): Promise<void> {
    await db.hands.update(id, changes);
  },

  async delete(id: string): Promise<void> {
    await db.hands.delete(id);
  },
};
