import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { NavigationProvider } from './navigation/NavigationContext';
import { SessionProvider } from './store/SessionContext';
import { HandProvider } from './store/HandContext';
import './styles/globals.css';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration is optional — app works without it
    });
  });
}

// Lock screen orientation to portrait when running as installed PWA
if ('screen' in window && 'orientation' in screen) {
  (screen.orientation as { lock?(orientation: string): Promise<void> })
    .lock?.('portrait')
    .catch(() => {
      // Orientation lock only works in fullscreen PWA mode; ignore the error
    });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NavigationProvider>
      <SessionProvider>
        <HandProvider>
          <App />
        </HandProvider>
      </SessionProvider>
    </NavigationProvider>
  </React.StrictMode>
);
