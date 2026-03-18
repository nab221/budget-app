import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// vi.mock() is hoisted to run before all imports by Vitest's transform.
// Mock fn declarations MUST use vi.hoisted() so they are also hoisted and
// available when the factory runs — plain const declarations at module scope
// are NOT hoisted and would be undefined inside the factory.
const {
  mockSignInWithOtp,
  mockSignInWithOAuth,
  mockGetSession,
  mockSignOut,
  mockOnAuthStateChange,
  mockUpsert,
  mockMaybeSingle,
} = vi.hoisted(() => ({
  mockSignInWithOtp: vi.fn(),
  mockSignInWithOAuth: vi.fn(),
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
      signInWithOAuth: mockSignInWithOAuth,
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

  it('calls signInWithOtp with email and window.location.origin when VITE_SUPABASE_REDIRECT_URL is not set', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    const { signIn } = await import('./supabase-sync.js');
    await signIn('user@example.com');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
  });

  it('calls signInWithOtp with VITE_SUPABASE_REDIRECT_URL when env var is set', async () => {
    vi.stubEnv('VITE_SUPABASE_REDIRECT_URL', 'https://my-pwa.example.com');
    vi.resetModules();
    mockSignInWithOtp.mockResolvedValue({ error: null });
    const { signIn } = await import('./supabase-sync.js');
    await signIn('user@example.com');
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: {
        emailRedirectTo: 'https://my-pwa.example.com',
      },
    });
  });

  it('throws when supabase returns an error', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: new Error('Auth failed') });
    const { signIn } = await import('./supabase-sync.js');
    await expect(signIn('bad@example.com')).rejects.toThrow('Auth failed');
  });
});

describe('signInWithGoogle', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('calls signInWithOAuth with google provider and runtime redirect URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    const { signInWithGoogle } = await import('./supabase-sync.js');
    await signInWithGoogle();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/',
      },
    });
  });

  it('throws when supabase OAuth sign-in fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: new Error('Google auth failed') });
    const { signInWithGoogle } = await import('./supabase-sync.js');
    await expect(signInWithGoogle()).rejects.toThrow('Google auth failed');
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

describe('TECH-06: affordability data included in generic db.tables snapshot (Phase 34)', () => {
  // Regression test: verifies that the generic db.tables.map() path in pushSnapshot()
  // includes affordability-specific tables (userPreferences) automatically, without any
  // allowlist modification. This matches the Phase 33 pattern for incomeSources/spendingBuckets.
  //
  // The mock simulates a db.tables array that includes userPreferences (schema v22).
  // If the generic path works correctly, userPreferences must appear in the snapshot payload.

  const {
    mockUpsertTECH06,
    mockGetSessionTECH06,
  } = vi.hoisted(() => ({
    mockUpsertTECH06: vi.fn(),
    mockGetSessionTECH06: vi.fn(),
  }));

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://tech06.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'tech06-anon-key');
    vi.resetModules();

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        auth: {
          getSession: mockGetSessionTECH06,
          onAuthStateChange: vi.fn(),
          signInWithOtp: vi.fn(),
          signInWithOAuth: vi.fn(),
          signOut: vi.fn(),
        },
        from: vi.fn(() => ({
          upsert: mockUpsertTECH06,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          })),
        })),
      })),
    }));

    // Override db mock to include userPreferences table (schema v22 simulation)
    vi.doMock('../db/schema.js', () => ({
      db: {
        tables: [
          { name: 'income', toArray: vi.fn().mockResolvedValue([]) },
          { name: 'userPreferences', toArray: vi.fn().mockResolvedValue([{ key: 'safetyBuffer', value: 20000 }]) },
          { name: 'incomeSources', toArray: vi.fn().mockResolvedValue([]) },
          { name: 'spendingBuckets', toArray: vi.fn().mockResolvedValue([]) },
        ],
        verno: 22,
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it('includes userPreferences table in cloud snapshot payload via generic db.tables path', async () => {
    mockGetSessionTECH06.mockResolvedValue({ data: { session: { user: { id: 'u-tech06' } } } });
    mockUpsertTECH06.mockResolvedValue({ error: null });

    const { pushSnapshot } = await import('./supabase-sync.js');
    await pushSnapshot();

    expect(mockUpsertTECH06).toHaveBeenCalledOnce();
    const [row] = mockUpsertTECH06.mock.calls[0];
    const parsed = JSON.parse(row.payload);

    // userPreferences must be in the payload — TECH-06 requirement
    expect(parsed).toHaveProperty('userPreferences');
    expect(parsed.userPreferences).toHaveLength(1);
    expect(parsed.userPreferences[0]).toMatchObject({ key: 'safetyBuffer', value: 20000 });
    expect(row.schema_version).toBe(22);
  });

  it('includes incomeSources and spendingBuckets (Phase 33 stores) in the same generic path', async () => {
    mockGetSessionTECH06.mockResolvedValue({ data: { session: { user: { id: 'u-tech06' } } } });
    mockUpsertTECH06.mockResolvedValue({ error: null });

    const { pushSnapshot } = await import('./supabase-sync.js');
    await pushSnapshot();

    const [row] = mockUpsertTECH06.mock.calls[0];
    const parsed = JSON.parse(row.payload);

    // Phase 33 stores also covered — regression guard
    expect(parsed).toHaveProperty('incomeSources');
    expect(parsed).toHaveProperty('spendingBuckets');
  });
});

describe('TECH-06: childcareProviders included in generic db.tables snapshot (Phase 35)', () => {
  // Regression test: verifies that the generic db.tables.map() path in pushSnapshot()
  // includes childcareProviders automatically, without any allowlist modification.
  // This is TECH-06 compliance for Phase 35 — same pattern as Phase 33 and Phase 34.
  // No explicit store registration is needed or added.

  const {
    mockUpsertTECH06P35,
    mockGetSessionTECH06P35,
  } = vi.hoisted(() => ({
    mockUpsertTECH06P35: vi.fn(),
    mockGetSessionTECH06P35: vi.fn(),
  }));

  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://tech06p35.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'tech06p35-anon-key');
    vi.resetModules();

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => ({
        auth: {
          getSession: mockGetSessionTECH06P35,
          onAuthStateChange: vi.fn(),
          signInWithOtp: vi.fn(),
          signInWithOAuth: vi.fn(),
          signOut: vi.fn(),
        },
        from: vi.fn(() => ({
          upsert: mockUpsertTECH06P35,
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          })),
        })),
      })),
    }));

    // Override db mock to include childcareProviders table (schema v23 simulation)
    vi.doMock('../db/schema.js', () => ({
      db: {
        tables: [
          { name: 'income', toArray: vi.fn().mockResolvedValue([]) },
          { name: 'childcareAccounts', toArray: vi.fn().mockResolvedValue([{ id: 1, childName: 'Alice' }]) },
          { name: 'childcareProviders', toArray: vi.fn().mockResolvedValue([{ id: 1, accountId: 1, name: 'Nursery A', frequency: 'monthly', monthlyEquivalentPence: 40000 }]) },
          { name: 'userPreferences', toArray: vi.fn().mockResolvedValue([]) },
        ],
        verno: 23,
      },
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it('includes childcareProviders in cloud snapshot payload via generic db.tables path (TECH-06)', async () => {
    mockGetSessionTECH06P35.mockResolvedValue({ data: { session: { user: { id: 'u-tech06-p35' } } } });
    mockUpsertTECH06P35.mockResolvedValue({ error: null });

    const { pushSnapshot } = await import('./supabase-sync.js');
    await pushSnapshot();

    expect(mockUpsertTECH06P35).toHaveBeenCalledOnce();
    const [row] = mockUpsertTECH06P35.mock.calls[0];
    const parsed = JSON.parse(row.payload);

    // childcareProviders must be in the payload — TECH-06 Phase 35 requirement
    expect(parsed).toHaveProperty('childcareProviders');
    expect(parsed.childcareProviders).toHaveLength(1);
    expect(parsed.childcareProviders[0]).toMatchObject({ name: 'Nursery A', frequency: 'monthly' });
    expect(row.schema_version).toBe(23);
  });

  it('no explicit childcareProviders allowlist registration exists in supabase-sync.js', async () => {
    // Structural regression: the sync module must use db.tables generic path,
    // not a hardcoded allowlist of store names. This test asserts the observable
    // behaviour (all tables in db.tables appear in payload) rather than inspecting
    // source code, as that is covered by the above test.
    mockGetSessionTECH06P35.mockResolvedValue({ data: { session: { user: { id: 'u-tech06-p35' } } } });
    mockUpsertTECH06P35.mockResolvedValue({ error: null });

    const { pushSnapshot } = await import('./supabase-sync.js');
    await pushSnapshot();

    const [row] = mockUpsertTECH06P35.mock.calls[0];
    const parsed = JSON.parse(row.payload);

    // All 4 tables in our mock db.tables must appear in the payload
    expect(parsed).toHaveProperty('income');
    expect(parsed).toHaveProperty('childcareAccounts');
    expect(parsed).toHaveProperty('childcareProviders');
    expect(parsed).toHaveProperty('userPreferences');
  });
});
