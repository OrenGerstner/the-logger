import { db } from './db';
import type { StackSnapshot } from '@/domain/types';

export const stackSnapshotRepo = {
  async create(snapshot: StackSnapshot): Promise<void> {
    await db.stackSnapshots.add(snapshot);
  },

  async getBySession(sessionId: string): Promise<StackSnapshot[]> {
    return db.stackSnapshots
      .where('sessionId')
      .equals(sessionId)
      .sortBy('createdAt');
  },

  async getLatestBySession(sessionId: string): Promise<StackSnapshot | undefined> {
    const snapshots = await db.stackSnapshots
      .where('sessionId')
      .equals(sessionId)
      .sortBy('createdAt');
    return snapshots[snapshots.length - 1];
  },

  async update(id: string, changes: Partial<StackSnapshot>): Promise<void> {
    await db.stackSnapshots.update(id, changes);
  },

  async delete(id: string): Promise<void> {
    await db.stackSnapshots.delete(id);
  },
};
