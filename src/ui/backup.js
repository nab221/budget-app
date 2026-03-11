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
  HAPTICS_ENABLED_KEY,
  THEME_KEY,
  PAYOFF_EXTRA_KEY,
  PAYOFF_STRATEGY_KEY
} from '../utils/storage.js';

// Holds the parsed backup content between promptImportMode() and the
// delegated click handler — avoids embedding large JSON in an inline onclick.
let _pendingImportContent = null;
let _pendingImportMode = 'merge'; // Default to merge mode

/**
 * Presents a unified modal to choose between Overwrite and Merge import modes.
 * If local data exists and file contains data, shows both options.
 * If local is empty, defaults to merge (effectively overwrite since there's nothing to lose).
 */
async function promptImportMode(content) {
  const localCount =
    (await db.income.count()) +
    (await db.recurrentExpenses.count()) +
    (await db.oneOffExpenses.count());

  // If local is empty, default to merge (safe since there's nothing to lose)
  if (localCount === 0) {
    _pendingImportMode = 'merge';
    backupUI.promptImportConfirmation(content);
    return;
  }

  // Local data exists: allow user to choose
  const htmlContent = `
    <p style="margin-bottom:20px">
      You have existing budget data. How would you like to import?
    </p>
    <div style="display:flex;flex-direction:column;gap:15px;margin-bottom:20px">
      <div style="padding:10px;border:1px solid var(--border-color);border-radius:4px;cursor:pointer" data-mode="overwrite">
        <strong style="color:var(--danger)">📭 Overwrite (Replace All)</strong>
        <p style="margin:5px 0 0;color:var(--text-soft);font-size:0.85rem">Delete all local data and use the imported file as-is. Useful for restoring a complete backup.</p>
      </div>
      <div style="padding:10px;border:1px solid var(--border-color);border-radius:4px;cursor:pointer" data-mode="merge">
        <strong style="color:var(--success)">➕ Merge (Keep Local, Add New)</strong>
        <p style="margin:5px 0 0;color:var(--text-soft);font-size:0.85rem">Keep your local data and add imported records. Duplicate categories are detected and reused — incoming transactions use local IDs.</p>
      </div>
    </div>
  `;
  
  if (content.encrypted) {
    htmlContent += `
      <div class="form-row">
        <div>
          <label>Decryption Password</label>
          <input type="password" id="importPass" placeholder="Enter password used for export"/>
        </div>
      </div>
    `;
  }

  _pendingImportContent = content;

  const footer = `
    <button class="ghost" onclick="window.templateUI.closeModal()">Cancel</button>
  `;

  templateUI.showModal('Choose Import Mode', htmlContent, footer);

  // Add click handlers for mode selection
  setTimeout(() => {
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.onclick = () => {
        _pendingImportMode = btn.dataset.mode;
        triggerHaptic('tap');
        backupUI.promptImportConfirmation(content);
      };
    });
  }, 0);
}

export const backupUI = {
  elements: {
    exportBtn: document.getElementById('exportBtn'),
    importFile: document.getElementById('importFile'),
    resetBtn: document.getElementById('resetBtn')
  },

  async init() {
    this.setupEventListeners();

    // Delegated click handler for modal buttons that use data-backup-action
    // attributes — avoids exposing backupUI on window.
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-backup-action]');
      if (!btn) return;
      const action = btn.dataset.backupAction;
      if (action === 'execute-export') await this.executeExport();
      if (action === 'execute-import') await this.executeImport(_pendingImportContent);
    });
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
      <button class="primary" data-backup-action="execute-export">Download Backup</button>
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
      THEME_KEY,
      PAYOFF_EXTRA_KEY,
      PAYOFF_STRATEGY_KEY,
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
        schema_version: db.verno,
        settings,
        data: await encryptData(data, password)
      });
      fileName += '.enc.json';
    } else {
      exportContent = JSON.stringify({
        version: 1,
        encrypted: false,
        schema_version: db.verno,
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
        // Show unified mode selection prompt
        await promptImportMode(content);
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
    let modalContent = `<p style="margin-bottom:15px">Ready to import via <strong>${_pendingImportMode === 'overwrite' ? 'Overwrite' : 'Merge'}</strong> mode.</p>`;
    
    if (content.encrypted) {
      modalContent += `
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
      <button class="primary" data-backup-action="execute-import">Confirm Import</button>
    `;

    templateUI.showModal('Confirm Import', modalContent, footer);
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
      // Call importBackupData with selected mode
      // In overwrite mode, restore settings; in merge, preserve local settings
      await importBackupData(data, {
        mode: _pendingImportMode,
        restoreSettings: _pendingImportMode === 'overwrite'
      });

      // For merge mode, keep local settings (don't restore from backup)
      // For overwrite mode, settings were restored by importBackupData via options
      // However, we still check content.settings here for backward compatibility
      if (_pendingImportMode === 'overwrite' && content.settings && typeof content.settings === 'object') {
        // Already handled in DB layer if restoreSettings was true, but as fallback:
        for (const [key, value] of Object.entries(content.settings)) {
          localStorage.setItem(key, value);
        }
      }

      alertWithHaptic('Import successful! The app will now reload.', 'success');
      window.location.reload();
    } catch (err) {
      console.error('Import error:', err);
      alertWithHaptic(`Failed to import data: ${err.message}`);
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

