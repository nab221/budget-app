// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initPrivacyMode, togglePrivacyMode } from './privacy.js';
import { PRIVACY_MODE_KEY } from '../utils/storage.js';

// Mock haptics
vi.mock('../utils/haptics.js', () => ({
  triggerHaptic: vi.fn(),
}));

describe('privacy.js', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = '';
    document.body.innerHTML = '<button id="privacyToggle"></button>';
    vi.clearAllMocks();
  });

  describe('initPrivacyMode', () => {
    it('enables privacy mode if set to true in localStorage', () => {
      localStorage.setItem(PRIVACY_MODE_KEY, 'true');
      initPrivacyMode();
      expect(document.body.classList.contains('privacy-enabled')).toBe(true);
      expect(document.getElementById('privacyToggle').classList.contains('active')).toBe(true);
    });

    it('disables privacy mode if set to false in localStorage', () => {
      localStorage.setItem(PRIVACY_MODE_KEY, 'false');
      initPrivacyMode();
      expect(document.body.classList.contains('privacy-enabled')).toBe(false);
      expect(document.getElementById('privacyToggle').classList.contains('active')).toBe(false);
    });

    it('defaults to disabled if localStorage is empty', () => {
      initPrivacyMode();
      expect(document.body.classList.contains('privacy-enabled')).toBe(false);
    });
  });

  describe('togglePrivacyMode', () => {
    it('toggles privacy mode from off to on and persists', () => {
      initPrivacyMode(); // start off
      togglePrivacyMode();
      
      expect(document.body.classList.contains('privacy-enabled')).toBe(true);
      expect(localStorage.getItem(PRIVACY_MODE_KEY)).toBe('true');
      expect(document.getElementById('privacyToggle').classList.contains('active')).toBe(true);
    });

    it('toggles privacy mode from on to off and persists', () => {
      localStorage.setItem(PRIVACY_MODE_KEY, 'true');
      initPrivacyMode(); // start on
      
      togglePrivacyMode();
      
      expect(document.body.classList.contains('privacy-enabled')).toBe(false);
      expect(localStorage.getItem(PRIVACY_MODE_KEY)).toBe('false');
      expect(document.getElementById('privacyToggle').classList.contains('active')).toBe(false);
    });
  });
});
