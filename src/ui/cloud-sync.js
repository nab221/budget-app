import {
  isConfigured,
  getSupabaseClient,
  getRuntimeConfig,
  saveRuntimeConfig,
  getSession,
  signIn,
  pushSnapshot,
  pullSnapshot,
  getLatestSnapshotMeta,
  CLOUD_LAST_SYNC_KEY,
} from '../utils/supabase-sync.js';
import { getFileSyncState, openSelectFileDialog, disconnectFileSyncFile } from './file-sync.js';
import { importBackupData } from '../db/backup.js';
import { templateUI } from './templates.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';
import { db } from '../db/schema.js';

// Phase 23.1: Constants for dirty-state tracking and timestamps
const CLOUD_IS_DIRTY_KEY = 'budget_cloud_is_dirty';

export const cloudSyncUI = {
  _initialized: false,
  _authListenerBound: false,
  _authSubscription: null,
  _authBoundClient: null,
  _isDirty: false,
  _syncInProgress: false,
  _mutationsDuringSync: false,
  _didAutoPullCheckOnLoad: false,
  _lastAutoPullSessionUserId: null,
  _autoPullTriggered: false,
  _visibilityChangeHandler: null,

  /**
   * Initialise cloud sync UI.
   * When Supabase env vars are missing (e.g. hosted static builds), render a
   * runtime "Configure Cloud" action so users can paste URL + anon key.
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    // Phase 23.1: Initialize dirty-state tracking
    this._initDirtyStateTracking();

    // Listen for local file-sync status changes to update the local indicator dot
    window.addEventListener('localSync:statusChanged', () => this._updateLocalFileIndicator());

    this._bindAuthListener();
    this._bindPreviewListener();
    this._bindVisibilityAutoPush();
    await this._refreshSection();
    await this._runAutoPullCheckOnLoad();

    if (isConfigured()) {
      document.getElementById('cloudSyncSection')?.classList.remove('hidden');
    }
  },

  async _runAutoPullCheckOnLoad() {
    if (this._autoPullTriggered) return;
    if (this._didAutoPullCheckOnLoad) return;
    this._didAutoPullCheckOnLoad = true;

    try {
      const session = await getSession();
      if (!session) return;

      const latestMeta = await getLatestSnapshotMeta();
      if (!latestMeta?.updated_at) return;

      const cloudUpdatedAtMs = Date.parse(latestMeta.updated_at);
      if (!Number.isFinite(cloudUpdatedAtMs)) return;

      const localLastSyncRaw = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
      const localLastSyncMs = Number.parseInt(localLastSyncRaw ?? '0', 10);
      const hasValidLocalSync = Number.isFinite(localLastSyncMs) && localLastSyncMs > 0;

      if (!hasValidLocalSync || cloudUpdatedAtMs > localLastSyncMs) {
        if (this._autoPullTriggered) return;
        this._autoPullTriggered = true;
        this._syncInProgress = true;
        await pullSnapshot();
      }
    } catch (err) {
      if (err?.message !== 'No cloud snapshot found') {
        console.warn('[cloudSyncUI] Auto-pull check on load skipped:', err?.message || err);
      }
    } finally {
      this._syncInProgress = false;
    }
  },

  _bindVisibilityAutoPush() {
    if (this._visibilityChangeHandler) return;

    this._visibilityChangeHandler = () => {
      if (document.visibilityState === 'hidden') {
        void this._autoPushOnExit();
      }
    };

    document.addEventListener('visibilitychange', this._visibilityChangeHandler);
  },

  async _autoPushOnExit() {
    if (this._syncInProgress || !this._isDirty) return;

    try {
      const session = await getSession();
      if (!session) return;

      this._syncInProgress = true;
      this._mutationsDuringSync = false;

      await pushSnapshot();

      this._isDirty = this._mutationsDuringSync;
      this._mutationsDuringSync = false;
      localStorage.setItem(CLOUD_IS_DIRTY_KEY, this._isDirty ? 'true' : 'false');
      this._updateStatusIndicator();
    } catch (err) {
      console.warn('[cloudSyncUI] Auto-push on exit failed:', err?.message || err);
    } finally {
      this._syncInProgress = false;
    }
  },

  async _runAutoPullAfterSignIn(session) {
    if (this._autoPullTriggered) return;
    const userId = session?.user?.id;
    if (!userId) return;
    if (this._lastAutoPullSessionUserId === userId) return;

    this._lastAutoPullSessionUserId = userId;

    try {
      this._autoPullTriggered = true;
      this._syncInProgress = true;
      await pullSnapshot();
    } catch (err) {
      if (err?.message !== 'No cloud snapshot found') {
        console.warn('[cloudSyncUI] Auto-pull after sign-in failed:', err?.message || err);
      }
    } finally {
      this._syncInProgress = false;
    }
  },

  /**
   * Re-render the section contents based on current auth state.
   */
  async _refreshSection(sessionOverride) {
    const section = document.getElementById('cloudSyncSection');
    let session = sessionOverride;

    if (sessionOverride === undefined) {
      this._renderHeaderActions(null);
      this._updateStatusIndicator();
      this._updateLocalFileIndicator();

      try {
        session = await getSession();
      } catch {
        session = null;
      }
    }

    this._renderHeaderActions(session || null);
    this._updateStatusIndicator();
    this._updateLocalFileIndicator();

    if (!section) return;

    const statusEl = section.querySelector('#cloudSyncStatus');
    const actionsEl = section.querySelector('#cloudSyncActions');
    if (!statusEl || !actionsEl) return;

    if (!isConfigured()) {
      this._renderNotConfigured(statusEl, actionsEl);
      return;
    }

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

    if (!headerActionsEl) return;

    if (!isConfigured()) {
      headerActionsEl.classList.remove('hidden');
      headerActionsEl.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button id="headerCloudConfigureBtn" class="primary">☁ Configure Cloud</button>
          <span id="localFileSyncDot" style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;background:#6b7280;margin:0 2px" title="Local file sync"></span>
          <span id="localFileSyncText" style="font-size:.75rem;color:var(--text-soft)">No file</span>
          <button id="headerLocalMenuBtn" class="ghost">📁 Local</button>
        </div>
      `;

      headerActionsEl.querySelector('#headerCloudConfigureBtn')?.addEventListener('click', async () => {
        await this._showCloudConfigModal();
        triggerHaptic('tap');
      });

      headerActionsEl.querySelector('#headerLocalMenuBtn')?.addEventListener('click', async () => {
        await this._showLocalModal();
        triggerHaptic('tap');
      });

      exportBtn?.classList.add('hidden');
      importLabel?.classList.add('hidden');
      this._updateLocalFileIndicator();
      return;
    }

    exportBtn?.classList.add('hidden');
    importLabel?.classList.add('hidden');
    headerActionsEl.classList.remove('hidden');

    if (session) {
      // Phase 23.2: Status dot + timestamp + Sync button only (Sign Out moved inside sync modal)
      headerActionsEl.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span id="syncStatusDot" class="sync-status-indicator" title="Synced" style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;background:#22c55e;margin:0 4px"></span>
          <span id="lastSyncedTime" style="font-size:.75rem;color:var(--text-soft)">Last synced: never</span>
          <button id="headerSyncMenuBtn" class="ghost">☁ Sync</button>
          <span id="localFileSyncDot" style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;background:#6b7280;margin:0 2px" title="Local file sync"></span>
          <span id="localFileSyncText" style="font-size:.75rem;color:var(--text-soft)">No file</span>
          <button id="headerLocalMenuBtn" class="ghost">📁 Local</button>
        </div>
      `;

      const menuBtn = headerActionsEl.querySelector('#headerSyncMenuBtn');
      const localBtn = headerActionsEl.querySelector('#headerLocalMenuBtn');

      if (menuBtn) {
        menuBtn.onclick = async () => {
          await this._showSyncMenuModal();
          triggerHaptic('tap');
        };
      }

      if (localBtn) {
        localBtn.onclick = async () => {
          await this._showLocalModal();
          triggerHaptic('tap');
        };
      }

      this._updateLocalFileIndicator();

      return;
    }

    // Phase 23.1: Show sign-in button (will open modal on click)
    // Phase 23.2: Also show Local button when signed out so local backup is always accessible
    headerActionsEl.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button id="headerCloudSignInBtn" class="primary">☁ Cloud Sign In</button>
        <span id="localFileSyncDot" style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;background:#6b7280;margin:0 2px" title="Local file sync"></span>
        <span id="localFileSyncText" style="font-size:.75rem;color:var(--text-soft)">No file</span>
        <button id="headerLocalMenuBtn" class="ghost">📁 Local</button>
      </div>
    `;

    const signInBtn = headerActionsEl.querySelector('#headerCloudSignInBtn');
    if (signInBtn) {
      signInBtn.onclick = async () => {
        await this._showSignInModal();
        triggerHaptic('tap');
      };
    }

    const localBtn = headerActionsEl.querySelector('#headerLocalMenuBtn');
    if (localBtn) {
      localBtn.onclick = async () => {
        await this._showLocalModal();
        triggerHaptic('tap');
      };
    }

    this._updateLocalFileIndicator();
  },

  _renderNotConfigured(statusEl, actionsEl) {
    statusEl.innerHTML = '<span style="font-size:.85rem;color:var(--text-soft)">Cloud keys are not configured yet.</span>';
    actionsEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <p style="font-size:.85rem;margin:0">Enable cloud sync by entering your Supabase project URL and publishable anon key.</p>
        <button id="settingsCloudConfigureBtn" class="primary">Configure Cloud Sync</button>
      </div>
    `;

    document.getElementById('settingsCloudConfigureBtn')?.addEventListener('click', async () => {
      await this._showCloudConfigModal();
      triggerHaptic('tap');
    });
  },

  /**
   * Phase 23.2: Show local backup modal with file-sync management + Export/Import options.
   */
  _showLocalModal() {
    const { fileName, status, statusText } = getFileSyncState();

    // Safe HTML escaping for the file name (file names can have <, >, & etc.)
    const escHtml = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // ── File auto-save section ────────────────────────────────────────────
    let statusDotStyle = 'display:inline-block;width:0.55em;height:0.55em;border-radius:50%;vertical-align:middle;margin-right:4px;';
    let statusLabel = 'No file connected';
    if (fileName) {
      if (status === 'error') {
        statusDotStyle += 'background:#ef4444';
        statusLabel = escHtml(statusText || 'Error');
      } else if (status === 'pending') {
        statusDotStyle += 'background:#eab308';
        statusLabel = 'Saving…';
      } else {
        statusDotStyle += 'background:#22c55e';
        statusLabel = 'Auto-saving';
      }
    } else {
      statusDotStyle += 'background:#6b7280';
    }

    const fileInfo = fileName
      ? `<p style="font-size:.85rem;margin:4px 0 10px"><strong>${escHtml(fileName)}</strong></p>
         <p style="font-size:.8rem;color:var(--text-soft);margin:0 0 10px">
           <span style="${statusDotStyle}"></span>${statusLabel}
         </p>`
      : `<p style="font-size:.85rem;color:var(--text-soft);margin:4px 0 10px">
           No budget file connected.<br>Select a file to enable automatic saving.
         </p>`;

    const fileButtons = fileName
      ? `<button id="_localChangeFileBtn" class="ghost sm" style="margin-right:6px">📁 Change File</button>
         <button id="_localDisconnectBtn" class="danger sm">🔗 Disconnect</button>`
      : `<button id="_localSelectFileBtn" class="primary sm">📂 Select Budget File</button>`;

    const body = `
      <div style="display:flex;flex-direction:column;gap:14px">

        <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
          <p style="margin:0 0 6px;font-size:.75rem;font-weight:600;color:var(--text-soft);text-transform:uppercase;letter-spacing:.06em">💾 File Auto-Save</p>
          ${fileInfo}
          <div style="display:flex;flex-wrap:wrap;gap:6px">${fileButtons}</div>
        </div>

        <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
          <p style="margin:0 0 6px;font-size:.75rem;font-weight:600;color:var(--text-soft);text-transform:uppercase;letter-spacing:.06em">📋 Manual Backup</p>
          <p style="font-size:.8rem;color:var(--text-soft);margin:0 0 10px">One-off JSON export or restore.</p>
          <div style="display:flex;gap:6px">
            <button id="_localExportBtn" class="ghost sm">💾 Export</button>
            <button id="_localImportBtn" class="ghost sm">📂 Import</button>
          </div>
        </div>

      </div>
    `;

    templateUI.showModal('📁 Local', body, [{ label: 'Close', className: 'ghost', onClick: () => templateUI.closeModal() }]);

    // Bind inline button events (body innerHTML is rendered synchronously by modalUI.show)
    document.getElementById('_localExportBtn')?.addEventListener('click', () => {
      templateUI.closeModal();
      document.getElementById('exportBtn')?.click();
    });
    document.getElementById('_localImportBtn')?.addEventListener('click', () => {
      templateUI.closeModal();
      document.getElementById('importFile')?.click();
    });
    document.getElementById('_localSelectFileBtn')?.addEventListener('click', () => {
      templateUI.closeModal();
      openSelectFileDialog();
    });
    document.getElementById('_localChangeFileBtn')?.addEventListener('click', () => {
      templateUI.closeModal();
      openSelectFileDialog();
    });
    document.getElementById('_localDisconnectBtn')?.addEventListener('click', () => {
      templateUI.closeModal();
      disconnectFileSyncFile();
    });
  },

  /**
   * Phase 23.1: Initialize dirty-state tracking.
   * Loads initial dirty state from localStorage and hooks into Dexie table writes.
   */
  _initDirtyStateTracking() {
    // Load initial state from localStorage
    this._isDirty = localStorage.getItem(CLOUD_IS_DIRTY_KEY) === 'true';

    this._mutationsDuringSync = false;
    const markDirty = () => {
      if (this._syncInProgress) {
        this._mutationsDuringSync = true;
        return;
      }
      if (!this._isDirty) {
        this._isDirty = true;
        localStorage.setItem(CLOUD_IS_DIRTY_KEY, 'true');
        this._updateStatusIndicator();
      }
    };

    // Dexie 4 (dexie@4.0.11) doesn't provide db.on('mutated'); use per-table hooks instead.
    try {
      if (db.tables && db.tables.length > 0) {
        db.tables.forEach(table => {
          table.hook('creating', markDirty);
          table.hook('updating', markDirty);
          table.hook('deleting', markDirty);
        });
      }
    } catch (err) {
      console.warn('[cloudSyncUI] Could not bind Dexie mutation hooks:', err.message);
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
   * Updates the local file-sync status dot and label in the header.
   * Driven by `localSync:statusChanged` events dispatched by file-sync.js.
   * States: no file (gray) · auto-saving / pending (orange + pulse) · saved (green) · error (red)
   */
  _updateLocalFileIndicator() {
    const dot = document.getElementById('localFileSyncDot');
    const text = document.getElementById('localFileSyncText');
    if (!dot || !text) return;

    const { fileName, status, statusText } = getFileSyncState();

    if (!fileName) {
      dot.style.background = '#6b7280';
      dot.style.animation = 'none';
      dot.title = 'No local file connected';
      text.textContent = 'No file';
      return;
    }

    if (status === 'error') {
      dot.style.background = '#ef4444';
      dot.style.animation = 'none';
      dot.title = statusText || 'Local save error';
      text.textContent = statusText || 'Error';
    } else if (status === 'pending') {
      dot.style.background = '#eab308';
      dot.style.animation = 'pulse 1.5s infinite';
      dot.title = 'Saving to local file…';
      text.textContent = 'Saving…';
    } else {
      // success or idle with a connected file = auto-saving is active
      dot.style.background = '#22c55e';
      dot.style.animation = 'none';
      dot.title = `Auto-saving to ${fileName}`;
      text.textContent = 'Auto-saving';
    }
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

  async _showCloudConfigModal() {
    const runtimeConfig = getRuntimeConfig();

    return new Promise((resolve) => {
      const body = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <p style="font-size:.85rem;margin:0;color:var(--text-soft)">
            GitHub Pages cannot create a <code>.env.local</code> file at runtime.
            Paste your Supabase values below to enable cloud sync in this browser.
          </p>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:.8rem">
            Supabase URL
            <input id="cloudConfigUrlInput" type="url" placeholder="https://your-project.supabase.co" value="${String(runtimeConfig.url || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" style="padding:8px;font-size:.9rem" autocomplete="off" />
          </label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:.8rem">
            Supabase anon key
            <textarea id="cloudConfigKeyInput" placeholder="sb_publishable_..." style="padding:8px;font-size:.85rem;min-height:82px;resize:vertical" autocomplete="off">${String(runtimeConfig.anonKey || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</textarea>
          </label>
          <p style="font-size:.78rem;color:var(--text-soft);margin:0">
            Find both values in Supabase: Project Settings → API.
          </p>
        </div>
      `;

      const footer = [
        {
          label: 'Save & Continue',
          className: 'primary',
          onClick: async () => {
            const url = document.getElementById('cloudConfigUrlInput')?.value?.trim() || '';
            const anonKey = document.getElementById('cloudConfigKeyInput')?.value?.trim() || '';
            try {
              saveRuntimeConfig(url, anonKey);
              this._bindAuthListener();
              await this._refreshSection();
              document.getElementById('cloudSyncSection')?.classList.remove('hidden');
              alertWithHaptic('Cloud config saved for this browser.', 'success');
              templateUI.closeModal();
              resolve();
            } catch (err) {
              alertWithHaptic(err.message || 'Invalid Supabase configuration');
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

      templateUI.showModal('☁ Configure Cloud Sync', body, footer);
      setTimeout(() => {
        document.getElementById('cloudConfigUrlInput')?.focus();
      }, 100);
    });
  },

  /**
   * Phase 23.1: Show unified sync menu modal with panel-based actions.
   */
  async _showSyncMenuModal() {
    const session = await getSession();
    const email = session?.user?.email || 'Unknown account';
    const escHtml = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return new Promise((resolve) => {
      const body = `
        <div style="display:flex;flex-direction:column;gap:14px">

          <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
            <p style="margin:0 0 6px;font-size:.75rem;font-weight:600;color:var(--text-soft);text-transform:uppercase;letter-spacing:.06em">☁ Cloud Sync</p>
            <p style="font-size:.8rem;color:var(--text-soft);margin:0 0 10px">Push your current budget to the cloud or pull the latest cloud snapshot.</p>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              <button id="_cloudPushBtn" class="primary sm">Push to Cloud</button>
              <button id="_cloudPullBtn" class="ghost sm">Pull from Cloud</button>
            </div>
          </div>

          <div style="border:1px solid var(--border);border-radius:8px;padding:12px">
            <p style="margin:0 0 6px;font-size:.75rem;font-weight:600;color:var(--text-soft);text-transform:uppercase;letter-spacing:.06em">👤 Signed In</p>
            <p style="font-size:.85rem;margin:4px 0 10px"><strong>${escHtml(email)}</strong></p>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              <button id="_cloudSignOutBtn" class="danger sm">Sign Out</button>
            </div>
          </div>

        </div>
      `;

      const footer = [
        {
          label: 'Close',
          className: 'ghost',
          onClick: () => {
            templateUI.closeModal();
            resolve();
          }
        }
      ];

      templateUI.showModal('☁ Cloud', body, footer);

      document.getElementById('_cloudPushBtn')?.addEventListener('click', async () => {
        try {
          this._syncInProgress = true;
          templateUI.closeModal();
          alertWithHaptic('Pushing to cloud...');
          this._mutationsDuringSync = false;
          await pushSnapshot();
          this._isDirty = this._mutationsDuringSync;
          this._mutationsDuringSync = false;
          localStorage.setItem(CLOUD_IS_DIRTY_KEY, this._isDirty ? 'true' : 'false');
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
      });

      document.getElementById('_cloudPullBtn')?.addEventListener('click', async () => {
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
      });

      document.getElementById('_cloudSignOutBtn')?.addEventListener('click', async () => {
        templateUI.closeModal();
        try {
          const supabase = getSupabaseClient();
          await supabase?.auth.signOut();
          alertWithHaptic('Signed out');
        } catch (err) {
          alertWithHaptic('Sign out failed: ' + err.message);
        }
        resolve();
      });
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
      const supabase = getSupabaseClient();
      await supabase?.auth.signOut();
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      this._authSubscription?.unsubscribe?.();
      this._authSubscription = null;
      this._authBoundClient = null;
      this._authListenerBound = false;
      return;
    }

    if (this._authListenerBound && this._authBoundClient === supabase) return;

    this._authSubscription?.unsubscribe?.();

    const authState = supabase.auth.onAuthStateChange((event, session) => {
      void this._refreshSection(session ?? null);

      if (!session) {
        this._lastAutoPullSessionUserId = null;
        return;
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        void this._runAutoPullAfterSignIn(session);
      }
    });
    this._authSubscription = authState?.data?.subscription || authState?.subscription || null;
    this._authBoundClient = supabase;
    this._authListenerBound = true;
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
