/**
 * PWA UX — manual installation, update notification, storage safety, and
 * export reminder logic.
 *
 * - Intercepts 'beforeinstallprompt' to enable a user-triggered install button.
 * - Uses virtual:pwa-register to listen for service worker updates and shows
 *   a subtle bottom bar when a new version is available.
 * - Checks storage persistence and signals the dashboard to show a Risk badge.
 * - Checks whether the last data export was more than 7 days ago and shows
 *   an export reminder in the header.
 */

import { registerSW } from 'virtual:pwa-register';
import { isConfigured } from '../utils/supabase-sync.js';

/** LocalStorage key that backup.js writes after a successful export. */
export const LAST_EXPORT_KEY = 'last_export_timestamp';

/** Days after which the export reminder is triggered. */
const EXPORT_REMINDER_DAYS = 7;

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
  console.log('[PWA] installApp() called');
  console.log('[PWA] deferredInstallPrompt:', deferredInstallPrompt);
  
  if (!deferredInstallPrompt) {
    console.warn('[PWA] No install prompt available. Already installed or not supported.');
    return;
  }

  try {
    console.log('[PWA] Calling deferredInstallPrompt.prompt()...');
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);

    // Prompt can only be used once — discard it.
    deferredInstallPrompt = null;
    _hideInstallButton();
  } catch (error) {
    console.error('[PWA] Error during install prompt:', error);
  }
}

/**
 * Check whether the browser has granted durable (persistent) storage.
 *
 * Returns true if persisted, false if denied or the API is unavailable.
 * Callers (e.g. dashboard.js) use the result to decide whether to show the
 * red "Risk" badge on the Net Worth card.
 *
 * @returns {Promise<boolean>}
 */
export async function checkStoragePersistence() {
  if (!navigator.storage || !navigator.storage.persisted) {
    // API not available — assume not persisted (conservative / safe)
    return false;
  }
  return navigator.storage.persisted();
}

/**
 * Check whether the last data export was more than 7 days ago and, if so,
 * show a reminder banner in the header.
 *
 * The reminder element (#export-reminder) is shown/hidden via this function.
 * backup.js is responsible for writing LAST_EXPORT_KEY to localStorage each
 * time a successful export completes.
 */
export function checkExportReminder() {
  const raw = localStorage.getItem(LAST_EXPORT_KEY);

  // If there has never been an export, show the reminder after 24 hours.
  // (New users get a grace period before being nagged.)
  if (!raw) {
    // Don't nag on first load — only once the app has been used for a day.
    _hideExportReminder();
    return;
  }

  const lastExportMs = parseInt(raw, 10);
  if (isNaN(lastExportMs)) {
    _hideExportReminder();
    return;
  }

  const daysSince = (Date.now() - lastExportMs) / (1000 * 60 * 60 * 24);
  if (daysSince > EXPORT_REMINDER_DAYS) {
    _showExportReminder(Math.floor(daysSince));
  } else {
    _hideExportReminder();
  }
}

// ─── Private helpers ───────────────────────────────────────────────────────

function _registerUpdateListener() {
  const updateSW = registerSW({
    onOfflineReady() {
      console.log('[PWA] App ready for offline use.');
      _showOfflineReadyStatus();
    },
    onRegisteredSW(swUrl, registration) {
      console.log(`[PWA] Service worker registered: ${swUrl}`);
      // Check for updates every hour when the page is visible.
      if (registration) {
        setInterval(() => {
          if (!document.hidden) registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onNeedRefresh() {
      _showUpdateBar(() => updateSW(true));
    },
  });
}

function _showUpdateBar(onUpdate) {
  let bar = document.getElementById('pwa-update-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'pwa-update-bar';
    bar.className = 'update-bar';
    bar.innerHTML =
      '<span>A new version is available.</span>' +
      '<button id="pwa-update-btn">Update now</button>' +
      '<button id="pwa-update-dismiss">Later</button>';
    document.body.appendChild(bar);
  }
  bar.style.removeProperty('display');
  document.getElementById('pwa-update-btn')
    ?.addEventListener('click', () => { onUpdate(); _hideUpdateBar(); });
  document.getElementById('pwa-update-dismiss')
    ?.addEventListener('click', _hideUpdateBar);
}

function _hideUpdateBar() {
  const bar = document.getElementById('pwa-update-bar');
  if (bar) bar.style.display = 'none';
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

function _showExportReminder(daysSince) {
  const el = document.getElementById('export-reminder');
  if (el) {
    let msg = `Your last data export was ${daysSince} days ago. Export now to keep your data safe.`;
    if (isConfigured()) {
      msg += ' Your transactions are backed up, but app settings (theme, privacy mode) are stored locally only and not included in cloud sync.';
    }
    el.textContent = msg;
    el.classList.remove('hidden');
  }
}

function _hideExportReminder() {
  const el = document.getElementById('export-reminder');
  if (el) {
    el.classList.add('hidden');
  }
}

function _showOfflineReadyStatus() {
  const el = document.getElementById('offline-ready-status');
  if (el) {
    el.classList.remove('hidden');
  }
}
