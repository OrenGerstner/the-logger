import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigation } from '@/navigation/NavigationContext';
import { useSession } from '@/store/SessionContext';
import { useHand } from '@/store/HandContext';
import { useSettings } from '@/store/settingsStore';
import { sessionRepo } from '@/db/sessionRepo';
import { handRepo } from '@/db/handRepo';
import { calculateElapsedSeconds, formatElapsedTime } from '@/domain/sessionTime';
import type { Session } from '@/domain/types';
import styles from './PastSessions.module.css';

export function PastSessions() {
  const { goBack, navigate } = useNavigation();
  const { activeSession, deleteSession } = useSession();
  const { clearDraft } = useHand();
  const { settings } = useSettings();

  const [confirmId, setConfirmId] = useState<string | null>(null);

  const allSessions = useLiveQuery(() => sessionRepo.getAll()) ?? [];

  async function handleDelete(session: Session) {
    if (activeSession?.id === session.id) {
      clearDraft();
    }
    await deleteSession(session.id);
    setConfirmId(null);
  }

  return (
    <div className="screen">
      <div className="bar">
        <button className={styles.back} onClick={goBack}>← Back</button>
        <span>All sessions</span>
      </div>

      {allSessions.length === 0 && (
        <p className="note">No sessions recorded yet.</p>
      )}

      <div className={styles.list}>
        {allSessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            currency={settings.currency}
            isActive={s.id === activeSession?.id}
            onDelete={() => setConfirmId(s.id)}
            onTap={() => navigate({ name: 'sessionDetail', params: { sessionId: s.id } })}
          />
        ))}
      </div>

      <Dialog.Root open={confirmId !== null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content className={styles.modal}>
            <Dialog.Title className={styles.modalTitle}>Delete session?</Dialog.Title>
            <Dialog.Description className={styles.modalDesc}>
              This will permanently delete the session and all its logged hands and stack data. This cannot be undone.
            </Dialog.Description>
            <div className="btn-row">
              <Dialog.Close asChild>
                <button className="btn">Cancel</button>
              </Dialog.Close>
              <button
                className="btn danger"
                onClick={() => {
                  const s = allSessions.find((x) => x.id === confirmId);
                  if (s) handleDelete(s);
                }}
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function SessionRow({
  session,
  currency,
  isActive,
  onDelete,
  onTap,
}: {
  session: Session;
  currency: string;
  isActive: boolean;
  onDelete(): void;
  onTap(): void;
}) {
  const hands = useLiveQuery(() => handRepo.getBySession(session.id), [session.id]) ?? [];

  const elapsed = calculateElapsedSeconds(
    session.timerStartedAt,
    session.timerPauses,
    session.timerPausedAt,
    session.endedAt
  );

  const date = new Date(session.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className={styles.row}>
      <button className={styles.rowInfo} onClick={onTap}>
        <span className={styles.rowDate}>{date}</span>
        <span className={styles.rowMeta}>
          {currency}{session.stakes.smallBlind}/{currency}{session.stakes.bigBlind}
          {session.venue ? ` · ${session.venue}` : ''}
          {' · '}{hands.length} hands · {formatElapsedTime(elapsed)}
        </span>
        {isActive && <span className={styles.activeBadge}>active</span>}
      </button>
      <button className={styles.deleteBtn} onClick={onDelete}>🗑</button>
    </div>
  );
}
