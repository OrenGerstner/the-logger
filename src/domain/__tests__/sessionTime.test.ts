import { describe, it, expect } from 'vitest';
import {
  calculateElapsedSeconds,
  formatElapsedTime,
  calculateProfitPerHour,
} from '../sessionTime';

describe('calculateElapsedSeconds', () => {
  it('returns elapsed time for a completed session with no pauses', () => {
    const start = new Date(Date.now() - 3600_000).toISOString(); // 1 hour ago
    const end = new Date().toISOString();
    const elapsed = calculateElapsedSeconds(start, [], null, end);
    expect(elapsed).toBeCloseTo(3600, -1); // within ~10 seconds
  });

  it('subtracts pause time', () => {
    const startTime = Date.now() - 3600_000; // 1 hour ago
    const start = new Date(startTime).toISOString();
    const end = new Date().toISOString();
    const pauses = [
      {
        startedAt: new Date(startTime + 900_000).toISOString(), // 15min in
        endedAt: new Date(startTime + 2700_000).toISOString(),  // 45min in (30min pause)
      },
    ];
    const elapsed = calculateElapsedSeconds(start, pauses, null, end);
    expect(elapsed).toBeCloseTo(1800, -1); // ~30 minutes
  });

  it('returns 0 for zero elapsed time', () => {
    const now = new Date().toISOString();
    const elapsed = calculateElapsedSeconds(now, [], null, now);
    expect(elapsed).toBe(0);
  });
});

describe('formatElapsedTime', () => {
  it('formats seconds-only correctly', () => {
    expect(formatElapsedTime(45)).toBe('0:45');
    expect(formatElapsedTime(0)).toBe('0:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatElapsedTime(125)).toBe('2:05');
    expect(formatElapsedTime(3599)).toBe('59:59');
  });

  it('formats hours correctly', () => {
    expect(formatElapsedTime(3600)).toBe('1:00:00');
    expect(formatElapsedTime(7265)).toBe('2:01:05');
  });
});

describe('calculateProfitPerHour', () => {
  it('returns null for very short sessions', () => {
    expect(calculateProfitPerHour(100, 30)).toBeNull();
  });

  it('calculates correctly', () => {
    expect(calculateProfitPerHour(100, 3600)).toBeCloseTo(100, 1);
    expect(calculateProfitPerHour(200, 7200)).toBeCloseTo(100, 1);
  });

  it('handles negative net', () => {
    expect(calculateProfitPerHour(-150, 3600)).toBeCloseTo(-150, 1);
  });
});
