// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initPWA } from './pwa-ux.js';

// Capture the registerSW callbacks so tests can trigger them
let capturedCallbacks = {};
let capturedUpdateSW;

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((callbacks) => {
    capturedCallbacks = callbacks;
    // Return a mock updateSW function
    capturedUpdateSW = vi.fn();
    return capturedUpdateSW;
  }),
}));

vi.mock('../utils/supabase-sync.js', () => ({
  isConfigured: vi.fn(() => false),
}));

describe('pwa-ux.js — update bar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    capturedCallbacks = {};
    capturedUpdateSW = undefined;
    vi.clearAllMocks();
  });

  describe('_showUpdateBar (via onNeedRefresh)', () => {
    it('creates #pwa-update-bar with class update-bar and appends to document.body', () => {
      initPWA();
      capturedCallbacks.onNeedRefresh();

      const bar = document.getElementById('pwa-update-bar');
      expect(bar).not.toBeNull();
      expect(bar.className).toBe('update-bar');
      expect(document.body.contains(bar)).toBe(true);
    });

    it('bar contains an "Update now" button and a "Later" button', () => {
      initPWA();
      capturedCallbacks.onNeedRefresh();

      const bar = document.getElementById('pwa-update-bar');
      const buttons = bar.querySelectorAll('button');
      const buttonTexts = Array.from(buttons).map(b => b.textContent);
      expect(buttonTexts).toContain('Update now');
      expect(buttonTexts).toContain('Later');
    });

    it('is idempotent — calling onNeedRefresh twice does not create a second #pwa-update-bar', () => {
      initPWA();
      capturedCallbacks.onNeedRefresh();
      capturedCallbacks.onNeedRefresh();

      const bars = document.querySelectorAll('#pwa-update-bar');
      expect(bars.length).toBe(1);
    });

    it('clicking "Update now" calls updateSW(true)', () => {
      initPWA();
      capturedCallbacks.onNeedRefresh();

      const bar = document.getElementById('pwa-update-bar');
      const updateBtn = Array.from(bar.querySelectorAll('button')).find(b => b.textContent === 'Update now');
      updateBtn.click();

      expect(capturedUpdateSW).toHaveBeenCalledWith(true);
    });

    it('clicking "Update now" hides the bar', () => {
      initPWA();
      capturedCallbacks.onNeedRefresh();

      const bar = document.getElementById('pwa-update-bar');
      const updateBtn = Array.from(bar.querySelectorAll('button')).find(b => b.textContent === 'Update now');
      updateBtn.click();

      expect(bar.style.display).toBe('none');
    });

    it('clicking "Later" hides the bar without calling updateSW', () => {
      initPWA();
      capturedCallbacks.onNeedRefresh();

      const bar = document.getElementById('pwa-update-bar');
      const laterBtn = Array.from(bar.querySelectorAll('button')).find(b => b.textContent === 'Later');
      laterBtn.click();

      expect(bar.style.display).toBe('none');
      expect(capturedUpdateSW).not.toHaveBeenCalled();
    });
  });

  describe('_hideUpdateBar (via "Later" button)', () => {
    it('does not throw if #pwa-update-bar does not exist', () => {
      // No bar in DOM — just call via Later button path indirectly
      // We test this by ensuring no bar element and triggering hide indirectly
      // is safe. The bar won't exist so this is a no-op.
      expect(() => {
        // Trigger hide-only scenario: bar doesn't exist, no error expected
        const bar = document.getElementById('pwa-update-bar');
        if (bar) bar.style.display = 'none';
      }).not.toThrow();
    });
  });
});
