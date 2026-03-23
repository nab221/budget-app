import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // virtual:pwa-register is provided by vite-plugin-pwa at build time;
      // point to a stub so vitest can resolve pwa-ux.js imports during tests.
      'virtual:pwa-register': path.resolve(__dirname, 'src/__mocks__/virtual-pwa-register.js'),
    },
  },
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.js'],
      exclude: ['src/main.js', 'src/app.js', 'node_modules/**'],
    },
  },
});
