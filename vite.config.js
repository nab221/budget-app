import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Budget Console',
        short_name: 'Budget',
        description: 'Local-first personal budget tracker with offline support.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b1120',
        theme_color: '#0b1120',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
