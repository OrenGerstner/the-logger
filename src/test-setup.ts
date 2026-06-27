import '@testing-library/react';

// Suppress IndexedDB errors in jsdom (Dexie won't run in tests)
Object.defineProperty(window, 'indexedDB', {
  value: undefined,
  writable: true,
});
