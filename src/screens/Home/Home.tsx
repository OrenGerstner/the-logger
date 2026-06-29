import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSession } from '@/store/SessionContext';
import { useSettings } from '@/store/settingsStore';
import { useTableState } from '@/store/tableStateStore';
import { useHand } from '@/store/HandContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { handRepo } from '@/db/handRepo';
import { stackSnapshotRepo } from '@/db/stackSnapshotRepo';
import { getHeroPosition } from '@/domain/positions';
import { calculateElapsedSeconds, formatElapsedTime } from '@/domain/sessionTime';
import { formatStack } from '@/utils/formatting';
import styles from './Home.module.css';

export function Home() {
  const { navigate } = useNavigation();
  const { activeSession, isLoading, endSession, endTournamentSession } = useSession();
  const { settings } = useSettings();
  const { tableState } = useTableState();
  const { startNewHand, draft } = useHand();
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [cashOutStr, setCashOutStr] = useState('');
  const [finishPlaceStr, setFinishPlaceStr] = useState('');
  const [prizeWonStr, setPrizeWonStr] = useState('');

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

  if (isLoading) {
    return <div className="screen"><div className="note" style={{ marginTop: 40 }}>Loading…</div></div>;
  }

  function handleContinue() {
    if (!activeSession) return;
    if (draft) {
      navigate({ name: 'play' });
      return;
    }
    const heroPos = getHeroPosition(
      tableState.occupiedSeats,
      tableState.buttonSeat,
      tableState.heroSeat
    );
    if (heroPos) {
      const nextNumber = hands.length + 1;
      startNewHand({
        sessionId: activeSession.id,
        handNumber: nextNumber,
        occupiedSeats: tableState.occupiedSeats,
        buttonSeat: tableState.buttonSeat,
        heroSeat: tableState.heroSeat,
        heroPosition: heroPos,
      });
      navigate({ name: 'play' });
    } else {
      navigate({ name: 'tableSetup' });
    }
  }

  async function handleEndCashSession() {
    const cashOut = parseFloat(cashOutStr) || 0;
    await endSession(cashOut);
    setEndDialogOpen(false);
    setCashOutStr('');
  }

  async function handleEndTournamentSession() {
    const finishPlace = parseInt(finishPlaceStr) || null;
    const prizeWon = parseFloat(prizeWonStr) || null;
    const itm = prizeWon !== null && prizeWon > 0;
    await endTournamentSession(finishPlace, prizeWon, itm);
    setEndDialogOpen(false);
    setFinishPlaceStr('');
    setPrizeWonStr('');
  }

  const elapsed = activeSession
    ? calculateElapsedSeconds(
        activeSession.timerStartedAt,
        activeSession.timerPauses,
        activeSession.timerPausedAt,
        activeSession.endedAt
      )
    : 0;

  const sessionLabel = isTournament
    ? activeSession?.venue || activeSession?.structure?.name || 'Tournament'
    : `${settings.currency}${activeSession?.stakes.smallBlind}/${settings.currency}${activeSession?.stakes.bigBlind}`;

  const stackLabel = isTournament
    ? (latestSnapshot ? `${latestSnapshot.stackAmount.toLocaleString()} chips` : null)
    : (latestSnapshot ? formatStack(latestSnapshot.stackAmount, settings.currency) : null);

  return (
    <div className="screen">
      <div className={styles.logoRow}>
        <button className={styles.logo} onClick={() => setVersionModalOpen(true)}>The Logger</button>
        <button className={styles.settingsBtn} onClick={() => navigate({ name: 'settings' })}>⚙</button>
      </div>

      {activeSession ? (
        <>
          <div className={styles.sessionCard}>
            <div className={styles.sessionStakes}>
              {sessionLabel}
              {activeSession.venue && !isTournament && <span className={styles.venue}> · {activeSession.venue}</span>}
              {isTournament && activeSession.currentLevel && (
                <span className={styles.venue}> · L{activeSession.currentLevel}</span>
              )}
            </div>
            <div className={styles.sessionMeta}>
              {hands.length} hands · {formatElapsedTime(elapsed)}
              {stackLabel && <> · {stackLabel}</>}
            </div>
          </div>

          <button className="btn go" onClick={handleContinue}>▶ Continue session</button>
          <button className="btn" onClick={() => navigate({ name: 'handHistory' })}>Hand history</button>
          <button className="btn" onClick={() => navigate({ name: 'tableSetup' })}>Edit table</button>
          <button className="btn" onClick={() => navigate({ name: 'pastSessions' })}>All sessions</button>
          <button
            className="btn danger"
            onClick={() => setEndDialogOpen(true)}
            style={{ marginTop: 'auto' }}
          >End session</button>
        </>
      ) : (
        <>
          <div className={styles.emptyState}>
            <p>No active session.</p>
            <p className="note">Start a session to begin logging hands.</p>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <button className="btn go" onClick={() => navigate({ name: 'newSession' })}>
              + New session
            </button>
            <button className="btn" onClick={() => navigate({ name: 'pastSessions' })}>
              All sessions
            </button>
          </div>
        </>
      )}

      {versionModalOpen && (
        <div className={styles.overlay} onClick={() => setVersionModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.modalTitle}>The Logger</p>
            <p className={styles.versionNumber}>{__APP_VERSION__}</p>
            <p className={styles.copyright}>
              Designed by Oren Gerstner, developed by Claude.{'\n'}
              All rights reserved to Oren Gerstner.
            </p>
            <button className="btn" style={{ marginTop: 14 }} onClick={() => setVersionModalOpen(false)}>Close</button>
          </div>
        </div>
      )}

      <Dialog.Root open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.modal}>
            {isTournament ? (
              <>
                <Dialog.Title className={styles.modalTitle}>End tournament</Dialog.Title>
                <Dialog.Description style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 14, textAlign: 'center' }}>
                  Enter your finishing position to save results.
                </Dialog.Description>
                <input
                  className="field"
                  placeholder="Finish place (e.g. 42)"
                  value={finishPlaceStr}
                  onChange={(e) => setFinishPlaceStr(e.target.value)}
                  type="number"
                  inputMode="numeric"
                  autoFocus
                />
                <input
                  className="field"
                  placeholder={`Prize won (${settings.currency}0 if busted)`}
                  value={prizeWonStr}
                  onChange={(e) => setPrizeWonStr(e.target.value)}
                  type="number"
                  inputMode="decimal"
                />
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <Dialog.Close asChild>
                    <button className="btn">Cancel</button>
                  </Dialog.Close>
                  <button className="btn danger" onClick={handleEndTournamentSession}>End tournament</button>
                </div>
              </>
            ) : (
              <>
                <Dialog.Title className={styles.modalTitle}>End session</Dialog.Title>
                <Dialog.Description style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 14, textAlign: 'center' }}>
                  Enter your cash-out amount to finalize session stats.
                </Dialog.Description>
                <input
                  className="field"
                  placeholder={`${settings.currency}0`}
                  value={cashOutStr}
                  onChange={(e) => setCashOutStr(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  autoFocus
                />
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <Dialog.Close asChild>
                    <button className="btn">Cancel</button>
                  </Dialog.Close>
                  <button className="btn danger" onClick={handleEndCashSession}>End session</button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
