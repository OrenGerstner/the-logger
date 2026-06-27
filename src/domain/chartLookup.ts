import type { Position, Scenario } from './types';
import rawCharts from '@charts';

interface ChartMap {
  [handKey: string]: string;
}

interface ChartsData {
  RFI: Record<string, ChartMap>;
  FacingRFI: Record<string, ChartMap>;
  RFIvs3Bet: Record<string, ChartMap>;
}

const charts = rawCharts as ChartsData;

// Build lookup maps at module load time so lookups are O(1)

// (heroPos):(raiserPos) → chartKey for FacingRFI
const facingRFILookup = new Map<string, string>();
for (const chartKey of Object.keys(charts.FacingRFI)) {
  const parts = chartKey.split(' vs ');
  if (parts.length !== 2) continue;
  const heroPos = parts[0].trim();
  const raiserGroup = parts[1].trim().split('/');
  for (const raiserPos of raiserGroup) {
    facingRFILookup.set(`${heroPos}:${raiserPos.trim()}`, chartKey);
  }
}

// (heroPos):(threeBettorPos) → chartKey for RFIvs3Bet
const rfiVs3BetLookup = new Map<string, string>();
for (const chartKey of Object.keys(charts.RFIvs3Bet)) {
  const parts = chartKey.split(' vs ');
  if (parts.length !== 2) continue;
  const heroPos = parts[0].trim();
  const threeBettorGroup = parts[1].trim().split('/');
  for (const threeBettorPos of threeBettorGroup) {
    rfiVs3BetLookup.set(`${heroPos}:${threeBettorPos.trim()}`, chartKey);
  }
}

export function lookupRFI(heroPosition: Position, handKey: string): string | null {
  const chart = charts.RFI[heroPosition];
  if (!chart) return null;
  return chart[handKey] ?? null;
}

export function lookupFacingRFI(
  heroPosition: Position,
  raiserPosition: Position,
  handKey: string
): string | null {
  const chartKey = facingRFILookup.get(`${heroPosition}:${raiserPosition}`);
  if (!chartKey) return null;
  const chart = charts.FacingRFI[chartKey];
  if (!chart) return null;
  return chart[handKey] ?? null;
}

export function lookupRFIvs3Bet(
  heroPosition: Position,
  threeBettorPosition: Position,
  handKey: string
): string | null {
  const chartKey = rfiVs3BetLookup.get(`${heroPosition}:${threeBettorPosition}`);
  if (!chartKey) return null;
  const chart = charts.RFIvs3Bet[chartKey];
  if (!chart) return null;
  return chart[handKey] ?? null;
}

export function lookupRecommendation(
  scenario: Scenario,
  heroPosition: Position,
  facingPosition: Position | null,
  handKey: string
): string | null {
  if (scenario === 'OffChart') return null;
  if (scenario === 'RFI') return lookupRFI(heroPosition, handKey);
  if (scenario === 'FacingRFI' && facingPosition) {
    return lookupFacingRFI(heroPosition, facingPosition, handKey);
  }
  if (scenario === 'RFIvs3Bet' && facingPosition) {
    return lookupRFIvs3Bet(heroPosition, facingPosition, handKey);
  }
  return null;
}

export { charts };
