import type { TournamentStructure } from '@/domain/types';

// In-memory slot: StructureEditor writes here, then calls goBack().
// NewSession reads it on mount (useState initializer).
let _pending: TournamentStructure | null = null;

export function setPendingStructure(s: TournamentStructure | null): void {
  _pending = s;
}

export function takePendingStructure(): TournamentStructure | null {
  const s = _pending;
  _pending = null;
  return s;
}
