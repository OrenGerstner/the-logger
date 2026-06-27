import { useEffect, useState } from 'react';
import type { Session, StackSnapshot } from '@/domain/types';
import { calculateElapsedSeconds, formatElapsedTime } from '@/domain/sessionTime';
import { computeSessionNet } from '@/domain/stackAttribution';
import { formatNet, formatProfitPerHour, formatStack } from '@/utils/formatting';
import styles from './SessionHeader.module.css';

interface Props {
  session: Session;
  latestSnapshot?: StackSnapshot;
  currency: string;
  handCount: number;
  onPause?(): void;
  onResume?(): void;
  onUpdateStack?(): void;
}

export function SessionHeader({ session, latestSnapshot, currency, handCount, onPause, onResume, onUpdateStack }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const tick = () => {
      setElapsed(
        calculateElapsedSeconds(
          session.timerStartedAt,
          session.timerPauses,
          session.timerPausedAt,
          session.endedAt
        )
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  const isPaused = !!session.timerPausedAt;
  const latestStack = latestSnapshot?.stackAmount ?? null;

  const { net } = computeSessionNet(
    session.buyIns,
    session.cashOut,
    latestStack,
    []
  );

  const pph =
    net !== null && elapsed >= 60
      ? (net / (elapsed / 3600))
      : null;

  const netColor =
    net === null ? '' : net > 0 ? styles.positive : net < 0 ? styles.negative : '';

  return (
    <div className={styles.header}>
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <div className={styles.val}>{formatElapsedTime(elapsed)}{isPaused ? ' ⏸' : ''}</div>
          <div className={styles.key}>time</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.val}>{formatStack(latestStack, currency)}</div>
          <div className={styles.key}>stack</div>
        </div>
        <div className={`${styles.metric} ${netColor}`}>
          <div className={styles.val}>{formatNet(net, currency)}</div>
          <div className={styles.key}>net</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.val}>{formatProfitPerHour(pph, currency)}</div>
          <div className={styles.key}>$/hr</div>
        </div>
      </div>
      <div className={styles.actions}>
        <span className={styles.handCount}>{handCount} hands</span>
        <div className={styles.btns}>
          {onPause && !isPaused && (
            <button className={styles.iconBtn} onClick={onPause} title="Pause timer">⏸</button>
          )}
          {onResume && isPaused && (
            <button className={styles.iconBtn} onClick={onResume} title="Resume timer">▶</button>
          )}
          {onUpdateStack && (
            <button className={styles.stackBtn} onClick={onUpdateStack}>Update Stack</button>
          )}
        </div>
      </div>
    </div>
  );
}
