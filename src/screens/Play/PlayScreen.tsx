import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigation } from '@/navigation/NavigationContext';
import { useHand } from '@/store/HandContext';
import { useSession } from '@/store/SessionContext';
import { useSettings } from '@/store/settingsStore';
import { useTableState } from '@/store/tableStateStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { handRepo } from '@/db/handRepo';
import { stackSnapshotRepo } from '@/db/stackSnapshotRepo';
import { PokerTable } from '@/components/PokerTable/PokerTable';
import type { SeatState } from '@/components/PokerTable/PokerTable';
import { SessionHeader } from '@/components/SessionHeader/SessionHeader';
import { PlayingCard } from '@/components/PlayingCard/PlayingCard';
import { displayRecommendation } from '@/domain/deviationChecker';
import { derivePositions, getHeroPosition, isShortHanded } from '@/domain/positions';
import { getLevelRow, computeEffBB, getStrategyRegime, formatBlinds, getMaxLevel } from '@/domain/tournamentStructure';
import type { Position, HeroAction, OpponentAction, Session, IcmPressure } from '@/domain/types';
import styles from './PlayScreen.module.css';

const ICM_LABELS: Record<IcmPressure, string> = {
  chipEV: 'Chip-EV',
  nearBubble: 'Bubble',
  finalTable: 'FT',
};

export function PlayScreen() {
  const { navigate } = useNavigation();
  const { draft, setHeroAction, addOpponentAction, removeOpponentAction, startNewHand, toHand, setTournamentContext } = useHand();
  const { activeSession, pauseTimer, resumeTimer, createQuickStackSnapshot, setCurrentLevel, setIcmPressure } = useSession();
  const { settings, updateSettings } = useSettings();
  const { tableState, setHeroSeat, setSeatOccupied, setButtonSeat } = useTableState();

  const [tableMode, setTableMode] = useState<'play' | 'edit'>('play');
  const [stackModalOpen, setStackModalOpen] = useState(false);
  const [stackInput, setStackInput] = useState('');

  const hands = useLiveQuery(
    () => activeSession ? handRepo.getBySession(activeSession.id) : Promise.resolve([]),
    [activeSession?.id]
  ) ?? [];

  const snapshots = useLiveQuery(
    () => activeSession ? stackSnapshotRepo.getBySession(activeSession.id) : Promise.resolve([]),
    [activeSession?.id]
  ) ?? [];

  const latestSnapshot = snapshots[snapshots.length - 1];

  const isTournament = activeSession?.gameType === 'tournament';

  // Compute and sync tournament context into the draft
  useEffect(() => {
    if (!isTournament || !activeSession || !draft) return;
    const level = activeSession.currentLevel ?? 1;
    const structure = activeSession.structure ?? null;
    const levelRow = structure ? getLevelRow(structure, level) : null;
    const currentStack = latestSnapshot?.stackAmount ?? activeSession.startingStack ?? 0;
    const effBB = levelRow ? computeEffBB(currentStack, levelRow.bb) : null;
    const regime = effBB !== null ? getStrategyRegime(effBB) : 'cash';
    const icmPressure = activeSession.icmPressure ?? 'chipEV';
    setTournamentContext({ level, effBB, icmPressure, regime });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isTournament,
    activeSession?.currentLevel,
    activeSession?.icmPressure,
    latestSnapshot?.stackAmount,
    draft?.id, // re-run when a new hand starts
  ]);

  if (!activeSession || !draft) {
    return <div className="screen"><div className="note" style={{ marginTop: 40 }}>Loading…</div></div>;
  }

  const positions = derivePositions(tableState.occupiedSeats, tableState.buttonSeat);
  const heroPos = positions.get(tableState.heroSeat) as Position | undefined;
  const shortHanded = isShortHanded(tableState.occupiedSeats);

  // Tournament level info
  const currentLevel = activeSession.currentLevel ?? 1;
  const structure = activeSession.structure ?? null;
  const maxLevel = structure ? getMaxLevel(structure) : 0;
  const levelRow = structure ? getLevelRow(structure, currentLevel) : null;
  const currentStack = latestSnapshot?.stackAmount ?? activeSession.startingStack ?? 0;
  const effBB = levelRow ? computeEffBB(currentStack, levelRow.bb) : null;
  const regime = effBB !== null ? getStrategyRegime(effBB) : 'cash';
  const icmPressure = activeSession.icmPressure ?? 'chipEV';

  function buildSeats(): Record<number, SeatState> {
    const result: Record<number, SeatState> = {};
    for (let i = 1; i <= 9; i++) {
      const occ = tableState.occupiedSeats.includes(i);
      const action = draft!.preflop.opponentActions.find((a) => a.seat === i);
      const raisedAction =
        action?.action === 'open' || action?.action === '3bet' || action?.action === '4bet'
          ? action.action
          : undefined;
      result[i] = {
        occupied: occ,
        isHero: i === tableState.heroSeat,
        isButton: i === tableState.buttonSeat,
        position: positions.get(i) as Position | undefined,
        raisedAction,
      };
    }
    return result;
  }

  function handleOpponentAction(seat: number, action: OpponentAction['action']) {
    const pos = positions.get(seat);
    if (!pos) return;
    addOpponentAction({ seat, position: pos as Position, action });
  }

  function handleSeatEdit(seat: number, action: 'me' | 'sitting' | 'empty') {
    if (action === 'me') {
      setHeroSeat(seat);
      setSeatOccupied(seat, true);
    } else if (action === 'sitting') {
      setSeatOccupied(seat, true);
    } else {
      if (seat === tableState.heroSeat) return;
      setSeatOccupied(seat, false);
    }
  }

  function handleHeroAction(action: HeroAction) {
    setHeroAction(action);
    if (action === 'Fold' || settings.preflopFocusMode) navigate({ name: 'handResult' });
  }

  async function handleGoToFlop() {
    navigate({ name: 'postflop', params: { street: 'flop' } });
  }

  async function handleLogNewHand() {
    const hand = toHand();
    if (hand) await handRepo.create(hand);

    const { occupiedSeats, buttonSeat, heroSeat } = tableState;
    const sorted = [...occupiedSeats].sort((a, b) => a - b);
    const nextBtnSeat = sorted[(sorted.indexOf(buttonSeat) + 1) % sorted.length];
    const nextPos = getHeroPosition(occupiedSeats, nextBtnSeat, heroSeat);

    setButtonSeat(nextBtnSeat);

    if (nextPos && activeSession) {
      startNewHand({
        sessionId: activeSession.id,
        handNumber: draft!.handNumber + 1,
        occupiedSeats,
        buttonSeat: nextBtnSeat,
        heroSeat,
        heroPosition: nextPos,
      });
    }
  }

  async function handleUpdateStack() {
    const amount = parseFloat(stackInput);
    if (!isNaN(amount) && amount > 0) {
      await createQuickStackSnapshot(amount, draft!.handNumber);
    }
    setStackInput('');
    setStackModalOpen(false);
  }

  async function handleLevelChange(delta: number) {
    const next = Math.max(1, Math.min(maxLevel || 99, currentLevel + delta));
    await setCurrentLevel(next);
  }

  async function handleIcmChange(pressure: IcmPressure) {
    await setIcmPressure(pressure);
  }

  const rec = draft.preflop.chartRecommendation
    ? displayRecommendation(draft.preflop.chartRecommendation)
    : null;

  const showRecBefore = settings.showRecommendation === 'before';
  const heroActed = !!draft.preflop.heroAction;
  const recAllowed = !settings.focusRFI || draft.preflop.scenario === 'RFI';

  // T0: In tournament mode, NEVER show recommendation during live hand
  const showRec = !isTournament && rec && recAllowed && (showRecBefore || (heroActed && settings.showChartAfterFold));

  const facingDesc = draft.preflop.facingPosition
    ? `facing ${draft.preflop.facingPosition} ${draft.preflop.scenario === 'RFIvs3Bet' ? '3-bet' : 'raise'}`
    : '';

  return (
    <div className="screen">
      <SessionHeader
        session={activeSession}
        latestSnapshot={latestSnapshot}
        currency={settings.currency}
        handCount={hands.length}
        onPause={pauseTimer}
        onResume={resumeTimer}
        onUpdateStack={() => setStackModalOpen(true)}
      />

      {activeSession.target && activeSession.startingStack && (
        <TargetBar
          session={activeSession}
          currentStack={latestSnapshot?.stackAmount ?? activeSession.startingStack}
          currency={settings.currency}
        />
      )}

      {isTournament && (
        <TournamentInfoRow
          levelRow={levelRow}
          currentLevel={currentLevel}
          maxLevel={maxLevel}
          effBB={effBB}
          regime={regime}
          icmPressure={icmPressure}
          onLevelChange={handleLevelChange}
          onIcmChange={handleIcmChange}
        />
      )}

      <div className="bar">
        <button className={styles.homeBtn} onClick={() => navigate({ name: 'home' })}>⌂</button>
        <span>Hand {draft.handNumber} · {tableState.occupiedSeats.length}-handed</span>
        <button
          className={styles.modeToggle}
          onClick={() => setTableMode(tableMode === 'play' ? 'edit' : 'play')}
        >
          {tableMode === 'edit' ? '✓ Done' : '✏ Edit'}
        </button>
      </div>

      <PokerTable
        mode={tableMode}
        seats={buildSeats()}
        heroSeat={tableState.heroSeat}
        opponentActions={draft.preflop.opponentActions}
        onOpponentAction={handleOpponentAction}
        onRemoveOpponentAction={(seat) => removeOpponentAction(seat)}
        onSeatEdit={handleSeatEdit}
        hint={tableMode === 'play' ? 'tap opponent\nto mark action' : 'tap seat to edit'}
      />

      <div className={styles.posInfo}>
        Your position: <strong>{heroPos ?? '?'}</strong>
        {facingDesc && ` · ${facingDesc}`}
        {shortHanded && <span className={styles.shortHandedNote}> · short-handed (9-max chart)</span>}
        {isTournament && effBB !== null && (
          <span> · <strong>{effBB.toFixed(1)} BB</strong> · {regime === 'pushfold' ? 'Push/fold' : 'Charts'}</span>
        )}
      </div>

      <div className={styles.cardsRow}>
        <button
          className={draft.holeCards ? styles.cardsClickable : styles.pickCards}
          onClick={() => navigate({ name: 'cardPicker' })}
        >
          {draft.holeCards ? (
            <>
              <PlayingCard card={draft.holeCards[0]} />
              <PlayingCard card={draft.holeCards[1]} />
              <span className={styles.editHint}>✎</span>
            </>
          ) : (
            '+ Pick hole cards'
          )}
        </button>
      </div>

      {showRec && (
        <div className={styles.recRow}>
          <span className="label">Recommended</span>
          <button
            className="rec-badge"
            title="Tap to hide recommendation"
            onClick={() => updateSettings({ showRecommendation: 'after', showChartAfterFold: false })}
          >{rec}</button>
        </div>
      )}
      {!isTournament && rec && !showRec && !showRecBefore && !heroActed && (
        <div className={styles.recRow}>
          <span className="label">Act first — chart shown after</span>
        </div>
      )}
      {isTournament && !heroActed && (
        <div className={styles.recRow}>
          <span className="label">Chart shown after hand (tournament rules)</span>
        </div>
      )}

      <div className="btn-row">
        {(['Fold', 'Call', 'Raise'] as HeroAction[]).map((a) => (
          <button
            key={a}
            className={`btn ${draft.preflop.heroAction === a ? 'info' : ''}`}
            onClick={() => handleHeroAction(a)}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="btn-row">
        <button className="btn" onClick={handleLogNewHand}>Log new hand</button>
        {!settings.preflopFocusMode && draft.preflop.heroAction && draft.preflop.heroAction !== 'Fold' && (
          <button className="btn info" onClick={handleGoToFlop}>Go to flop →</button>
        )}
      </div>

      <Dialog.Root open={stackModalOpen} onOpenChange={setStackModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.dialogOverlay} />
          <Dialog.Content className={styles.dialogContent}>
            <Dialog.Title className={styles.dialogTitle}>Update Stack</Dialog.Title>
            <Dialog.Description style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 14, textAlign: 'center' }}>
              Enter your current stack on the table
            </Dialog.Description>
            <input
              className="field"
              placeholder={isTournament ? 'Chips' : `${settings.currency}0`}
              value={stackInput}
              onChange={(e) => setStackInput(e.target.value)}
              type="number"
              inputMode="decimal"
              autoFocus
            />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <Dialog.Close asChild>
                <button className="btn">Cancel</button>
              </Dialog.Close>
              <button className="btn info" onClick={handleUpdateStack}>Save</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function TournamentInfoRow({
  levelRow,
  currentLevel,
  maxLevel,
  effBB,
  regime,
  icmPressure,
  onLevelChange,
  onIcmChange,
}: {
  levelRow: ReturnType<typeof getLevelRow>;
  currentLevel: number;
  maxLevel: number;
  effBB: number | null;
  regime: 'cash' | 'pushfold';
  icmPressure: IcmPressure;
  onLevelChange(delta: number): void;
  onIcmChange(p: IcmPressure): void;
}) {
  return (
    <div className={styles.tournamentRow}>
      <div className={styles.levelControl}>
        <button className={styles.levelBtn} onClick={() => onLevelChange(-1)} disabled={currentLevel <= 1}>−</button>
        <span className={styles.levelLabel}>
          L{currentLevel}
          {levelRow && <span className={styles.blindsLabel}> · {formatBlinds(levelRow)}</span>}
        </span>
        <button className={styles.levelBtn} onClick={() => onLevelChange(1)} disabled={maxLevel > 0 && currentLevel >= maxLevel}>+</button>
      </div>
      <div className={styles.icmRow}>
        {(['chipEV', 'nearBubble', 'finalTable'] as IcmPressure[]).map((p) => (
          <button
            key={p}
            className={`chip ${icmPressure === p ? 'selected' : ''}`}
            onClick={() => onIcmChange(p)}
          >{ICM_LABELS[p]}</button>
        ))}
      </div>
    </div>
  );
}

function TargetBar({
  session,
  currentStack,
  currency,
}: {
  session: Session;
  currentStack: number;
  currency: string;
}) {
  const { target, startingStack } = session;
  if (!target || !startingStack) return null;

  const targetStack =
    target.type === 'multiplier' && target.multiplier
      ? startingStack * target.multiplier
      : target.type === 'amount' && target.amount
      ? target.amount
      : null;

  if (!targetStack) return null;

  const profit = currentStack - startingStack;
  const needed = targetStack - startingStack;
  const pct = needed > 0 ? Math.min(100, Math.max(0, (profit / needed) * 100)) : 100;
  const reached = currentStack >= targetStack;
  const barColor = reached ? 'var(--go)' : pct > 0 ? 'var(--it)' : 'var(--dt)';
  const remaining = targetStack - currentStack;

  const label =
    target.type === 'multiplier'
      ? `${target.multiplier}x target`
      : 'target';

  return (
    <div className={styles.targetBar}>
      <div className={styles.targetInfo}>
        <span className={styles.targetLabel}>
          🎯 {label}: {currency}{targetStack.toFixed(0)}
        </span>
        <span className={styles.targetStatus} style={{ color: barColor }}>
          {reached
            ? '✓ Reached!'
            : remaining > 0
            ? `${currency}${remaining.toFixed(0)} to go`
            : `${currency}${Math.abs(remaining).toFixed(0)} over`}
        </span>
      </div>
      <div className={styles.targetTrack}>
        <div
          className={styles.targetFill}
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}
