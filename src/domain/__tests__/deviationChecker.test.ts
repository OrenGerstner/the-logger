import { describe, it, expect } from 'vitest';
import { getActionFamily, checkDeviation, displayRecommendation } from '../deviationChecker';

describe('getActionFamily', () => {
  it('maps all raise-family labels to Raise', () => {
    for (const label of [
      'Raise', 'Raise for Value', 'Raise as a Bluff',
      '3-Bet for Value', '3-Bet as a Bluff',
      '4-Bet for Value', '4-Bet as a Bluff',
    ]) {
      expect(getActionFamily(label)).toBe('Raise');
    }
  });

  it('maps Call and Limp to Call family', () => {
    expect(getActionFamily('Call')).toBe('Call');
    expect(getActionFamily('Limp')).toBe('Call');
  });

  it('maps Fold to Fold family', () => {
    expect(getActionFamily('Fold')).toBe('Fold');
  });
});

describe('checkDeviation', () => {
  it('returns false when hero action matches chart family', () => {
    expect(checkDeviation('Raise', '3-Bet for Value')).toBe(false);
    expect(checkDeviation('Call', 'Call')).toBe(false);
    expect(checkDeviation('Fold', 'Fold')).toBe(false);
    expect(checkDeviation('Call', 'Limp')).toBe(false);
  });

  it('returns true when hero action differs from chart family', () => {
    expect(checkDeviation('Fold', '3-Bet for Value')).toBe(true);
    expect(checkDeviation('Raise', 'Call')).toBe(true);
    expect(checkDeviation('Call', 'Fold')).toBe(true);
  });

  it('returns false when no chart recommendation exists', () => {
    expect(checkDeviation('Raise', null)).toBe(false);
    expect(checkDeviation('Fold', null)).toBe(false);
  });
});

describe('displayRecommendation', () => {
  it('converts Limp to Call', () => {
    expect(displayRecommendation('Limp')).toBe('Call');
  });

  it('passes other labels through unchanged', () => {
    expect(displayRecommendation('3-Bet for Value')).toBe('3-Bet for Value');
    expect(displayRecommendation('Fold')).toBe('Fold');
  });
});
