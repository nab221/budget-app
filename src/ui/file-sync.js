import { checkFileSupport, HandleStore, ensurePersistence } from '../utils/storage.js';
import { SyncManager } from '../utils/sync-manager.js';
import { db } from '../db/schema.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';
import { OPFSStore } from '../utils/opfs-store.js';

/** True when the session is using OPFS instead of File System Access API. */
let _opfsMode = false;

function checkOPFSSupport() {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    'getDirectory' in navigator.storage
  );
}

/**
 * Initialize the File Sync UI and logic.
 */
export async function initFileSyncUI() {
  const toolbar = document.querySelector('.toolbar');

  // ── Branch 1: File System Access API (desktop Chrome/Edge) ──────────────
  if (checkFileSupport()) {
    setupModalHandlers();

    const enablePersistenceBtn = document.getElementById('enablePersistenceBtn');
    if (enablePersistenceBtn) {
      enablePersistenceBtn.onclick = async () => {
        const isPersisted = await ensurePersistence();
        if (isPersisted) {
          triggerHaptic('success');
          await refreshPersistenceWarning();
          await updateFileSyncToolbar();
        } else {
          alertWithHaptic('Browser refused to enable persistence. Try adding the app to your Home Screen or Bookmarks first.');
        }
      };
    }

    try {
      const savedHandle = await HandleStore.get();
      if (savedHandle) {
        SyncManager.initialize(savedHandle, updateFileSyncToolbar);
        await updateFileSyncToolbar();
      } else {
        await updateFileSyncToolbar();
      }
    } catch (err) {
      console.error('[FileSyncUI] Init failed:', err);
      await updateFileSyncToolbar();
    }
    return;
  }

  // ── Branch 2: Origin Private File System (mobile) ───────────────────────
  if (checkOPFSSupport()) {
    _opfsMode = true;
    let loadSucceeded = true;

    try {
      const existing = await OPFSStore.readFile();
      if (existing) {
        await loadFromData(existing);
      }
    } catch (err) {
      console.error('[FileSyncUI] OPFS read failed:', err);
      loadSucceeded = false;
    }

    OPFSStore.initialize(updateFileSyncToolbar);
    if (loadSucceeded) {
      await OPFSStore.saveToFile();
    }
    await updateFileSyncToolbar();
    return;
  }

  // ── Branch 3: Neither API available ─────────────────────────────────────
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.style.marginRight = '10px';
  hint.innerHTML = '💡 On desktop Chrome/Edge: auto-save available';
  toolbar.prepend(hint);
}

/**
 * Refresh the persistence warning banner visibility.
 * Shown only if storage is not persistent AND no file-sync is active.
 */
export async function refreshPersistenceWarning() {
  if (!navigator.storage || !navigator.storage.persisted) return false;
  
  // Just check, don't request, to avoid console spam or unwanted popups
  const isPersisted = await navigator.storage.persisted();
  const fileName = _opfsMode ? OPFSStore.getFileName() : SyncManager.getFileName();
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
  const fileName = _opfsMode ? OPFSStore.getFileName() : SyncManager.getFileName();
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

  const existingReconnect = toolbar.querySelector('#reconnectFileBtn');
  if (existingReconnect) existingReconnect.remove();

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

    // If permission is missing, provide a Reconnect button
    if (!_opfsMode && status === 'error' && statusText === '⚠ Reconnect Needed') {
      const reconnectBtn = document.createElement('button');
      reconnectBtn.id = 'reconnectFileBtn';
      reconnectBtn.className = 'primary sm';
      reconnectBtn.textContent = '🔌 Reconnect';
      reconnectBtn.onclick = async () => {
        const granted = await SyncManager.requestPermission();
        if (granted) {
          triggerHaptic('success');
          await updateFileSyncToolbar();
        }
      };
      toolbar.appendChild(reconnectBtn);
    }

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
    selectBtn.onclick = () => {
      triggerHaptic('tap');
      showFileSyncModal();
    };
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
      triggerHaptic('success');
      modal.classList.add('hidden');
    } catch (err) {
      if (err.name !== 'AbortError') alertWithHaptic('Error opening file: ' + err.message);
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
      triggerHaptic('success');
      modal.classList.add('hidden');
      await updateFileSyncToolbar();
    } catch (err) {
      if (err.name !== 'AbortError') alertWithHaptic('Error creating file: ' + err.message);
    }
  };
}

async function loadFromData(data) {
  if (!data) return;

  const localCount =
    (await db.income.count()) +
    (await db.recurrentExpenses.count()) +
    (await db.oneOffExpenses.count());

  let overwrite = false;
  if (localCount > 0) {
    const choice = confirm('File contains data. Overwrite local data? (Cancel to Merge)');
    if (choice) {
      overwrite = true;
      triggerHaptic('delete');
    } else {
      triggerHaptic('tap');
    }
  }

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      if (overwrite) {
        await table.clear();
      }
      if (data[table.name]) {
        try {
          await table.bulkPut(data[table.name]);
        } catch (e) {
          if (e.failures) {
            console.error(`[loadFromData] ${table.name}: ${e.failures.length} record(s) failed`, e.failures);
          } else {
            throw e;
          }
        }
      }
    }
  });

  window.dispatchEvent(new CustomEvent('app:refresh'));
}

async function loadFromFile(handle) {
  try {
    const file = await handle.getFile();
    const content = await file.text();
    if (content.trim()) {
      await loadFromData(JSON.parse(content));
    }
    SyncManager.initialize(handle, updateFileSyncToolbar);
    await HandleStore.set(handle);
    await updateFileSyncToolbar();
  } catch (err) {
    console.error('[FileSyncUI] Load failed:', err);
    alertWithHaptic('Failed to load file: ' + err.message);
  }
}

async function handleDisconnectFile() {
  if (!confirm('Stop auto-saving to this file? Your data stays in the browser.')) return;
  triggerHaptic('delete');
  if (_opfsMode) {
    await OPFSStore.disconnect();
  } else {
    await HandleStore.clear();
  }
  location.reload();
}

function showFileSyncModal() {
  document.getElementById('fileSyncModal').classList.remove('hidden');
}
