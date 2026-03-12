/**
 * Centralized utility for haptic feedback patterns and vibration triggers.
 * Provides tactile reinforcement for user actions and system states.
 */
import { HAPTICS_ENABLED_KEY } from './storage.js';

export const HAPTIC_PATTERNS = {
  tap: [10],
  success: [30, 20, 30],
  delete: [40, 15, 25, 15, 15],
  error: [60, 40, 60],
  threshold: [10]
};

const lastPulseTime = new Map();
const DEBOUNCE_MS = 300;

/**
 * Resets internal debounce timers. Used for testing.
 */
export function resetHapticTimers() {
  lastPulseTime.clear();
}

/**
 * Returns true when haptics are enabled (defaults to true if not set).
 */
export function isHapticsEnabled() {
  return localStorage.getItem(HAPTICS_ENABLED_KEY) !== 'false';
}

/**
 * Initialize Haptics from localStorage.
 * @param {HTMLInputElement} [checkbox] - Optional checkbox element to sync; falls back to
 *   document.getElementById('hapticsEnabledCheckbox') when omitted.
 */
export function initHaptics(checkbox) {
  const isEnabled = isHapticsEnabled();
  const el = checkbox ?? document.getElementById('hapticsEnabledCheckbox');
  if (el) el.checked = isEnabled;
}

/**
 * Triggers a haptic vibration if enabled and not debounced.
 * @param {string} type - Key from HAPTIC_PATTERNS ('tap', 'success', 'delete', 'error')
 */
export function triggerHaptic(type) {
  const isEnabled = isHapticsEnabled();
  if (!isEnabled) return;

  // Enforce debounce per type to prevent vibration flooding
  const now = Date.now();
  const lastTime = lastPulseTime.get(type) || 0;
  if (now - lastTime < DEBOUNCE_MS) return;

  lastPulseTime.set(type, now);

  console.log(`[HAPTIC] Triggering: ${type}`);

  // Safe check for browser support (iOS/Desktop-safe)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const pattern = HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.tap;
      navigator.vibrate(pattern);
    } catch (err) {
      // Non-blocking failure (some environments might restrict vibrate)
      console.warn('Haptic feedback failed:', err);
    }
  }
}

/**
 * Triggers a haptic pulse followed by a standard browser alert.
 * Useful for critical errors or confirmations where tactile focus is needed.
 * 
 * @param {string} message - The alert message to display
 * @param {string} type - Haptic pattern type (default 'error')
 */
export function alertWithHaptic(message, type = 'error') {
  triggerHaptic(type);
  // Delay alert slightly to allow vibration to be felt (alerts are blocking)
  window.alert(message);
}
