import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getAppVersion(isBuild: boolean): string {
  const counterFile = path.resolve(__dirname, '.build-counter.json');
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yy}${mm}${dd}`;

  let info: { date: string; count: number } = { date: '', count: 0 };
  try {
    info = JSON.parse(readFileSync(counterFile, 'utf-8')) as typeof info;
  } catch { /* no counter file yet */ }

  if (isBuild) {
    info = info.date === today ? { date: today, count: info.count + 1 } : { date: today, count: 1 };
    try { writeFileSync(counterFile, JSON.stringify(info)); } catch { /* ignore write errors */ }
  } else if (info.date !== today) {
    info = { date: today, count: 0 };
  }

  return `${yy}.${mm}.${dd}.${String(info.count).padStart(2, '0')}`;
}

export default defineConfig(({ command }) => {
  const appVersion = getAppVersion(command === 'build');
  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'The Logger',
          short_name: 'Logger',
          description: 'Preflop poker hand tracker — log hands and check charts at the table',
          theme_color: '#191916',
          background_color: '#191916',
          display: 'fullscreen',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
          runtimeCaching: [],
        },
      }),
    ],
    server: {
      host: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@charts': path.resolve(__dirname, 'charts.json'),
        '@pushfold': path.resolve(__dirname, 'pushfold.json'),
      },
    },
  };
});
