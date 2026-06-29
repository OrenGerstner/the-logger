import React, { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuid } from 'uuid';
import type { Session, IcmPressure } from '@/domain/types';
import { sessionRepo } from '@/db/sessionRepo';
import { stackSnapshotRepo } from '@/db/stackSnapshotRepo';

type SessionCreateParams = Omit<Session, 'id' | 'status' | 'endedAt' | 'timerPauses' | 'timerPausedAt'>;

interface SessionCtx {
  activeSession: Session | undefined;
  isLoading: boolean;
  createSession(params: SessionCreateParams): Promise<string>;
  endSession(cashOut: number): Promise<void>;
  endTournamentSession(finishPlace: number | null, prizeWon: number | null, itm: boolean): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  pauseTimer(): Promise<void>;
  resumeTimer(): Promise<void>;
  createQuickStackSnapshot(stack: number, handNumberContext: number): Promise<void>;
  setCurrentLevel(level: number): Promise<void>;
  setIcmPressure(pressure: IcmPressure): Promise<void>;
}

const SessionContext = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryResult = useLiveQuery(() =>
    sessionRepo.getActive().then((s) => ({ session: s }))
  );
  const activeSession: Session | undefined = queryResult?.session;
  const isLoading = queryResult === undefined;

  async function createSession(params: SessionCreateParams): Promise<string> {
    const id = uuid();
    const now = new Date().toISOString();
    const session: Session = {
      ...params,
      id,
      status: 'active',
      endedAt: null,
      timerPauses: [],
      timerPausedAt: null,
    };
    await sessionRepo.create(session);

    if (params.startingStack !== null) {
      await stackSnapshotRepo.create({
        id: uuid(),
        sessionId: id,
        createdAt: now,
        handNumberContext: 0,
        stackAmount: params.startingStack,
        previousStackAmount: null,
        deltaFromPrevious: null,
        source: 'session_start',
        candidateHandIds: [],
        assignedHandId: null,
        attributionConfidence: null,
        note: '',
      });
    }

    return id;
  }

  async function endSession(cashOut: number): Promise<void> {
    if (!activeSession) return;
    const now = new Date().toISOString();
    await sessionRepo.end(activeSession.id, cashOut);
    await stackSnapshotRepo.create({
      id: uuid(),
      sessionId: activeSession.id,
      createdAt: now,
      handNumberContext: 0,
      stackAmount: cashOut,
      previousStackAmount: null,
      deltaFromPrevious: null,
      source: 'session_end',
      candidateHandIds: [],
      assignedHandId: null,
      attributionConfidence: null,
      note: '',
    });
  }

  async function endTournamentSession(
    finishPlace: number | null,
    prizeWon: number | null,
    itm: boolean
  ): Promise<void> {
    if (!activeSession) return;
    const prize = prizeWon ?? 0;
    await sessionRepo.endTournament(activeSession.id, finishPlace, prizeWon, itm);
    await stackSnapshotRepo.create({
      id: uuid(),
      sessionId: activeSession.id,
      createdAt: new Date().toISOString(),
      handNumberContext: 0,
      stackAmount: prize,
      previousStackAmount: null,
      deltaFromPrevious: null,
      source: 'session_end',
      candidateHandIds: [],
      assignedHandId: null,
      attributionConfidence: null,
      note: '',
    });
  }

  async function deleteSession(sessionId: string): Promise<void> {
    await sessionRepo.delete(sessionId);
  }

  async function setCurrentLevel(level: number): Promise<void> {
    if (!activeSession) return;
    await sessionRepo.setCurrentLevel(activeSession.id, level);
  }

  async function setIcmPressure(pressure: import('@/domain/types').IcmPressure): Promise<void> {
    if (!activeSession) return;
    await sessionRepo.setIcmPressure(activeSession.id, pressure);
  }

  async function pauseTimer(): Promise<void> {
    if (!activeSession || activeSession.timerPausedAt) return;
    await sessionRepo.pauseTimer(activeSession.id);
  }

  async function resumeTimer(): Promise<void> {
    if (!activeSession || !activeSession.timerPausedAt) return;
    await sessionRepo.resumeTimer(activeSession.id);
  }

  async function createQuickStackSnapshot(stack: number, handNumberContext: number): Promise<void> {
    if (!activeSession) return;
    const latest = await stackSnapshotRepo.getLatestBySession(activeSession.id);
    const previousStack = latest?.stackAmount ?? null;
    const delta = previousStack !== null ? stack - previousStack : null;

    await stackSnapshotRepo.create({
      id: uuid(),
      sessionId: activeSession.id,
      createdAt: new Date().toISOString(),
      handNumberContext,
      stackAmount: stack,
      previousStackAmount: previousStack,
      deltaFromPrevious: delta,
      source: 'quick_update',
      candidateHandIds: [],
      assignedHandId: null,
      attributionConfidence: delta !== null ? 'ambiguous' : null,
      note: '',
    });
  }

  return (
    <SessionContext.Provider value={{
      activeSession,
      isLoading,
      createSession,
      endSession,
      endTournamentSession,
      deleteSession,
      pauseTimer,
      resumeTimer,
      createQuickStackSnapshot,
      setCurrentLevel,
      setIcmPressure,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
