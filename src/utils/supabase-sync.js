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

/**
 * Fetches only metadata for the latest cloud snapshot of the current user.
 * Returns null when no snapshot exists.
 * Throws when not signed in or on Supabase error.
 */
export async function getLatestSnapshotMeta() {
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
