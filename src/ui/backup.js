import { db } from '../db/schema.js';
import { encryptData, decryptData } from '../utils/security.js';
import { templateUI } from './templates.js'; // Reuse modal logic
import { LAST_EXPORT_KEY } from './pwa-ux.js';
import { importBackupData } from '../db/backup.js';
import { SyncManager } from '../utils/sync-manager.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';
import {
  BALANCE_START_DATE_KEY,
  BALANCE_OPENING_AMOUNT_KEY,
  PRIVACY_MODE_KEY,
  HAPTICS_ENABLED_KEY
} from '../utils/storage.js';

export const backupUI = {
  elements: {
    exportBtn: document.getElementById('exportBtn'),
    importFile: document.getElementById('importFile'),
    resetBtn: document.getElementById('resetBtn')
  },

  async init() {
    this.setupEventListeners();
  },

  setupEventListeners() {
    this.elements.exportBtn.addEventListener('click', () => this.promptExport());
    this.elements.importFile.addEventListener('change', (e) => this.handleImport(e));
    this.elements.resetBtn.addEventListener('click', () => this.handleReset());
  },

  promptExport() {
    const content = `
      <p style="margin-bottom:15px">Export your data for backup or to move it to another device.</p>
      <div class="form-row">
        <div>
          <label>Encryption Password (Optional)</label>
          <input type="password" id="exportPass" placeholder="Leave blank for plain JSON"/>
          <div class="hint">If set, your data will be encrypted using AES-256. You will need this password to import the file.</div>
        </div>
      </div>
    `;

    const footer = `
      <button class="ghost" onclick="window.templateUI.closeModal()">Cancel</button>
      <button class="primary" onclick="window.backupUI.executeExport()">Download Backup</button>
    `;

    templateUI.showModal('Export Data', content, footer);
  },

  async executeExport() {
    const password = document.getElementById('exportPass').value;
    const data = {};

    // Collect all data from all tables
    const tableNames = db.tables.map(t => t.name);
    for (const name of tableNames) {
      data[name] = await db.table(name).toArray();
    }

    // Collect localStorage settings so they survive a backup/restore cycle
    const settingKeys = [
      BALANCE_START_DATE_KEY,
      BALANCE_OPENING_AMOUNT_KEY,
      PRIVACY_MODE_KEY,
      HAPTICS_ENABLED_KEY,
      LAST_EXPORT_KEY
    ];
    const settings = Object.fromEntries(
      settingKeys
        .filter(k => localStorage.getItem(k) !== null)
        .map(k => [k, localStorage.getItem(k)])
    );

    let exportContent;
    let fileName = `budget-backup-${new Date().toISOString().split('T')[0]}`;

    if (password) {
      exportContent = JSON.stringify({
        version: 1,
        encrypted: true,
        settings,
        data: await encryptData(data, password)
      });
      fileName += '.enc.json';
    } else {
      exportContent = JSON.stringify({
        version: 1,
        encrypted: false,
        settings,
        data: data
      }, null, 2);
      fileName += '.json';
    }

    const blob = new Blob([exportContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    // Record export timestamp so the export reminder can track recency
    localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
    triggerHaptic('success');

    templateUI.closeModal();
  },

  async handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      let content;
      try {
        content = JSON.parse(e.target.result);
      } catch (err) {
        alertWithHaptic('Invalid backup file format: Not a valid JSON file.');
        return;
      }

      try {
        this.promptImportConfirmation(content);
      } catch (err) {
        console.error('Import prompt error:', err);
        alertWithHaptic('An error occurred while preparing the import prompt.');
      }
      // Reset input so the same file can be selected again
      event.target.value = '';
    };
    reader.readAsText(file);
  },

  promptImportConfirmation(content) {
    let message = '<p style="margin-bottom:15px">Are you sure you want to import this backup? <strong>This will replace ALL current data.</strong></p>';
    
    if (content.encrypted) {
      message += `
        <div class="form-row">
          <div>
            <label>Decryption Password</label>
            <input type="password" id="importPass" placeholder="Enter password used for export"/>
          </div>
        </div>
      `;
    }

    const footer = `
      <button class="ghost" onclick="window.templateUI.closeModal()">Cancel</button>
      <button class="danger" onclick="window.backupUI.executeImport(${JSON.stringify(content).replace(/"/g, '&quot;')})">Confirm Import</button>
    `;

    templateUI.showModal('Import Data', message, footer);
  },

  async executeImport(content) {
    let data;

    if (content.encrypted) {
      const password = document.getElementById('importPass').value;
      if (!password) {
        alertWithHaptic('Password required for encrypted backup.');
        return;
      }
      try {
        data = await decryptData(content.data, password);
      } catch (err) {
        alertWithHaptic('Decryption failed. Check your password.');
        return;
      }
    } else {
      data = content.data;
    }

    // Basic validation
    if (!data || typeof data !== 'object') {
      alertWithHaptic('Invalid backup data.');
      return;
    }

    try {
      await importBackupData(data);

      // Restore localStorage settings if present in the backup envelope
      if (content.settings && typeof content.settings === 'object') {
        for (const [key, value] of Object.entries(content.settings)) {
          localStorage.setItem(key, value);
        }
      }

      alertWithHaptic('Import successful! The app will now reload.', 'success');
      window.location.reload();
    } catch (err) {
      console.error('Import error:', err);
      alertWithHaptic('Failed to import data. The backup might be corrupted or incompatible.');
    }
  },

  async handleReset() {
    const isFileSyncActive = !!SyncManager.getFileName();
    let message = 'This will PERMANENTLY DELETE all data stored in this browser (IndexedDB).';
    
    if (isFileSyncActive) {
      message += '\n\n⚠️ NOTE: Auto-save is active. The connected file will NOT be updated after clearing, effectively disconnecting it from this browser state.';
    }

    if (confirm(message + '\n\nAre you sure you want to proceed?')) {
      if (confirm('FINAL CONFIRMATION: Delete EVERYTHING? This cannot be undone.')) {
        await db.transaction('rw', db.tables, async () => {
          for (const table of db.tables) {
            await table.clear();
          }
        });
        localStorage.clear();
        alertWithHaptic('All data has been cleared.', 'success');
        window.location.reload();
      }
    }
  }
};

// Make it globally accessible
window.backupUI = backupUI;
