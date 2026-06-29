import { db } from './db';
import type { Session, BuyIn } from '@/domain/types';

export const sessionRepo = {
  async create(session: Session): Promise<void> {
    await db.sessions.add(session);
  },

  async getById(id: string): Promise<Session | undefined> {
    return db.sessions.get(id);
  },

  async getActive(): Promise<Session | undefined> {
    return db.sessions.where('status').equals('active').first();
  },

  async getAll(): Promise<Session[]> {
    return db.sessions.orderBy('createdAt').reverse().toArray();
  },

  async update(id: string, changes: Partial<Session>): Promise<void> {
    await db.sessions.update(id, changes);
  },

  async addBuyIn(id: string, buyIn: BuyIn): Promise<void> {
    const session = await db.sessions.get(id);
    if (!session) throw new Error(`Session ${id} not found`);
    await db.sessions.update(id, { buyIns: [...session.buyIns, buyIn] });
  },

  async end(id: string, cashOut: number): Promise<void> {
    await db.sessions.update(id, {
      status: 'ended',
      cashOut,
      endedAt: new Date().toISOString(),
      timerPausedAt: null,
    });
  },

  async endTournament(
    id: string,
    finishPlace: number | null,
    prizeWon: number | null,
    itm: boolean
  ): Promise<void> {
    await db.sessions.update(id, {
      status: 'ended',
      cashOut: prizeWon ?? 0,
      finishPlace,
      prizeWon,
      itm,
      endedAt: new Date().toISOString(),
      timerPausedAt: null,
    });
  },

  async setCurrentLevel(id: string, level: number): Promise<void> {
    await db.sessions.update(id, { currentLevel: level });
  },

  async setIcmPressure(id: string, pressure: import('@/domain/types').IcmPressure): Promise<void> {
    await db.sessions.update(id, { icmPressure: pressure });
  },

  async pauseTimer(id: string): Promise<void> {
    await db.sessions.update(id, { timerPausedAt: new Date().toISOString() });
  },

  async resumeTimer(id: string): Promise<void> {
    const session = await db.sessions.get(id);
    if (!session?.timerPausedAt) return;
    const pause = { startedAt: session.timerPausedAt, endedAt: new Date().toISOString() };
    await db.sessions.update(id, {
      timerPausedAt: null,
      timerPauses: [...session.timerPauses, pause],
    });
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.sessions, db.hands, db.stackSnapshots, async () => {
      await db.sessions.delete(id);
      await db.hands.where('sessionId').equals(id).delete();
      await db.stackSnapshots.where('sessionId').equals(id).delete();
    });
  },
};
