import { useNavigation } from '@/navigation/NavigationContext';
import { useTableState } from '@/store/tableStateStore';
import { useHand } from '@/store/HandContext';
import { useSession } from '@/store/SessionContext';
import { handRepo } from '@/db/handRepo';
import { getHeroPosition } from '@/domain/positions';
import { PokerTable } from '@/components/PokerTable/PokerTable';
import type { SeatState } from '@/components/PokerTable/PokerTable';
import type { Position } from '@/domain/types';
import { derivePositions } from '@/domain/positions';
import styles from './TableSetup.module.css';

export function TableSetup() {
  const { navigate } = useNavigation();
  const { tableState, setSeatOccupied, setHeroSeat, initForSession } = useTableState();
  const { activeSession } = useSession();
  const { startNewHand } = useHand();

  const positions = derivePositions(tableState.occupiedSeats, tableState.buttonSeat);

  function buildSeats(): Record<number, SeatState> {
    const result: Record<number, SeatState> = {};
    for (let i = 1; i <= 9; i++) {
      const occ = tableState.occupiedSeats.includes(i);
      result[i] = {
        occupied: occ,
        isHero: i === tableState.heroSeat,
        isButton: i === tableState.buttonSeat,
        position: positions.get(i) as Position | undefined,
        raisedAction: undefined,
      };
    }
    return result;
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

  async function handleDone() {
    if (!activeSession) return;
    const heroPos = getHeroPosition(
      tableState.occupiedSeats,
      tableState.buttonSeat,
      tableState.heroSeat
    );
    if (!heroPos) return;

    const handNumber = await handRepo.getNextHandNumber(activeSession.id);
    startNewHand({
      sessionId: activeSession.id,
      handNumber,
      occupiedSeats: tableState.occupiedSeats,
      buttonSeat: tableState.buttonSeat,
      heroSeat: tableState.heroSeat,
      heroPosition: heroPos,
    });
    navigate({ name: 'play' });
  }

  const heroPos = getHeroPosition(
    tableState.occupiedSeats,
    tableState.buttonSeat,
    tableState.heroSeat
  );

  return (
    <div className="screen">
      <div className="bar">
        <span>Table setup</span>
        <button className={styles.doneBtn} onClick={handleDone} disabled={!heroPos}>✓ Done</button>
      </div>

      <div className="label">Table size</div>
      <div className="btn-row">
        {([6, 8, 9] as const).map((n) => (
          <button
            key={n}
            className={`btn ${tableState.maxSeats === n ? 'info' : ''}`}
            onClick={() => initForSession(n, tableState.heroSeat)}
          >
            {n === 6 ? '6-max' : n === 8 ? '8-max' : '9-handed'}
          </button>
        ))}
      </div>

      <div className="label">Tap a seat to set who's in and your seat</div>

      <PokerTable
        mode="edit"
        seats={buildSeats()}
        heroSeat={tableState.heroSeat}
        opponentActions={[]}
        onOpponentAction={() => {}}
        onRemoveOpponentAction={() => {}}
        onSeatEdit={handleSeatEdit}
      />

      <div className={styles.legend}>
        <span><span className={styles.youDot}>●</span> you</span>
        <span>● occupied</span>
        <span style={{ color: 'var(--t3)' }}>- - empty</span>
      </div>

      {heroPos && (
        <div className="note" style={{ textAlign: 'center' }}>Your position: <strong>{heroPos}</strong></div>
      )}

      <div className="note" style={{ marginTop: 'auto', textAlign: 'center' }}>
        Long-press any seat to remove player · tap ✓ when ready
      </div>
    </div>
  );
}
