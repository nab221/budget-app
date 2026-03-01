/**
 * Cloud Backup UI module
 *
 * Renders two provider cards (Google Drive, OneDrive) in the Settings panel
 * and orchestrates the connect/backup/restore/disconnect flows using the
 * utility modules from plan 01.
 *
 * All cloud backup user-facing logic lives here — provider cards, state
 * transitions, confirmation modals, loading states, and error messages.
 *
 * Export: cloudBackupUI object (also assigned to window.cloudBackupUI in init())
 */

import { db } from '../db/schema.js';
import { templateUI } from './templates.js';
import {
  initGoogleDrive, withGoogleToken, disconnectGoogle,
  googleDriveUpload, googleDriveDownload, isGoogleConnected
} from '../utils/google-drive.js';
import {
  connectOneDrive, disconnectOneDrive,
  oneDriveUpload, oneDriveDownload,
  isOneDriveConnected
} from '../utils/onedrive.js';

// --- Constants ---

const CLOUD_ACCOUNT_KEY = 'cloud_account_email';
const CLOUD_LAST_BACKUP_KEY = 'cloud_last_backup';

// --- Private helpers ---

/**
 * Formats an ISO timestamp string for display.
 * @param {string|null} isoStr
 * @returns {string}
 */
function formatTimestamp(isoStr) {
  if (!isoStr) return 'Never';
  const d = new Date(isoStr);
  return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Collects all data from IndexedDB and returns it as a JSON backup string.
 * @returns {Promise<string>}
 */
async function collectData() {
  const data = {};
  const tableNames = db.tables.map(t => t.name);
  for (const name of tableNames) {
    data[name] = await db.table(name).toArray();
  }
  return JSON.stringify({ version: 1, encrypted: false, data }, null, 2);
}

/**
 * Imports backup data into IndexedDB and reloads the page.
 * @param {{ data: object }} parsed - Parsed backup object with a .data property.
 */
async function importData(parsed) {
  if (!parsed || typeof parsed.data !== 'object') {
    throw new Error('Invalid backup data');
  }
  const data = parsed.data;

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      if (data[table.name]) {
        await table.clear();
        await table.bulkAdd(data[table.name]);
      }
    }
  });

  window.location.reload();
}

/**
 * Shows an inline status message on a provider card.
 * Clears the message after 5 seconds if it is not an error.
 *
 * @param {string} providerId - 'google' or 'onedrive'
 * @param {string} message
 * @param {boolean} [isError=false]
 */
function setCardStatus(providerId, message, isError = false) {
  const el = document.getElementById(`cloud-status-${providerId}`);
  if (!el) return;

  el.textContent = message;
  el.style.color = isError ? 'var(--danger)' : 'var(--success)';

  if (!isError) {
    setTimeout(() => {
      if (el.textContent === message) {
        el.textContent = '';
      }
    }, 5000);
  }
}

/**
 * Enables or disables card actions by toggling opacity and pointer-events.
 *
 * @param {string} providerId - 'google' or 'onedrive'
 * @param {boolean} loading
 */
function setCardLoading(providerId, loading) {
  const card = document.getElementById(`cloud-card-${providerId}`);
  if (!card) return;

  const actions = card.querySelector('.cloud-card-actions');
  if (!actions) return;

  if (loading) {
    actions.style.opacity = '0.5';
    actions.style.pointerEvents = 'none';
  } else {
    actions.style.opacity = '';
    actions.style.pointerEvents = '';
  }
}

// --- cloudBackupUI ---

export const cloudBackupUI = {

  /**
   * Initialises the GIS token client and renders the provider cards.
   * Must be called after the GIS script has been loaded by index.html.
   */
  async init() {
    try {
      initGoogleDrive();
    } catch (err) {
      // GIS_NOT_LOADED — script may not be present yet; non-fatal here.
      console.warn('Google Drive init deferred:', err.message);
    }
    window.cloudBackupUI = this;
    this.render();
  },

  /**
   * Re-renders the provider cards inside #cloudBackupContainer.
   */
  render() {
    const container = document.getElementById('cloudBackupContainer');
    if (!container) return;

    const providers = [
      { id: 'google', label: 'Google Drive', icon: '&#128194;' },
      { id: 'onedrive', label: 'OneDrive', icon: '&#9729;' }
    ];

    container.innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        ${providers.map(p => this.renderCard(p)).join('')}
      </div>
    `;
  },

  /**
   * Renders HTML for a single provider card.
   *
   * @param {{ id: string, label: string, icon: string }} provider
   * @returns {string}
   */
  renderCard(provider) {
    const connected = provider.id === 'google' ? isGoogleConnected() : isOneDriveConnected();
    const email = localStorage.getItem(CLOUD_ACCOUNT_KEY) || '';
    const lastBackup = localStorage.getItem(CLOUD_LAST_BACKUP_KEY);
    const offline = !navigator.onLine;

    if (connected) {
      return `
        <div id="cloud-card-${provider.id}" class="cloud-card" style="border:1px solid var(--border);border-radius:6px;padding:12px;min-width:200px;flex:1">
          <div style="font-weight:600;margin-bottom:4px">${provider.icon} ${provider.label}</div>
          <div style="font-size:.85rem;margin-bottom:2px">${email}</div>
          <div style="font-size:.8rem;color:var(--muted);margin-bottom:8px">Last backup: ${formatTimestamp(lastBackup)}</div>
          <span id="cloud-status-${provider.id}" style="font-size:.8rem;display:block;min-height:1.2em;margin-bottom:6px"></span>
          <div class="cloud-card-actions" style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="primary sm" onclick="window.cloudBackupUI.backup('${provider.id}')"${offline ? ' disabled' : ''}>Backup Now</button>
            <button class="ghost sm" onclick="window.cloudBackupUI.restore('${provider.id}')"${offline ? ' disabled' : ''}>Restore</button>
            <button class="danger sm" onclick="window.cloudBackupUI.disconnect('${provider.id}')">Disconnect</button>
          </div>
        </div>
      `;
    }

    return `
      <div id="cloud-card-${provider.id}" class="cloud-card" style="border:1px solid var(--border);border-radius:6px;padding:12px;min-width:200px;flex:1">
        <div style="font-weight:600;margin-bottom:4px">${provider.icon} ${provider.label}</div>
        <div style="font-size:.85rem;color:var(--muted);margin-bottom:8px">Connect to back up and restore your data</div>
        <div class="cloud-card-actions">
          <button class="primary sm" onclick="window.cloudBackupUI.connect('${provider.id}')">Connect</button>
        </div>
      </div>
    `;
  },

  /**
   * Connects a cloud provider.
   *
   * If another provider is already connected, shows a confirmation modal before
   * switching. Google's connect uses withGoogleToken() directly from this click
   * handler to satisfy popup blocker constraints.
   *
   * @param {string} providerId - 'google' or 'onedrive'
   */
  async connect(providerId) {
    const otherConnected = providerId === 'google' ? isOneDriveConnected() : isGoogleConnected();
    const otherLabel = providerId === 'google' ? 'OneDrive' : 'Google Drive';
    const thisLabel = providerId === 'google' ? 'Google Drive' : 'OneDrive';

    if (otherConnected) {
      const confirmed = await new Promise(resolve => {
        const footer = `
          <button class="ghost" onclick="window.templateUI.closeModal();window._cloudConfirm(false)">Cancel</button>
          <button class="primary" onclick="window.templateUI.closeModal();window._cloudConfirm(true)">Switch Provider</button>
        `;
        window._cloudConfirm = resolve;
        templateUI.showModal(
          'Switch Provider',
          `<p>Disconnect ${otherLabel} and connect ${thisLabel}?</p>`,
          footer
        );
      });
      delete window._cloudConfirm;
      if (!confirmed) return;

      // Disconnect the other provider before connecting the new one.
      if (providerId === 'google') {
        await disconnectOneDrive();
      } else {
        disconnectGoogle();
      }
    }

    if (providerId === 'google') {
      // MUST call withGoogleToken directly from a click handler — popup blocker constraint.
      withGoogleToken(async (_token) => {
        // localStorage already updated by the GIS callback in google-drive.js.
        this.render();
      });
    } else {
      try {
        await connectOneDrive();
        this.render();
      } catch (err) {
        console.error('OneDrive connect failed:', err);
        alert('Could not connect to OneDrive. Please try again.');
      }
    }
  },

  /**
   * Backs up local data to the connected provider.
   * Checks navigator.onLine before proceeding.
   *
   * @param {string} providerId - 'google' or 'onedrive'
   */
  async backup(providerId) {
    if (!navigator.onLine) {
      setCardStatus(providerId, 'No internet connection', true);
      return;
    }

    setCardLoading(providerId, true);

    try {
      const jsonString = await collectData();

      if (providerId === 'google') {
        withGoogleToken(async (token) => {
          try {
            await googleDriveUpload(jsonString, token);
            setCardLoading(providerId, false);
            setCardStatus(providerId, 'Backed up just now');
            this.render(); // update timestamp display
          } catch (err) {
            setCardLoading(providerId, false);
            const msg = err.message.includes('401')
              ? 'Session expired — reconnect Google Drive'
              : 'Backup failed. Try again.';
            setCardStatus(providerId, msg, true);
          }
        });
      } else {
        await oneDriveUpload(jsonString);
        setCardLoading(providerId, false);
        setCardStatus(providerId, 'Backed up just now');
        this.render();
      }
    } catch (err) {
      setCardLoading(providerId, false);
      setCardStatus(providerId, 'Backup failed. Try again.', true);
      console.error('Backup error:', err);
    }
  },

  /**
   * Restores data from the connected provider after user confirmation.
   * Checks navigator.onLine before proceeding.
   *
   * @param {string} providerId - 'google' or 'onedrive'
   */
  async restore(providerId) {
    if (!navigator.onLine) {
      setCardStatus(providerId, 'No internet connection', true);
      return;
    }

    const label = providerId === 'google' ? 'Google Drive' : 'OneDrive';

    const confirmed = await new Promise(resolve => {
      const footer = `
        <button class="ghost" onclick="window.templateUI.closeModal();window._cloudConfirm(false)">Cancel</button>
        <button class="danger" onclick="window.templateUI.closeModal();window._cloudConfirm(true)">Restore</button>
      `;
      window._cloudConfirm = resolve;
      templateUI.showModal(
        'Restore from ' + label,
        `<p>Restore from ${label}? Your current local data will be replaced.</p>`,
        footer
      );
    });
    delete window._cloudConfirm;
    if (!confirmed) return;

    setCardLoading(providerId, true);

    try {
      if (providerId === 'google') {
        withGoogleToken(async (token) => {
          try {
            const jsonString = await googleDriveDownload(token);
            const parsed = JSON.parse(jsonString);
            await importData(parsed); // reloads page on success
          } catch (err) {
            setCardLoading(providerId, false);
            const msg =
              err.message === 'NO_BACKUP_FOUND'
                ? 'No backup found in Google Drive'
                : err.message.includes('401')
                  ? 'Session expired — reconnect Google Drive'
                  : 'Restore failed. Try again.';
            setCardStatus(providerId, msg, true);
          }
        });
      } else {
        const jsonString = await oneDriveDownload();
        const parsed = JSON.parse(jsonString);
        await importData(parsed); // reloads page on success
      }
    } catch (err) {
      setCardLoading(providerId, false);
      const msg =
        err.message === 'NO_BACKUP_FOUND'
          ? 'No backup found in OneDrive'
          : 'Restore failed. Try again.';
      setCardStatus(providerId, msg, true);
      console.error('Restore error:', err);
    }
  },

  /**
   * Disconnects the specified provider after user confirmation.
   *
   * @param {string} providerId - 'google' or 'onedrive'
   */
  async disconnect(providerId) {
    const label = providerId === 'google' ? 'Google Drive' : 'OneDrive';

    const confirmed = await new Promise(resolve => {
      const footer = `
        <button class="ghost" onclick="window.templateUI.closeModal();window._cloudConfirm(false)">Cancel</button>
        <button class="danger" onclick="window.templateUI.closeModal();window._cloudConfirm(true)">Disconnect</button>
      `;
      window._cloudConfirm = resolve;
      templateUI.showModal(
        'Disconnect ' + label,
        `<p>Disconnect ${label}? Your local data won't be affected.</p>`,
        footer
      );
    });
    delete window._cloudConfirm;
    if (!confirmed) return;

    if (providerId === 'google') {
      disconnectGoogle();
    } else {
      await disconnectOneDrive();
    }

    this.render();
  }
};

// Global reference is set in init(), but also expose it here for any code that
// imports before init() has been called (non-standard usage).
window.cloudBackupUI = cloudBackupUI;
