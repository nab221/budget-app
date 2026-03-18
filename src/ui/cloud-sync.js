import {
  isConfigured,
  getSupabaseClient,
  getRuntimeConfig,
  saveRuntimeConfig,
  getSession,
  signIn,
  signInWithGoogle,
  pushSnapshot,
  pullSnapshot,
  getLatestSnapshotMeta,
  CLOUD_LAST_SYNC_KEY,
} from '../utils/supabase-sync.js';
import { getFileSyncState, openSelectFileDialog, disconnectFileSyncFile } from './file-sync.js';
import { importBackupData } from '../db/backup.js';
import { templateUI } from './templates.js';
import { triggerHaptic } from '../utils/haptics.js';
import { notificationUI } from './notifications.js';
import { db } from '../db/schema.js';
import { validateDataIntegrity, cleanOrphanedRecords } from '../utils/data-integrity.js';
import {
  computeSnapshotDiff,
  isFirstSyncFallback,
  formatDiffSummary,
} from '../utils/snapshot-diff.js';
import { parseLegacyBackup, runLegacyImport } from '../utils/legacy-import.js';

// Phase 23.1: Constants for dirty-state tracking and timestamps
const CLOUD_IS_DIRTY_KEY = 'budget_cloud_is_dirty';

// Phase 25.1: Constants for error-state tracking
const CLOUD_LAST_ERROR_KEY = 'budget_cloud_last_error';
const CLOUD_LAST_ERROR_TIME_KEY = 'budget_cloud_last_error_time';
const CLOUD_LAST_ERROR_CODE_KEY = 'budget_cloud_last_error_code';
const CLOUD_LAST_PREVIEWED_SNAPSHOT_KEY = 'budget_cloud_last_previewed_snapshot';
const CLOUD_SYNC_DIAGNOSTICS_KEY = 'budget_cloud_sync_diagnostics';
const NO_CLOUD_SNAPSHOT_MESSAGE = 'No cloud snapshot found';

export const cloudSyncUI = {
  _initialized: false,
  _authListenerBound: false,
  _previewListenerBound: false,
  _previewHandler: null,
  _authSubscription: null,
  _authBoundClient: null,
  _isDirty: false,
  _syncInProgress: false,
  _mutationsDuringSync: false,
  _didAutoPullCheckOnLoad: false,
  _lastError: null, // { message, code, timestamp }
  _errorDismissed: false,
  _errorStorageUserScope: null,
  _lastAutoPullSessionUserId: null,
  _autoPullTriggered: false,
  _visibilityChangeHandler: null,

  _isDiagnosticsEnabled() {
    try {
      return import.meta.env.DEV || localStorage.getItem(CLOUD_SYNC_DIAGNOSTICS_KEY) === 'true';
    } catch {
      return !!import.meta.env.DEV;
    }
  },

  _logDiagnostics(context, extra = {}) {
    if (!this._isDiagnosticsEnabled()) return;

    const dot = document.getElementById('syncStatusDot');
    const timeEl = document.getElementById('lastSyncedTime');
    const payload = {
      context,
      isDirtyMemory: this._isDirty,
      isDirtyPersisted: localStorage.getItem(CLOUD_IS_DIRTY_KEY),
      syncInProgress: this._syncInProgress,
      mutationsDuringSync: this._mutationsDuringSync,
      lastSync: localStorage.getItem(CLOUD_LAST_SYNC_KEY),
      lastPreviewedSnapshot: localStorage.getItem(CLOUD_LAST_PREVIEWED_SNAPSHOT_KEY),
      dotBackground: dot?.style?.background || null,
      dotAnimation: dot?.style?.animation || null,
      dotTitle: dot?.getAttribute?.('title') || null,
      timestampText: timeEl?.textContent || null,
      ...extra,
    };
    console.info('[cloudSyncUI][diag]', payload);
  },

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

    // Phase 25.1: Initialize error-state tracking
    this._loadErrorState();

    // Listen for local file-sync status changes to update the local indicator dot
    window.addEventListener('localSync:statusChanged', () => this._updateLocalFileIndicator());

    this._bindAuthListener();
    this._bindPreviewListener();
    this._bindVisibilityAutoPush();
    await this._refreshSection();
    await this._runAutoPullCheckOnLoad();

    if (this._isDiagnosticsEnabled()) {
      window.__cloudSyncDebug = () => this._logDiagnostics('manual:window.__cloudSyncDebug()');
      window.__setCloudSyncDiagnostics = (enabled) => {
        localStorage.setItem(CLOUD_SYNC_DIAGNOSTICS_KEY, enabled ? 'true' : 'false');
        this._logDiagnostics('manual:window.__setCloudSyncDiagnostics', { enabled });
      };
    }

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

      const lastPreviewedRaw = localStorage.getItem(CLOUD_LAST_PREVIEWED_SNAPSHOT_KEY);
      const lastPreviewedMs = Number.parseInt(lastPreviewedRaw ?? '0', 10);
      if (Number.isFinite(lastPreviewedMs) && lastPreviewedMs >= cloudUpdatedAtMs) return;

      const localLastSyncRaw = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
      const localLastSyncMs = Number.parseInt(localLastSyncRaw ?? '0', 10);
      const hasValidLocalSync = Number.isFinite(localLastSyncMs) && localLastSyncMs > 0;

      if (!hasValidLocalSync || cloudUpdatedAtMs > localLastSyncMs) {
        if (this._autoPullTriggered) return;
        this._autoPullTriggered = true;
        const err = await this._executePullSync();
        if (err && err?.message !== 'No cloud snapshot found') {
          console.warn('[cloudSyncUI] Auto-pull check on load skipped:', err?.message || err);
        }
      }
    } catch (err) {
      if (err?.message !== 'No cloud snapshot found') {
        console.warn('[cloudSyncUI] Auto-pull check on load skipped:', err?.message || err);
      }
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
      // Phase 25.1: Clear error state on successful auto-push
      this._clearErrorState();
      this._updateStatusIndicator();
    } catch (err) {
      console.warn('[cloudSyncUI] Auto-push on exit failed:', err?.message || err);
      // Phase 25.1: Save error state on auto-push failure
      this._saveErrorState(err?.message || 'Auto-push failed', 'AUTO_PUSH_ERROR');
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
      const latestMeta = await getLatestSnapshotMeta();
      if (!latestMeta?.updated_at) return;

      const cloudUpdatedAtMs = Date.parse(latestMeta.updated_at);
      if (!Number.isFinite(cloudUpdatedAtMs)) return;

      const lastPreviewedRaw = localStorage.getItem(CLOUD_LAST_PREVIEWED_SNAPSHOT_KEY);
      const lastPreviewedMs = Number.parseInt(lastPreviewedRaw ?? '0', 10);
      if (Number.isFinite(lastPreviewedMs) && lastPreviewedMs >= cloudUpdatedAtMs) {
        return;
      }

      const localLastSyncRaw = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
      const localLastSyncMs = Number.parseInt(localLastSyncRaw ?? '0', 10);
      const hasValidLocalSync = Number.isFinite(localLastSyncMs) && localLastSyncMs > 0;

      if (hasValidLocalSync && cloudUpdatedAtMs <= localLastSyncMs) {
        return;
      }

      this._autoPullTriggered = true;
      const err = await this._executePullSync();
      if (err && err?.message !== 'No cloud snapshot found') {
        console.warn('[cloudSyncUI] Auto-pull after sign-in failed:', err?.message || err);
      }
    } catch (err) {
      if (err?.message !== 'No cloud snapshot found') {
        console.warn('[cloudSyncUI] Auto-pull after sign-in failed:', err?.message || err);
      }
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

    this._setErrorStorageScope(session || null);

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
        await this._executeSmartLocalAction();
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
          <span id="syncStatusDot" class="sync-status-indicator" title="Synced" style="display:inline-block;width:0.6em;height:0.6em;border-radius:50%;background:#22c55e;margin:0 4px;flex-shrink:0"></span>
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
        const runSmartSync = async (isRetry = false) => {
          const { action, err } = await this._executeSmartSync({ button: menuBtn });
          if (!err) return;

          const prefix = isRetry ? 'Retry failed: ' : 'Sync failed: ';
          const message = `${prefix}${err.message}`;

          if (action === 'pull') {
            this._showPullErrorNotification(message, () => runSmartSync(true));
          } else if (action === 'meta') {
            this._showPullErrorNotification(message, () => runSmartSync(true));
          } else {
            this._showPushErrorNotification(message, () => runSmartSync(true));
          }
        };

        menuBtn.onclick = () => {
          void runSmartSync(false);
          triggerHaptic('tap');
        };
      }

      if (localBtn) {
        localBtn.onclick = async () => {
          await this._executeSmartLocalAction();
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
        await this._executeSmartLocalAction();
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

    this._renderLocalSettingsActions(actionsEl);
  },

  async _executeSmartLocalAction() {
    const { fileName } = getFileSyncState();

    if (!fileName) {
      openSelectFileDialog();
      return;
    }

    const settingsTab = document.querySelector('#mainTabs .tab[data-tab="settings"]');
    settingsTab?.click();

    try {
      document.getElementById('cloudSyncSection')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    } catch {
      document.getElementById('cloudSyncSection')?.scrollIntoView?.();
    }

    notificationUI.info('Local sync options are in Settings', [], 1800);
  },

  _renderLocalSettingsActions(actionsEl) {
    const { fileName, status, statusText } = getFileSyncState();
    const escHtml = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let statusDotColor = '#6b7280';
    let statusLabel = 'No file connected';

    if (fileName) {
      if (status === 'error') {
        statusDotColor = '#ef4444';
        statusLabel = statusText || 'Error';
      } else if (status === 'pending') {
        statusDotColor = '#eab308';
        statusLabel = 'Saving…';
      } else {
        statusDotColor = '#22c55e';
        statusLabel = 'Auto-saving';
      }
    }

    const fileInfo = fileName
      ? `<p style="font-size:.85rem;margin:4px 0 8px"><strong>${escHtml(fileName)}</strong></p>
         <p style="font-size:.8rem;color:var(--text-soft);margin:0 0 10px">
           <span style="display:inline-block;width:0.55em;height:0.55em;border-radius:50%;vertical-align:middle;margin-right:4px;background:${statusDotColor}"></span>${escHtml(statusLabel)}
         </p>`
      : `<p style="font-size:.85rem;color:var(--text-soft);margin:4px 0 10px">No budget file connected. Select a file to enable automatic saving.</p>`;

    const fileButtons = fileName
      ? `<button id="settingsLocalChangeFileBtn" class="ghost">Change File</button>
         <button id="settingsLocalDisconnectBtn" class="ghost">Disconnect</button>`
      : `<button id="settingsLocalSelectFileBtn" class="ghost">Select Budget File</button>`;

    actionsEl.insertAdjacentHTML('beforeend', `
      <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-top:12px">
        <p style="margin:0 0 6px;font-size:.75rem;font-weight:600;color:var(--text-soft);text-transform:uppercase;letter-spacing:.06em">📁 Local Sync</p>
        ${fileInfo}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">${fileButtons}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="settingsLocalExportBtn" class="ghost">Export Backup</button>
          <button id="settingsLocalImportBtn" class="ghost">Import Backup</button>
          <button id="settingsLegacyImportBtn" class="ghost" title="Import a v2 budget backup file">Import v2 Legacy</button>
        </div>
      </div>
      <input type="file" id="legacyImportFile" accept=".json" style="display:none" aria-hidden="true">
    `);

    document.getElementById('settingsLocalExportBtn')?.addEventListener('click', () => {
      document.getElementById('exportBtn')?.click();
    });

    document.getElementById('settingsLocalImportBtn')?.addEventListener('click', () => {
      document.getElementById('importFile')?.click();
    });

    document.getElementById('settingsLegacyImportBtn')?.addEventListener('click', () => {
      document.getElementById('legacyImportFile')?.click();
    });

    document.getElementById('legacyImportFile')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      e.target.value = '';

      let payload;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        notificationUI.error('Invalid file: not a valid JSON backup.');
        return;
      }

      const { valid, reasons } = parseLegacyBackup(payload);
      if (!valid) {
        notificationUI.error(`Cannot import: ${reasons.join(' ')}`);
        return;
      }

      try {
        const summary = await runLegacyImport(payload, { db });
        notificationUI.success(
          `Legacy import complete: ${summary.imported} imported, ${summary.skipped} skipped (conflicts).`
        );
        if (summary.imported > 0) {
          window.location.reload();
        }
      } catch (err) {
        console.error('[legacy-import] import error:', err);
        notificationUI.error(`Legacy import failed: ${err.message}`);
      }
    });

    document.getElementById('settingsLocalSelectFileBtn')?.addEventListener('click', () => {
      openSelectFileDialog();
    });

    document.getElementById('settingsLocalChangeFileBtn')?.addEventListener('click', () => {
      openSelectFileDialog();
    });

    document.getElementById('settingsLocalDisconnectBtn')?.addEventListener('click', () => {
      disconnectFileSyncFile();
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
        this._logDiagnostics('dirty:mutation-during-sync');
        return;
      }
      this._isDirty = true;
      localStorage.setItem(CLOUD_IS_DIRTY_KEY, 'true');
      this._updateStatusIndicator();
      this._logDiagnostics('dirty:marked');
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

    // Repository layer broadcasts db:mutated after writes.
    // Listening here ensures dirty-state UX updates even when a write path
    // does not trigger Dexie hooks in this module's lifecycle.
    window.addEventListener('db:mutated', () => {
      markDirty();
      // Defensive refresh: if header was re-rendered by other UI flows,
      // force sync indicator and timestamp to pick up the latest dirty state.
      this._updateStatusIndicator();
      this._logDiagnostics('event:db:mutated');
    });
  },

  /**
   * Phase 25.1: Load error state from localStorage on app init.
   * Restores _lastError and validates timestamp.
   */
  _loadErrorState() {
    const savedError = localStorage.getItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_KEY));
    const savedTime = localStorage.getItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_TIME_KEY));
    const savedCode = localStorage.getItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_CODE_KEY));

    this._lastError = null;

    if (savedError && savedTime) {
      const timestamp = parseInt(savedTime, 10);
      if (Number.isFinite(timestamp)) {
        this._lastError = {
          message: savedError,
          code: savedCode || null,
          timestamp,
        };
      }
    }
  },

  /**
   * Phase 25.1: Save error state to localStorage.
   * Called after push/pull fails to persist error for display on page reload.
   */
  _saveErrorState(errorMessage, errorCode = null) {
    const now = Date.now();
    this._lastError = {
      message: errorMessage,
      code: errorCode,
      timestamp: now
    };

    localStorage.setItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_KEY), errorMessage);
    localStorage.setItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_TIME_KEY), String(now));
    if (errorCode) {
      localStorage.setItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_CODE_KEY), errorCode);
    } else {
      localStorage.removeItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_CODE_KEY));
    }
    this._errorDismissed = false;
    this._updateStatusIndicator();
  },

  /**
   * Phase 25.1: Clear error state from memory and localStorage.
   * Called after successful push/pull to reset to clean/synced state.
   */
  _clearErrorState() {
    this._lastError = null;
    this._errorDismissed = false;
    localStorage.removeItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_KEY));
    localStorage.removeItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_TIME_KEY));
    localStorage.removeItem(this._getErrorStorageKey(CLOUD_LAST_ERROR_CODE_KEY));
    this._updateStatusIndicator();
  },

  _deriveErrorStorageScope(session) {
    const user = session?.user;
    const rawScope = user?.id || user?.email || 'anonymous';
    return encodeURIComponent(String(rawScope));
  },

  _setErrorStorageScope(session) {
    const nextScope = this._deriveErrorStorageScope(session);
    if (nextScope === this._errorStorageUserScope) return;
    this._errorStorageUserScope = nextScope;
    this._loadErrorState();
  },

  _getErrorStorageKey(baseKey) {
    const scope = this._errorStorageUserScope || 'anonymous';
    return `${baseKey}:${scope}`;
  },

  _isNoCloudSnapshotError(err) {
    if (!err) return false;
    const code = String(err.code || '').toLowerCase();
    const message = String(err.message || '').toLowerCase();
    return code === 'no_cloud_snapshot' || message.includes(NO_CLOUD_SNAPSHOT_MESSAGE.toLowerCase());
  },

  _buildExportBackupAction() {
    return {
      label: '💾 Export Backup',
      onClick: () => document.getElementById('exportBtn')?.click(),
    };
  },

  _showPushErrorNotification(message, retryAction = null) {
    const actions = [this._buildExportBackupAction()];
    if (retryAction) {
      actions.push({ label: '↻ Retry', onClick: retryAction });
    }
    notificationUI.error(message, actions);
  },

  _showPullErrorNotification(message, retryAction = null) {
    const actions = retryAction ? [{ label: '↻ Retry', onClick: retryAction }] : [];
    notificationUI.error(message, actions);
  },

  _setSyncButtonBusy(button, isBusy, busyLabel = null) {
    if (!button) return;

    if (isBusy) {
      if (button.dataset.syncOriginalText === undefined) {
        button.dataset.syncOriginalText = button.textContent || '';
      }
      if (button.dataset.syncWasDisabled === undefined) {
        button.dataset.syncWasDisabled = button.disabled ? 'true' : 'false';
      }
      if (busyLabel) {
        button.textContent = busyLabel;
      }
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.classList.add('sync-action-busy');
      return;
    }

    if (Object.prototype.hasOwnProperty.call(button.dataset, 'syncOriginalText')) {
      button.textContent = button.dataset.syncOriginalText;
    }

    if (Object.prototype.hasOwnProperty.call(button.dataset, 'syncWasDisabled')) {
      button.disabled = button.dataset.syncWasDisabled === 'true';
    }
    button.removeAttribute('aria-busy');
    button.classList.remove('sync-action-busy');
    delete button.dataset.syncOriginalText;
    delete button.dataset.syncWasDisabled;
  },

  async _executeSmartSync({ button = null } = {}) {
    const persistedDirty = localStorage.getItem(CLOUD_IS_DIRTY_KEY) === 'true';
    const hasDirtyChanges = this._isDirty || persistedDirty;

    if (hasDirtyChanges) {
      const err = await this._executePushSync({ button, announceStart: true, successAlert: true });
      return { action: 'push', err };
    }

    const localLastSyncMs = Number.parseInt(localStorage.getItem(CLOUD_LAST_SYNC_KEY) || '0', 10) || 0;
    const lastPreviewedMs = Number.parseInt(localStorage.getItem(CLOUD_LAST_PREVIEWED_SNAPSHOT_KEY) || '0', 10) || 0;

    let latestMeta = null;
    try {
      latestMeta = await getLatestSnapshotMeta();
    } catch (err) {
      if (!this._isNoCloudSnapshotError(err)) {
        console.error('[cloudSyncUI] Smart sync metadata check failed:', err);
        this._saveErrorState(err.message, err.code || 'META_ERROR');
        return { action: 'meta', err };
      }
    }

    const cloudUpdatedAtMs = Date.parse(latestMeta?.updated_at || '') || 0;
    if (!cloudUpdatedAtMs) {
      if (!localLastSyncMs) {
        const err = await this._executePushSync({ button, announceStart: true, successAlert: true });
        return { action: 'push', err };
      }
      notificationUI.info('Already up to date', [], 1600);
      return { action: 'noop', err: null };
    }

    const localGateMs = Math.max(localLastSyncMs, lastPreviewedMs);
    if (cloudUpdatedAtMs > localGateMs) {
      const err = await this._executePullSync({ button, announceStart: true });
      return { action: 'pull', err };
    }

    notificationUI.info('Already up to date', [], 1600);
    return { action: 'noop', err: null };
  },

  async _executePushSync({ button = null, closeModal = false, announceStart = false, successAlert = false } = {}) {
    if (this._syncInProgress) {
      return null;
    }

    try {
      this._syncInProgress = true;
      this._setSyncButtonBusy(button, true, 'Pushing...');
      if (closeModal) {
        templateUI.closeModal();
      }
      if (announceStart) {
        notificationUI.info('Pushing to cloud…', [], 1500);
      }

      this._mutationsDuringSync = false;
      await pushSnapshot();
      this._isDirty = this._mutationsDuringSync;
      this._mutationsDuringSync = false;
      localStorage.setItem(CLOUD_IS_DIRTY_KEY, this._isDirty ? 'true' : 'false');
      this._clearErrorState();
      this._updateStatusIndicator();

      triggerHaptic('success');
      notificationUI.success('Budget synced to cloud', [], 2000);
      await this._refreshSection();
      return null;
    } catch (err) {
      console.error('[cloudSyncUI] Push failed:', err);
      this._saveErrorState(err.message, err.code || 'PUSH_ERROR');
      return err;
    } finally {
      this._syncInProgress = false;
      this._setSyncButtonBusy(button, false);
    }
  },

  async _executePullSync({ button = null, closeModal = false, announceStart = false } = {}) {
    if (this._syncInProgress) {
      return null;
    }

    try {
      this._syncInProgress = true;
      this._setSyncButtonBusy(button, true, 'Fetching...');
      if (closeModal) {
        templateUI.closeModal();
      }
      if (announceStart) {
        notificationUI.info('Fetching from cloud…', [], 1500);
      }

      await pullSnapshot();
      this._clearErrorState();
      await this._refreshSection();

      // Phase 27: Run integrity check after successful cloud pull (non-blocking)
      validateDataIntegrity().then(({ valid, issues }) => {
        if (!valid) {
          notificationUI.warning(
            `⚠️ ${issues.length} data integrity issue${issues.length !== 1 ? 's' : ''} found after sync.`,
            [
              {
                label: 'Clean up',
                onClick: () => cleanOrphanedRecords(issues).then(() => notificationUI.success('Orphaned records removed.')),
              },
            ],
            8000
          );
        }
      }).catch(err => {
        console.warn('[cloudSyncUI] Post-pull integrity check failed:', err);
      });

      return null;
    } catch (err) {
      if (this._isNoCloudSnapshotError(err)) {
        this._clearErrorState();
        return null;
      }
      console.error('[cloudSyncUI] Pull failed:', err);
      this._saveErrorState(err.message, err.code || 'PULL_ERROR');
      return err;
    } finally {
      this._syncInProgress = false;
      this._setSyncButtonBusy(button, false);
    }
  },

  /**
   * Phase 23.1: Update status indicator dot color and animation.
   * Phase 25.2: Updated to show error state (RED > Yellow > Green)
   * Priority: 🔴 Error > 🟡 Dirty > 🟢 Synced
   */
  _updateStatusIndicator() {
    const dot = document.getElementById('syncStatusDot');
    if (!dot) return;

    const persistedDirty = localStorage.getItem(CLOUD_IS_DIRTY_KEY) === 'true';
    if (persistedDirty && !this._syncInProgress) {
      this._isDirty = true;
    }

    let state = 'synced';
    let title = 'All changes saved to cloud';

    // Phase 25.2: Check error state first (highest priority)
    if (this._lastError) {
      state = 'error';
      title = `Cloud sync error: ${this._lastError.message}`;
    } else if (this._isDirty) {
      state = 'dirty';
      title = 'Unsaved changes (click Sync to sync)';
    }

    // Update dot styling based on state priority
    if (state === 'error') {
      dot.style.background = '#ef4444'; // Red
      dot.style.animation = 'none';
    } else if (state === 'dirty') {
      dot.style.background = '#eab308'; // Yellow
      dot.style.animation = 'pulse 1.5s infinite';
    } else if (state === 'synced') {
      dot.style.background = '#22c55e'; // Green
      dot.style.animation = 'none';
    }

    dot.title = title;
    this._updateTimestampDisplay();
    this._logDiagnostics('indicator:updated', { state, title });
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
      const iosNotice = window.navigator.standalone === true
        ? `<p class="auth-ios-notice" style="font-size:.85rem;background:var(--info-bg,#eff6ff);border:1px solid var(--info-border,#93c5fd);border-radius:6px;padding:8px 10px;margin:0">
            <strong>iOS tip:</strong> Magic links open in Safari, not this app. ` +
          `Continue sign-in in <strong>Safari</strong>, or use Safari/browser mode before requesting the link.</p>`
        : '';
      const body = `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${iosNotice}
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
          label: 'Continue with Google',
          className: 'ghost',
          onClick: async () => {
            try {
              await signInWithGoogle();
              templateUI.closeModal();
              resolve();
            } catch (err) {
              console.error('[cloudSyncUI] Google sign-in failed:', err);
              notificationUI.error('Google sign-in failed: ' + err.message);
            }
          }
        },
        {
          label: 'Send Link',
          className: 'primary',
          onClick: async () => {
            const email = document.getElementById('signInEmailInput')?.value?.trim();
            if (!email) {
              notificationUI.warning('Please enter your email address.');
              return;
            }
            try {
              await signIn(email);
              notificationUI.success('Check your email for a sign-in link.');
              templateUI.closeModal();
              resolve();
            } catch (err) {
              console.error('[cloudSyncUI] Sign-in failed:', err);
              notificationUI.error('Sign-in failed: ' + err.message);
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
    const getConfigModalRoot = () => document.getElementById('modalBody');

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
            const modalRoot = getConfigModalRoot();
            const url = modalRoot?.querySelector('#cloudConfigUrlInput')?.value?.trim() || '';
            const anonKey = modalRoot?.querySelector('#cloudConfigKeyInput')?.value?.trim() || '';
            try {
              saveRuntimeConfig(url, anonKey);
              this._bindAuthListener();
              await this._refreshSection();
              document.getElementById('cloudSyncSection')?.classList.remove('hidden');
              notificationUI.success('Cloud config saved for this browser.');
              templateUI.closeModal();
              resolve();
            } catch (err) {
              notificationUI.error(err.message || 'Invalid Supabase configuration');
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
        getConfigModalRoot()?.querySelector('#cloudConfigUrlInput')?.focus();
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

      const pushBtnModal = document.getElementById('_cloudPushBtn');
      if (pushBtnModal) pushBtnModal.onclick = async () => {
        try {
          const retryPush = async () => {
            const retryErr = await this._executePushSync({ announceStart: true, successAlert: true });
            if (retryErr) {
              this._showPushErrorNotification(retryErr.message, retryPush);
            }
          };

          const err = await this._executePushSync({ closeModal: true, announceStart: true, successAlert: true });
          if (err) {
            this._showPushErrorNotification(err.message, retryPush);
          }
        } finally {
          resolve();
        }
      };

      const pullBtnModal = document.getElementById('_cloudPullBtn');
      if (pullBtnModal) pullBtnModal.onclick = async () => {
        try {
          const retryPull = async () => {
            const retryErr = await this._executePullSync({ announceStart: true });
            if (retryErr) {
              this._showPullErrorNotification(retryErr.message, retryPull);
            }
          };

          const err = await this._executePullSync({ closeModal: true, announceStart: true });
          if (err) {
            this._showPullErrorNotification(err.message, retryPull);
          }
        } finally {
          resolve();
        }
      };

      const signOutBtnModal = document.getElementById('_cloudSignOutBtn');
      if (signOutBtnModal) signOutBtnModal.onclick = async () => {
        templateUI.closeModal();
        try {
          const supabase = getSupabaseClient();
          await supabase?.auth.signOut();
          notificationUI.info('Signed out');
        } catch (err) {
          notificationUI.error('Sign out failed: ' + err.message);
        }
        resolve();
      };
    });
  },

  _renderSignedIn(session, statusEl, actionsEl) {
    const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lastSyncMs = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
    const lastSyncText = lastSyncMs
      ? `Last synced: ${new Date(parseInt(lastSyncMs)).toLocaleString()}`
      : 'Never synced';

    statusEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="color:var(--success);font-size:.85rem">Signed in as ${escHtml(session.user.email)}</span>
        <button id="cloudSignOutBtn" class="ghost" style="font-size:.75rem;padding:2px 8px">Sign Out</button>
      </div>
    `;

    actionsEl.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="cloudPushBtn" class="ghost">Push to Cloud</button>
        <button id="cloudPullBtn" class="ghost">Pull from Cloud</button>
        <button id="settingsCloudEditConfigBtn" class="ghost">Edit Cloud Config</button>
      </div>
      <div class="hint" style="margin-top:6px;font-size:.75rem">${lastSyncText}</div>
    `;

    const signOutBtn = statusEl.querySelector('#cloudSignOutBtn');
    if (signOutBtn) signOutBtn.onclick = async () => {
      const supabase = getSupabaseClient();
      await supabase?.auth.signOut();
      triggerHaptic('tap');
    };

    const pushBtn = actionsEl.querySelector('#cloudPushBtn');
    if (pushBtn) {
      const runPush = async (isRetry = false) => {
        const err = await this._executePushSync({ button: pushBtn });
        if (!err) return;

        const message = isRetry ? 'Retry failed: ' + err.message : err.message;
        this._showPushErrorNotification(message, () => runPush(true));
      };

      pushBtn.onclick = () => runPush(false);
    }

    const pullBtn = actionsEl.querySelector('#cloudPullBtn');
    if (pullBtn) {
      const runPull = async (isRetry = false) => {
        const err = await this._executePullSync({ button: pullBtn });
        if (!err) return;

        const message = isRetry ? 'Retry failed: ' + err.message : err.message;
        this._showPullErrorNotification(message, () => runPull(true));
      };

      pullBtn.onclick = () => runPull(false);
    }

    const editConfigBtn = actionsEl.querySelector('#settingsCloudEditConfigBtn');
    if (editConfigBtn) {
      editConfigBtn.onclick = async () => {
        await this._showCloudConfigModal();
        triggerHaptic('tap');
      };
    }

    this._renderLocalSettingsActions(actionsEl);
  },

  _renderSignedOut(statusEl, actionsEl) {
    statusEl.innerHTML = '';
    actionsEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <p style="font-size:.85rem;margin:0">Sign in to the cloud to sync your budget across devices.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="settingsCloudSignInBtn" class="primary">Send Magic Link Via Email</button>
          <button id="settingsCloudEditConfigBtn" class="ghost">Edit Cloud Config</button>
        </div>
      </div>
    `;

    const signInBtn = actionsEl.querySelector('#settingsCloudSignInBtn');
    if (signInBtn) {
      signInBtn.onclick = async () => {
        await this._showSignInModal();
        triggerHaptic('tap');
      };
    }

    const editConfigBtn = actionsEl.querySelector('#settingsCloudEditConfigBtn');
    if (editConfigBtn) {
      editConfigBtn.onclick = async () => {
        await this._showCloudConfigModal();
        triggerHaptic('tap');
      };
    }

    this._renderLocalSettingsActions(actionsEl);
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
        this._setErrorStorageScope(null);
        return;
      }

      if (event === 'SIGNED_IN') {
        // Clean up PKCE ?code= parameter to prevent stale-code errors on refresh
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        void this._runAutoPullAfterSignIn(session);
      }
    });
    this._authSubscription = authState?.data?.subscription || authState?.subscription || null;
    this._authBoundClient = supabase;
    this._authListenerBound = true;
  },

  /**
   * Listens for the preview event dispatched by pullSnapshot().
   * Phase 37: Renders a delta-first preview (added/deleted/updated per store)
   * when a non-empty local baseline exists; falls back to full-summary counts
   * on first sync (all local stores empty).  Shows "No changes since last
   * snapshot" when the computed diff is all-zero.
   * Only calls importBackupData() after explicit user confirmation.
   */
  _bindPreviewListener() {
    if (this._previewListenerBound) return;
    this._previewListenerBound = true;
    this._previewHandler = async (e) => {
      const { updated_at, schema_version, counts, tableData } = e.detail;

      // --- Phase 37: Build local store map for diff computation ---
      const currentStoreMap = {};
      for (const table of db.tables) {
        try {
          currentStoreMap[table.name] = await table.toArray();
        } catch {
          currentStoreMap[table.name] = [];
        }
      }

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

      // --- Phase 37: Choose delta vs full-summary rendering path ---
      let previewContent;
      if (isFirstSyncFallback(currentStoreMap)) {
        // First sync: no local baseline — show the incoming record counts so the
        // user understands what they are about to import.
        const countLines = Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([t, n]) => `${n} ${escapeHtml(t)}`)
          .join(' · ');
        previewContent = `
          <p style="margin-top:6px;color:var(--text-soft);font-size:.85rem">${countLines || 'No data'}</p>
          <p style="margin-top:6px;font-size:.8rem;color:var(--text-soft)">First sync — no local data to compare against.</p>
        `;
      } else {
        // Delta mode: show only what changed since the last local snapshot.
        const diffMap = computeSnapshotDiff(currentStoreMap, tableData) ?? {};
        const diffLines = formatDiffSummary(diffMap) ?? [];

        if (diffLines.length === 0) {
          previewContent = `<p style="margin-top:6px;color:var(--text-soft);font-size:.85rem">No changes since last snapshot</p>`;
        } else {
          const deltaRows = diffLines
            .map(({ store, added, deleted, updated }) => {
              const parts = [];
              if (added > 0) parts.push(`${added} added`);
              if (deleted > 0) parts.push(`${deleted} removed`);
              if (updated > 0) parts.push(`${updated} changed`);
              return `<span style="display:inline-block;margin-right:12px"><strong>${escapeHtml(store)}</strong>: ${parts.join(', ')}</span>`;
            })
            .join('');
          previewContent = `<p style="margin-top:6px;color:var(--text-soft);font-size:.85rem">${deltaRows}</p>`;
        }
      }

      const body = `
        <p>Cloud snapshot from <strong>${date}</strong></p>
        ${previewContent}
        ${versionWarning}
        <p style="margin-top:12px"><strong>Replace local data?</strong> This cannot be undone.</p>
      `;

      const footer = `
        <button class="ghost" id="cancelCloudImportBtn">Cancel</button>
        <button class="danger" id="confirmCloudImportBtn">Replace Local Data</button>
      `;

      const previewedSnapshotMs = Date.parse(updated_at);
      const recordPreviewedSnapshot = () => {
        const value = Number.isFinite(previewedSnapshotMs) ? previewedSnapshotMs : Date.now();
        localStorage.setItem(CLOUD_LAST_PREVIEWED_SNAPSHOT_KEY, String(value));
      };

      templateUI.showModal('Cloud Snapshot Preview', body, footer);

      const restorePullBtn = () => {
        const settingsPullBtn = document.getElementById('cloudPullBtn');
        this._setSyncButtonBusy(settingsPullBtn, false);

      };

      document.getElementById('cancelCloudImportBtn').onclick = () => {
        recordPreviewedSnapshot();
        templateUI.closeModal();
        restorePullBtn();
      };

      document.getElementById('confirmCloudImportBtn').onclick = async () => {
        recordPreviewedSnapshot();
        templateUI.closeModal();
        try {
          await importBackupData(tableData);
          const importedSnapshotMs = Date.parse(updated_at);
          const lastSyncMs = Number.isFinite(importedSnapshotMs) ? importedSnapshotMs : Date.now();
          localStorage.setItem(CLOUD_LAST_SYNC_KEY, String(lastSyncMs));
          notificationUI.success('Latest budget loaded from cloud', [], 2000);
          triggerHaptic('success');
          window.location.reload();
        } catch (err) {
          console.error('[cloudSyncUI] Import failed:', err);
          notificationUI.error('Import failed: ' + err.message);
          restorePullBtn();
        }
      };
    };
    window.addEventListener('budget:import-cloud-preview', this._previewHandler);
  },
};
