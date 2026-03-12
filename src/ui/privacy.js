import { PRIVACY_MODE_KEY } from '../utils/storage.js';
import { triggerHaptic } from '../utils/haptics.js';

/**
 * Initialize Privacy Mode from localStorage.
 */
export function initPrivacyMode() {
  const isEnabled = localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
  document.body.classList.toggle('privacy-enabled', isEnabled);
  const btn = document.getElementById('privacyToggle');
  if (btn) {
    btn.classList.toggle('active', isEnabled);
    btn.setAttribute('aria-pressed', String(isEnabled));
  }
}

/**
 * Toggle Privacy Mode and persist.
 */
export function togglePrivacyMode() {
  const isEnabled = !document.body.classList.contains('privacy-enabled');
  document.body.classList.toggle('privacy-enabled', isEnabled);
  localStorage.setItem(PRIVACY_MODE_KEY, isEnabled.toString());
  const btn = document.getElementById('privacyToggle');
  if (btn) {
    btn.classList.toggle('active', isEnabled);
    btn.setAttribute('aria-pressed', String(isEnabled));
  }

  // Add haptic feedback for security state change
  triggerHaptic('tap');
}
