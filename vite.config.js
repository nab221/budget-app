import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/budget-app/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Budget Console',
        short_name: 'Budget',
        description: 'Local-first personal budget tracker with offline support.',
        start_url: '/budget-app/',
        scope: '/budget-app/',
        display: 'standalone',
        background_color: '#0b1120',
        theme_color: '#0b1120',
        icons: [
          {
            src: '/budget-app/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/budget-app/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Only local assets are precached. External CDN scripts are intentionally excluded.
        // Note: GIS (accounts.google.com/gsi/client) is intentionally NOT precached.
        // Cloud backup features require network — gracefully disabled offline by navigator.onLine checks.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
