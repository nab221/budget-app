import {
  isConfigured,
  supabase,
  getSession,
  signIn,
  pushSnapshot,
  pullSnapshot,
  CLOUD_LAST_SYNC_KEY,
} from '../utils/supabase-sync.js';
import { importBackupData } from '../db/backup.js';
import { templateUI } from './templates.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';
import { db } from '../db/schema.js';

// Phase 23.1: Constants for dirty-state tracking and timestamps
const CLOUD_IS_DIRTY_KEY = 'budget_cloud_is_dirty';

export const cloudSyncUI = {
  _initialized: false,
  _isDirty: false,
  _syncInProgress: false,

  /**
   * Initialise cloud sync UI. No-ops silently if Supabase is not configured,
   * keeping the section hidden and the app fully functional.
   */
  async init() {
    if (!isConfigured()) return;
    if (this._initialized) return;
    this._initialized = true;

    // Phase 23.1: Initialize dirty-state tracking
    this._initDirtyStateTracking();

    this._bindAuthListener();
    this._bindPreviewListener();
    await this._refreshSection();
    document.getElementById('cloudSyncSection')?.classList.remove('hidden');
  },

  /**
   * Re-render the section contents based on current auth state.
   */
  async _refreshSection() {
    const section = document.getElementById('cloudSyncSection');
    if (!section) return;

    const session = await getSession();
    this._renderHeaderActions(session);
    this._updateStatusIndicator();

    const statusEl = section.querySelector('#cloudSyncStatus');
    const actionsEl = section.querySelector('#cloudSyncActions');
    if (!statusEl || !actionsEl) return;

    if (session) {
      this._renderSignedIn(session, statusEl, actionsEl);
    } else {
      this._renderSignedOut(statusEl, actionsEl);
    }
  },

  _renderHeaderActions(session) {
    const headerActionsEl = document.getElementById('cloudSyncActionsHeader');
    const exportBtn = document.getElementById('exportBtn');
    const importLabel = document.querySelector('label[for="importFile"]');

    if (!headerActionsEl || !exportBtn || !importLabel) return;

    if (!isConfigured()) {
      headerActionsEl.classList.add('hidden');
      headerActionsEl.innerHTML = '';
      exportBtn.classList.remove('hidden');
      importLabel.classList.remove('hidden');
      return;
    }

    exportBtn.classList.add('hidden');
    importLabel.classList.add('hidden');
    headerActionsEl.classList.remove('hidden');

    if (session) {
      // Phase 23.1: Show unified sync menu with status indicator and timestamp
      headerActionsEl.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span id="syncStatusDot" class="sync-status-indicator" title="Synced" style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;background:#22c55e;margin:0 4px"></span>
          <span id="lastSyncedTime" style="font-size:.75rem;color:var(--text-soft)">Last synced: never</span>
          <button id="headerSyncMenuBtn" class="ghost">☁ Sync</button>
          <button id="headerCloudSignOutBtn" class="ghost">Sign Out</button>
        </div>
      `;

      const menuBtn = headerActionsEl.querySelector('#headerSyncMenuBtn');
      const signOutBtn = headerActionsEl.querySelector('#headerCloudSignOutBtn');

      if (menuBtn) {
        menuBtn.onclick = async () => {
          await this._showSyncMenuModal();
          triggerHaptic('tap');
        };
      }

      if (signOutBtn) {
        signOutBtn.onclick = async () => {
          await supabase.auth.signOut();
          triggerHaptic('tap');
        };
      }

      return;
    }

    // Phase 23.1: Show sign-in button (will open modal on click)
    headerActionsEl.innerHTML = `
      <button id="headerCloudSignInBtn" class="primary">☁ Cloud Sign In</button>
    `;

    const signInBtn = headerActionsEl.querySelector('#headerCloudSignInBtn');
    if (signInBtn) {
      signInBtn.onclick = async () => {
        await this._showSignInModal();
        triggerHaptic('tap');
      };
    }
  },

  /**
   * Phase 23.1: Initialize dirty-state tracking.
   * Loads initial dirty state from localStorage and sets up Dexie mutation listener.
   */
  _initDirtyStateTracking() {
    // Load initial state from localStorage
    this._isDirty = localStorage.getItem(CLOUD_IS_DIRTY_KEY) === 'true';

    // Listen for Dexie mutations (all table writes)
    if (db.on) {
      db.on('mutated', (event) => {
        if (!this._isDirty && !this._syncInProgress) {
          this._isDirty = true;
          localStorage.setItem(CLOUD_IS_DIRTY_KEY, 'true');
          this._updateStatusIndicator();
          console.log('[cloudSyncUI] Marked as dirty via Dexie mutation');
        }
      });
    }
  },

  /**
   * Phase 23.1: Update status indicator dot color and animation.
   * Synced (🟢) -> Dirty (🟡 with pulse) -> Error (🔴)
   */
  _updateStatusIndicator() {
    const dot = document.getElementById('syncStatusDot');
    if (!dot) return;

    let state = 'synced';
    let title = 'All changes saved to cloud';

    if (this._isDirty) {
      state = 'dirty';
      title = 'Unsaved changes (click Sync to sync)';
    }

    // Update dot styling
    if (state === 'dirty') {
      dot.style.background = '#eab308';
      dot.style.animation = 'pulse 1.5s infinite';
    } else if (state === 'synced') {
      dot.style.background = '#22c55e';
      dot.style.animation = 'none';
    } else {
      dot.style.background = '#ef4444';
      dot.style.animation = 'none';
    }

    dot.title = title;
    this._updateTimestampDisplay();
  },

  /**
   * Phase 23.1: Format last synced timestamp as relative time (e.g., "5 min ago").
   */
  _formatLastSynced(timestamp) {
    if (!timestamp) return 'Never';

    const date = new Date(parseInt(timestamp));
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  },

  /**
   * Phase 23.1: Update the last synced timestamp display.
   */
  _updateTimestampDisplay() {
    const timeEl = document.getElementById('lastSyncedTime');
    if (!timeEl) return;

    const timestamp = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
    const formatted = this._formatLastSynced(timestamp);
    timeEl.textContent = `Last synced: ${formatted}`;
  },

  /**
   * Phase 23.1: Show sign-in modal with email input.
   */
  async _showSignInModal() {
    return new Promise((resolve) => {
      const body = `
        <div style="display:flex;flex-direction:column;gap:12px">
          <input 
            type="email" 
            id="signInEmailInput" 
            placeholder="your@email.com" 
            style="padding:8px;font-size:.9rem;min-width:250px"
            autocomplete="email"
          />
          <p style="font-size:.85rem;color:var(--text-soft);margin:0">
            A sign-in link will be sent to this email. No password required.
          </p>
        </div>
      `;

      const footer = [
        {
          label: 'Send Link',
          className: 'primary',
          onClick: async () => {
            const email = document.getElementById('signInEmailInput')?.value?.trim();
            if (!email) {
              alertWithHaptic('Please enter your email address.');
              return;
            }
            try {
              await signIn(email);
              alertWithHaptic('Check your email for a sign-in link.', 'success');
              templateUI.closeModal();
              resolve();
            } catch (err) {
              console.error('[cloudSyncUI] Sign-in failed:', err);
              alertWithHaptic('Sign-in failed: ' + err.message);
            }
          }
        },
        {
          label: 'Cancel',
          className: 'ghost',
          onClick: () => {
            templateUI.closeModal();
            resolve();
          }
        }
      ];

      templateUI.showModal('Sign In to Cloud', body, footer);

      // Auto-focus email input
      setTimeout(() => {
        document.getElementById('signInEmailInput')?.focus();
      }, 100);
    });
  },

  /**
   * Phase 23.1: Show unified sync menu modal with Push/Pull/Sign-Out options.
   */
  async _showSyncMenuModal() {
    return new Promise((resolve) => {
      const body = `
        <p style="margin-bottom:12px;font-size:.9rem">Choose an action:</p>
      `;

      const footer = [
        {
          label: 'Push to Cloud',
          className: 'primary',
          onClick: async () => {
            try {
              this._syncInProgress = true;
              templateUI.closeModal();
              alertWithHaptic('Pushing to cloud...');
              await pushSnapshot();
              this._isDirty = false;
              localStorage.setItem(CLOUD_IS_DIRTY_KEY, 'false');
              this._updateStatusIndicator();
              alertWithHaptic('Synced successfully!', 'success');
              await this._refreshSection();
            } catch (err) {
              console.error('[cloudSyncUI] Push failed:', err);
              alertWithHaptic('Push failed: ' + err.message);
            } finally {
              this._syncInProgress = false;
              resolve();
            }
          }
        },
        {
          label: 'Pull from Cloud',
          className: 'ghost',
          onClick: async () => {
            try {
              this._syncInProgress = true;
              templateUI.closeModal();
              alertWithHaptic('Fetching from cloud...');
              await pullSnapshot();
              // pullSnapshot dispatches an event that shows a preview modal
              // UI takes over from there
            } catch (err) {
              console.error('[cloudSyncUI] Pull failed:', err);
              alertWithHaptic('Pull failed: ' + err.message);
            } finally {
              this._syncInProgress = false;
              resolve();
            }
          }
        },
        {
          label: 'Sign Out',
          className: 'danger',
          onClick: async () => {
            templateUI.closeModal();
            await supabase.auth.signOut();
            alertWithHaptic('Signed out');
            resolve();
          }
        },
        {
          label: 'Cancel',
          className: 'ghost',
          onClick: () => {
            templateUI.closeModal();
            resolve();
          }
        }
      ];

      templateUI.showModal('Cloud Sync', body, footer);
    });
  },

  _renderSignedIn(session, statusEl, actionsEl) {
    const lastSyncMs = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
    const lastSyncText = lastSyncMs
      ? `Last synced: ${new Date(parseInt(lastSyncMs)).toLocaleString()}`
      : 'Never synced';

    statusEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="color:var(--success);font-size:.85rem">Signed in as ${session.user.email}</span>
        <button id="cloudSignOutBtn" class="ghost" style="font-size:.75rem;padding:2px 8px">Sign Out</button>
      </div>
    `;

    actionsEl.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="cloudPushBtn" class="ghost">Push to Cloud</button>
        <button id="cloudPullBtn" class="ghost">Pull from Cloud</button>
      </div>
      <div class="hint" style="margin-top:6px;font-size:.75rem">${lastSyncText}</div>
    `;

    const signOutBtn = document.getElementById('cloudSignOutBtn');
    if (signOutBtn) signOutBtn.onclick = async () => {
      await supabase.auth.signOut();
      triggerHaptic('tap');
    };

    const pushBtn = document.getElementById('cloudPushBtn');
    if (pushBtn) pushBtn.onclick = async () => {
      try {
        pushBtn.textContent = 'Pushing...';
        pushBtn.disabled = true;
        await pushSnapshot();
        triggerHaptic('success');
        await this._refreshSection();
      } catch (err) {
        console.error('[cloudSyncUI] Push failed:', err);
        alertWithHaptic('Push failed: ' + err.message);
        pushBtn.textContent = 'Push to Cloud';
        pushBtn.disabled = false;
      }
    };

    const pullBtn = document.getElementById('cloudPullBtn');
    if (pullBtn) pullBtn.onclick = async () => {
      try {
        pullBtn.textContent = 'Fetching...';
        pullBtn.disabled = true;
        await pullSnapshot();
        // Event dispatched by pullSnapshot(); UI takes over from the preview listener.
        // Button stays disabled until the modal is dismissed (cancel) or page reloads (confirm).
      } catch (err) {
        console.error('[cloudSyncUI] Pull failed:', err);
        alertWithHaptic('Pull failed: ' + err.message);
        pullBtn.textContent = 'Pull from Cloud';
        pullBtn.disabled = false;
      }
    };
  },

  _renderSignedOut(statusEl, actionsEl) {
    statusEl.innerHTML = '';
    actionsEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <p style="font-size:.85rem;margin:0">Sign in to the cloud to sync your budget across devices.</p>
        <button id="settingsCloudSignInBtn" class="primary">Send Magic Link Via Email</button>
      </div>
    `;

    const signInBtn = document.getElementById('settingsCloudSignInBtn');
    if (signInBtn) {
      signInBtn.onclick = async () => {
        await this._showSignInModal();
        triggerHaptic('tap');
      };
    }
  },

  /**
   * Reacts to Supabase auth state changes (sign-in via magic link callback,
   * sign-out) by re-rendering the section.
   * Owned here — not in supabase-sync.js — because auth state is a UI concern.
   */
  _bindAuthListener() {
    supabase.auth.onAuthStateChange(() => this._refreshSection());
  },

  /**
   * Listens for the preview event dispatched by pullSnapshot().
   * Shows a modal with snapshot metadata and record counts.
   * Only calls importBackupData() after explicit user confirmation.
   */
  _bindPreviewListener() {
    window.addEventListener('budget:import-cloud-preview', async (e) => {
      const { updated_at, schema_version, counts, tableData } = e.detail;

      const localVersion = db.verno;
      const versionWarning =
        schema_version > localVersion
          ? `<p style="color:var(--danger);margin:8px 0 0">
               Warning: snapshot uses schema v${schema_version}, local is v${localVersion}.
               Importing may fail or produce unexpected results.
             </p>`
          : '';

      const date = new Date(updated_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const escapeHtml = (s) =>
        String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const countLines = Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([t, n]) => `${n} ${escapeHtml(t)}`)
        .join(' · ');

      const body = `
        <p>Cloud snapshot from <strong>${date}</strong></p>
        <p style="margin-top:6px;color:var(--text-soft);font-size:.85rem">${countLines || 'No data'}</p>
        ${versionWarning}
        <p style="margin-top:12px"><strong>Replace local data?</strong> This cannot be undone.</p>
      `;

      const footer = `
        <button class="ghost" id="cancelCloudImportBtn">Cancel</button>
        <button class="danger" id="confirmCloudImportBtn">Replace Local Data</button>
      `;

      templateUI.showModal('Cloud Snapshot Preview', body, footer);

      const restorePullBtn = () => {
        const settingsPullBtn = document.getElementById('cloudPullBtn');
        if (settingsPullBtn) {
          settingsPullBtn.textContent = 'Pull from Cloud';
          settingsPullBtn.disabled = false;
        }

        const headerPullBtn = document.getElementById('headerCloudPullBtn');
        if (headerPullBtn) {
          headerPullBtn.textContent = '☁ Pull';
          headerPullBtn.disabled = false;
        }
      };

      document.getElementById('cancelCloudImportBtn').onclick = () => {
        templateUI.closeModal();
        restorePullBtn();
      };

      document.getElementById('confirmCloudImportBtn').onclick = async () => {
        templateUI.closeModal();
        try {
          await importBackupData(tableData);
          localStorage.setItem(CLOUD_LAST_SYNC_KEY, String(Date.now()));
          triggerHaptic('success');
          alertWithHaptic('Import successful! The app will now reload.', 'success');
          window.location.reload();
        } catch (err) {
          console.error('[cloudSyncUI] Import failed:', err);
          alertWithHaptic('Import failed: ' + err.message);
          restorePullBtn();
        }
      };
    });
  },
};
