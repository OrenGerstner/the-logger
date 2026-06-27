import React, { createContext, useContext, useState } from 'react';

export type ScreenName =
  | 'home'
  | 'newSession'
  | 'tableSetup'
  | 'play'
  | 'cardPicker'
  | 'postflop'
  | 'handResult'
  | 'handHistory'
  | 'pastSessions'
  | 'sessionDetail'
  | 'settings';

export interface Screen {
  name: ScreenName;
  params?: Record<string, unknown>;
}

interface NavigationCtx {
  currentScreen: Screen;
  navigate(screen: Screen): void;
  goBack(): void;
  canGoBack: boolean;
}

const NavigationContext = createContext<NavigationCtx | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);

  const currentScreen = stack[stack.length - 1];
  const canGoBack = stack.length > 1;

  function navigate(screen: Screen) {
    setStack((prev) => [...prev, screen]);
  }

  function goBack() {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }

  return (
    <NavigationContext.Provider value={{ currentScreen, navigate, goBack, canGoBack }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
