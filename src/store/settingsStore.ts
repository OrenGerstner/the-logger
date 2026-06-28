import { useState, useEffect } from 'react';
import type { Settings } from '@/domain/types';

const STORAGE_KEY = 'logger-settings';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  showRecommendation: 'before',
  showChartAfterFold: true,
  hideHoleCardsPostflop: true,
  flagDeviations: true,
  currency: '$',
  defaultTableSize: 9,
  pauseTimerDuringBreaks: true,
  preflopFocusMode: true,
  focusRFI: true,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useSettings() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);

  useEffect(() => {
    // Apply theme class to body
    document.body.classList.toggle('light', settings.theme === 'light');
  }, [settings.theme]);

  function updateSettings(patch: Partial<Settings>): void {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }

  return { settings, updateSettings };
}
