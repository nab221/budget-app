/**
 * Test-only helpers. Importing `fake-indexeddb/auto` installs a fake
 * IndexedDB on the global before any Dexie connection is opened.
 */
import 'fake-indexeddb/auto';
import { db } from './schema.js';

/** Wipe and reopen the database so each test starts from a clean slate. */
export async function resetDb() {
  if (db.isOpen()) db.close();
  await db.delete();
  await db.open();
}
