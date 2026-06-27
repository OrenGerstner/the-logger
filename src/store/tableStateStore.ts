import { useState } from 'react';
import type { TableState } from '@/domain/types';

const STORAGE_KEY = 'logger-table-state';

export const DEFAULT_TABLE_STATE: TableState = {
  occupiedSeats: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  heroSeat: 7,
  buttonSeat: 1,
  maxSeats: 9,
};

function loadTableState(): TableState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TABLE_STATE;
    return { ...DEFAULT_TABLE_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TABLE_STATE;
  }
}

function saveTableState(s: TableState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useTableState() {
  const [tableState, setTableStateInner] = useState<TableState>(loadTableState);

  function setTableState(patch: Partial<TableState>): void {
    setTableStateInner((prev) => {
      const next = { ...prev, ...patch };
      saveTableState(next);
      return next;
    });
  }

  function initForSession(maxSeats: 6 | 8 | 9, heroSeat?: number): void {
    const allSeats = Array.from({ length: 9 }, (_, i) => i + 1);
    const occupied = allSeats.slice(0, maxSeats);
    const newState: TableState = {
      occupiedSeats: occupied,
      heroSeat: heroSeat ?? Math.ceil(maxSeats / 2),
      buttonSeat: 1,
      maxSeats,
    };
    setTableStateInner(newState);
    saveTableState(newState);
  }

  function setSeatOccupied(seat: number, occupied: boolean): void {
    setTableState({
      occupiedSeats: occupied
        ? [...new Set([...tableState.occupiedSeats, seat])].sort((a, b) => a - b)
        : tableState.occupiedSeats.filter((s) => s !== seat),
    });
  }

  function setHeroSeat(seat: number): void {
    if (!tableState.occupiedSeats.includes(seat)) {
      setSeatOccupied(seat, true);
    }
    setTableState({ heroSeat: seat });
  }

  function setButtonSeat(seat: number): void {
    setTableState({ buttonSeat: seat });
  }

  function advanceButton(): void {
    const { occupiedSeats, buttonSeat } = tableState;
    const sorted = [...occupiedSeats].sort((a, b) => a - b);
    const idx = sorted.indexOf(buttonSeat);
    const next = sorted[(idx + 1) % sorted.length];
    setTableState({ buttonSeat: next });
  }

  return {
    tableState,
    setTableState,
    initForSession,
    setSeatOccupied,
    setHeroSeat,
    setButtonSeat,
    advanceButton,
  };
}
