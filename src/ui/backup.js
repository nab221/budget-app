import { db } from '../db/schema.js';
import { encryptData, decryptData } from '../utils/security.js';
import { templateUI } from './templates.js'; // Reuse modal logic
import { LAST_EXPORT_KEY } from './pwa-ux.js';

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

    let exportContent;
    let fileName = `budget-backup-${new Date().toISOString().split('T')[0]}`;

    if (password) {
      exportContent = JSON.stringify({
        version: 1,
        encrypted: true,
        data: await encryptData(data, password)
      });
      fileName += '.enc.json';
    } else {
      exportContent = JSON.stringify({
        version: 1,
        encrypted: false,
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

    templateUI.closeModal();
  },

  async handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = JSON.parse(e.target.result);
        this.promptImportConfirmation(content);
      } catch (err) {
        alert('Invalid backup file format.');
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
        alert('Password required for encrypted backup.');
        return;
      }
      try {
        data = await decryptData(content.data, password);
      } catch (err) {
        alert('Decryption failed. Check your password.');
        return;
      }
    } else {
      data = content.data;
    }

    // Basic validation
    if (!data || typeof data !== 'object') {
      alert('Invalid backup data.');
      return;
    }

    try {
      // Use a transaction for the entire import process
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          if (data[table.name]) {
            await table.clear();
            await table.bulkAdd(data[table.name]);
          }
        }
      });

      alert('Import successful! The app will now reload.');
      window.location.reload();
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import data. The backup might be corrupted or incompatible.');
    }
  },

  async handleReset() {
    if (confirm('CRITICAL: This will PERMANENTLY DELETE all your data. Are you sure?')) {
      if (confirm('Final confirmation: Delete EVERYTHING?')) {
        await db.transaction('rw', db.tables, async () => {
          for (const table of db.tables) {
            await table.clear();
          }
        });
        localStorage.clear();
        alert('All data has been cleared.');
        window.location.reload();
      }
    }
  }
};

// Make it globally accessible
window.backupUI = backupUI;
