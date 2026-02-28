/**
 * PWA UX — manual installation and update notification logic.
 *
 * - Intercepts 'beforeinstallprompt' to enable a user-triggered install button.
 * - Uses virtual:pwa-register to listen for service worker updates and shows
 *   a subtle bottom bar when a new version is available.
 */

import { registerSW } from 'virtual:pwa-register';

/** Stored deferred install prompt event (BeforeInstallPromptEvent). */
let deferredInstallPrompt = null;

/** Reference to the DOM button used to trigger installation. */
let installBtn = null;

/**
 * Initialise PWA lifecycle listeners.
 * Call once during app startup.
 */
export function initPWA() {
  _registerUpdateListener();
  _registerInstallListener();
}

/**
 * Trigger the deferred browser installation prompt.
 * Should be connected to the "Install App" button's click event.
 */
export async function installApp() {
  if (!deferredInstallPrompt) {
    console.warn('[PWA] No install prompt available. Already installed or not supported.');
    return;
  }

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log(`[PWA] Install prompt outcome: ${outcome}`);

  // Prompt can only be used once — discard it.
  deferredInstallPrompt = null;
  _hideInstallButton();
}

// ─── Private helpers ───────────────────────────────────────────────────────

function _registerUpdateListener() {
  registerSW({
    onNeedRefresh() {
      _showUpdateBar();
    },
    onOfflineReady() {
      console.log('[PWA] App ready for offline use.');
    },
    onRegisteredSW(swUrl, registration) {
      console.log(`[PWA] Service worker registered: ${swUrl}`);
      // Check for updates every hour when the page is visible.
      if (registration) {
        setInterval(() => {
          if (!document.hidden) {
            registration.update().catch(() => {});
          }
        }, 60 * 60 * 1000);
      }
    },
  });
}

function _registerInstallListener() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] Install prompt intercepted and deferred.');
    _showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully.');
    deferredInstallPrompt = null;
    _hideInstallButton();
  });
}

function _showUpdateBar() {
  const bar = document.getElementById('update-bar');
  if (bar) {
    bar.classList.remove('hidden');
  }
}

function _showInstallButton() {
  installBtn = installBtn || document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.classList.remove('hidden');
  }
}

function _hideInstallButton() {
  installBtn = installBtn || document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.classList.add('hidden');
  }
}
