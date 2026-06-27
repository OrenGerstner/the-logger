import { describe, it, expect } from 'vitest';
import { lookupRFI, lookupFacingRFI, lookupRFIvs3Bet, charts } from '../chartLookup';

// Combo weight helpers
const comboWeight = (handKey: string): number => {
  if (handKey.length === 2) return 6; // pair
  if (handKey.endsWith('s')) return 4; // suited
  return 12; // offsuit
};

const VALID_RANKS = 'AKQJT98765432'.split('');
const VALID_KEY_RE = /^(AA|KK|QQ|JJ|TT|99|88|77|66|55|44|33|22|[AKQJT98765432]{2}[so])$/;

function validateChart(chart: Record<string, string>, chartName: string) {
  const keys = Object.keys(chart);

  // Must have exactly 169 hand keys
  expect(keys.length, `${chartName}: must have 169 keys`).toBe(169);

  // All keys must be valid hand keys
  for (const key of keys) {
    expect(
      VALID_KEY_RE.test(key),
      `${chartName}: invalid key "${key}"`
    ).toBe(true);
  }

  // Total combos must be 1326
  const totalCombos = keys.reduce((sum, k) => sum + comboWeight(k), 0);
  expect(totalCombos, `${chartName}: total combos must be 1326`).toBe(1326);

  // All ranks must appear as high-card in some hand key
  for (const rank of VALID_RANKS) {
    const hasRank = keys.some((k) => k.startsWith(rank));
    expect(hasRank, `${chartName}: rank ${rank} missing from keys`).toBe(true);
  }
}

describe('chart data integrity — mandatory checksum', () => {
  describe('RFI charts', () => {
    it('UTG has 169 keys and 1326 combos', () => validateChart(charts.RFI['UTG'] ?? {}, 'RFI UTG'));
    it('UTG+1 has 169 keys and 1326 combos', () => validateChart(charts.RFI['UTG+1'] ?? {}, 'RFI UTG+1'));
    it('UTG+2 has 169 keys and 1326 combos', () => validateChart(charts.RFI['UTG+2'] ?? {}, 'RFI UTG+2'));
    it('LJ has 169 keys and 1326 combos', () => validateChart(charts.RFI['LJ'] ?? {}, 'RFI LJ'));
    it('HJ has 169 keys and 1326 combos', () => validateChart(charts.RFI['HJ'] ?? {}, 'RFI HJ'));
    it('CO has 169 keys and 1326 combos', () => validateChart(charts.RFI['CO'] ?? {}, 'RFI CO'));
    it('BTN has 169 keys and 1326 combos', () => validateChart(charts.RFI['BTN'] ?? {}, 'RFI BTN'));
    it('SB has 169 keys and 1326 combos', () => validateChart(charts.RFI['SB'] ?? {}, 'RFI SB'));
  });

  describe('FacingRFI charts', () => {
    for (const [chartKey, chart] of Object.entries(charts.FacingRFI)) {
      it(`"${chartKey}" has 169 keys and 1326 combos`, () =>
        validateChart(chart as Record<string, string>, `FacingRFI ${chartKey}`));
    }
  });

  describe('RFIvs3Bet charts', () => {
    for (const [chartKey, chart] of Object.entries(charts.RFIvs3Bet)) {
      it(`"${chartKey}" has 169 keys and 1326 combos`, () =>
        validateChart(chart as Record<string, string>, `RFIvs3Bet ${chartKey}`));
    }
  });
});

describe('spot-check known chart values', () => {
  it('RFI UTG: AA is Raise', () => {
    expect(lookupRFI('UTG', 'AA')).toBe('Raise');
  });

  it('RFI UTG: 72o is Fold', () => {
    expect(lookupRFI('UTG', '72o')).toBe('Fold');
  });

  it('RFI BTN: returns a value for all 169 hands', () => {
    const chart = charts.RFI['BTN'];
    expect(Object.keys(chart).length).toBe(169);
    for (const val of Object.values(chart)) {
      expect(['Raise', 'Fold']).toContain(val);
    }
  });

  it('FacingRFI BTN vs UTG: AA is 3-Bet for Value', () => {
    expect(lookupFacingRFI('BTN', 'UTG', 'AA')).toBe('3-Bet for Value');
  });

  it('FacingRFI lookup handles grouped raiser positions (UTG → UTG/UTG+1 key)', () => {
    // LJ vs UTG/UTG+1 should work for both raiser=UTG and raiser=UTG+1
    const forUTG = lookupFacingRFI('LJ', 'UTG', 'AA');
    const forUTG1 = lookupFacingRFI('LJ', 'UTG+1', 'AA');
    expect(forUTG).not.toBeNull();
    expect(forUTG1).not.toBeNull();
  });

  it('RFIvs3Bet UTG vs CO/BTN: AA has a recommendation', () => {
    expect(lookupRFIvs3Bet('UTG', 'CO', 'AA')).not.toBeNull();
    expect(lookupRFIvs3Bet('UTG', 'BTN', 'AA')).not.toBeNull();
  });

  it('returns null for nonexistent chart pairing', () => {
    // There is no "UTG vs UTG+1" RFI (UTG can't be facing UTG)
    expect(lookupFacingRFI('UTG', 'UTG', 'AA')).toBeNull();
  });
});
