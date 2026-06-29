import type { TournamentStructure, TournamentLevelRow } from './types';

export function getLevelRow(structure: TournamentStructure, levelNum: number): TournamentLevelRow | null {
  for (const row of structure.rows) {
    if (row.kind === 'level' && row.level === levelNum) return row;
  }
  return null;
}

export function getMaxLevel(structure: TournamentStructure): number {
  let max = 0;
  for (const row of structure.rows) {
    if (row.kind === 'level' && row.level > max) max = row.level;
  }
  return max;
}

export function computeEffBB(chips: number, bigBlind: number): number {
  if (bigBlind <= 0) return 0;
  return chips / bigBlind;
}

export function getStrategyRegime(effBB: number): 'cash' | 'pushfold' {
  return effBB >= 20 ? 'cash' : 'pushfold';
}

export function parseStructureJSON(jsonStr: string): TournamentStructure {
  const data: unknown = JSON.parse(jsonStr);
  if (typeof data !== 'object' || data === null) throw new Error('Must be a JSON object');
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.rows)) throw new Error('Missing "rows" array');
  const levels = (d.rows as Array<Record<string, unknown>>).filter((r) => r.kind === 'level');
  if (levels.length === 0) throw new Error('No level rows found');
  for (const lv of levels) {
    if (typeof lv.level !== 'number') throw new Error(`Level row missing "level" number`);
    if (typeof lv.sb !== 'number') throw new Error(`Level ${lv.level}: missing "sb"`);
    if (typeof lv.bb !== 'number') throw new Error(`Level ${lv.level}: missing "bb"`);
    if (typeof lv.ante !== 'number') throw new Error(`Level ${lv.level}: missing "ante"`);
  }
  return d as unknown as TournamentStructure;
}

export function formatBlinds(levelRow: TournamentLevelRow): string {
  const parts = [`${levelRow.sb.toLocaleString()}/${levelRow.bb.toLocaleString()}`];
  if (levelRow.ante > 0) parts.push(`ante ${levelRow.ante.toLocaleString()}`);
  return parts.join(' · ');
}
