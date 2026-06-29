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
import { getLevelRow } from '@/domain/tournamentStructure';
import { getPushFoldRec } from '@/domain/pushFoldLookup';
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
  const isTournament = activeSession?.gameType === 'tournament';
  const tc = draft.tournamentContext ?? null;

  // Hero folded at any street
  const heroFolded =
    preflop.heroAction === 'Fold' ||
    postflop.flop === 'Fold' ||
    postflop.turn === 'Fold' ||
    postflop.river === 'Fold' ||
    draft.result === 'folded';

  // Cash chart rec
  const cashRec = preflop.chartRecommendation
    ? displayRecommendation(preflop.chartRecommendation)
    : null;

  // Push/fold rec (computed at save time for display in tournament post-hand)
  let pushFoldRec: 'Shove' | 'Call' | 'Fold' | null = null;
  let pushFoldRegime: 'pushfold' | 'offchart' | null = null;

  if (isTournament && tc && tc.regime === 'pushfold' && draft.handKey) {
    const structure = activeSession?.structure ?? null;
    const levelRow = structure ? getLevelRow(structure, tc.level) : null;
    const hasAnte = (levelRow?.ante ?? 0) > 0;
    const effBB = tc.effBB ?? 0;
    const result = getPushFoldRec(
      preflop.scenario,
      draft.heroPosition,
      preflop.facingPosition,
      draft.handKey,
      effBB,
      hasAnte,
      tc.icmPressure
    );
    pushFoldRec = result.rec;
    pushFoldRegime = result.regime;
  }

  // Cash deviation (exists already in preflop.deviation for cash mode)
  const cashDeviation = settings.flagDeviations && preflop.deviation && preflop.heroAction;

  // Push/fold deviation
  const pfDeviation =
    isTournament && tc?.regime === 'pushfold' && pushFoldRec && preflop.heroAction
      ? preflop.heroAction !== (pushFoldRec === 'Shove' ? 'Raise' : pushFoldRec)
      : false;

  const showDeviation = isTournament
    ? (tc?.regime === 'cash' ? cashDeviation : pfDeviation)
    : cashDeviation;

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
        // Capture push/fold rec at save time
        pushFoldRec: isTournament && tc?.regime === 'pushfold' ? pushFoldRec : null,
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
      navigate({ name: 'tableSetup' });
    }
  }

  const boardCards = [
    ...(board.flop ?? []),
    ...(board.turn ? [board.turn] : []),
    ...(board.river ? [board.river] : []),
  ];

  const amountLabel = isTournament ? 'Chips won/lost (optional)' : 'Amount won/lost (optional)';
  const stackLabel = isTournament ? 'Current chip count (optional)' : 'Current stack (optional)';
  const stackPlaceholder = isTournament ? 'Chips' : `${settings.currency}0`;

  return (
    <div className="screen">
      <div className="bar">
        <span>Hand result</span>
        <span className="label">#{draft.handNumber}</span>
      </div>

      {/* Tournament: show level + effBB info */}
      {isTournament && tc && (
        <div className={styles.tournamentInfo}>
          Level {tc.level}
          {tc.effBB !== null && ` · ${tc.effBB.toFixed(1)} BB`}
          {' · '}
          {tc.regime === 'pushfold' ? 'Push/fold' : tc.regime === 'offchart' ? 'Off-chart' : 'Cash charts'}
        </div>
      )}

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

      {/* Deviation banner */}
      {showDeviation && (
        <div className="deviation-banner">
          <span>⚠</span>
          <span>
            {isTournament && tc?.regime === 'pushfold' ? (
              <>
                Deviation — you <b>{preflop.heroAction === 'Raise' ? 'Shoved' : preflop.heroAction}d</b>.
                {pushFoldRec && <> Chart said <b>{pushFoldRec}</b>.</>}
              </>
            ) : (
              <>
                Deviation — you <b>{preflop.heroAction}</b>d.
                {cashRec && <> Chart said <b>{cashRec}</b>.</>}
              </>
            )}
          </span>
        </div>
      )}

      {/* Tournament post-hand recommendation reveal (T0: only shown here, never during hand) */}
      {isTournament && tc && preflop.heroAction && (
        <div className={styles.recReveal}>
          <div className={styles.recRevealTitle}>Post-hand chart</div>
          {tc.regime === 'pushfold' && pushFoldRegime === 'pushfold' && pushFoldRec && (
            <div className={styles.recRevealRec}>
              Push/fold: <strong>{pushFoldRec}</strong>
              {!pfDeviation && preflop.heroAction && (
                <span className={styles.recCheck}> ✓</span>
              )}
            </div>
          )}
          {tc.regime === 'pushfold' && pushFoldRegime === 'offchart' && (
            <div className={styles.recOffChart}>Off-chart position (log only)</div>
          )}
          {tc.regime === 'cash' && cashRec && (
            <div className={styles.recRevealRec}>
              Chart: <strong>{cashRec}</strong>
              {!cashDeviation && <span className={styles.recCheck}> ✓</span>}
            </div>
          )}
          {tc.regime === 'offchart' && (
            <div className={styles.recOffChart}>Off-chart</div>
          )}
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

      <div className="label">{amountLabel}</div>
      <input
        className="field"
        placeholder={isTournament ? 'Chips' : `${settings.currency}0`}
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        type="number"
        inputMode="decimal"
      />

      <div className="label">{stackLabel}</div>
      <input
        className="field"
        placeholder={stackPlaceholder}
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
