// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

let configured = true;

vi.mock('../utils/supabase-sync.js', () => ({
  isConfigured: () => configured,
  supabase: {
    auth: {
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  },
  getSession: vi.fn(),
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

import { cloudSyncUI } from './cloud-sync.js';
import * as supabaseSync from '../utils/supabase-sync.js';

describe('cloud-sync header actions (Phase 23)', () => {
  beforeEach(() => {
    configured = true;
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

  it('restores local import/export and hides cloud header when cloud is not configured', () => {
    configured = false;
    cloudSyncUI._renderHeaderActions(null);

    expect(document.getElementById('cloudSyncActionsHeader').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('cloudSyncActionsHeader').innerHTML).toBe('');
    expect(document.getElementById('exportBtn').classList.contains('hidden')).toBe(false);
    expect(document.querySelector('label[for="importFile"]').classList.contains('hidden')).toBe(false);
  });
});

describe('cloud-sync intelligent sync logic (Phase 24)', () => {
  beforeEach(() => {
    configured = true;
    localStorage.clear();
    vi.clearAllMocks();

    cloudSyncUI._initialized = false;
    cloudSyncUI._isDirty = false;
    cloudSyncUI._syncInProgress = false;
    cloudSyncUI._mutationsDuringSync = false;
    cloudSyncUI._didAutoPullCheckOnLoad = false;
    cloudSyncUI._lastAutoPullSessionUserId = null;
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
    supabaseSync.supabase.auth.onAuthStateChange.mockImplementation((cb) => {
      authCallback = cb;
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
