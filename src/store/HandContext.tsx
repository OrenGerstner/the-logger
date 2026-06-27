import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import type {
  Card,
  Position,
  HeroAction,
  OpponentAction,
  Scenario,
  BoardCards,
  PostflopActions,
  Hand,
} from '@/domain/types';
import { normalizeHand } from '@/domain/handNormalizer';
import { resolveFirstDecisionScenario, resolveSecondDecisionScenario } from '@/domain/scenarioResolver';
import { lookupRecommendation } from '@/domain/chartLookup';
import { checkDeviation } from '@/domain/deviationChecker';
import { isShortHanded } from '@/domain/positions';

export interface HandDraftPreflop {
  scenario: Scenario;
  facingPosition: Position | null;
  chartRecommendation: string | null;
  heroAction?: HeroAction;
  heroSecondAction?: HeroAction | null;
  opponentActions: OpponentAction[];
  deviation?: boolean;
}

export interface HandDraft {
  id: string;
  sessionId: string;
  handNumber: number;
  tableSize: number;
  shortHanded: boolean;
  buttonSeat: number;
  heroSeat: number;
  heroPosition: Position;
  holeCards?: [Card, Card];
  handKey?: string;
  preflop: HandDraftPreflop;
  board: BoardCards;
  postflop: PostflopActions;
  result?: 'won' | 'lost' | 'folded' | null;
  wouldHave?: 'won' | 'lost' | 'no_showdown' | null;
  amount?: number | null;
  amountSource?: 'manual' | 'stack_snapshot' | 'unentered';
  stackBefore?: number | null;
  stackAfter?: number | null;
  note?: string;
}

interface HandCtx {
  draft: HandDraft | null;
  startNewHand(params: {
    sessionId: string;
    handNumber: number;
    occupiedSeats: number[];
    buttonSeat: number;
    heroSeat: number;
    heroPosition: Position;
  }): void;
  setHoleCards(cards: [Card, Card]): void;
  addOpponentAction(action: OpponentAction): void;
  removeOpponentAction(seat: number): void;
  setHeroAction(action: HeroAction): void;
  setHeroSecondAction(action: HeroAction): void;
  setBoard(board: Partial<BoardCards>): void;
  setPostflopAction(street: keyof PostflopActions, action: HeroAction): void;
  setResult(result: 'won' | 'lost' | 'folded'): void;
  setWouldHave(outcome: 'won' | 'lost' | 'no_showdown'): void;
  setAmount(amount: number | null): void;
  setNote(note: string): void;
  setStackAfter(stack: number): void;
  toHand(): Hand | null;
  clearDraft(): void;
}

const HandContext = createContext<HandCtx | null>(null);

const DRAFT_KEY = 'logger-hand-draft';

function loadDraft(): HandDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as HandDraft) : null;
  } catch { return null; }
}

function persistDraft(draft: HandDraft | null): void {
  try {
    if (draft === null) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage full or private mode */ }
}

function buildPreflopState(
  heroPosition: Position,
  opponentActions: OpponentAction[],
  handKey?: string
): HandDraftPreflop {
  const firstDecision = resolveFirstDecisionScenario(heroPosition, opponentActions);
  const secondDecision = resolveSecondDecisionScenario(heroPosition, opponentActions);

  const scenario = secondDecision?.scenario ?? firstDecision.scenario;
  const facingPosition = secondDecision?.facingPosition ?? firstDecision.facingPosition;

  const chartRecommendation =
    handKey
      ? lookupRecommendation(scenario, heroPosition, facingPosition, handKey)
      : null;

  return {
    scenario,
    facingPosition,
    chartRecommendation,
    opponentActions,
  };
}

export function HandProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<HandDraft | null>(loadDraft);

  useEffect(() => {
    persistDraft(draft);
  }, [draft]);

  const startNewHand = useCallback((params: {
    sessionId: string;
    handNumber: number;
    occupiedSeats: number[];
    buttonSeat: number;
    heroSeat: number;
    heroPosition: Position;
  }) => {
    const { sessionId, handNumber, occupiedSeats, buttonSeat, heroSeat, heroPosition } = params;
    setDraft({
      id: uuid(),
      sessionId,
      handNumber,
      tableSize: occupiedSeats.length,
      shortHanded: isShortHanded(occupiedSeats),
      buttonSeat,
      heroSeat,
      heroPosition,
      preflop: buildPreflopState(heroPosition, []),
      board: {},
      postflop: {},
    });
  }, []);

  const setHoleCards = useCallback((cards: [Card, Card]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const handKey = normalizeHand(cards[0], cards[1]);
      const preflop = buildPreflopState(prev.heroPosition, prev.preflop.opponentActions, handKey);
      return { ...prev, holeCards: cards, handKey, preflop };
    });
  }, []);

  const addOpponentAction = useCallback((action: OpponentAction) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const existing = prev.preflop.opponentActions.filter((a) => a.seat !== action.seat);
      const opponentActions = [...existing, action];
      const preflop = buildPreflopState(prev.heroPosition, opponentActions, prev.handKey);
      return { ...prev, preflop: { ...preflop, heroAction: prev.preflop.heroAction } };
    });
  }, []);

  const removeOpponentAction = useCallback((seat: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const opponentActions = prev.preflop.opponentActions.filter((a) => a.seat !== seat);
      const preflop = buildPreflopState(prev.heroPosition, opponentActions, prev.handKey);
      return { ...prev, preflop: { ...preflop, heroAction: prev.preflop.heroAction } };
    });
  }, []);

  const setHeroAction = useCallback((action: HeroAction) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const deviation = checkDeviation(action, prev.preflop.chartRecommendation ?? null);
      return {
        ...prev,
        preflop: { ...prev.preflop, heroAction: action, deviation },
      };
    });
  }, []);

  const setHeroSecondAction = useCallback((action: HeroAction) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const deviation = checkDeviation(action, prev.preflop.chartRecommendation ?? null);
      return {
        ...prev,
        preflop: { ...prev.preflop, heroSecondAction: action, deviation },
      };
    });
  }, []);

  const setBoard = useCallback((board: Partial<BoardCards>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, board: { ...prev.board, ...board } };
    });
  }, []);

  const setPostflopAction = useCallback((street: keyof PostflopActions, action: HeroAction) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, postflop: { ...prev.postflop, [street]: action } };
    });
  }, []);

  const setResult = useCallback((result: 'won' | 'lost' | 'folded') => {
    setDraft((prev) => prev ? { ...prev, result } : prev);
  }, []);

  const setWouldHave = useCallback((outcome: 'won' | 'lost' | 'no_showdown') => {
    setDraft((prev) => prev ? { ...prev, wouldHave: outcome } : prev);
  }, []);

  const setAmount = useCallback((amount: number | null) => {
    setDraft((prev) =>
      prev ? { ...prev, amount, amountSource: amount === null ? 'unentered' : 'manual' } : prev
    );
  }, []);

  const setNote = useCallback((note: string) => {
    setDraft((prev) => prev ? { ...prev, note } : prev);
  }, []);

  const setStackAfter = useCallback((stack: number) => {
    setDraft((prev) => prev ? { ...prev, stackAfter: stack } : prev);
  }, []);

  const toHand = useCallback((): Hand | null => {
    const d = draft;
    if (!d || !d.holeCards || !d.handKey) return null;
    return {
      id: d.id,
      sessionId: d.sessionId,
      handNumber: d.handNumber,
      timestamp: new Date().toISOString(),
      tableSize: d.tableSize,
      shortHanded: d.shortHanded,
      buttonSeat: d.buttonSeat,
      heroSeat: d.heroSeat,
      heroPosition: d.heroPosition,
      holeCards: d.holeCards,
      handKey: d.handKey,
      preflop: {
        scenario: d.preflop.scenario,
        facingPosition: d.preflop.facingPosition,
        chartRecommendation: d.preflop.chartRecommendation,
        heroAction: d.preflop.heroAction,
        heroSecondAction: d.preflop.heroSecondAction,
        opponentActions: d.preflop.opponentActions,
        deviation: d.preflop.deviation,
      },
      board: d.board,
      postflop: d.postflop,
      result: d.result ?? null,
      wouldHave: d.wouldHave ?? null,
      amount: d.amount ?? null,
      amountSource: d.amountSource ?? 'unentered',
      stackBefore: d.stackBefore ?? null,
      stackAfter: d.stackAfter ?? null,
      stackAttributionConfidence: null,
      note: d.note ?? '',
    };
  }, [draft]);

  const clearDraft = useCallback(() => setDraft(null), []);

  return (
    <HandContext.Provider value={{
      draft,
      startNewHand,
      setHoleCards,
      addOpponentAction,
      removeOpponentAction,
      setHeroAction,
      setHeroSecondAction,
      setBoard,
      setPostflopAction,
      setResult,
      setWouldHave,
      setAmount,
      setNote,
      setStackAfter,
      toHand,
      clearDraft,
    }}>
      {children}
    </HandContext.Provider>
  );
}

export function useHand() {
  const ctx = useContext(HandContext);
  if (!ctx) throw new Error('useHand must be used within HandProvider');
  return ctx;
}
