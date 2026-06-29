import type { Position, Scenario, IcmPressure } from './types';
import rawPushFold from '@pushfold';

interface PushFoldData {
  meta: Record<string, string>;
  push: {
    SB: Record<string, number>;
    SB_bbAnte: Record<string, number>;
  };
  call: {
    BB_vs_SB: Record<string, number>;
    BB_vs_SB_bbAnte: Record<string, number>;
  };
}

const data = rawPushFold as PushFoldData;

// ICM tightening: lower the max-BB threshold by this factor so marginal hands drop out sooner.
// Near bubble: push -15%, call -10%; Final table: push/call both -28%.
const ICM_PUSH_FACTOR: Record<IcmPressure, number> = {
  chipEV: 1.0,
  nearBubble: 0.85,
  finalTable: 0.72,
};

const ICM_CALL_FACTOR: Record<IcmPressure, number> = {
  chipEV: 1.0,
  nearBubble: 0.90,
  finalTable: 0.72,
};

export type PushFoldRec = 'Shove' | 'Call' | 'Fold';

export interface PushFoldResult {
  rec: PushFoldRec | null;
  regime: 'pushfold' | 'offchart';
}

/**
 * Returns a push/fold recommendation for the given hand in a short-stack spot (effBB < 20).
 *
 * Covered:
 *   - Hero SB, RFI scenario  → open-shove lookup
 *   - Hero BB, FacingRFI vs SB → calling a SB shove
 *
 * Off-chart (returns null rec):
 *   - Any other position / scenario combination
 *   - No hand data for this key
 */
export function getPushFoldRec(
  scenario: Scenario,
  heroPosition: Position,
  facingPosition: Position | null,
  handKey: string,
  effBB: number,
  hasAnte: boolean,
  icmPressure: IcmPressure
): PushFoldResult {
  // SB open-shove (RFI = folded to hero)
  if (scenario === 'RFI' && heroPosition === 'SB') {
    const range = hasAnte ? data.push.SB_bbAnte : data.push.SB;
    const threshold = range[handKey];
    if (threshold === undefined) return { rec: null, regime: 'offchart' };
    const adjusted = threshold * ICM_PUSH_FACTOR[icmPressure];
    return { rec: effBB <= adjusted ? 'Shove' : 'Fold', regime: 'pushfold' };
  }

  // BB calling a SB shove (FacingRFI from SB)
  if (scenario === 'FacingRFI' && heroPosition === 'BB' && facingPosition === 'SB') {
    const range = hasAnte ? data.call.BB_vs_SB_bbAnte : data.call.BB_vs_SB;
    const threshold = range[handKey];
    if (threshold === undefined) return { rec: null, regime: 'offchart' };
    const adjusted = threshold * ICM_CALL_FACTOR[icmPressure];
    return { rec: effBB <= adjusted ? 'Call' : 'Fold', regime: 'pushfold' };
  }

  // All other positions / scenarios: off-chart in v1
  return { rec: null, regime: 'offchart' };
}

// Exposed for tests
export const pushFoldData = data;
