import { checkFileSupport, HandleStore, ensurePersistence } from '../utils/storage.js';
import { SyncManager } from '../utils/sync-manager.js';
import { db } from '../db/schema.js';
import { importBackupData } from '../db/backup.js';
import { triggerHaptic } from '../utils/haptics.js';
import { OPFSStore } from '../utils/opfs-store.js';
import { notificationUI } from './notifications.js';

/** True when the session is using OPFS instead of File System Access API. */
let _opfsMode = false;

/** Last status reported by SyncManager / OPFSStore. */
let _lastStatus = 'idle';
let _lastStatusText = '';

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
          notificationUI.warning('Browser refused to enable persistence. Try adding the app to your Home Screen or Bookmarks first.');
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
 * When cloud is managing the header (#cloudSyncActionsHeader is visible), this function
 * only stores state and dispatches an event for cloud-sync.js to consume. The
 * individual Select / Change / Disconnect buttons are shown inside the 📁 Local modal.
 */
async function updateFileSyncToolbar(status = 'idle', statusText = '') {
  _lastStatus = status;
  _lastStatusText = statusText;

  const toolbar = document.querySelector('.toolbar');
  const fileName = _opfsMode ? OPFSStore.getFileName() : SyncManager.getFileName();
  const headerHint = document.querySelector('header .hint');

  // Dispatch event so cloud-sync.js can update its local status indicator
  window.dispatchEvent(new CustomEvent('localSync:statusChanged', {
    detail: { fileName, status, statusText }
  }));

  // Refresh persistence warning visibility whenever sync status changes
  const isPersisted = await refreshPersistenceWarning();

  // Remove existing file sync elements from the toolbar (cleanup always)
  toolbar.querySelector('.file-sync-indicator')?.remove();
  toolbar.querySelector('#changeFileBtn')?.remove();
  toolbar.querySelector('#disconnectFileBtn')?.remove();
  toolbar.querySelector('#selectFileBtn')?.remove();
  toolbar.querySelector('#reconnectFileBtn')?.remove();

  // If cloud header actions exist they manage local controls; don't add standalone toolbar buttons —
  // those actions live inside the 📁 Local modal. Just manage export/import visibility.
  const cloudManaged = !!document.getElementById('cloudSyncActionsHeader');

  if (cloudManaged) {
    const cloudHeader = document.getElementById('cloudSyncActionsHeader');
    const hasCloudHeaderActions = !!cloudHeader?.querySelector('button');

    if (!hasCloudHeaderActions) {
      document.getElementById('exportBtn')?.classList.remove('hidden');
      document.querySelector('label[for="importFile"]')?.classList.remove('hidden');
      return;
    }

    if (fileName) {
      document.getElementById('exportBtn')?.classList.add('hidden');
      document.querySelector('label[for="importFile"]')?.classList.add('hidden');
    }
    return;
  }

  // ── Cloud NOT configured: manage toolbar directly (legacy behaviour) ──────
  if (fileName) {
    // Hide standard export/import buttons to reduce clutter in file-sync mode
    document.getElementById('exportBtn')?.classList.add('hidden');
    document.querySelector('label[for="importFile"]')?.classList.add('hidden');

    const indicator = document.createElement('div');
    indicator.className = 'file-sync-indicator';
    indicator.style.cssText = 'display:flex;align-items:center;gap:10px;font-size:.8rem;color:var(--text-soft)';

    let statusClass = '';
    if (status === 'success') statusClass = 'green';
    if (status === 'error') statusClass = 'red';

    indicator.innerHTML = `<span id="saveStatus" class="${statusClass}">${statusText}</span>`;
    toolbar.prepend(indicator);

    // Permission missing: show a Reconnect button
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
    if (headerHint) {
      headerHint.textContent = `Local Storage (IndexedDB) • Persistence: ${isPersisted ? 'Active' : 'Inactive'}`;
    }

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
      if (err.name !== 'AbortError') notificationUI.error('Error opening file: ' + err.message);
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
      if (err.name !== 'AbortError') notificationUI.error('Error creating file: ' + err.message);
    }
  };
}

async function loadFromData(data) {
  if (!data) return;

  try {
    // File-sync always uses merge mode (preserve local, add file data)
    // and never restores settings (keep browser settings as-is)
    await importBackupData(data, {
      mode: 'merge',
      restoreSettings: false
    });
    
    window.dispatchEvent(new CustomEvent('app:refresh'));
  } catch (err) {
    console.error('[loadFromData] Import failed:', err);
    notificationUI.error(`Failed to merge file data: ${err.message}`);
  }
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
    notificationUI.error('Failed to load file: ' + err.message);
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

// ── Public API for cloud-sync.js to consume ───────────────────────────────────

/**
 * Returns the current local file sync state.
 * @returns {{ fileName: string|null, status: string, statusText: string }}
 */
export function getFileSyncState() {
  const fileName = _opfsMode ? OPFSStore.getFileName() : SyncManager.getFileName();
  return { fileName, status: _lastStatus, statusText: _lastStatusText };
}

/**
 * Opens the file-selection dialog (File System Access API only).
 * No-op in OPFS mode since the file is managed automatically.
 */
export function openSelectFileDialog() {
  if (!_opfsMode) showFileSyncModal();
}

/**
 * Disconnects the current budget file (same as clicking Disconnect in toolbar).
 */
export async function disconnectFileSyncFile() {
  await handleDisconnectFile();
}
