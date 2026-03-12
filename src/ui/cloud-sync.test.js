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
