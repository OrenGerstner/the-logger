import type { Position, Scenario, OpponentAction } from './types';
import { actsBeforeHero } from './positions';

export interface ScenarioResult {
  scenario: Scenario;
  facingPosition: Position | null;
}

export function resolveFirstDecisionScenario(
  heroPosition: Position,
  opponentActions: OpponentAction[]
): ScenarioResult {
  const actorsBefore = opponentActions.filter((a) =>
    actsBeforeHero(a.position, heroPosition)
  );

  const raises = actorsBefore.filter((a) => a.action === 'open');
  const limps = actorsBefore.filter((a) => a.action === 'limp');
  const threeBets = actorsBefore.filter((a) => a.action === '3bet');
  const fourBets = actorsBefore.filter((a) => a.action === '4bet');

  // 2+ raises before hero (a 3-bet has already happened)
  if (threeBets.length > 0 || fourBets.length > 0 || raises.length >= 2) {
    return { scenario: 'OffChart', facingPosition: null };
  }

  // A limper before hero (open-limp, no raise yet)
  if (limps.length > 0 && raises.length === 0) {
    return { scenario: 'OffChart', facingPosition: null };
  }

  // Exactly one raise before hero
  if (raises.length === 1) {
    return { scenario: 'FacingRFI', facingPosition: raises[0].position };
  }

  // No raise before hero — hero is first in
  return { scenario: 'RFI', facingPosition: null };
}

export function resolveSecondDecisionScenario(
  heroPosition: Position,
  opponentActions: OpponentAction[]
): ScenarioResult | null {
  // Only relevant when hero opened (raised first in)
  // Look for a single 3-bet behind hero's open
  const actorsAfter = opponentActions.filter(
    (a) => !actsBeforeHero(a.position, heroPosition) && a.position !== heroPosition
  );

  const threeBets = actorsAfter.filter((a) => a.action === '3bet');
  const fourBets = actorsAfter.filter((a) => a.action === '4bet');

  if (fourBets.length > 0 || threeBets.length >= 2) {
    return { scenario: 'OffChart', facingPosition: null };
  }

  if (threeBets.length === 1) {
    return { scenario: 'RFIvs3Bet', facingPosition: threeBets[0].position };
  }

  return null; // no second decision yet
}

export function autoLabelAction(
  currentOpponentActions: OpponentAction[]
): OpponentAction['action'] {
  const raises = currentOpponentActions.filter(
    (a) => a.action === 'open' || a.action === '3bet' || a.action === '4bet'
  );
  if (raises.length === 0) return 'open';
  if (raises.length === 1) return '3bet';
  return '4bet';
}
