import { describe, it, expect } from 'vitest';
import { pushFoldData, getPushFoldRec } from '../pushFoldLookup';

const HAND_KEY_RE = /^(AA|KK|QQ|JJ|TT|99|88|77|66|55|44|33|22|[AKQJT98765432]{2}[so])$/;

function assertRange(range: Record<string, number>, name: string) {
  const keys = Object.keys(range);
  expect(keys.length, `${name}: must have 169 hand keys`).toBe(169);
  for (const key of keys) {
    expect(HAND_KEY_RE.test(key), `${name}: invalid key "${key}"`).toBe(true);
    expect(typeof range[key], `${name}: value for "${key}" must be number`).toBe('number');
  }
}

describe('push/fold data integrity — mandatory checksum', () => {
  it('push.SB has 169 hand keys', () => assertRange(pushFoldData.push.SB, 'push.SB'));
  it('push.SB_bbAnte has 169 hand keys', () => assertRange(pushFoldData.push.SB_bbAnte, 'push.SB_bbAnte'));
  it('call.BB_vs_SB has 169 hand keys', () => assertRange(pushFoldData.call.BB_vs_SB, 'call.BB_vs_SB'));
  it('call.BB_vs_SB_bbAnte has 169 hand keys', () => assertRange(pushFoldData.call.BB_vs_SB_bbAnte, 'call.BB_vs_SB_bbAnte'));
});

describe('getPushFoldRec — known values', () => {
  it('SB RFI with AA at 10bb (no ante) → Shove', () => {
    const r = getPushFoldRec('RFI', 'SB', null, 'AA', 10, false, 'chipEV');
    expect(r.rec).toBe('Shove');
    expect(r.regime).toBe('pushfold');
  });

  it('SB RFI with 72o at 1.5bb (no ante) → Shove (threshold 1.6 > 1.5)', () => {
    const r = getPushFoldRec('RFI', 'SB', null, '72o', 1.5, false, 'chipEV');
    expect(r.rec).toBe('Shove');
    expect(r.regime).toBe('pushfold');
  });

  it('SB RFI with 72o at 2bb (no ante) → Fold (threshold 1.6 < 2)', () => {
    const r = getPushFoldRec('RFI', 'SB', null, '72o', 2, false, 'chipEV');
    expect(r.rec).toBe('Fold');
  });

  it('BB vs SB shove with AA at 10bb (bbAnte) → Call', () => {
    const r = getPushFoldRec('FacingRFI', 'BB', 'SB', 'AA', 10, true, 'chipEV');
    expect(r.rec).toBe('Call');
    expect(r.regime).toBe('pushfold');
  });

  it('Off-chart: UTG RFI → null rec, offchart regime', () => {
    const r = getPushFoldRec('RFI', 'UTG', null, 'AA', 8, false, 'chipEV');
    expect(r.rec).toBeNull();
    expect(r.regime).toBe('offchart');
  });

  it('ICM near-bubble tightens SB shove threshold', () => {
    // Find a hand that is right at the edge: chip-EV says shove, bubble says fold
    // K6s: threshold 36bb. At 32bb chip-EV → shove; at 32bb nearBubble (36 * 0.85 = 30.6) → fold
    const chipEV = getPushFoldRec('RFI', 'SB', null, 'K6s', 32, false, 'chipEV');
    const bubble = getPushFoldRec('RFI', 'SB', null, 'K6s', 32, false, 'nearBubble');
    expect(chipEV.rec).toBe('Shove');
    expect(bubble.rec).toBe('Fold');
  });
});
