import type { Position } from './types';

const POSITION_ACTION_ORDER: Position[] = [
  'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB',
];

export const POSITION_ORDER: Record<Position, number> = Object.fromEntries(
  POSITION_ACTION_ORDER.map((p, i) => [p, i])
) as Record<Position, number>;

const POSITIONS_BY_COUNT: Record<number, Position[]> = {
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
};

function sortClockwise(seats: number[], buttonSeat: number): number[] {
  const maxSeat = 9; // physical seats are always 1-9
  const normalize = (seat: number) => {
    const diff = seat - buttonSeat;
    if (diff === 0) return 0;
    return diff < 0 ? diff + maxSeat : diff;
  };
  return [...seats].sort((a, b) => normalize(a) - normalize(b));
}

export function derivePositions(
  occupiedSeats: number[],
  buttonSeat: number
): Map<number, Position> {
  const n = occupiedSeats.length;
  if (n < 3 || n > 9 || !occupiedSeats.includes(buttonSeat)) return new Map();

  const positionSet = POSITIONS_BY_COUNT[n];
  if (!positionSet) return new Map();

  // Sort seats clockwise starting from button
  const sorted = sortClockwise(occupiedSeats, buttonSeat);
  // sorted[0] = BTN, sorted[1] = SB, sorted[2] = BB, sorted[3..] = early positions

  // positionSet = [early..., BTN, SB, BB] (action order)
  // Early positions (everything before BTN, SB, BB):
  const earlyPositions = positionSet.slice(0, -3); // e.g. ['UTG', 'UTG+1', ..., 'CO']

  const result = new Map<number, Position>();
  result.set(sorted[0], 'BTN');
  result.set(sorted[1], 'SB');
  result.set(sorted[2], 'BB');
  for (let i = 0; i < earlyPositions.length; i++) {
    result.set(sorted[3 + i], earlyPositions[i]);
  }
  return result;
}

export function getHeroPosition(
  occupiedSeats: number[],
  buttonSeat: number,
  heroSeat: number
): Position | null {
  const positions = derivePositions(occupiedSeats, buttonSeat);
  return positions.get(heroSeat) ?? null;
}

export function isShortHanded(occupiedSeats: number[]): boolean {
  return occupiedSeats.length < 9;
}

export function actsBeforeHero(opponentPos: Position, heroPos: Position): boolean {
  return POSITION_ORDER[opponentPos] < POSITION_ORDER[heroPos];
}
