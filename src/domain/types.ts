export type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
export type Suit = 's' | 'h' | 'd' | 'c';
export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Position = 'UTG' | 'UTG+1' | 'UTG+2' | 'LJ' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

export type Scenario = 'RFI' | 'FacingRFI' | 'RFIvs3Bet' | 'OffChart';

export type HeroAction = 'Fold' | 'Call' | 'Raise';
export type ActionFamily = 'Fold' | 'Call' | 'Raise';

export type OpponentActionType = 'open' | '3bet' | '4bet' | 'call' | 'fold' | 'limp';
export interface OpponentAction {
  seat: number;
  position: Position;
  action: OpponentActionType;
}

export interface Stakes {
  smallBlind: number;
  bigBlind: number;
}

export interface BuyIn {
  amount: number;
  at: string;
}

export interface TimePause {
  startedAt: string;
  endedAt: string;
}

export interface SessionTarget {
  type: 'multiplier' | 'amount';
  multiplier?: 2 | 3 | 4 | 5;
  amount?: number;
}

export interface Session {
  id: string;
  createdAt: string;
  gameType: 'cash' | 'tournament';
  venue?: string;
  stakes: Stakes;
  currency: string;
  startingTableSize: 6 | 8 | 9;
  buyIns: BuyIn[];
  startingStack: number | null;
  cashOut: number | null;
  status: 'active' | 'ended';
  endedAt: string | null;
  timerStartedAt: string;
  timerPausedAt: string | null;
  timerPauses: TimePause[];
  target?: SessionTarget | null;
}

export interface Preflop {
  scenario: Scenario;
  facingPosition: Position | null;
  chartRecommendation: string | null;
  heroAction?: HeroAction;
  heroSecondAction?: HeroAction | null;
  opponentActions: OpponentAction[];
  deviation?: boolean;
}

export interface BoardCards {
  flop?: [Card, Card, Card];
  turn?: Card;
  river?: Card;
}

export interface PostflopActions {
  flop?: HeroAction;
  turn?: HeroAction;
  river?: HeroAction;
}

export interface Hand {
  id: string;
  sessionId: string;
  handNumber: number;
  timestamp: string;
  tableSize: number;
  shortHanded: boolean;
  buttonSeat: number;
  heroSeat: number;
  heroPosition: Position;
  holeCards: [Card, Card];
  handKey: string;
  preflop: Preflop;
  board: BoardCards;
  postflop: PostflopActions;
  result: 'won' | 'lost' | 'folded' | null;
  wouldHave: 'won' | 'lost' | 'no_showdown' | null;
  amount: number | null;
  amountSource: 'manual' | 'stack_snapshot' | 'unentered';
  stackBefore: number | null;
  stackAfter: number | null;
  stackAttributionConfidence: 'exact' | 'likely' | 'ambiguous' | null;
  note: string;
}

export interface StackSnapshot {
  id: string;
  sessionId: string;
  createdAt: string;
  handNumberContext: number;
  stackAmount: number;
  previousStackAmount: number | null;
  deltaFromPrevious: number | null;
  source: 'session_start' | 'quick_update' | 'hand_result' | 'session_end';
  candidateHandIds: string[];
  assignedHandId: string | null;
  attributionConfidence: 'exact' | 'likely' | 'ambiguous' | null;
  note: string;
}

export interface TableState {
  occupiedSeats: number[];
  heroSeat: number;
  buttonSeat: number;
  maxSeats: 6 | 8 | 9;
}

export interface Settings {
  theme: 'dark' | 'light';
  showRecommendation: 'before' | 'after';
  showChartAfterFold: boolean;
  hideHoleCardsPostflop: boolean;
  flagDeviations: boolean;
  currency: string;
  defaultTableSize: 6 | 8 | 9;
  pauseTimerDuringBreaks: boolean;
  preflopFocusMode: boolean;
  focusRFI: boolean;
}
