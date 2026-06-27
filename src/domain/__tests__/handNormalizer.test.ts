import { describe, it, expect } from 'vitest';
import { normalizeHand } from '../handNormalizer';
import type { Card } from '../types';

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({ rank, suit });

describe('normalizeHand', () => {
  it('returns pair key', () => {
    expect(normalizeHand(c('A', 's'), c('A', 'h'))).toBe('AA');
    expect(normalizeHand(c('2', 'c'), c('2', 'd'))).toBe('22');
  });

  it('returns suited key with higher rank first', () => {
    expect(normalizeHand(c('K', 's'), c('A', 's'))).toBe('AKs');
    expect(normalizeHand(c('A', 's'), c('K', 's'))).toBe('AKs');
    expect(normalizeHand(c('T', 'h'), c('9', 'h'))).toBe('T9s');
  });

  it('returns offsuit key with higher rank first', () => {
    expect(normalizeHand(c('K', 's'), c('A', 'h'))).toBe('AKo');
    expect(normalizeHand(c('A', 'h'), c('K', 's'))).toBe('AKo');
    expect(normalizeHand(c('7', 'd'), c('2', 'c'))).toBe('72o');
  });

  it('handles T (ten) rank correctly', () => {
    expect(normalizeHand(c('T', 's'), c('T', 'h'))).toBe('TT');
    expect(normalizeHand(c('J', 'd'), c('T', 'd'))).toBe('JTs');
  });
});
