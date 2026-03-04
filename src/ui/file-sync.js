import { checkFileSupport, HandleStore, ensurePersistence } from '../utils/storage.js';
import { SyncManager } from '../utils/sync-manager.js';
import { db } from '../db/schema.js';

/**
 * Initialize the File Sync UI and logic.
 */
export async function initFileSyncUI() {
  const isSupported = checkFileSupport();
  const toolbar = document.querySelector('.toolbar');
  
  if (!isSupported) {
    // Show a hint for unsupported browsers
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.style.marginRight = '10px';
    hint.innerHTML = '💡 On desktop Chrome/Edge: auto-save available';
    toolbar.prepend(hint);
    return;
  }

  // 1. Setup Modal Event Listeners
  setupModalHandlers();

  // 2. Check for saved handle
  try {
    const savedHandle = await HandleStore.get();
    if (savedHandle) {
      // Initialize manager but status will stay 'error' or 'idle' until next mutation or manual trigger
      SyncManager.initialize(savedHandle, updateFileSyncToolbar);
      await updateFileSyncToolbar();
    } else {
      // First launch or reset: show button to open modal
      await updateFileSyncToolbar();
    }
  } catch (err) {
    console.error('[FileSyncUI] Init failed:', err);
    await updateFileSyncToolbar();
  }
}

/**
 * Refresh the persistence warning banner visibility.
 * Shown only if storage is not persistent AND no file-sync is active.
 */
export async function refreshPersistenceWarning() {
  const isPersisted = await ensurePersistence();
  const fileName = SyncManager.getFileName();
  const warning = document.getElementById('persistence-warning');
  if (warning) {
    if (!isPersisted && !fileName) {
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
    }
  }
  return isPersisted;
}

/**
 * Update the header toolbar based on persistence state.
 */
async function updateFileSyncToolbar(status = 'idle', statusText = '') {
  const toolbar = document.querySelector('.toolbar');
  const fileName = SyncManager.getFileName();
  const headerHint = document.querySelector('header .hint');

  // Refresh persistence warning visibility whenever sync status changes
  const isPersisted = await refreshPersistenceWarning();

  // Remove existing file sync elements if any
  const existingSync = toolbar.querySelector('.file-sync-indicator');
  if (existingSync) existingSync.remove();
  
  const existingBtn = toolbar.querySelector('#changeFileBtn');
  if (existingBtn) existingBtn.remove();

  const existingDisconnect = toolbar.querySelector('#disconnectFileBtn');
  if (existingDisconnect) existingDisconnect.remove();

  const existingSelect = toolbar.querySelector('#selectFileBtn');
  if (existingSelect) existingSelect.remove();

  if (fileName) {
    // Update header hint
    if (headerHint) headerHint.textContent = `Auto-saving to ${fileName}`;

    // Hide standard export/import buttons to reduce clutter in sync mode
    document.getElementById('exportBtn')?.classList.add('hidden');
    document.querySelector('label[for="importFile"]')?.classList.add('hidden');

    const indicator = document.createElement('div');
    indicator.className = 'file-sync-indicator';
    indicator.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:.8rem;color:var(--text-soft)';
    
    let statusClass = '';
    if (status === 'success') statusClass = 'green';
    if (status === 'error') statusClass = 'red';

    indicator.innerHTML = `
      <span id="saveStatus" class="${statusClass}">${statusText}</span>
    `;
    toolbar.prepend(indicator);

    const changeBtn = document.createElement('button');
    changeBtn.id = 'changeFileBtn';
    changeBtn.className = 'ghost sm';
    changeBtn.textContent = '📁 Change File';
    changeBtn.onclick = () => showFileSyncModal();
    toolbar.appendChild(changeBtn);

    const disconnectBtn = document.createElement('button');
    disconnectBtn.id = 'disconnectFileBtn';
    disconnectBtn.className = 'ghost sm';
    disconnectBtn.textContent = '🔗 Disconnect File';
    disconnectBtn.onclick = handleDisconnectFile;
    toolbar.appendChild(disconnectBtn);

  } else {
    // Restore header hint with detailed status
    if (headerHint) {
      headerHint.textContent = `Local Storage (IndexedDB) • Persistence: ${isPersisted ? 'Active' : 'Inactive'}`;
    }

    // No file connected: show "Select Budget File" button and ensure legacy buttons are visible
    document.getElementById('exportBtn')?.classList.remove('hidden');
    document.querySelector('label[for="importFile"]')?.classList.remove('hidden');

    const selectBtn = document.createElement('button');
    selectBtn.id = 'selectFileBtn';
    selectBtn.className = 'primary sm';
    selectBtn.textContent = '📂 Select Budget File';
    selectBtn.onclick = () => showFileSyncModal();
    toolbar.prepend(selectBtn);
  }
}

function setupModalHandlers() {
  const modal = document.getElementById('fileSyncModal');
  const closeBtn = document.getElementById('fileSyncModalClose');
  const openFileBtn = document.getElementById('openFileBtn');
  const createFileBtn = document.getElementById('createFileBtn');

  closeBtn.onclick = () => modal.classList.add('hidden');

  openFileBtn.onclick = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ accept: { 'application/json': ['.json'] } }]
      });
      await loadFromFile(handle);
      modal.classList.add('hidden');
    } catch (err) {
      if (err.name !== 'AbortError') alert('Error opening file: ' + err.message);
    }
  };

  createFileBtn.onclick = async () => {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'budget-data.json',
        types: [{ accept: { 'application/json': ['.json'] } }]
      });
      SyncManager.initialize(handle, updateFileSyncToolbar);
      await HandleStore.set(handle);
      await SyncManager.saveToFile();
      modal.classList.add('hidden');
      await updateFileSyncToolbar();
    } catch (err) {
      if (err.name !== 'AbortError') alert('Error creating file: ' + err.message);
    }
  };
}

async function loadFromFile(handle) {
  try {
    const file = await handle.getFile();
    const content = await file.text();
    
    if (content.trim()) {
      const data = JSON.parse(content);
      const localCount = await db.income.count() + await db.recurrentExpenses.count() + await db.oneOffExpenses.count();

      if (localCount > 0) {
        const choice = confirm('File contains data. Overwrite local data? (Cancel to Merge)');
        if (choice) {
          // Clear all before merging
          await Promise.all(Object.values(db.tables).map(table => table.clear()));
        }
      }

      // Re-use legacy strip pattern
      const strip = arr => (arr || []).map(({ id, ...rest }) => rest);
      
      // Batch operations
      await db.transaction('rw', db.tables, async () => {
        if (data.income) await db.income.bulkAdd(strip(data.income));
        if (data.recurrentExpenses) await db.recurrentExpenses.bulkAdd(strip(data.recurrentExpenses));
        if (data.oneOffExpenses) await db.oneOffExpenses.bulkAdd(strip(data.oneOffExpenses));
        if (data.categories) await db.categories.bulkAdd(strip(data.categories));
        if (data.debts) await db.debts.bulkAdd(strip(data.debts));
        if (data.assets) await db.assets.bulkAdd(strip(data.assets));
        if (data.statements) await db.statements.bulkAdd(strip(data.statements));
        if (data.balanceSnapshots) await db.balanceSnapshots.bulkAdd(strip(data.balanceSnapshots));
        if (data.childcareAccounts) await db.childcareAccounts.bulkAdd(strip(data.childcareAccounts));
        if (data.childcareLedger) await db.childcareLedger.bulkAdd(strip(data.childcareLedger));
        if (data.expectedIncome) await db.expectedIncome.bulkAdd(strip(data.expectedIncome));
      });
    }

    SyncManager.initialize(handle, updateFileSyncToolbar);
    await HandleStore.set(handle);
    
    // Refresh the whole app
    window.dispatchEvent(new CustomEvent('app:refresh'));
    await updateFileSyncToolbar();
    
  } catch (err) {
    console.error('[FileSyncUI] Load failed:', err);
    alert('Failed to load file: ' + err.message);
  }
}

async function handleDisconnectFile() {
  if (!confirm('Stop auto-saving to this file? Your data stays in the browser.')) return;
  await HandleStore.clear();
  // We can't easily "un-initialize" SyncManager but we can stop its effect
  location.reload(); 
}

function showFileSyncModal() {
  document.getElementById('fileSyncModal').classList.remove('hidden');
}
