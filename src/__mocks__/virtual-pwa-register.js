/**
 * Test stub for virtual:pwa-register (provided by vite-plugin-pwa at build time).
 * Vitest cannot resolve virtual modules — this stub is wired in vitest.config.js
 * via resolve.alias so tests can import pwa-ux.js without errors.
 *
 * Individual tests override this with vi.mock('virtual:pwa-register', ...) as needed.
 */
export function registerSW(_callbacks) {
  // No-op in tests by default; individual tests override via vi.mock
  return () => {};
}
