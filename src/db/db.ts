import Dexie, { type Table } from 'dexie';
import type { Session, Hand, StackSnapshot } from '@/domain/types';

export class LoggerDB extends Dexie {
  sessions!: Table<Session, string>;
  hands!: Table<Hand, string>;
  stackSnapshots!: Table<StackSnapshot, string>;

  constructor() {
    super('the-logger-db');
    this.version(1).stores({
      sessions: 'id, status, createdAt',
      hands: 'id, sessionId, handNumber, timestamp',
      stackSnapshots: 'id, sessionId, createdAt',
    });
  }
}

export const db = new LoggerDB();
