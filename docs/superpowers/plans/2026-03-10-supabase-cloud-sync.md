# Supabase Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Supabase-backed cloud sync to the budget app — one snapshot row per user, push/pull with confirmation — behind an env-var feature flag that degrades gracefully when unconfigured.

**Architecture:** A pure utility module (`supabase-sync.js`) provides all Supabase interactions as stateless functions; auth state and rendering are owned by a dedicated UI module (`cloud-sync.js`). The pull flow dispatches a preview event first so the user sees a data summary before any overwrite. The feature is invisible when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are absent.

**Tech Stack:** `@supabase/supabase-js` v2, Dexie 4 (existing), Vitest (existing), Vite `import.meta.env`

---

## Supabase SQL Setup (run once in Supabase dashboard)

Before executing this plan, create the `budget_snapshots` table and RLS policy in your Supabase project's SQL editor:

```sql
create table budget_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  updated_at timestamptz not null default now(),
  schema_version integer not null,
  payload text not null,
  unique(user_id)
);

alter table budget_snapshots enable row level security;

create policy "Users can only access their own snapshots"
  on budget_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

The `unique(user_id)` constraint is required for the upsert `onConflict: 'user_id'` in `pushSnapshot()`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `package.json` | Remove `@azure/msal-browser`, add `@supabase/supabase-js` |
| Create | `.env.example` | Document required env vars with explanation |
| Create | `src/utils/supabase-sync.js` | Pure sync module: client init, `isConfigured`, `getSession`, `signIn`, `pushSnapshot`, `pullSnapshot` |
| Create | `src/utils/supabase-sync.test.js` | Unit tests for the sync module |
| Create | `src/ui/cloud-sync.js` | UI module: renders Cloud Sync section, owns auth state, handles preview event |
| Modify | `index.html` | Add `#cloudSyncSection` div in Settings tab (hidden by default) |
| Modify | `src/app.js` | Import and init `cloudSyncUI` |

---

## Chunk 1: Dependency Cleanup & Environment

### Task 1: Remove MSAL, install Supabase, add .env.example

**Files:**
- Modify: `package.json`
- Create: `.env.example`

- [ ] **Step 1: Remove @azure/msal-browser and install @supabase/supabase-js**

```bash
npm uninstall @azure/msal-browser
npm install @supabase/supabase-js
```

Expected: `package.json` `dependencies` no longer contains `@azure/msal-browser`; it now contains `"@supabase/supabase-js": "^2.x.x"`. No build errors.

- [ ] **Step 2: Verify removal did not break any imports**

```bash
grep -r "msal" src/ --include="*.js"
```

Expected: no output. If any file imports from `@azure/msal-browser`, remove or update it before continuing.

- [ ] **Step 3: Create .env.example**

Create file `.env.example` at repo root:

```dotenv
# Supabase Cloud Sync (optional)
#
# These two values are safe to commit — the Supabase anon key is a public-facing
# credential. Access control is enforced server-side by Row Level Security (RLS),
# not by keeping the key secret.
#
# To enable cloud sync:
# 1. Create a Supabase project at https://supabase.com
# 2. Copy your project URL and anon key from Settings > API
# 3. Create a .env.local file (already git-ignored via *.local) with real values
# 4. Run the SQL from docs/superpowers/plans/2026-03-10-supabase-cloud-sync.md
#    to create the budget_snapshots table and RLS policy
#
# If these vars are absent or empty, the Cloud Sync UI is hidden entirely.
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: swap @azure/msal-browser for @supabase/supabase-js, add .env.example"
```

---

## Chunk 2: supabase-sync.js — Pure Sync Module

### Task 2: Write failing tests for isConfigured() and getSession()

**Files:**
- Create: `src/utils/supabase-sync.test.js`

- [ ] **Step 1: Create the test file**

Create `src/utils/supabase-sync.test.js`:

```javascript
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// vi.mock() is hoisted to run before all imports by Vitest's transform.
// Mock fn declarations MUST use vi.hoisted() so they are also hoisted and
// available when the factory runs — plain const declarations at module scope
// are NOT hoisted and would be undefined inside the factory.
const {
  mockSignInWithOtp,
  mockGetSession,
  mockSignOut,
  mockOnAuthStateChange,
  mockUpsert,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockSignInWithOtp: vi.fn(),
  mockGetSession: vi.fn(),
  mockSignOut: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockUpsert: vi.fn(),
  mockMaybeSingle: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      getSession: mockGetSession,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: vi.fn(() => ({
      upsert: mockUpsert,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: mockMaybeSingle,
            })),
          })),
        })),
      })),
    })),
  })),
}));

// Mock the db module
vi.mock('../db/schema.js', () => ({
  db: {
    tables: [
      { name: 'income', toArray: vi.fn().mockResolvedValue([{ id: 1, source: 'Salary' }]) },
      { name: 'debts', toArray: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]) },
    ],
    verno: 18,
  },
}));

describe('isConfigured', () => {
  it('returns true when both env vars are present', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules();
    const { isConfigured } = await import('./supabase-sync.js');
    expect(isConfigured()).toBe(true);
  });

  it('returns false when URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules();
    const { isConfigured } = await import('./supabase-sync.js');
    expect(isConfigured()).toBe(false);
  });

  it('returns false when anon key is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { isConfigured } = await import('./supabase-sync.js');
    expect(isConfigured()).toBe(false);
  });

  it('returns false when both env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { isConfigured } = await import('./supabase-sync.js');
    expect(isConfigured()).toBe(false);
  });
});

describe('getSession', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns the session from supabase.auth.getSession', async () => {
    const fakeSession = { user: { id: 'user-123', email: 'test@example.com' } };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    const { getSession } = await import('./supabase-sync.js');
    const result = await getSession();
    expect(result).toEqual(fakeSession);
  });

  it('returns null when there is no active session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { getSession } = await import('./supabase-sync.js');
    const result = await getSession();
    expect(result).toBeNull();
  });
});

describe('signIn', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('calls signInWithOtp with the provided email', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    const { signIn } = await import('./supabase-sync.js');
    await signIn('user@example.com');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'user@example.com' });
  });

  it('throws when supabase returns an error', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: new Error('Auth failed') });
    const { signIn } = await import('./supabase-sync.js');
    await expect(signIn('bad@example.com')).rejects.toThrow('Auth failed');
  });
});

describe('pushSnapshot', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('throws when not signed in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { pushSnapshot } = await import('./supabase-sync.js');
    await expect(pushSnapshot()).rejects.toThrow('Not signed in');
  });

  it('upserts with user_id, schema_version, updated_at, and payload', async () => {
    const fakeSession = { user: { id: 'user-abc' } };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    mockUpsert.mockResolvedValue({ error: null });

    const { pushSnapshot } = await import('./supabase-sync.js');
    await pushSnapshot();

    expect(mockUpsert).toHaveBeenCalledOnce();
    const [row, options] = mockUpsert.mock.calls[0];
    expect(row.user_id).toBe('user-abc');
    expect(row.schema_version).toBe(18);
    expect(typeof row.payload).toBe('string');
    expect(typeof row.updated_at).toBe('string');
    expect(options).toEqual({ onConflict: 'user_id' });
  });

  it('payload contains all table data as JSON', async () => {
    const fakeSession = { user: { id: 'user-abc' } };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    mockUpsert.mockResolvedValue({ error: null });

    const { pushSnapshot } = await import('./supabase-sync.js');
    await pushSnapshot();

    const [row] = mockUpsert.mock.calls[0];
    const parsed = JSON.parse(row.payload);
    expect(parsed).toHaveProperty('income');
    expect(parsed).toHaveProperty('debts');
    expect(parsed.income).toHaveLength(1);
    expect(parsed.debts).toHaveLength(2);
  });

  it('writes budget_cloud_last_sync to localStorage on success', async () => {
    const fakeSession = { user: { id: 'user-abc' } };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    mockUpsert.mockResolvedValue({ error: null });

    const { pushSnapshot, CLOUD_LAST_SYNC_KEY } = await import('./supabase-sync.js');
    const before = Date.now();
    await pushSnapshot();
    const after = Date.now();

    const stored = parseInt(localStorage.getItem(CLOUD_LAST_SYNC_KEY));
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(after);
  });

  it('throws when supabase upsert returns an error', async () => {
    const fakeSession = { user: { id: 'user-abc' } };
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    mockUpsert.mockResolvedValue({ error: new Error('DB error') });

    const { pushSnapshot } = await import('./supabase-sync.js');
    await expect(pushSnapshot()).rejects.toThrow('DB error');
  });
});

describe('pullSnapshot', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('throws when not signed in', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { pullSnapshot } = await import('./supabase-sync.js');
    await expect(pullSnapshot()).rejects.toThrow('Not signed in');
  });

  it('throws when no snapshot found', async () => {
    // .maybeSingle() returns { data: null, error: null } when no row exists
    // (unlike .single() which returns a PGRST116 error — reason we use .maybeSingle())
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const { pullSnapshot } = await import('./supabase-sync.js');
    await expect(pullSnapshot()).rejects.toThrow('No cloud snapshot found');
  });

  it('dispatches budget:import-cloud-preview with correct metadata', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    const tableData = { income: [{ id: 1 }, { id: 2 }], debts: [{ id: 1 }] };
    mockMaybeSingle.mockResolvedValue({
      data: {
        updated_at: '2026-03-09T12:00:00Z',
        schema_version: 18,
        payload: JSON.stringify(tableData),
      },
      error: null,
    });

    const { pullSnapshot } = await import('./supabase-sync.js');

    const events = [];
    window.addEventListener('budget:import-cloud-preview', (e) => events.push(e.detail));

    await pullSnapshot();

    expect(events).toHaveLength(1);
    expect(events[0].updated_at).toBe('2026-03-09T12:00:00Z');
    expect(events[0].schema_version).toBe(18);
    expect(events[0].counts).toEqual({ income: 2, debts: 1 });
    expect(events[0].tableData).toEqual(tableData);
  });

  it('throws when supabase returns an error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('Fetch failed') });
    const { pullSnapshot } = await import('./supabase-sync.js');
    await expect(pullSnapshot()).rejects.toThrow('Fetch failed');
  });
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
npx vitest run src/utils/supabase-sync.test.js
```

Expected: all tests fail with "Cannot find module './supabase-sync.js'" or similar. If tests pass at this point, something is wrong — do not proceed.

---

### Task 3: Implement supabase-sync.js

**Files:**
- Create: `src/utils/supabase-sync.js`

- [ ] **Step 1: Create the module**

Create `src/utils/supabase-sync.js`:

```javascript
import { createClient } from '@supabase/supabase-js';
import { db } from '../db/schema.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const CLOUD_LAST_SYNC_KEY = 'budget_cloud_last_sync';

/**
 * Returns true only when both Supabase env vars are present and non-empty.
 * When false, all cloud sync UI is hidden and no Supabase calls are made.
 */
export function isConfigured() {
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/**
 * Supabase client. Null when not configured — callers must guard with isConfigured().
 */
export const supabase = isConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Returns the current Supabase session, or null if not signed in.
 */
export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * Sends a magic link to the given email address.
 * Throws on error.
 * @param {string} email
 */
export async function signIn(email) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

/**
 * Reads all Dexie tables and upserts a single snapshot row to budget_snapshots.
 * One row per user — subsequent pushes overwrite the previous snapshot.
 * Stores the current DB schema version alongside the payload for forward-compat checks on pull.
 * Writes budget_cloud_last_sync to localStorage on success.
 * Throws when not signed in or on Supabase error.
 */
export async function pushSnapshot() {
  if (!supabase) throw new Error('Supabase not configured');

  const session = await getSession();
  if (!session) throw new Error('Not signed in');

  const tableData = Object.fromEntries(
    await Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()]))
  );

  const { error } = await supabase
    .from('budget_snapshots')
    .upsert(
      {
        user_id: session.user.id,
        updated_at: new Date().toISOString(),
        schema_version: db.verno,
        payload: JSON.stringify(tableData),
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;

  localStorage.setItem(CLOUD_LAST_SYNC_KEY, String(Date.now()));
}

/**
 * Fetches the latest snapshot for the current user and dispatches
 * 'budget:import-cloud-preview' with metadata and table data.
 * The UI listens for that event, shows a confirmation dialog,
 * and only calls importBackupData() after explicit user approval.
 * Throws when not signed in, no snapshot found, or on Supabase error.
 */
export async function pullSnapshot() {
  if (!supabase) throw new Error('Supabase not configured');

  const session = await getSession();
  if (!session) throw new Error('Not signed in');

  // .maybeSingle() returns { data: null, error: null } when no row exists.
  // .single() would return a PGRST116 error for the same case, making the
  // "no snapshot" path indistinguishable from a real DB error.
  const { data, error } = await supabase
    .from('budget_snapshots')
    .select('*')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('No cloud snapshot found');

  const tableData = JSON.parse(data.payload);

  const counts = Object.fromEntries(
    Object.entries(tableData).map(([table, rows]) => [table, rows.length])
  );

  window.dispatchEvent(
    new CustomEvent('budget:import-cloud-preview', {
      detail: {
        updated_at: data.updated_at,
        schema_version: data.schema_version,
        counts,
        tableData,
      },
    })
  );
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run src/utils/supabase-sync.test.js
```

Expected: all tests pass. If any fail, fix the implementation before continuing. Do not skip failing tests.

- [ ] **Step 3: Commit**

```bash
git add src/utils/supabase-sync.js src/utils/supabase-sync.test.js
git commit -m "feat(cloud-sync): add supabase-sync utility module with push/pull/auth"
```

---

## Chunk 3: UI Module, HTML, and App Wiring

### Task 4: Create cloud-sync.js UI module

**Files:**
- Create: `src/ui/cloud-sync.js`

No unit tests for this module — it manipulates DOM and depends on Supabase auth state. Covered by manual integration testing described at the end.

- [ ] **Step 1: Create the UI module**

Create `src/ui/cloud-sync.js`:

```javascript
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

export const cloudSyncUI = {
  /**
   * Initialise cloud sync UI. No-ops silently if Supabase is not configured,
   * keeping the section hidden and the app fully functional.
   */
  async init() {
    if (!isConfigured()) return;

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
    const statusEl = section.querySelector('#cloudSyncStatus');
    const actionsEl = section.querySelector('#cloudSyncActions');
    if (!statusEl || !actionsEl) return;

    if (session) {
      this._renderSignedIn(session, statusEl, actionsEl);
    } else {
      this._renderSignedOut(statusEl, actionsEl);
    }
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

    document.getElementById('cloudSignOutBtn')?.addEventListener('click', async () => {
      await supabase.auth.signOut();
      triggerHaptic('tap');
    });

    document.getElementById('cloudPushBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('cloudPushBtn');
      try {
        btn.textContent = 'Pushing...';
        btn.disabled = true;
        await pushSnapshot();
        triggerHaptic('success');
        await this._refreshSection();
      } catch (err) {
        console.error('[cloudSyncUI] Push failed:', err);
        alertWithHaptic('Push failed: ' + err.message);
        btn.textContent = 'Push to Cloud';
        btn.disabled = false;
      }
    });

    document.getElementById('cloudPullBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('cloudPullBtn');
      try {
        btn.textContent = 'Fetching...';
        btn.disabled = true;
        await pullSnapshot();
        // Event dispatched by pullSnapshot(); UI takes over from the preview listener.
      } catch (err) {
        console.error('[cloudSyncUI] Pull failed:', err);
        alertWithHaptic('Pull failed: ' + err.message);
      } finally {
        btn.textContent = 'Pull from Cloud';
        btn.disabled = false;
      }
    });
  },

  _renderSignedOut(statusEl, actionsEl) {
    statusEl.innerHTML = '';
    actionsEl.innerHTML = `
      <div class="form-row" style="margin-bottom:8px">
        <div>
          <label for="cloudSyncEmail">Email</label>
          <input type="email" id="cloudSyncEmail" placeholder="your@email.com" style="font-size:.85rem"/>
        </div>
        <div style="display:flex;align-items:flex-end">
          <button id="cloudMagicLinkBtn" class="primary">Send Magic Link</button>
        </div>
      </div>
      <div class="hint">A sign-in link will be emailed to you. No password required.</div>
    `;

    document.getElementById('cloudMagicLinkBtn')?.addEventListener('click', async () => {
      const email = document.getElementById('cloudSyncEmail')?.value?.trim();
      if (!email) {
        alertWithHaptic('Please enter your email address.');
        return;
      }
      const btn = document.getElementById('cloudMagicLinkBtn');
      try {
        btn.textContent = 'Sending...';
        btn.disabled = true;
        await signIn(email);
        btn.textContent = 'Link Sent!';
        alertWithHaptic('Check your email for a sign-in link.', 'success');
      } catch (err) {
        console.error('[cloudSyncUI] Sign-in failed:', err);
        alertWithHaptic('Sign-in failed: ' + err.message);
        btn.textContent = 'Send Magic Link';
        btn.disabled = false;
      }
    });
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

      const countLines = Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([t, n]) => `${n} ${t}`)
        .join(' · ');

      const body = `
        <p>Cloud snapshot from <strong>${date}</strong></p>
        <p style="margin-top:6px;color:var(--text-soft);font-size:.85rem">${countLines || 'No data'}</p>
        ${versionWarning}
        <p style="margin-top:12px"><strong>Replace local data?</strong> This cannot be undone.</p>
      `;

      const footer = `
        <button class="ghost" onclick="window.templateUI.closeModal()">Cancel</button>
        <button class="danger" id="confirmCloudImportBtn">Replace Local Data</button>
      `;

      templateUI.showModal('Cloud Snapshot Preview', body, footer);

      document.getElementById('confirmCloudImportBtn')?.addEventListener('click', async () => {
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
        }
      });
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/cloud-sync.js
git commit -m "feat(cloud-sync): add cloudSyncUI module with auth, push, pull confirmation"
```

---

### Task 5: Add HTML section and wire into app.js

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`

- [ ] **Step 1: Add the Cloud Sync section to index.html**

In `index.html`, find the `#offline-ready-status` paragraph (inside the Install App section) and the closing `</div>` that follows it. Insert the Cloud Sync `<div>` after that closing div, before the `</div>` that closes the settings panel:

Find (unique anchor — the offline-ready status paragraph and its enclosing close):
```html
              <p id="offline-ready-status" class="hint hidden" style="color:var(--success);margin-top:8px">
                Ready for Offline — all assets are cached.
              </p>
            </div>

          </div>
```

Replace with:
```html
              <p id="offline-ready-status" class="hint hidden" style="color:var(--success);margin-top:8px">
                Ready for Offline — all assets are cached.
              </p>
            </div>

            <!-- Cloud Sync (hidden until Supabase env vars are configured) -->
            <div id="cloudSyncSection" class="hidden" style="margin-top:20px; padding-top:20px; border-top:1px solid var(--border)">
              <h3 style="font-size:.9rem;margin-bottom:4px">&#9729; Cloud Sync</h3>
              <div class="hint" style="margin-bottom:10px">Sync your budget to the cloud. Sign in with a magic link — no password required.</div>
              <div id="cloudSyncStatus"></div>
              <div id="cloudSyncActions"></div>
            </div>

          </div>
```

- [ ] **Step 2: Wire cloudSyncUI into app.js**

In `src/app.js`, add the import after the existing `backupUI` import:

Find:
```javascript
import { backupUI } from './ui/backup.js';
```

Replace with:
```javascript
import { backupUI } from './ui/backup.js';
import { cloudSyncUI } from './ui/cloud-sync.js';
```

In the same file, in the parallel module initialization block (the `await Promise.all([...])` near line 220), add `cloudSyncUI.init()` alongside `backupUI.init()`:

Find:
```javascript
    backupUI.init(),
    initDashboard()
```

Replace with:
```javascript
    backupUI.init(),
    cloudSyncUI.init(),
    initDashboard()
```

- [ ] **Step 3: Verify the app builds without errors**

```bash
npm run build
```

Expected: build completes without errors. If there are TypeScript or import errors, fix them before committing.

- [ ] **Step 4: Run the full test suite**

```bash
npx vitest run
```

Expected: all existing tests pass plus the new `supabase-sync.test.js` tests. Zero failures.

- [ ] **Step 5: Commit**

```bash
git add index.html src/app.js
git commit -m "feat(cloud-sync): add Cloud Sync section to Settings tab, wire cloudSyncUI into app init"
```

---

## Manual Integration Checklist

After all tasks are complete, verify the following manually in the browser. These cannot be unit-tested without a live Supabase project.

**Without env vars (default):**
- [ ] Open Settings tab — Cloud Sync section is not visible
- [ ] No console errors related to Supabase

**With env vars set (requires a configured Supabase project):**

Set up `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then:
- [ ] Open Settings tab — Cloud Sync section is visible with email input
- [ ] Enter email, click "Send Magic Link" — button shows "Sending..." then "Link Sent!"
- [ ] Click the link in email — page reloads, section now shows signed-in state with email address
- [ ] Click "Push to Cloud" — button shows "Pushing...", then reverts; last-sync timestamp updates
- [ ] Click "Pull from Cloud" — modal appears with snapshot date, record counts, and "Replace Local Data" button
- [ ] Click Cancel in modal — nothing changes
- [ ] Click "Replace Local Data" — data imports, page reloads
- [ ] Test with cloud snapshot from a hypothetical newer schema: `schema_version` set to 99 should show red warning in modal
- [ ] Click "Sign Out" — section returns to signed-out state
