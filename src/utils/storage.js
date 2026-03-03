/**
 * localStorage key for the user-configured balance chain start date (YYYY-MM).
 * Shared by app.js (save/load) and the balance UI tests.
 */
export const BALANCE_START_DATE_KEY = 'budget_balance_start_date';

/**
 * localStorage key for the user-configured initial opening balance (pence).
 */
export const BALANCE_OPENING_AMOUNT_KEY = 'budget_balance_opening_amount';

/**
 * Checks if the File System Access API is supported by the current browser.
 * @returns {boolean}
 */
export function checkFileSupport() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/**
 * Native IndexedDB for file handle storage.
 * Dexie/Structured clone can sometimes have issues with direct handle serialization
 * in older browser versions or specific environments, so we use a dedicated simple store.
 */
export const HandleStore = {
  dbName: 'BudgetFileHandles',
  storeName: 'handles',
  key: 'currentFile',

  async get() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get(this.key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async set(handle) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(this.storeName, 'readwrite');
        const req = tx.objectStore(this.storeName).put(handle, this.key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async clear() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(this.storeName, 'readwrite');
        const req = tx.objectStore(this.storeName).delete(this.key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      };
      request.onerror = () => reject(request.error);
    });
  }
};

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
