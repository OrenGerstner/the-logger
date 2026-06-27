import React, { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { Position, OpponentAction } from '@/domain/types';
import { autoLabelAction } from '@/domain/scenarioResolver';
import styles from './PokerTable.module.css';

// Canonical seat positions for the 300×220 table oval
export const SEAT_POSITIONS = [
  { left: 38, top: 55 },   // seat 1
  { left: 95, top: 22 },   // seat 2
  { left: 169, top: 22 },  // seat 3
  { left: 226, top: 55 },  // seat 4
  { left: 238, top: 105 }, // seat 5
  { left: 201, top: 149 }, // seat 6
  { left: 132, top: 166 }, // seat 7
  { left: 63, top: 149 },  // seat 8
  { left: 26, top: 105 },  // seat 9
];

// Seat number label offsets (from seat circle's top-left corner)
const SEAT_NUM_OFFSETS = [
  { dl: -4, dt: -17 },  // seat 1: above-left
  { dl: 8, dt: -17 },   // seat 2: above
  { dl: 8, dt: -17 },   // seat 3: above
  { dl: 38, dt: -4 },   // seat 4: right
  { dl: 38, dt: 8 },    // seat 5: right
  { dl: 38, dt: 10 },   // seat 6: right-below
  { dl: 8, dt: 38 },    // seat 7: below
  { dl: -20, dt: 10 },  // seat 8: left-below
  { dl: -20, dt: 8 },   // seat 9: left
];

export interface SeatState {
  occupied: boolean;
  isHero: boolean;
  isButton: boolean;
  position?: Position;
  raisedAction?: OpponentAction['action'];
}

interface Props {
  mode: 'play' | 'edit';
  seats: Record<number, SeatState>;
  heroSeat: number;
  opponentActions: OpponentAction[];
  onOpponentAction(seat: number, action: OpponentAction['action']): void;
  onRemoveOpponentAction(seat: number): void;
  onSeatEdit(seat: number, action: 'me' | 'sitting' | 'empty'): void;
  hint?: string;
}

export function PokerTable({
  mode,
  seats,
  heroSeat,
  opponentActions,
  onOpponentAction,
  onRemoveOpponentAction,
  onSeatEdit,
  hint,
}: Props) {
  const [popoverSeat, setPopoverSeat] = useState<number | null>(null);
  const [removeConfirmSeat, setRemoveConfirmSeat] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasLongPress = useRef(false);

  function handleLongPressStart(seat: number) {
    wasLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      wasLongPress.current = true;
      if (seats[seat]?.occupied && !seats[seat]?.isHero) {
        setRemoveConfirmSeat(seat);
      }
    }, 600);
  }

  function handleLongPressEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleTap(seat: number) {
    if (wasLongPress.current) {
      wasLongPress.current = false;
      return;
    }
    // Close any open popover first
    if (popoverSeat !== null) {
      setPopoverSeat(null);
      return;
    }
    setPopoverSeat(seat);
  }

  function closePopover() {
    setPopoverSeat(null);
  }

  return (
    <div className={styles.tableWrap}>
      <div className={styles.table}>
        <div className={styles.felt}>
          {hint && <span className={styles.hint}>{hint}</span>}
        </div>

        {Array.from({ length: 9 }, (_, i) => i + 1).map((seatNum) => {
          const pos = SEAT_POSITIONS[seatNum - 1];
          const numOff = SEAT_NUM_OFFSETS[seatNum - 1];
          const state = seats[seatNum];
          const action = opponentActions.find((a) => a.seat === seatNum);
          const hasRaise = action?.action === 'open' || action?.action === '3bet' || action?.action === '4bet';

          const cls = [
            styles.seat,
            !state?.occupied ? styles.empty : '',
            state?.isHero ? styles.you : '',
            hasRaise ? styles.raise : '',
            state?.isButton ? styles.btn : '',
          ].filter(Boolean).join(' ');

          const label = state?.isHero
            ? 'You'
            : state?.position
            ? (state.position === 'UTG+1' ? 'U+1'
              : state.position === 'UTG+2' ? 'U+2'
              : state.position)
            : '·';

          const raiseLvl = action?.action === 'open' ? 'R'
            : action?.action === '3bet' ? '3B'
            : action?.action === '4bet' ? '4B'
            : '';

          return (
            <React.Fragment key={seatNum}>
              <button
                className={cls}
                style={{ left: pos.left, top: pos.top }}
                onClick={() => handleTap(seatNum)}
                onPointerDown={() => handleLongPressStart(seatNum)}
                onPointerUp={handleLongPressEnd}
                onPointerCancel={handleLongPressEnd}
                onContextMenu={(e) => e.preventDefault()}
              >
                {label}
                {raiseLvl && <span className={styles.raiseLvl}>{raiseLvl}</span>}
                {state?.isButton && (
                  <span className={styles.dealerBtn} style={{ left: 14, top: -2 }}>D</span>
                )}
              </button>
              {/* Seat number label outside the circle */}
              <span
                className={styles.seatNum}
                style={{ left: pos.left + numOff.dl, top: pos.top + numOff.dt }}
              >
                {seatNum}
              </span>
            </React.Fragment>
          );
        })}

        {/* Popover — positioned within the table */}
        {popoverSeat !== null && (
          <div className={styles.popoverOverlay} onClick={closePopover}>
            <div
              className={styles.popover}
              style={getPopoverStyle(popoverSeat)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.popoverHeader}>
                <span className={styles.popoverTitle}>
                  {seats[popoverSeat]?.position ?? `Seat ${popoverSeat}`}
                  {mode === 'edit' && ` · Seat ${popoverSeat}`}
                </span>
                <button className={styles.popoverX} onClick={closePopover}>✕</button>
              </div>

              {mode === 'edit' ? (
                <>
                  <button
                    className={`${styles.popoverOpt} ${styles.info}`}
                    onClick={() => { onSeatEdit(popoverSeat, 'me'); closePopover(); }}
                  >
                    👤 This is me
                  </button>
                  <button
                    className={styles.popoverOpt}
                    onClick={() => { onSeatEdit(popoverSeat, 'sitting'); closePopover(); }}
                  >
                    🪑 Player sitting
                  </button>
                  {popoverSeat !== heroSeat && (
                    <button
                      className={`${styles.popoverOpt} ${styles.danger}`}
                      onClick={() => { onSeatEdit(popoverSeat, 'empty'); closePopover(); }}
                    >
                      ✕ Empty / left
                    </button>
                  )}
                </>
              ) : (
                <>
                  {(() => {
                    const prevRaises = opponentActions.filter(
                      (a) => a.seat !== popoverSeat && (a.action === 'open' || a.action === '3bet' || a.action === '4bet')
                    );
                    const nextLabel = autoLabelAction(prevRaises);
                    const raiseLabel = nextLabel === 'open' ? 'Raise' : nextLabel === '3bet' ? '3-Bet' : '4-Bet';
                    const existingAction = opponentActions.find((a) => a.seat === popoverSeat);
                    return (
                      <>
                        <button
                          className={`${styles.popoverOpt} ${styles.info}`}
                          onClick={() => { onOpponentAction(popoverSeat, nextLabel as OpponentAction['action']); closePopover(); }}
                        >
                          ↑ {raiseLabel}
                        </button>
                        <button
                          className={styles.popoverOpt}
                          onClick={() => { onOpponentAction(popoverSeat, 'call'); closePopover(); }}
                        >
                          = Call / limp
                        </button>
                        <button
                          className={styles.popoverOpt}
                          onClick={() => { onOpponentAction(popoverSeat, 'fold'); closePopover(); }}
                        >
                          × Fold
                        </button>
                        {existingAction && (
                          <button
                            className={`${styles.popoverOpt} ${styles.danger}`}
                            onClick={() => { onRemoveOpponentAction(popoverSeat); closePopover(); }}
                          >
                            ↺ Clear action
                          </button>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Long-press remove confirm dialog */}
      <Dialog.Root
        open={removeConfirmSeat !== null}
        onOpenChange={(open) => !open && setRemoveConfirmSeat(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className={styles.dialogOverlay} />
          <Dialog.Content className={styles.dialogContent}>
            <Dialog.Title className={styles.dialogTitle}>Remove player?</Dialog.Title>
            <Dialog.Description className={styles.dialogDesc}>
              Seat {removeConfirmSeat} will be marked empty.
            </Dialog.Description>
            <div className="btn-row">
              <Dialog.Close asChild>
                <button className="btn">Cancel</button>
              </Dialog.Close>
              <button
                className="btn danger"
                onClick={() => {
                  if (removeConfirmSeat !== null) onSeatEdit(removeConfirmSeat, 'empty');
                  setRemoveConfirmSeat(null);
                }}
              >
                Remove
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function getPopoverStyle(seat: number): React.CSSProperties {
  const pos = SEAT_POSITIONS[seat - 1];
  const onRight = pos.left + 18 > 150;
  const atBottom = pos.top > 110;
  const left = onRight ? Math.max(4, pos.left - 152) : Math.min(pos.left + 38, 148);
  const top = atBottom ? Math.max(0, pos.top - 115) : pos.top + 10;
  return { position: 'absolute', left, top, zIndex: 30 };
}
