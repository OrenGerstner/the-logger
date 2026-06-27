import type { Hand } from './types';

export interface AttributionResult {
  assignedHandId: string | null;
  candidateHandIds: string[];
  attributionConfidence: 'exact' | 'likely' | 'ambiguous' | null;
}

const DEFAULT_WINDOW_HANDS = 3;
const DEFAULT_WINDOW_MINUTES = 10;

export function calculateStackDelta(
  newStackAmount: number,
  previousStackAmount: number | null,
  buyInsSincePrevious: number,
  cashRemovedSincePrevious: number
): number | null {
  if (previousStackAmount === null) return null;
  return newStackAmount - previousStackAmount - buyInsSincePrevious + cashRemovedSincePrevious;
}

export function attributeStackDelta(
  delta: number | null,
  candidateHands: Hand[], // hands since previous snapshot, no manual amount
  currentTimestamp: string,
  windowHands: number = DEFAULT_WINDOW_HANDS,
  windowMinutes: number = DEFAULT_WINDOW_MINUTES
): AttributionResult {
  if (delta === null) {
    return { assignedHandId: null, candidateHandIds: [], attributionConfidence: null };
  }

  const windowMs = windowMinutes * 60 * 1000;
  const currentTime = new Date(currentTimestamp).getTime();

  // Filter to correlation window
  const windowedHands = candidateHands.filter((h) => {
    const handTime = new Date(h.timestamp).getTime();
    const ageMs = currentTime - handTime;
    return ageMs <= windowMs;
  });

  const recentHands = windowedHands.slice(-windowHands);
  const candidateHandIds = recentHands.map((h) => h.id);

  if (recentHands.length === 0) {
    return { assignedHandId: null, candidateHandIds: [], attributionConfidence: 'ambiguous' };
  }

  if (recentHands.length === 1) {
    return {
      assignedHandId: recentHands[0].id,
      candidateHandIds,
      attributionConfidence: 'exact',
    };
  }

  // Multiple candidates — attach to most recent with 'likely'
  const mostRecent = recentHands[recentHands.length - 1];
  return {
    assignedHandId: mostRecent.id,
    candidateHandIds,
    attributionConfidence: 'likely',
  };
}

export function computeSessionNet(
  buyIns: { amount: number }[],
  cashOut: number | null,
  latestStack: number | null,
  manualHandAmounts: (number | null)[]
): { net: number | null; source: 'final' | 'snapshot' | 'partial' } {
  const totalBuyIns = buyIns.reduce((s, b) => s + b.amount, 0);

  if (cashOut !== null) {
    return { net: cashOut - totalBuyIns, source: 'final' };
  }

  if (latestStack !== null) {
    return { net: latestStack - totalBuyIns, source: 'snapshot' };
  }

  const knownAmounts = manualHandAmounts.filter((a): a is number => a !== null);
  if (knownAmounts.length === 0) return { net: null, source: 'partial' };
  return {
    net: knownAmounts.reduce((s, a) => s + a, 0),
    source: 'partial',
  };
}
