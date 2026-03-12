// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initTheme, toggleTheme, getCurrentTheme } from './theme.js';
import { THEME_KEY } from '../utils/storage.js';

describe('theme.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.clearAllMocks();
  });

  describe('initTheme', () => {
    it('applies saved theme from localStorage if present', () => {
      localStorage.setItem(THEME_KEY, 'dark');
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('falls back to system preference (dark) if no saved theme', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
      }));
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('falls back to system preference (light) if no saved theme', () => {
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: light)',
      }));
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    it('defaults to light if matchMedia is unavailable', () => {
      const originalMatchMedia = window.matchMedia;
      delete window.matchMedia;
      initTheme();
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      window.matchMedia = originalMatchMedia;
    });
  });

  describe('toggleTheme', () => {
    it('toggles light to dark and persists', () => {
      document.documentElement.setAttribute('data-theme', 'light');
      const result = toggleTheme();
      expect(result).toBe('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    });

    it('toggles dark to light and persists', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      const result = toggleTheme();
      expect(result).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(localStorage.getItem(THEME_KEY)).toBe('light');
    });

    it('defaults current theme to light if attribute is missing', () => {
      const result = toggleTheme();
      expect(result).toBe('dark'); // light (default) -> dark
    });
  });

  describe('getCurrentTheme', () => {
    it('returns the current data-theme attribute', () => {
      document.documentElement.setAttribute('data-theme', 'dark');
      expect(getCurrentTheme()).toBe('dark');
    });

    it('defaults to light if attribute is missing', () => {
      expect(getCurrentTheme()).toBe('light');
    });
  });
});
