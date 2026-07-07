import { describe, it, expect, afterEach } from 'vitest';
import { applyTheme, applyPrivacy } from './theme.js';

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.body.classList.remove('privacy');
});

describe('applyTheme', () => {
  it('stamps data-theme for an explicit theme', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('clears data-theme for "system"', () => {
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('applyPrivacy', () => {
  it('toggles the privacy class on body', () => {
    applyPrivacy(true);
    expect(document.body.classList.contains('privacy')).toBe(true);
    applyPrivacy(false);
    expect(document.body.classList.contains('privacy')).toBe(false);
  });
});
