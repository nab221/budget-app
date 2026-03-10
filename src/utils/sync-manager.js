import { db } from '../db/schema.js';

let fileHandle = null;
let saveTimeout = null;
let statusCallback = null;

/**
 * SyncManager handles automatic persistence to a local file.
 */
export const SyncManager = {
  /**
   * Initialize the manager with a file handle and status listener.
   * @param {FileSystemFileHandle} handle 
   * @param {Function} onStatusChange - Callback receiving (status, text)
   */
  initialize(handle, onStatusChange) {
    fileHandle = handle;
    statusCallback = onStatusChange;
    
    // Set up the global hook for the repository to call
    if (typeof window !== 'undefined') {
      window.scheduleAutoSave = () => this.scheduleAutoSave();
    }
  },

  /**
   * Debounce auto-save to file.
   */
  scheduleAutoSave() {
    if (!fileHandle) return;
    
    if (statusCallback) statusCallback('pending', 'Saving...');
    
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => this.saveToFile(), 500);
  },

  /**
   * Perform the actual save with retry logic.
   */
  async saveToFile(retryCount = 0) {
    if (!fileHandle) return;

    try {
      // 1. Verify permissions (Chrome/Edge require this)
      const perm = await fileHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        if (statusCallback) statusCallback('error', '⚠ Reconnect Needed');
        return;
      }

      // 2. Prepare payload
      const tableData = Object.fromEntries(
        await Promise.all(db.tables.map(async t => [t.name, await t.toArray()]))
      );
      const payload = {
        meta: {
          version: 2,
          exportedAt: new Date().toISOString(),
          app: 'Budget Console'
        },
        ...tableData
      };

      // 3. Write to file
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();

      if (statusCallback) statusCallback('success', '✓ Saved');
      
      // Clear status after 2s
      setTimeout(() => {
        if (statusCallback) statusCallback('idle', '');
      }, 2000);

    } catch (err) {
      // Handle transient errors (like OneDrive sync lock) with exponential backoff
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.warn(`[SyncManager] Save failed, retrying in ${delay}ms...`, err);
        if (statusCallback) statusCallback('pending', `Retrying (${retryCount + 1})...`);
        setTimeout(() => this.saveToFile(retryCount + 1), delay);
      } else {
        console.error('[SyncManager] Save failed after retries:', err);
        if (statusCallback) statusCallback('error', '⚠ Save Failed');
      }
    }
  },

  /**
   * Request readwrite permission for the current file handle.
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    if (!fileHandle) return false;
    try {
      const perm = await fileHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        await this.saveToFile();
        return true;
      }
    } catch (err) {
      console.error('[SyncManager] Permission request failed:', err);
    }
    return false;
  },

  /**
   * Get the current file handle name.
   */
  getFileName() {
    return fileHandle ? fileHandle.name : null;
  }
};
