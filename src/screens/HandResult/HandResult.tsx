import { useState } from 'react';
import { useNavigation } from '@/navigation/NavigationContext';
import { useHand } from '@/store/HandContext';
import { useSession } from '@/store/SessionContext';
import { useSettings } from '@/store/settingsStore';
import { useTableState } from '@/store/tableStateStore';
import { handRepo } from '@/db/handRepo';
import { PlayingCard } from '@/components/PlayingCard/PlayingCard';
import { displayRecommendation } from '@/domain/deviationChecker';
import { getHeroPosition } from '@/domain/positions';
import styles from './HandResult.module.css';

export function HandResult() {
  const { navigate } = useNavigation();
  const { draft, setResult, setWouldHave, setAmount, setNote, setStackAfter, toHand, startNewHand } = useHand();
  const { activeSession, createQuickStackSnapshot } = useSession();
  const { settings } = useSettings();
  const { tableState, setButtonSeat } = useTableState();

  const [amountStr, setAmountStr] = useState('');
  const [stackStr, setStackStr] = useState('');
  const [noteStr, setNoteStr] = useState(draft?.note ?? '');

  if (!draft) return null;

  const { preflop, postflop, holeCards, board } = draft;

  // Hero folded at any street
  const heroFolded =
    preflop.heroAction === 'Fold' ||
    postflop.flop === 'Fold' ||
    postflop.turn === 'Fold' ||
    postflop.river === 'Fold' ||
    draft.result === 'folded';

  const showDeviation =
    settings.flagDeviations && preflop.deviation && preflop.heroAction;

  const rec = preflop.chartRecommendation
    ? displayRecommendation(preflop.chartRecommendation)
    : null;

  async function handleSave() {
    const amount = parseFloat(amountStr) || null;
    const stack = parseFloat(stackStr) || null;

    if (amount !== null) setAmount(amount);
    if (stack !== null) setStackAfter(stack);
    setNote(noteStr);

    const hand = toHand();
    if (hand) {
      await handRepo.create({
        ...hand,
        note: noteStr,
        amount: amount ?? null,
        amountSource: amount !== null ? 'manual' : 'unentered',
      });
    }

    if (stack !== null && activeSession) {
      await createQuickStackSnapshot(stack, draft!.handNumber);
    }

    // Compute next button seat BEFORE any state update
    const { occupiedSeats, buttonSeat, heroSeat } = tableState;
    const sorted = [...occupiedSeats].sort((a, b) => a - b);
    const nextBtnSeat = sorted[(sorted.indexOf(buttonSeat) + 1) % sorted.length];
    const nextPos = getHeroPosition(occupiedSeats, nextBtnSeat, heroSeat);

    setButtonSeat(nextBtnSeat);

    if (activeSession && nextPos) {
      startNewHand({
        sessionId: activeSession.id,
        handNumber: draft!.handNumber + 1,
        occupiedSeats,
        buttonSeat: nextBtnSeat,
        heroSeat,
        heroPosition: nextPos,
      });
      navigate({ name: 'play' });
    } else {
      // Table setup is inconsistent — go fix it
      navigate({ name: 'tableSetup' });
    }
  }

  const boardCards = [
    ...(board.flop ?? []),
    ...(board.turn ? [board.turn] : []),
    ...(board.river ? [board.river] : []),
  ];

  return (
    <div className="screen">
      <div className="bar">
        <span>Hand result</span>
        <span className="label">#{draft.handNumber}</span>
      </div>

      <div className="label">Your hand · revealed now hand is over</div>
      <div className={styles.handRow}>
        {holeCards?.map((c, i) => <PlayingCard key={i} card={c} />)}
        {boardCards.length > 0 && (
          <>
            <span className={styles.vsLabel}>vs board</span>
            {boardCards.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}
          </>
        )}
      </div>

      {showDeviation && (
        <div className="deviation-banner">
          <span>⚠</span>
          <span>
            Deviation — you <b>{preflop.heroAction}</b>d.
            {rec && <> Chart said <b>{rec}</b>.</>}
          </span>
        </div>
      )}

      {heroFolded ? (
        <>
          <div className="label">Would have…</div>
          <div className="btn-row">
            <button
              className={`btn ${draft.wouldHave === 'won' ? 'success' : ''}`}
              onClick={() => setWouldHave('won')}
            >Would Win</button>
            <button
              className={`btn ${draft.wouldHave === 'lost' ? 'danger' : ''}`}
              onClick={() => setWouldHave('lost')}
            >Would Lose</button>
            <button
              className={`btn ${draft.wouldHave === 'no_showdown' ? 'info' : ''}`}
              onClick={() => setWouldHave('no_showdown')}
            >No Showdown</button>
          </div>
        </>
      ) : (
        <>
          <div className="label">Result</div>
          <div className="btn-row">
            <button
              className={`btn ${draft.result === 'won' ? 'success' : ''}`}
              onClick={() => setResult('won')}
            >Won</button>
            <button
              className={`btn ${draft.result === 'lost' ? 'danger' : ''}`}
              onClick={() => setResult('lost')}
            >Lost</button>
          </div>
        </>
      )}

      <div className="label">Amount won/lost (optional)</div>
      <input
        className="field"
        placeholder={`${settings.currency}0`}
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        type="number"
        inputMode="decimal"
      />

      <div className="label">Current stack (optional)</div>
      <input
        className="field"
        placeholder={`${settings.currency}0`}
        value={stackStr}
        onChange={(e) => setStackStr(e.target.value)}
        type="number"
        inputMode="decimal"
      />

      <input
        className="field"
        placeholder="Note…"
        value={noteStr}
        onChange={(e) => setNoteStr(e.target.value)}
      />

      <div style={{ marginTop: 'auto' }}>
        <button className="btn info" onClick={handleSave}>Save &amp; log new hand</button>
      </div>
    </div>
  );
}
