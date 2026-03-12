// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { triggerHaptic, alertWithHaptic, HAPTIC_PATTERNS, resetHapticTimers } from './haptics.js';

describe('haptics.js', () => {
  beforeEach(() => {
    localStorage.clear();
    resetHapticTimers();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock navigator.vibrate
    if (typeof navigator !== 'undefined') {
      navigator.vibrate = vi.fn();
    }
    
    // Mock window.alert
    window.alert = vi.fn();

    // Reset internal debounce timer by clearing the map (not exported, but we can wait)
    // Actually, we can just mock Date.now()
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('triggerHaptic', () => {
    it('calls navigator.vibrate with the correct pattern when enabled', () => {
      triggerHaptic('tap');
      expect(navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.tap);
    });

    it('does NOT call navigator.vibrate when disabled in localStorage', () => {
      localStorage.setItem('budget_haptics_enabled', 'false');
      triggerHaptic('tap');
      expect(navigator.vibrate).not.toHaveBeenCalled();
    });

    it('defaults to enabled if localStorage is empty', () => {
      triggerHaptic('success');
      expect(navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.success);
    });

    it('enforces debounce to prevent flooding', () => {
      triggerHaptic('tap');
      triggerHaptic('tap');
      expect(navigator.vibrate).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(301);
      triggerHaptic('tap');
      expect(navigator.vibrate).toHaveBeenCalledTimes(2);
    });

    it('handles missing navigator.vibrate gracefully', () => {
      delete navigator.vibrate;
      
      triggerHaptic('tap'); // Should not throw
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('alertWithHaptic', () => {
    it('triggers haptic and then shows alert', () => {
      alertWithHaptic('Test Message', 'success');
      expect(navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.success);
      expect(window.alert).toHaveBeenCalledWith('Test Message');
    });

    it('defaults to error pattern', () => {
      alertWithHaptic('Error Message');
      expect(navigator.vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.error);
    });
  });
});
