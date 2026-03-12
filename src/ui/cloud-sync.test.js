// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

let configured = true;
let currentSupabaseClient;
const {
  mockSignOut,
  mockOnAuthStateChange,
  mockSaveRuntimeConfig,
  mockUnsubscribe,
  mockGetSession,
} = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockSaveRuntimeConfig: vi.fn(),
  mockUnsubscribe: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock('../utils/supabase-sync.js', () => ({
  isConfigured: () => configured,
  getSupabaseClient: () => currentSupabaseClient,
  getRuntimeConfig: () => ({ url: '', anonKey: '', isConfigured: false }),
  saveRuntimeConfig: mockSaveRuntimeConfig,
  getSession: mockGetSession,
  getLatestSnapshotMeta: vi.fn(),
  signIn: vi.fn(),
  pushSnapshot: vi.fn(),
  pullSnapshot: vi.fn(),
  CLOUD_LAST_SYNC_KEY: 'budget_cloud_last_sync',
}));

vi.mock('../db/backup.js', () => ({
  importBackupData: vi.fn(),
}));

vi.mock('./templates.js', () => ({
  templateUI: {
    showModal: vi.fn(),
    closeModal: vi.fn(),
  },
}));

vi.mock('../utils/haptics.js', () => ({
  triggerHaptic: vi.fn(),
  alertWithHaptic: vi.fn(),
}));

vi.mock('../db/schema.js', () => ({
  db: {
    verno: 1,
  },
}));

vi.mock('./notifications.js', () => ({
  notificationUI: {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { cloudSyncUI } from './cloud-sync.js';
import { notificationUI } from './notifications.js';
import * as supabaseSync from '../utils/supabase-sync.js';

describe('cloud-sync header actions (Phase 23)', () => {
  beforeEach(() => {
    configured = true;
    mockSignOut.mockReset();
    mockOnAuthStateChange.mockReset();
    mockSaveRuntimeConfig.mockReset();
    mockUnsubscribe.mockReset();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(null);
    currentSupabaseClient = {
      auth: {
        signOut: mockSignOut,
        onAuthStateChange: mockOnAuthStateChange.mockImplementation(() => ({
          data: { subscription: { unsubscribe: mockUnsubscribe } },
        })),
      },
    };
    cloudSyncUI._authListenerBound = false;
    cloudSyncUI._authSubscription = null;
    cloudSyncUI._authBoundClient = null;
    document.body.innerHTML = `
      <div class="toolbar">
        <div id="cloudSyncActionsHeader" class="hidden"></div>
        <button id="exportBtn" class="ghost">Export</button>
        <label for="importFile" class="ghost">Import <input id="importFile" type="file" /></label>
      </div>
      <nav>
        <div id="mainTabs">
          <button class="tab" data-tab="settings">Settings</button>
        </div>
      </nav>
      <input id="cloudSyncEmail" type="email" />
    `;
  });

  it('shows cloud sign-in action and hides local import/export when configured and signed out', () => {
    cloudSyncUI._renderHeaderActions(null);

    expect(document.getElementById('exportBtn').classList.contains('hidden')).toBe(true);
    expect(document.querySelector('label[for="importFile"]').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('cloudSyncActionsHeader').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('headerCloudSignInBtn')).not.toBeNull();
    // Phase 23.2: Local button always present
    expect(document.getElementById('headerLocalMenuBtn')).not.toBeNull();
  });

  it('shows push/pull actions when configured and signed in', () => {
    cloudSyncUI._renderHeaderActions({ user: { email: 'user@example.com' } });

    // Phase 23.1: Check for unified sync menu button and status indicator
    expect(document.getElementById('syncStatusDot')).not.toBeNull();
    expect(document.getElementById('lastSyncedTime')).not.toBeNull();
    expect(document.getElementById('headerSyncMenuBtn')).not.toBeNull();
    // Phase 23.2: Sign Out removed from header; Local button present instead
    expect(document.getElementById('headerCloudSignOutBtn')).toBeNull();
    expect(document.getElementById('headerLocalMenuBtn')).not.toBeNull();
  });

  it('shows configure cloud action and hides legacy local import/export when cloud is not configured', () => {
    configured = false;
    cloudSyncUI._renderHeaderActions(null);

    expect(document.getElementById('cloudSyncActionsHeader').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('headerCloudConfigureBtn')).not.toBeNull();
    expect(document.getElementById('exportBtn').classList.contains('hidden')).toBe(true);
    expect(document.querySelector('label[for="importFile"]').classList.contains('hidden')).toBe(true);
  });

  it('rebinds auth listener when Supabase client changes', () => {
    cloudSyncUI._bindAuthListener();
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);

    const nextUnsubscribe = vi.fn();
    const nextClient = {
      auth: {
        signOut: mockSignOut,
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: nextUnsubscribe } },
        })),
      },
    };

    currentSupabaseClient = nextClient;
    cloudSyncUI._bindAuthListener();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(nextClient.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(cloudSyncUI._authBoundClient).toBe(nextClient);
  });

  it('renders header actions even when cloud settings section is not present', async () => {
    await cloudSyncUI._refreshSection();

    expect(document.getElementById('cloudSyncActionsHeader').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('headerCloudSignInBtn')).not.toBeNull();
    expect(document.getElementById('headerLocalMenuBtn')).not.toBeNull();
  });

  it('keeps baseline header actions when session lookup fails', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('session failed'));

    await cloudSyncUI._refreshSection();

    expect(document.getElementById('cloudSyncActionsHeader').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('headerCloudSignInBtn')).not.toBeNull();
    expect(document.getElementById('headerLocalMenuBtn')).not.toBeNull();
  });

  it('uses provided session override without calling getSession', async () => {
    mockGetSession.mockClear();

    await cloudSyncUI._refreshSection({ user: { email: 'user@example.com' } });

    expect(mockGetSession).not.toHaveBeenCalled();
    expect(document.getElementById('headerSyncMenuBtn')).not.toBeNull();
    expect(document.getElementById('headerLocalMenuBtn')).not.toBeNull();
  });

  it('renders header actions even when legacy export/import controls are missing', () => {
    document.body.innerHTML = `
      <div class="toolbar">
        <div id="cloudSyncActionsHeader" class="hidden"></div>
      </div>
    `;

    cloudSyncUI._renderHeaderActions(null);

    expect(document.getElementById('cloudSyncActionsHeader').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('headerCloudSignInBtn')).not.toBeNull();
    expect(document.getElementById('headerLocalMenuBtn')).not.toBeNull();
  });
});

describe('cloud-sync intelligent sync logic (Phase 24)', () => {
  beforeEach(() => {
    configured = true;
    localStorage.clear();
    vi.clearAllMocks();

    mockSignOut.mockReset();
    mockOnAuthStateChange.mockReset();
    mockSaveRuntimeConfig.mockReset();
    mockUnsubscribe.mockReset();
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(null);
    currentSupabaseClient = {
      auth: {
        signOut: mockSignOut,
        onAuthStateChange: mockOnAuthStateChange.mockImplementation(() => ({
          data: { subscription: { unsubscribe: mockUnsubscribe } },
        })),
      },
    };

    cloudSyncUI._initialized = false;
    cloudSyncUI._isDirty = false;
    cloudSyncUI._syncInProgress = false;
    cloudSyncUI._mutationsDuringSync = false;
    cloudSyncUI._didAutoPullCheckOnLoad = false;
    cloudSyncUI._lastAutoPullSessionUserId = null;
    cloudSyncUI._autoPullTriggered = false;
    cloudSyncUI._visibilityChangeHandler = null;

    vi.mocked(supabaseSync.getSession).mockResolvedValue(null);
    vi.mocked(supabaseSync.getLatestSnapshotMeta).mockResolvedValue(null);
    vi.mocked(supabaseSync.pullSnapshot).mockResolvedValue(undefined);
    vi.mocked(supabaseSync.pushSnapshot).mockResolvedValue(undefined);

    document.body.innerHTML = '<div id="cloudSyncActionsHeader"></div>';
  });

  it('runs auto-pull check on load when cloud snapshot is newer than local', async () => {
    const oldLocalMs = Date.now() - 60_000;
    localStorage.setItem('budget_cloud_last_sync', String(oldLocalMs));

    vi.mocked(supabaseSync.getSession).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(supabaseSync.getLatestSnapshotMeta).mockResolvedValue({
      updated_at: new Date(Date.now()).toISOString(),
      schema_version: 1,
    });

    await cloudSyncUI._runAutoPullCheckOnLoad();

    expect(supabaseSync.pullSnapshot).toHaveBeenCalledTimes(1);
  });

  it('does not auto-pull on load when local snapshot is up to date', async () => {
    const localMs = Date.now();
    localStorage.setItem('budget_cloud_last_sync', String(localMs));

    vi.mocked(supabaseSync.getSession).mockResolvedValue({ user: { id: 'u1' } });
    vi.mocked(supabaseSync.getLatestSnapshotMeta).mockResolvedValue({
      updated_at: new Date(localMs - 1000).toISOString(),
      schema_version: 1,
    });

    await cloudSyncUI._runAutoPullCheckOnLoad();

    expect(supabaseSync.pullSnapshot).not.toHaveBeenCalled();
  });

  it('auto-pushes on exit when dirty and signed in', async () => {
    cloudSyncUI._isDirty = true;
    vi.mocked(supabaseSync.getSession).mockResolvedValue({ user: { id: 'u1' } });

    await cloudSyncUI._autoPushOnExit();

    expect(supabaseSync.pushSnapshot).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('budget_cloud_is_dirty')).toBe('false');
  });

  it('skips auto-push on exit when not dirty', async () => {
    cloudSyncUI._isDirty = false;
    vi.mocked(supabaseSync.getSession).mockResolvedValue({ user: { id: 'u1' } });

    await cloudSyncUI._autoPushOnExit();

    expect(supabaseSync.pushSnapshot).not.toHaveBeenCalled();
  });

  it('deduplicates auto-pull when auth emits INITIAL_SESSION then SIGNED_IN', async () => {
    let authCallback;
    mockOnAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
    });

    vi.spyOn(cloudSyncUI, '_refreshSection').mockResolvedValue(undefined);

    cloudSyncUI._bindAuthListener();
    const session = { user: { id: 'u1' } };

    authCallback('INITIAL_SESSION', session);
    await Promise.resolve();
    authCallback('SIGNED_IN', session);
    await Promise.resolve();

    expect(supabaseSync.pullSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe('cloud-sync sync visibility (Phase 25)', () => {
  const CLOUD_LAST_ERROR_KEY = 'budget_cloud_last_error';
  const CLOUD_LAST_ERROR_TIME_KEY = 'budget_cloud_last_error_time';
  const CLOUD_LAST_ERROR_CODE_KEY = 'budget_cloud_last_error_code';

  beforeEach(() => {
    configured = true;
    localStorage.clear();
    vi.clearAllMocks();
    cloudSyncUI._lastError = null;
    cloudSyncUI._isDirty = false;
    document.body.innerHTML = `
      <div id="cloudSyncActionsHeader">
        <span id="syncStatusDot" class="sync-status-dot"></span>
        <span id="lastSyncedTime"></span>
      </div>
    `;
  });

  describe('error state tracking', () => {
    it('saves error state to localStorage on push failure', () => {
      const errorMsg = 'Network error during push';
      cloudSyncUI._saveErrorState(errorMsg, 'PUSH_ERROR');

      expect(localStorage.getItem(CLOUD_LAST_ERROR_KEY)).toBe(errorMsg);
      expect(localStorage.getItem(CLOUD_LAST_ERROR_TIME_KEY)).toBeTruthy();
      expect(localStorage.getItem(CLOUD_LAST_ERROR_CODE_KEY)).toBe('PUSH_ERROR');
    });

    it('loads error state from localStorage on initialization', () => {
      const errorMsg = 'Previous error';
      const now = Date.now();
      localStorage.setItem(CLOUD_LAST_ERROR_KEY, errorMsg);
      localStorage.setItem(CLOUD_LAST_ERROR_TIME_KEY, String(now));
      localStorage.setItem(CLOUD_LAST_ERROR_CODE_KEY, 'PULL_ERROR');

      cloudSyncUI._loadErrorState();

      expect(cloudSyncUI._lastError).not.toBeNull();
      expect(cloudSyncUI._lastError.message).toBe(errorMsg);
      expect(cloudSyncUI._lastError.code).toBe('PULL_ERROR');
      expect(cloudSyncUI._lastError.timestamp).toBe(now);
    });

    it('clears error state after successful push', () => {
      cloudSyncUI._saveErrorState('temp error');
      expect(localStorage.getItem(CLOUD_LAST_ERROR_KEY)).toBe('temp error');

      cloudSyncUI._clearErrorState();

      expect(localStorage.getItem(CLOUD_LAST_ERROR_KEY)).toBeNull();
      expect(localStorage.getItem(CLOUD_LAST_ERROR_TIME_KEY)).toBeNull();
      expect(localStorage.getItem(CLOUD_LAST_ERROR_CODE_KEY)).toBeNull();
      expect(cloudSyncUI._lastError).toBeNull();
    });

    it('returns nothing from _loadErrorState when no error exists', () => {
      const result = cloudSyncUI._loadErrorState();
      expect(result).toBeUndefined();
      expect(cloudSyncUI._lastError).toBeNull();
    });

    it('error state survives page reload through localStorage', () => {
      cloudSyncUI._saveErrorState('Persistent error');
      const saved = localStorage.getItem(CLOUD_LAST_ERROR_KEY);
      
      cloudSyncUI._lastError = null;
      cloudSyncUI._loadErrorState();
      
      expect(cloudSyncUI._lastError.message).toBe(saved);
    });
  });

  describe('visual error indicator', () => {
    it('shows red status dot when error state exists', () => {
      cloudSyncUI._saveErrorState('Sync failed');
      
      const dot = document.getElementById('syncStatusDot');
      expect(dot.style.background).toMatch(/ef4444|rgb\(239,\s*68,\s*68\)/);
    });

    it('prioritizes error state over dirty state in status indicator', () => {
      cloudSyncUI._saveErrorState('Recent error');
      cloudSyncUI._isDirty = true;
      cloudSyncUI._updateStatusIndicator();

      const dot = document.getElementById('syncStatusDot');
      expect(dot.style.background).toMatch(/ef4444|rgb\(239,\s*68,\s*68\)/);
    });

    it('shows yellow dirty indicator when no error exists', () => {
      cloudSyncUI._lastError = null;
      cloudSyncUI._isDirty = true;
      cloudSyncUI._updateStatusIndicator();

      const dot = document.getElementById('syncStatusDot');
      expect(dot.style.background).toMatch(/eab308|rgb\(234,\s*179,\s*8\)/);
    });

    it('shows green synced indicator when no error or dirty state', () => {
      cloudSyncUI._lastError = null;
      cloudSyncUI._isDirty = false;
      cloudSyncUI._updateStatusIndicator();

      const dot = document.getElementById('syncStatusDot');
      expect(dot.style.background).toMatch(/22c55e|rgb\(34,\s*197,\s*94\)/);
    });

    it('status indicator has error message in title attribute', () => {
      const errorMsg = 'Failed to connect';
      cloudSyncUI._saveErrorState(errorMsg);

      const dot = document.getElementById('syncStatusDot');
      expect(dot.getAttribute('title')).toContain(errorMsg);
    });
  });

  describe('notification integration', () => {
    it('shows push error notification with retry and export fallback actions', () => {
      const retryAction = vi.fn();

      cloudSyncUI._showPushErrorNotification('Push failed', retryAction);

      expect(notificationUI.error).toHaveBeenCalledWith(
        'Push failed',
        expect.arrayContaining([
          expect.objectContaining({ label: '💾 Export Backup' }),
          expect.objectContaining({ label: '↻ Retry', onClick: retryAction }),
        ])
      );
    });

    it('emits success notification after successful push helper run', async () => {
      const refreshSpy = vi.spyOn(cloudSyncUI, '_refreshSection').mockResolvedValue(undefined);
      vi.mocked(supabaseSync.pushSnapshot).mockResolvedValue(undefined);

      const err = await cloudSyncUI._executePushSync();

      expect(err).toBeNull();
      expect(notificationUI.success).toHaveBeenCalledWith('Budget synced to cloud', [], 2000);
      refreshSpy.mockRestore();
    });

    it('clears persisted error state after successful sync helper run', async () => {
      const refreshSpy = vi.spyOn(cloudSyncUI, '_refreshSection').mockResolvedValue(undefined);
      vi.mocked(supabaseSync.pushSnapshot).mockResolvedValue(undefined);
      cloudSyncUI._saveErrorState('temp error', 'PUSH_ERROR');

      await cloudSyncUI._executePushSync();

      expect(localStorage.getItem(CLOUD_LAST_ERROR_KEY)).toBeNull();
      expect(localStorage.getItem(CLOUD_LAST_ERROR_CODE_KEY)).toBeNull();
      refreshSpy.mockRestore();
    });
  });
});

