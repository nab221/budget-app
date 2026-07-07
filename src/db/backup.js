/**
 * Backup: JSON export / import (spec §5 envelope).
 *
 * The envelope carries **raw rows** exactly as stored — money stays as integer
 * pence, no pounds translation. Import is a full replace-all: validate → refuse
 * newer format/schema → wipe → bulk-insert inside a single Dexie transaction.
 */

import { db, SCHEMA_VERSION, TABLE_NAMES } from './schema.js';
import { settings } from './settings.js';
import { dispatchMutation } from './events.js';

export const APP_NAME = 'budget-app';
export const BACKUP_FORMAT = 1;

/**
 * Build the backup envelope from raw table contents and record the export time.
 * @returns {Promise<object>} the spec §5 envelope.
 */
export async function exportBackup() {
  const data = {};
  for (const name of TABLE_NAMES) {
    data[name] = await db.table(name).toArray();
  }
  const exportedAt = new Date().toISOString();
  const envelope = {
    app: APP_NAME,
    format: BACKUP_FORMAT,
    exportedAt,
    schemaVersion: SCHEMA_VERSION,
    data,
  };
  await settings.setLastExportAt(exportedAt); // dispatches db:mutated
  return envelope;
}

/**
 * Export and trigger a browser download of `budget-backup-YYYY-MM-DD.json`.
 * @returns {Promise<object>} the exported envelope.
 */
export async function downloadBackup() {
  const envelope = await exportBackup();
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `budget-backup-${envelope.exportedAt.slice(0, 10)}.json`;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return envelope;
}

/**
 * Replace all data from a parsed backup envelope.
 *
 * Validates shape, refuses `format`/`schemaVersion` newer than this app, then
 * wipes every table and bulk-inserts the backup rows in one Dexie transaction.
 * `lastExportAt` is intentionally left as-is (importing is not exporting).
 *
 * @param {object} parsed - a parsed JSON backup envelope.
 */
export async function importBackup(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Import failed: backup is not a valid object.');
  }
  if (parsed.app !== APP_NAME) {
    throw new Error(
      `Import failed: not a ${APP_NAME} backup (app="${parsed.app}").`
    );
  }
  if (!Number.isInteger(parsed.format)) {
    throw new Error('Import failed: backup is missing a numeric "format".');
  }
  if (parsed.format > BACKUP_FORMAT) {
    throw new Error(
      `Import failed: backup format ${parsed.format} is newer than this app (format ${BACKUP_FORMAT}). Update the app to import it.`
    );
  }
  if (!Number.isInteger(parsed.schemaVersion)) {
    throw new Error('Import failed: backup is missing a numeric "schemaVersion".');
  }
  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Import failed: backup schemaVersion ${parsed.schemaVersion} is newer than this app (schema ${SCHEMA_VERSION}). Update the app to import it.`
    );
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Import failed: backup has no "data" section.');
  }

  const tables = TABLE_NAMES.map((name) => db.table(name));
  await db.transaction('rw', tables, async () => {
    for (const name of TABLE_NAMES) {
      await db.table(name).clear();
      const rows = parsed.data[name];
      if (Array.isArray(rows) && rows.length > 0) {
        await db.table(name).bulkAdd(rows);
      }
    }
  });

  dispatchMutation();
}
