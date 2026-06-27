import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSession } from '@/store/SessionContext';
import { useSettings } from '@/store/settingsStore';
import { handRepo } from '@/db/handRepo';
import { stackSnapshotRepo } from '@/db/stackSnapshotRepo';
import { PlayingCard } from '@/components/PlayingCard/PlayingCard';
import { calculateElapsedSeconds, formatElapsedTime } from '@/domain/sessionTime';
import { computeSessionNet } from '@/domain/stackAttribution';
import { formatNet } from '@/utils/formatting';
import { exportHandsCSV, exportSnapshotsCSV, downloadCSV } from '@/utils/csvExport';
import type { Hand } from '@/domain/types';
import styles from './HandHistory.module.css';

export function HandHistory() {
  const { goBack } = useNavigation();
  const { activeSession } = useSession();
  const { settings } = useSettings();

  const hands = useLiveQuery(
    () => activeSession ? handRepo.getBySession(activeSession.id) : Promise.resolve([]),
    [activeSession?.id]
  ) ?? [];

  const snapshots = useLiveQuery(
    () => activeSession ? stackSnapshotRepo.getBySession(activeSession.id) : Promise.resolve([]),
    [activeSession?.id]
  ) ?? [];

  const latestSnapshot = snapshots[snapshots.length - 1];

  async function handleExport() {
    if (!activeSession) return;
    const csv = exportHandsCSV([activeSession], hands);
    downloadCSV(csv, `logger-session-${activeSession.id.slice(0, 8)}.csv`);
    if (snapshots.length > 0) {
      const snapCsv = exportSnapshotsCSV(snapshots);
      downloadCSV(snapCsv, `logger-snapshots-${activeSession.id.slice(0, 8)}.csv`);
    }
  }

  if (!activeSession) return <div className="screen"><p>No active session.</p></div>;

  const elapsed = calculateElapsedSeconds(
    activeSession.timerStartedAt,
    activeSession.timerPauses,
    activeSession.timerPausedAt,
    activeSession.endedAt
  );

  const { net } = computeSessionNet(
    activeSession.buyIns,
    activeSession.cashOut,
    latestSnapshot?.stackAmount ?? null,
    hands.map((h) => h.amount)
  );

  const offChartCount = hands.filter((h) => h.preflop.scenario === 'OffChart').length;

  const reversedHands = [...hands].reverse();

  return (
    <div className="screen">
      <div className="bar">
        <button className={styles.back} onClick={goBack}>← Back</button>
        <span>Hands</span>
        <span className="label">session · today</span>
      </div>

      <div className={styles.metrics}>
        <div className="metric">
          <div className="k">hands</div>
          <div className="v">{hands.length}</div>
        </div>
        <div className="metric">
          <div className="k">off-chart</div>
          <div className="v" style={{ color: offChartCount > 0 ? 'var(--dt)' : undefined }}>
            {offChartCount}
          </div>
        </div>
        <div className="metric">
          <div className="k">elapsed</div>
          <div className="v">{formatElapsedTime(elapsed)}</div>
        </div>
        <div className="metric">
          <div className="k">net</div>
          <div className="v" style={{ color: (net ?? 0) >= 0 ? 'var(--st)' : 'var(--dt)' }}>
            {formatNet(net, settings.currency)}
          </div>
        </div>
      </div>

      <div className={styles.handList}>
        {reversedHands.length === 0 && (
          <p className="note">No hands logged yet.</p>
        )}
        {reversedHands.map((hand) => (
          <HandRow key={hand.id} hand={hand} currency={settings.currency} />
        ))}
      </div>

      <div className="btn-row" style={{ marginTop: 'auto' }}>
        <button className="btn info" onClick={handleExport}>↓ Export CSV</button>
      </div>
    </div>
  );
}

function HandRow({ hand, currency }: { hand: Hand; currency: string }) {
  const deviation = hand.preflop.deviation;
  const offChart = hand.preflop.scenario === 'OffChart';

  return (
    <div className={styles.handRow}>
      <div className={styles.handInfo}>
        <span className="label" style={{ width: 30 }}>#{hand.handNumber}</span>
        {hand.holeCards.map((c, i) => <PlayingCard key={i} card={c} size="sm" />)}
        <span className="label">{hand.heroPosition} · {hand.preflop.heroAction?.toLowerCase() ?? '?'}</span>
        {offChart && <span className={styles.offChartBadge}>OC</span>}
      </div>
      <div className={styles.handResult}>
        {deviation && <span className={styles.deviationMark}>⚠</span>}
        {hand.amount !== null ? (
          <span style={{ fontSize: 12, color: hand.amount >= 0 ? 'var(--st)' : 'var(--dt)' }}>
            {hand.amount >= 0 ? '+' : ''}{currency}{Math.abs(hand.amount)}
          </span>
        ) : (
          <span className="label">—</span>
        )}
      </div>
    </div>
  );
}
