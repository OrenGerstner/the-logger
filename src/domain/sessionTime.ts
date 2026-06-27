import type { TimePause } from './types';

export function calculateElapsedSeconds(
  timerStartedAt: string,
  timerPauses: TimePause[],
  timerPausedAt: string | null,
  endedAt: string | null
): number {
  const start = new Date(timerStartedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();

  const pausedMs = timerPauses.reduce((acc, pause) => {
    const pauseStart = new Date(pause.startedAt).getTime();
    const pauseEnd = new Date(pause.endedAt).getTime();
    return acc + (pauseEnd - pauseStart);
  }, 0);

  // If currently paused, add time since pause started
  const currentPauseMs =
    timerPausedAt && !endedAt
      ? Date.now() - new Date(timerPausedAt).getTime()
      : 0;

  const elapsed = Math.max(0, end - start - pausedMs - currentPauseMs);
  return Math.floor(elapsed / 1000);
}

export function formatElapsedTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatElapsedHours(totalSeconds: number): string {
  const h = totalSeconds / 3600;
  if (h < 1) {
    const m = Math.floor(totalSeconds / 60);
    return `${m}m`;
  }
  return `${h.toFixed(1)}h`;
}

export function calculateProfitPerHour(
  netAmount: number,
  elapsedSeconds: number
): number | null {
  if (elapsedSeconds < 60) return null; // avoid division by tiny numbers
  return netAmount / (elapsedSeconds / 3600);
}
