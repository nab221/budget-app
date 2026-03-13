import { createClient } from '@supabase/supabase-js';
import { db } from '../db/schema.js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const CLOUD_RUNTIME_CONFIG_KEY = 'budget_cloud_runtime_config';

export const CLOUD_LAST_SYNC_KEY = 'budget_cloud_last_sync';

let supabaseClient = null;

export function _readRuntimeConfig() {
  if (typeof localStorage === 'undefined') {
    return { url: '', anonKey: '' };
  }
  try {
    const raw = localStorage.getItem(CLOUD_RUNTIME_CONFIG_KEY);
    if (!raw) return { url: '', anonKey: '' };
    const parsed = JSON.parse(raw);
    return {
      url: String(parsed.url || '').trim(),
      anonKey: String(parsed.anonKey || '').trim(),
    };
  } catch {
    return { url: '', anonKey: '' };
  }
}

function _getEffectiveConfig() {
  const runtime = _readRuntimeConfig();
  const envUrl = String(SUPABASE_URL || '').trim();
  const envKey = String(SUPABASE_ANON_KEY || '').trim();

  return {
    url: envUrl || runtime.url,
    anonKey: envKey || runtime.anonKey,
    source: envUrl && envKey ? 'env' : (runtime.url && runtime.anonKey ? 'runtime' : 'none'),
  };
}

function _getClient() {
  if (supabaseClient) return supabaseClient;
  const { url, anonKey } = _getEffectiveConfig();
  if (!url || !anonKey) return null;
  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}

export function _validateConfig(url, anonKey) {
  const nextUrl = String(url || '').trim();
  const nextKey = String(anonKey || '').trim();
  if (!nextUrl || !nextKey) {
    throw new Error('Both Supabase URL and anon key are required');
  }
  let parsed;
  try {
    parsed = new URL(nextUrl);
  } catch {
    throw new Error('Supabase URL must be a valid https URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Supabase URL must use https');
  }
  return { nextUrl, nextKey };
}

/**
 * Returns true when effective Supabase config has non-empty url + anonKey,
 * whether sourced from environment variables or runtime browser config.
 * When false, all cloud sync UI is hidden and no Supabase calls are made.
 */
export function isConfigured() {
  const { url, anonKey } = _getEffectiveConfig();
  return !!(url && anonKey);
}

/**
 * Returns Supabase config source for UI messaging.
 */
export function getConfigSource() {
  return _getEffectiveConfig().source;
}

/**
 * Runtime cloud configuration shown in hosted environments where .env is not available.
 */
export function getRuntimeConfig() {
  const runtime = _readRuntimeConfig();
  return {
    url: runtime.url,
    anonKey: runtime.anonKey,
    isConfigured: !!(runtime.url && runtime.anonKey),
  };
}

/**
 * Saves runtime cloud config to localStorage and reinitializes client.
 */
export function saveRuntimeConfig(url, anonKey) {
  const { nextUrl, nextKey } = _validateConfig(url, anonKey);
  if (typeof localStorage === 'undefined') {
    throw new Error('Cloud config can only be saved in a browser');
  }
  localStorage.setItem(
    CLOUD_RUNTIME_CONFIG_KEY,
    JSON.stringify({ url: nextUrl, anonKey: nextKey })
  );
  supabaseClient = null;
}

/**
 * Clears runtime cloud config. .env-based config still applies if present.
 */
export function clearRuntimeConfig() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(CLOUD_RUNTIME_CONFIG_KEY);
  supabaseClient = null;
}

/**
 * Supabase client. Null when not configured — callers must guard with isConfigured().
 */
export function getSupabaseClient() {
  return _getClient();
}

/**
 * Returns the current Supabase session, or null if not signed in.
 */
export async function getSession() {
  const supabase = _getClient();
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
  const supabase = _getClient();
  if (!supabase) throw new Error('Supabase not configured');
  const redirectTo = window.location.origin + window.location.pathname;
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
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
  const supabase = _getClient();
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
  const supabase = _getClient();
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

/**
 * Fetches only metadata for the latest cloud snapshot of the current user.
 * Returns null when no snapshot exists.
 * Throws when not signed in or on Supabase error.
 */
export async function getLatestSnapshotMeta() {
  const supabase = _getClient();
  if (!supabase) throw new Error('Supabase not configured');

  const session = await getSession();
  if (!session) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('budget_snapshots')
    .select('updated_at, schema_version')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    updated_at: data.updated_at,
    schema_version: data.schema_version,
  };
}
