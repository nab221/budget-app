/**
 * Shared localStorage key for the timestamp of the last successful cloud backup.
 * Imported by google-drive.js, onedrive.js, and cloud-backup.js to ensure a
 * single source of truth — rename here to update all usages.
 */
export const CLOUD_LAST_BACKUP_KEY = 'cloud_last_backup';

/**
 * Checks and requests storage persistence.
 * This is crucial for Safari and mobile browsers where data might be purged.
 *
 * @returns {Promise<boolean>} - True if persistent, false if not or denied.
 */
export async function ensurePersistence() {
  if (!navigator.storage || !navigator.storage.persist || !navigator.storage.persisted) {
    console.warn('Storage Persistence API not supported in this browser.');
    return false;
  }
  
  // Check if it's already persistent
  let persisted = await navigator.storage.persisted();
  
  // If not, request it
  if (!persisted) {
    persisted = await navigator.storage.persist();
  }
  
  console.log('Storage persisted:', persisted);
  return persisted;
}

/**
 * Checks if storage is already persistent.
 * @returns {Promise<boolean>}
 */
export async function checkPersistence() {
  if (navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted();
  }
  return false;
}
