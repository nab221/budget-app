import { db } from '../db/schema.js';

let _statusCallback = null;
let _saveTimeout = null;
let _mutationListener = null;

export const OPFSStore = {
  _fileName: 'budget-data.json',

  _reset() {
    _statusCallback = null;
    _saveTimeout = null;
    if (_mutationListener && typeof window !== 'undefined') {
      window.removeEventListener('db:mutated', _mutationListener);
    }
    _mutationListener = null;
  },

  getFileName() {
    return this._fileName;
  },

  async _getRoot() {
    return navigator.storage.getDirectory();
  },

  async readFile() {
    try {
      const root = await this._getRoot();
      const handle = await root.getFileHandle(this._fileName);
      const file = await handle.getFile();
      const text = await file.text();
      if (!text.trim()) return null;
      return JSON.parse(text);
    } catch (err) {
      if (err.name === 'NotFoundError') return null;
      console.error('[OPFSStore] readFile failed:', err);
      return null;
    }
  },

  initialize(onStatusChange) {
    _statusCallback = onStatusChange;

    if (typeof window !== 'undefined') {
      if (_mutationListener) {
        window.removeEventListener('db:mutated', _mutationListener);
      }
      _mutationListener = () => this.scheduleAutoSave();
      window.addEventListener('db:mutated', _mutationListener);
    }
  },

  scheduleAutoSave() {
    if (_statusCallback) _statusCallback('pending', 'Saving...');
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => this.saveToFile(), 500);
  },

  async saveToFile() {
    try {
      const tableData = Object.fromEntries(
        await Promise.all(db.tables.map(async t => [t.name, await t.toArray()]))
      );
      const payload = {
        meta: {
          version: 2,
          exportedAt: new Date().toISOString(),
          app: 'Budget Console',
        },
        ...tableData,
      };

      const root = await this._getRoot();
      const handle = await root.getFileHandle(this._fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();

      if (_statusCallback) _statusCallback('success', '✓ Saved');
      setTimeout(() => {
        if (_statusCallback) _statusCallback('idle', '');
      }, 2000);
    } catch (err) {
      console.error('[OPFSStore] saveToFile failed:', err);
      if (_statusCallback) _statusCallback('error', '⚠ Save Failed');
    }
  },

  async disconnect() {
    if (_mutationListener && typeof window !== 'undefined') {
      window.removeEventListener('db:mutated', _mutationListener);
      _mutationListener = null;
    }
    _statusCallback = null;

    try {
      const root = await this._getRoot();
      await root.removeEntry(this._fileName);
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        console.warn('[OPFSStore] disconnect — removeEntry failed:', err);
      }
    }
  },
};
