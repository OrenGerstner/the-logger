import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSettings } from '@/store/settingsStore';
import { sessionRepo } from '@/db/sessionRepo';
import { handRepo } from '@/db/handRepo';
import { stackSnapshotRepo } from '@/db/stackSnapshotRepo';
import { calculateElapsedSeconds, formatElapsedTime } from '@/domain/sessionTime';
import type { StackSnapshot, Hand, Session } from '@/domain/types';
import styles from './SessionDetail.module.css';

export function SessionDetail() {
  const { currentScreen, goBack } = useNavigation();
  const { settings } = useSettings();
  const sessionId = currentScreen.params?.sessionId as string | undefined;

  const session = useLiveQuery(
    () => (sessionId ? sessionRepo.getById(sessionId) : Promise.resolve(undefined)),
    [sessionId]
  );

  const hands = useLiveQuery(
    () => (sessionId ? handRepo.getBySession(sessionId) : Promise.resolve([])),
    [sessionId]
  ) ?? [];

  const snapshots = useLiveQuery(
    () => (sessionId ? stackSnapshotRepo.getBySession(sessionId) : Promise.resolve([])),
    [sessionId]
  ) ?? [];

  if (!session) {
    return (
      <div className="screen">
        <div className="bar">
          <button className={styles.back} onClick={goBack}>← Back</button>
          <span>Session detail</span>
        </div>
        <p className="note">Loading…</p>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="bar">
        <button className={styles.back} onClick={goBack}>← Back</button>
        <span>Session detail</span>
      </div>
      <SessionStats
        session={session}
        hands={hands}
        snapshots={snapshots}
        currency={settings.currency}
      />
    </div>
  );
}

function SessionStats({
  session,
  hands,
  snapshots,
  currency,
}: {
  session: Session;
  hands: Hand[];
  snapshots: StackSnapshot[];
  currency: string;
}) {
  const elapsed = calculateElapsedSeconds(
    session.timerStartedAt,
    session.timerPauses,
    session.timerPausedAt,
    session.endedAt
  );

  const date = new Date(session.createdAt).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  const total = hands.length;
  const foldedPre = hands.filter((h) => h.preflop.heroAction === 'Fold').length;
  const sawFlop = hands.filter((h) => h.postflop.flop != null).length;
  const sawTurn = hands.filter((h) => h.postflop.turn != null).length;
  const sawRiver = hands.filter((h) => h.postflop.river != null).length;
  const showdown = hands.filter((h) => h.result === 'won' || h.result === 'lost').length;

  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '—');

  const totalInvested = session.buyIns.reduce((s, b) => s + b.amount, 0);
  const profit = session.cashOut != null ? session.cashOut - totalInvested : null;
  const elapsedHours = elapsed / 3600;
  const dollarsPerHour =
    profit != null && elapsedHours > 0
      ? profit / elapsedHours
      : null;

  const profitLabel =
    profit == null
      ? '—'
      : `${profit >= 0 ? '+' : ''}${currency}${Math.abs(profit).toFixed(0)}`;

  const profitColor = profit == null ? 'var(--t2)' : profit >= 0 ? 'var(--go)' : 'var(--dt)';

  const dphLabel =
    dollarsPerHour == null
      ? '—'
      : `${dollarsPerHour >= 0 ? '+' : ''}${currency}${Math.abs(dollarsPerHour).toFixed(1)}/hr`;

  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <span className={styles.headerDate}>{date}</span>
        <span className={styles.headerMeta}>
          {currency}{session.stakes.smallBlind}/{currency}{session.stakes.bigBlind}
          {session.venue ? ` · ${session.venue}` : ''}
        </span>
      </div>

      <div className={styles.section}>
        <div className={styles.row2}>
          <span className={styles.label}>Time played</span>
          <span className={styles.value}>{formatElapsedTime(elapsed)}</span>
        </div>
        <div className={styles.row2}>
          <span className={styles.label}>Total hands</span>
          <span className={styles.value}>{total}</span>
        </div>
      </div>

      <div className={styles.sectionTitle}>Street breakdown</div>
      <div className={styles.section}>
        <div className={styles.streetHeader}>
          <span />
          <span className={styles.colN}>Hands</span>
          <span className={styles.colPct}>%</span>
        </div>
        <StreetRow label="Folded preflop" n={foldedPre} pct={pct(foldedPre)} />
        <StreetRow label="Saw flop" n={sawFlop} pct={pct(sawFlop)} />
        <StreetRow label="Saw turn" n={sawTurn} pct={pct(sawTurn)} />
        <StreetRow label="Saw river" n={sawRiver} pct={pct(sawRiver)} />
        <StreetRow label="Went to showdown" n={showdown} pct={pct(showdown)} />
      </div>

      <div className={styles.sectionTitle}>Results</div>
      <div className={styles.section}>
        <div className={styles.row2}>
          <span className={styles.label}>Total P/L</span>
          <span className={styles.value} style={{ color: profitColor }}>{profitLabel}</span>
        </div>
        <div className={styles.row2}>
          <span className={styles.label}>Earn rate</span>
          <span className={styles.value} style={{ color: profitColor }}>{dphLabel}</span>
        </div>
        <div className={styles.row2}>
          <span className={styles.label}>Buy-in</span>
          <span className={styles.value}>{currency}{totalInvested.toFixed(0)}</span>
        </div>
        {session.cashOut != null && (
          <div className={styles.row2}>
            <span className={styles.label}>Cash out</span>
            <span className={styles.value}>{currency}{session.cashOut.toFixed(0)}</span>
          </div>
        )}
      </div>

      {snapshots.length >= 2 && (
        <>
          <div className={styles.sectionTitle}>Stack over time</div>
          <div className={styles.chartWrap}>
            <StackChart snapshots={snapshots} currency={currency} />
          </div>
        </>
      )}
    </div>
  );
}

function StreetRow({ label, n, pct }: { label: string; n: number; pct: string }) {
  return (
    <div className={styles.streetRow}>
      <span className={styles.streetLabel}>{label}</span>
      <span className={styles.colN}>{n}</span>
      <span className={styles.colPct}>{pct}</span>
    </div>
  );
}

function StackChart({ snapshots, currency }: { snapshots: StackSnapshot[]; currency: string }) {
  const W = 288, H = 110, PX = 8, PY = 12;

  const times = snapshots.map((s) => new Date(s.createdAt).getTime());
  const stacks = snapshots.map((s) => s.stackAmount);

  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minS = Math.min(...stacks);
  const maxS = Math.max(...stacks);
  const rangeT = maxT - minT || 1;
  const rangeS = maxS - minS || 1;

  const toX = (t: number) => PX + ((t - minT) / rangeT) * (W - PX * 2);
  const toY = (s: number) => H - PY - ((s - minS) / rangeS) * (H - PY * 2);

  const points = snapshots.map((s) => `${toX(new Date(s.createdAt).getTime())},${toY(s.stackAmount)}`).join(' ');

  // zero line (starting stack)
  const baselineY = toY(stacks[0]);
  const lastY = toY(stacks[stacks.length - 1]);
  const lineColor = stacks[stacks.length - 1] >= stacks[0] ? 'var(--go)' : 'var(--dt)';

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className={styles.chart}>
      {/* baseline */}
      <line
        x1={PX} y1={baselineY}
        x2={W - PX} y2={baselineY}
        stroke="var(--bt)" strokeWidth="0.5" strokeDasharray="3,3"
      />
      {/* stack line */}
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* dots */}
      {snapshots.map((s, i) => {
        const x = toX(new Date(s.createdAt).getTime());
        const y = toY(s.stackAmount);
        return <circle key={i} cx={x} cy={y} r="3" fill={lineColor} />;
      })}
      {/* first and last labels */}
      <text x={PX} y={H - 1} fontSize="9" fill="var(--t3)">{currency}{stacks[0]}</text>
      <text x={W - PX} y={lastY - 5} fontSize="9" fill={lineColor} textAnchor="end">
        {currency}{stacks[stacks.length - 1]}
      </text>
    </svg>
  );
}
