import { describe, it, expect } from 'vitest';
import {
  resolveFirstDecisionScenario,
  resolveSecondDecisionScenario,
  autoLabelAction,
} from '../scenarioResolver';
import type { OpponentAction } from '../types';

const action = (
  seat: number,
  position: OpponentAction['position'],
  action: OpponentAction['action']
): OpponentAction => ({ seat, position, action });

describe('resolveFirstDecisionScenario', () => {
  it('returns RFI when no raises before hero', () => {
    const result = resolveFirstDecisionScenario('CO', [
      action(1, 'UTG', 'fold'),
      action(2, 'UTG+1', 'fold'),
      action(3, 'LJ', 'fold'),
      action(4, 'HJ', 'fold'),
    ]);
    expect(result.scenario).toBe('RFI');
    expect(result.facingPosition).toBeNull();
  });

  it('returns FacingRFI with raiser position', () => {
    const result = resolveFirstDecisionScenario('BTN', [
      action(1, 'UTG', 'fold'),
      action(2, 'CO', 'open'),
    ]);
    expect(result.scenario).toBe('FacingRFI');
    expect(result.facingPosition).toBe('CO');
  });

  it('returns OffChart when a limper is present', () => {
    const result = resolveFirstDecisionScenario('CO', [
      action(1, 'UTG', 'limp'),
    ]);
    expect(result.scenario).toBe('OffChart');
  });

  it('returns OffChart when two raises before hero', () => {
    const result = resolveFirstDecisionScenario('BTN', [
      action(1, 'UTG', 'open'),
      action(2, 'CO', '3bet'),
    ]);
    expect(result.scenario).toBe('OffChart');
  });

  it('ignores actions from players acting AFTER hero', () => {
    // BB acts after BTN
    const result = resolveFirstDecisionScenario('BTN', [
      action(1, 'BB', 'open'),
    ]);
    expect(result.scenario).toBe('RFI');
  });
});

describe('resolveSecondDecisionScenario', () => {
  it('returns RFIvs3Bet when one player behind 3-bets', () => {
    const result = resolveSecondDecisionScenario('CO', [
      action(1, 'BTN', '3bet'),
    ]);
    expect(result?.scenario).toBe('RFIvs3Bet');
    expect(result?.facingPosition).toBe('BTN');
  });

  it('returns null when no one 3-bets behind', () => {
    const result = resolveSecondDecisionScenario('CO', [
      action(1, 'BTN', 'fold'),
      action(2, 'SB', 'fold'),
    ]);
    expect(result).toBeNull();
  });

  it('returns OffChart when two players 3-bet behind', () => {
    const result = resolveSecondDecisionScenario('UTG', [
      action(1, 'CO', '3bet'),
      action(2, 'BTN', '3bet'),
    ]);
    expect(result?.scenario).toBe('OffChart');
  });
});

describe('autoLabelAction', () => {
  it('labels first raise as open', () => {
    expect(autoLabelAction([])).toBe('open');
  });

  it('labels second raise as 3bet', () => {
    const actions = [action(1, 'UTG', 'open')];
    expect(autoLabelAction(actions)).toBe('3bet');
  });

  it('labels third raise as 4bet', () => {
    const actions = [action(1, 'UTG', 'open'), action(2, 'CO', '3bet')];
    expect(autoLabelAction(actions)).toBe('4bet');
  });
});
