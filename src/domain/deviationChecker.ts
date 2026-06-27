import type { HeroAction, ActionFamily } from './types';

const RAISE_FAMILY = new Set([
  'Raise',
  'Raise for Value',
  'Raise as a Bluff',
  '3-Bet for Value',
  '3-Bet as a Bluff',
  '4-Bet for Value',
  '4-Bet as a Bluff',
]);

const CALL_FAMILY = new Set(['Call', 'Limp']);

export function getActionFamily(chartAction: string): ActionFamily {
  if (RAISE_FAMILY.has(chartAction)) return 'Raise';
  if (CALL_FAMILY.has(chartAction)) return 'Call';
  return 'Fold';
}

export function checkDeviation(
  heroAction: HeroAction,
  chartRecommendation: string | null
): boolean {
  if (!chartRecommendation) return false;
  const chartFamily = getActionFamily(chartRecommendation);
  return heroAction !== chartFamily;
}

// Display version: "Limp" is shown as "Call" to the player
export function displayRecommendation(chartRecommendation: string): string {
  if (chartRecommendation === 'Limp') return 'Call';
  return chartRecommendation;
}
