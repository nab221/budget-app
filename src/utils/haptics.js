/**
 * Centralized utility for haptic feedback patterns and vibration triggers.
 * Provides tactile reinforcement for user actions and system states.
 */

export const HAPTIC_PATTERNS = {
  tap: [10],
  success: [30, 20, 30],
  delete: [40, 15, 25, 15, 15],
  error: [60, 40, 60],
  threshold: [10]
};

const lastPulseTime = new Map();
const DEBOUNCE_MS = 300;
const HAPTICS_STORAGE_KEY = 'budget_haptics_enabled';

/**
 * Resets internal debounce timers. Used for testing.
 */
export function resetHapticTimers() {
  lastPulseTime.clear();
}

/**
 * Initialize Haptics from localStorage.
 */
export function initHaptics() {
  const isEnabled = localStorage.getItem(HAPTICS_STORAGE_KEY) !== 'false';
  const checkbox = document.getElementById('hapticsEnabledCheckbox');
  if (checkbox) checkbox.checked = isEnabled;
}

/**
 * Triggers a haptic vibration if enabled and not debounced.
 * @param {string} type - Key from HAPTIC_PATTERNS ('tap', 'success', 'delete', 'error')
 */
export function triggerHaptic(type) {
  // Check if enabled (defaults to true if not set)
  const isEnabled = localStorage.getItem(HAPTICS_STORAGE_KEY) !== 'false';
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
