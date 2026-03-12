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
