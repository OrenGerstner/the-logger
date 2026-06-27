import { describe, it, expect } from 'vitest';
import { derivePositions, getHeroPosition, actsBeforeHero } from '../positions';

describe('derivePositions', () => {
  it('assigns all 9 positions correctly for a full table', () => {
    // Button at seat 7, seats 1-9 all occupied
    const seats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const positions = derivePositions(seats, 7);

    expect(positions.get(7)).toBe('BTN');
    expect(positions.get(8)).toBe('SB');
    expect(positions.get(9)).toBe('BB');
    expect(positions.get(1)).toBe('UTG');
    expect(positions.get(2)).toBe('UTG+1');
    expect(positions.get(3)).toBe('UTG+2');
    expect(positions.get(4)).toBe('LJ');
    expect(positions.get(5)).toBe('HJ');
    expect(positions.get(6)).toBe('CO');
  });

  it('wraps clockwise correctly when button is at seat 9', () => {
    const seats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const positions = derivePositions(seats, 9);

    expect(positions.get(9)).toBe('BTN');
    expect(positions.get(1)).toBe('SB');
    expect(positions.get(2)).toBe('BB');
    expect(positions.get(3)).toBe('UTG');
    expect(positions.get(8)).toBe('CO');
  });

  it('handles 6-handed correctly — drops earliest positions', () => {
    const seats = [1, 2, 3, 4, 5, 6];
    const positions = derivePositions(seats, 1);

    expect(positions.get(1)).toBe('BTN');
    expect(positions.get(2)).toBe('SB');
    expect(positions.get(3)).toBe('BB');
    expect(positions.get(4)).toBe('LJ');
    expect(positions.get(5)).toBe('HJ');
    expect(positions.get(6)).toBe('CO');
  });

  it('handles 8-handed — drops UTG', () => {
    const seats = [1, 2, 3, 4, 5, 6, 7, 8];
    const positions = derivePositions(seats, 1);

    const allPositions = Array.from(positions.values());
    expect(allPositions).not.toContain('UTG');
    expect(allPositions).toContain('UTG+1');
    expect(allPositions).toContain('BTN');
    expect(allPositions).toContain('BB');
  });

  it('returns empty map when button not in occupied seats', () => {
    const positions = derivePositions([1, 2, 3], 9);
    expect(positions.size).toBe(0);
  });

  it('handles 3-handed', () => {
    const positions = derivePositions([1, 2, 3], 1);
    expect(positions.get(1)).toBe('BTN');
    expect(positions.get(2)).toBe('SB');
    expect(positions.get(3)).toBe('BB');
  });
});

describe('getHeroPosition', () => {
  it('returns correct hero position', () => {
    const seats = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(getHeroPosition(seats, 7, 6)).toBe('CO');
    expect(getHeroPosition(seats, 7, 7)).toBe('BTN');
    expect(getHeroPosition(seats, 7, 9)).toBe('BB');
  });

  it('returns null when hero is not in occupied seats', () => {
    expect(getHeroPosition([1, 2, 3], 1, 5)).toBeNull();
  });
});

describe('actsBeforeHero', () => {
  it('identifies positions acting before hero', () => {
    expect(actsBeforeHero('UTG', 'CO')).toBe(true);
    expect(actsBeforeHero('CO', 'BTN')).toBe(true);
    expect(actsBeforeHero('BTN', 'SB')).toBe(true);
  });

  it('identifies positions acting after hero', () => {
    expect(actsBeforeHero('BTN', 'CO')).toBe(false);
    expect(actsBeforeHero('BB', 'SB')).toBe(false);
  });
});
