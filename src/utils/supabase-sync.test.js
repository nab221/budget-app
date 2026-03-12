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
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

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

  it('returns true when runtime config exists and env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
    const { saveRuntimeConfig, isConfigured } = await import('./supabase-sync.js');
    saveRuntimeConfig('https://runtime.supabase.co', 'runtime-key');
    expect(isConfigured()).toBe(true);
  });
});

describe('runtime config', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('persists and reads runtime config', async () => {
    const { saveRuntimeConfig, getRuntimeConfig, getConfigSource } = await import('./supabase-sync.js');
    saveRuntimeConfig('https://runtime.supabase.co', 'runtime-key');
    expect(getRuntimeConfig()).toEqual({
      url: 'https://runtime.supabase.co',
      anonKey: 'runtime-key',
      isConfigured: true,
    });
    expect(getConfigSource()).toBe('runtime');
  });

  it('clears runtime config', async () => {
    const { saveRuntimeConfig, clearRuntimeConfig, getRuntimeConfig, isConfigured } = await import('./supabase-sync.js');
    saveRuntimeConfig('https://runtime.supabase.co', 'runtime-key');
    clearRuntimeConfig();
    expect(getRuntimeConfig()).toEqual({ url: '', anonKey: '', isConfigured: false });
    expect(isConfigured()).toBe(false);
  });

  it('rejects invalid or incomplete runtime config without persisting values', async () => {
    const {
      saveRuntimeConfig,
      getRuntimeConfig,
      clearRuntimeConfig,
      isConfigured,
      _validateConfig,
    } = await import('./supabase-sync.js');

    expect(() => _validateConfig('http://runtime.supabase.co', 'runtime-key')).toThrow('Supabase URL must use https');
    expect(() => _validateConfig('', 'runtime-key')).toThrow('Both Supabase URL and anon key are required');
    expect(() => _validateConfig('https://runtime.supabase.co', '')).toThrow('Both Supabase URL and anon key are required');
    expect(() => saveRuntimeConfig('http://runtime.supabase.co', 'runtime-key')).toThrow('Supabase URL must use https');
    expect(() => saveRuntimeConfig('', 'runtime-key')).toThrow('Both Supabase URL and anon key are required');
    expect(() => saveRuntimeConfig('https://runtime.supabase.co', '')).toThrow('Both Supabase URL and anon key are required');

    expect(getRuntimeConfig()).toEqual({ url: '', anonKey: '', isConfigured: false });
    expect(isConfigured()).toBe(false);

    clearRuntimeConfig();
    expect(getRuntimeConfig()).toEqual({ url: '', anonKey: '', isConfigured: false });
  });

  it('handles malformed runtime config in localStorage gracefully', async () => {
    const {
      _readRuntimeConfig,
      getRuntimeConfig,
      clearRuntimeConfig,
      isConfigured,
    } = await import('./supabase-sync.js');

    localStorage.setItem('budget_cloud_runtime_config', '{bad json');

    expect(() => _readRuntimeConfig()).not.toThrow();
    expect(_readRuntimeConfig()).toEqual({ url: '', anonKey: '' });
    expect(getRuntimeConfig()).toEqual({ url: '', anonKey: '', isConfigured: false });
    expect(isConfigured()).toBe(false);

    clearRuntimeConfig();
    expect(getRuntimeConfig()).toEqual({ url: '', anonKey: '', isConfigured: false });
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

describe('getLatestSnapshotMeta', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns latest snapshot metadata when a row exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockMaybeSingle.mockResolvedValue({
      data: { updated_at: '2026-03-10T10:00:00Z', schema_version: 18 },
      error: null,
    });

    const { getLatestSnapshotMeta } = await import('./supabase-sync.js');
    const result = await getLatestSnapshotMeta();

    expect(result).toEqual({ updated_at: '2026-03-10T10:00:00Z', schema_version: 18 });
  });

  it('returns null when no snapshot exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { getLatestSnapshotMeta } = await import('./supabase-sync.js');
    const result = await getLatestSnapshotMeta();

    expect(result).toBeNull();
  });

  it('throws when supabase returns an error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: new Error('Meta fetch failed') });

    const { getLatestSnapshotMeta } = await import('./supabase-sync.js');
    await expect(getLatestSnapshotMeta()).rejects.toThrow('Meta fetch failed');
  });
});
