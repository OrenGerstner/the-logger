import type { Card, Rank } from './types';

const RANK_ORDER: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

export function rankIndex(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

export function normalizeHand(card1: Card, card2: Card): string {
  // Sort so the higher rank comes first
  const [high, low] =
    rankIndex(card1.rank) <= rankIndex(card2.rank)
      ? [card1, card2]
      : [card2, card1];

  if (high.rank === low.rank) {
    return `${high.rank}${low.rank}`; // pair: AA, KK, ...
  }

  const suited = high.suit === low.suit;
  return `${high.rank}${low.rank}${suited ? 's' : 'o'}`;
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function parseCard(str: string): Card {
  if (str.length !== 2) throw new Error(`Invalid card: ${str}`);
  return { rank: str[0] as Card['rank'], suit: str[1] as Card['suit'] };
}

export const ALL_RANKS = RANK_ORDER;
export const ALL_SUITS: Card['suit'][] = ['s', 'h', 'd', 'c'];
