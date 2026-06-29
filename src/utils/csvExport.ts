import type { Hand, Session, StackSnapshot } from '@/domain/types';
import { cardToString } from '@/domain/handNormalizer';
import { calculateElapsedSeconds } from '@/domain/sessionTime';
import { computeSessionNet } from '@/domain/stackAttribution';

function escape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: unknown[]): string {
  return cells.map(escape).join(',');
}

function formatBoard(board: Hand['board']): {
  flop: string;
  turn: string;
  river: string;
} {
  return {
    flop: board.flop ? board.flop.map(cardToString).join(' ') : '',
    turn: board.turn ? cardToString(board.turn) : '',
    river: board.river ? cardToString(board.river) : '',
  };
}

function formatOpponentActions(actions: Hand['preflop']['opponentActions']): string {
  return actions.map((a) => `${a.position}:${a.action}`).join(';');
}

const HAND_HEADERS = [
  'session_id', 'session_venue', 'game_type', 'stakes',
  'session_buyin_total', 'session_cashout',
  'session_elapsed_seconds', 'session_elapsed_hours', 'session_net', 'session_profit_per_hour',
  'hand_number', 'timestamp', 'table_size', 'short_handed',
  'button_seat', 'hero_seat', 'hero_position',
  'hole_cards', 'hand_key',
  'stack_before', 'stack_after',
  'preflop_scenario', 'facing_position', 'chart_recommendation',
  'hero_preflop_action', 'hero_second_action', 'deviation',
  'flop', 'turn', 'river',
  'hero_flop_action', 'hero_turn_action', 'hero_river_action',
  'result', 'would_have', 'amount', 'amount_source',
  'stack_attribution_confidence', 'note', 'opponent_actions',
  // Tournament columns (blank for cash sessions)
  'tournament_level', 'effective_bb', 'regime', 'push_fold_rec', 'icm_pressure',
  'session_finish_place', 'session_prize_won', 'session_itm', 'session_field_size',
];

const SNAPSHOT_HEADERS = [
  'session_id', 'snapshot_id', 'created_at', 'hand_number_context',
  'stack_amount', 'previous_stack_amount', 'delta_from_previous',
  'source', 'candidate_hand_ids', 'assigned_hand_id',
  'attribution_confidence', 'note',
];

export function exportHandsCSV(sessions: Session[], hands: Hand[]): string {
  const lines: string[] = [row(HAND_HEADERS)];

  for (const session of sessions) {
    const sessionHands = hands.filter((h) => h.sessionId === session.id);
    const elapsed = calculateElapsedSeconds(
      session.timerStartedAt,
      session.timerPauses,
      session.timerPausedAt,
      session.endedAt
    );
    const { net } = computeSessionNet(
      session.buyIns,
      session.cashOut,
      null,
      sessionHands.map((h) => h.amount)
    );
    const totalBuyIns = session.buyIns.reduce((s, b) => s + b.amount, 0);
    const profitPerHour = elapsed > 0 && net !== null ? (net / (elapsed / 3600)).toFixed(2) : '';

    for (const hand of sessionHands) {
      const board = formatBoard(hand.board);
      lines.push(row([
        session.id,
        session.venue ?? '',
        session.gameType,
        `${session.stakes.smallBlind}/${session.stakes.bigBlind}`,
        totalBuyIns,
        session.cashOut ?? '',
        elapsed,
        (elapsed / 3600).toFixed(2),
        net ?? '',
        profitPerHour,
        hand.handNumber,
        hand.timestamp,
        hand.tableSize,
        hand.shortHanded,
        hand.buttonSeat,
        hand.heroSeat,
        hand.heroPosition,
        hand.holeCards.map(cardToString).join(' '),
        hand.handKey,
        hand.stackBefore ?? '',
        hand.stackAfter ?? '',
        hand.preflop.scenario,
        hand.preflop.facingPosition ?? '',
        hand.preflop.chartRecommendation ?? '',
        hand.preflop.heroAction ?? '',
        hand.preflop.heroSecondAction ?? '',
        hand.preflop.deviation ?? '',
        board.flop,
        board.turn,
        board.river,
        hand.postflop.flop ?? '',
        hand.postflop.turn ?? '',
        hand.postflop.river ?? '',
        hand.result ?? '',
        hand.wouldHave ?? '',
        hand.amount ?? '',
        hand.amountSource,
        hand.stackAttributionConfidence ?? '',
        hand.note,
        formatOpponentActions(hand.preflop.opponentActions),
        // Tournament columns
        hand.level ?? '',
        hand.effBB ?? '',
        hand.regime ?? '',
        hand.pushFoldRec ?? '',
        hand.icmPressureAtHand ?? '',
        session.finishPlace ?? '',
        session.prizeWon ?? '',
        session.itm ?? '',
        session.fieldSize ?? '',
      ]));
    }
  }

  return lines.join('\n');
}

export function exportSnapshotsCSV(snapshots: StackSnapshot[]): string {
  const lines: string[] = [row(SNAPSHOT_HEADERS)];
  for (const s of snapshots) {
    lines.push(row([
      s.sessionId, s.id, s.createdAt, s.handNumberContext,
      s.stackAmount, s.previousStackAmount ?? '',
      s.deltaFromPrevious ?? '',
      s.source,
      s.candidateHandIds.join(';'),
      s.assignedHandId ?? '',
      s.attributionConfidence ?? '',
      s.note,
    ]));
  }
  return lines.join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
