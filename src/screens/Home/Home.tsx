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
  const { activeSession, isLoading, endSession } = useSession();
  const { settings } = useSettings();
  const { tableState } = useTableState();
  const { startNewHand, draft } = useHand();
  const [endDialogOpen, setEndDialogOpen] = useState(false);
  const [cashOutStr, setCashOutStr] = useState('');

  const hands = useLiveQuery(
    () => activeSession ? handRepo.getBySession(activeSession.id) : Promise.resolve([]),
    [activeSession?.id]
  ) ?? [];

  const snapshots = useLiveQuery(
    () => activeSession ? stackSnapshotRepo.getBySession(activeSession.id) : Promise.resolve([]),
    [activeSession?.id]
  ) ?? [];

  const latestSnapshot = snapshots[snapshots.length - 1];

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

  async function handleEndSession() {
    const cashOut = parseFloat(cashOutStr) || 0;
    await endSession(cashOut);
    setEndDialogOpen(false);
    setCashOutStr('');
  }

  const elapsed = activeSession
    ? calculateElapsedSeconds(
        activeSession.timerStartedAt,
        activeSession.timerPauses,
        activeSession.timerPausedAt,
        activeSession.endedAt
      )
    : 0;

  return (
    <div className="screen">
      <div className={styles.logoRow}>
        <span className={styles.logo}>The Logger</span>
        <button className={styles.settingsBtn} onClick={() => navigate({ name: 'settings' })}>⚙</button>
      </div>

      {activeSession ? (
        <>
          <div className={styles.sessionCard}>
            <div className={styles.sessionStakes}>
              {settings.currency}{activeSession.stakes.smallBlind}/{settings.currency}{activeSession.stakes.bigBlind}
              {activeSession.venue && <span className={styles.venue}> · {activeSession.venue}</span>}
            </div>
            <div className={styles.sessionMeta}>
              {hands.length} hands · {formatElapsedTime(elapsed)}
              {latestSnapshot && <> · stack: {formatStack(latestSnapshot.stackAmount, settings.currency)}</>}
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

      <Dialog.Root open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.modal}>
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
              <button className="btn danger" onClick={handleEndSession}>End session</button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
