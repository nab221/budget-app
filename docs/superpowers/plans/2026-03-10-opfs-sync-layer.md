# OPFS Sync Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OPFS-backed auto-save store for mobile browsers that lack the File System Access API.

**Architecture:** `OPFSStore` in `src/utils/opfs-store.js` mirrors `SyncManager`'s interface (initialize / scheduleAutoSave / saveToFile / getFileName). `file-sync.js` gains a `checkOPFSSupport()` helper and an OPFS branch in `initFileSyncUI()` — FSA takes priority on desktop, OPFS fires on mobile when FSA is absent.

**Tech Stack:** Origin Private File System API (`navigator.storage.getDirectory()`), Vitest (mocked OPFS), existing Dexie DB schema.

---

## Chunk 1: OPFSStore utility

### Task 1: OPFSStore — write failing tests

**Files:**
- Create: `src/utils/opfs-store.test.js`

- [ ] **Step 1: Create the test file**

```js
// src/utils/opfs-store.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OPFSStore } from './opfs-store.js';

// ---------------------------------------------------------------------------
// Minimal OPFS mock
// ---------------------------------------------------------------------------
function makeOPFSMock(existingContent = null) {
  let stored = existingContent;

  const writable = {
    write: vi.fn(async (data) => { stored = data; }),
    close: vi.fn(async () => {}),
  };

  const fileHandle = {
    getFile: vi.fn(async () => ({
      text: async () => stored ?? '',
    })),
    createWritable: vi.fn(async () => writable),
    remove: vi.fn(async () => {}),
    _writable: writable,
  };

  const root = {
    getFileHandle: vi.fn(async () => fileHandle),
    removeEntry: vi.fn(async () => {}),
    _fileHandle: fileHandle,
    _stored: () => stored,
  };

  return { root, fileHandle, writable };
}

function mockNavigatorStorage(root) {
  vi.stubGlobal('navigator', {
    storage: { getDirectory: vi.fn(async () => root) },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('OPFSStore', () => {
  beforeEach(() => {
    OPFSStore._reset();
    vi.restoreAllMocks();
  });

  it('getFileName returns budget-data.json', () => {
    expect(OPFSStore.getFileName()).toBe('budget-data.json');
  });

  it('readFile returns null when file is empty', async () => {
    const { root } = makeOPFSMock('');
    mockNavigatorStorage(root);
    const result = await OPFSStore.readFile();
    expect(result).toBeNull();
  });

  it('readFile returns null when file does not exist', async () => {
    const root = {
      getFileHandle: vi.fn().mockRejectedValue(
        Object.assign(new Error('not found'), { name: 'NotFoundError' })
      ),
    };
    mockNavigatorStorage(root);
    const result = await OPFSStore.readFile();
    expect(result).toBeNull();
  });

  it('readFile parses and returns JSON content', async () => {
    const payload = { meta: { version: 2 }, income: [] };
    const { root } = makeOPFSMock(JSON.stringify(payload));
    mockNavigatorStorage(root);
    const result = await OPFSStore.readFile();
    expect(result).toEqual(payload);
  });

  it('saveToFile writes serialised DB payload to OPFS', async () => {
    const { root, writable } = makeOPFSMock();
    mockNavigatorStorage(root);

    // Minimal db mock
    vi.doMock('../db/schema.js', () => ({
      db: {
        tables: [
          { name: 'income', toArray: async () => [{ id: 1 }] },
        ],
      },
    }));

    await OPFSStore.saveToFile();

    expect(writable.write).toHaveBeenCalledOnce();
    const written = JSON.parse(writable.write.mock.calls[0][0]);
    expect(written.meta.version).toBe(2);
    expect(written.income).toEqual([{ id: 1 }]);
  });

  it('disconnect removes the OPFS file', async () => {
    const { root } = makeOPFSMock();
    mockNavigatorStorage(root);
    await OPFSStore.disconnect();
    expect(root.removeEntry).toHaveBeenCalledWith('budget-data.json');
  });

  it('scheduleAutoSave debounces and calls saveToFile', async () => {
    vi.useFakeTimers();
    const saveSpy = vi.spyOn(OPFSStore, 'saveToFile').mockResolvedValue();
    OPFSStore.scheduleAutoSave();
    OPFSStore.scheduleAutoSave();
    expect(saveSpy).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(saveSpy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd C:/Users/nab221/CODE/budget-app && npx vitest run src/utils/opfs-store.test.js 2>&1 | tail -20
```

Expected: errors like `Cannot find module './opfs-store.js'`

---

### Task 2: OPFSStore — implement

**Files:**
- Create: `src/utils/opfs-store.js`

- [ ] **Step 3: Create the implementation**

```js
// src/utils/opfs-store.js
import { db } from '../db/schema.js';

let _statusCallback = null;
let _saveTimeout = null;
let _mutationListener = null;

export const OPFSStore = {
  _fileName: 'budget-data.json',

  /** @private — test helper to reset module state between tests */
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

  /**
   * Get the OPFS root directory handle.
   * @returns {Promise<FileSystemDirectoryHandle>}
   */
  async _getRoot() {
    return navigator.storage.getDirectory();
  },

  /**
   * Read and parse the budget JSON file from OPFS.
   * Returns null if the file is absent or empty.
   * @returns {Promise<object|null>}
   */
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

  /**
   * Register the db:mutated listener and start auto-saving.
   * @param {Function} onStatusChange - receives (status, text)
   */
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

  /**
   * Debounce auto-save (500 ms), matching SyncManager behaviour.
   */
  scheduleAutoSave() {
    if (_statusCallback) _statusCallback('pending', 'Saving...');
    clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(() => this.saveToFile(), 500);
  },

  /**
   * Serialise all DB tables and write to OPFS.
   */
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

  /**
   * Remove the OPFS file and detach the mutation listener.
   */
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd C:/Users/nab221/CODE/budget-app && npx vitest run src/utils/opfs-store.test.js 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:/Users/nab221/CODE/budget-app
git add src/utils/opfs-store.js src/utils/opfs-store.test.js
git commit -m "feat(opfs): add OPFSStore utility for mobile auto-save"
```

---

## Chunk 2: Wire OPFS into file-sync.js

### Task 3: Integrate OPFSStore into file-sync.js

**Files:**
- Modify: `src/ui/file-sync.js`

No new tests needed — this file is browser-UI code with no unit test harness. Manual verification steps are provided below.

- [ ] **Step 1: Add OPFS support check and module flag**

In `src/ui/file-sync.js`, add after the existing imports:

```js
import { OPFSStore } from '../utils/opfs-store.js';

/** True when the session is using OPFS instead of File System Access API. */
let _opfsMode = false;

/**
 * Returns true if the Origin Private File System API is available.
 * Supported on Chrome Android, Firefox, Safari 16.4+.
 * No user permission prompt required.
 */
function checkOPFSSupport() {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    'getDirectory' in navigator.storage
  );
}
```

- [ ] **Step 2: Replace `initFileSyncUI` with tri-branch version**

Replace the entire `initFileSyncUI` function:

```js
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

    try {
      const existing = await OPFSStore.readFile();
      if (existing) {
        await loadFromData(existing);
      }
    } catch (err) {
      console.error('[FileSyncUI] OPFS read failed:', err);
    }

    OPFSStore.initialize(updateFileSyncToolbar);

    // Persist current IndexedDB state to OPFS immediately
    await OPFSStore.saveToFile();
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
```

- [ ] **Step 3: Add `loadFromData` helper (refactored from `loadFromFile`)**

Add a new `loadFromData(data)` function that the OPFS path can call with an already-parsed object. Refactor `loadFromFile` to delegate to it:

```js
/**
 * Restore DB from a parsed budget payload.
 * Shared by the FSA (loadFromFile) and OPFS paths.
 */
async function loadFromData(data) {
  if (!data) return;

  const localCount =
    (await db.income.count()) +
    (await db.recurrentExpenses.count()) +
    (await db.oneOffExpenses.count());

  if (localCount > 0) {
    const choice = confirm('File contains data. Overwrite local data? (Cancel to Merge)');
    if (choice) {
      await Promise.all(Object.values(db.tables).map(table => table.clear()));
      triggerHaptic('delete');
    } else {
      triggerHaptic('tap');
    }
  }

  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
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
      const data = JSON.parse(content);
      await loadFromData(data);
    }
    SyncManager.initialize(handle, updateFileSyncToolbar);
    await HandleStore.set(handle);
    await updateFileSyncToolbar();
  } catch (err) {
    console.error('[FileSyncUI] Load failed:', err);
    alertWithHaptic('Failed to load file: ' + err.message);
  }
}
```

- [ ] **Step 4: Update `updateFileSyncToolbar` to support both modes**

Replace the `const fileName = SyncManager.getFileName();` line at the top of `updateFileSyncToolbar`:

```js
const fileName = _opfsMode ? OPFSStore.getFileName() : SyncManager.getFileName();
```

Also update the Reconnect button block — wrap it so it only appears in FSA mode:

```js
if (!_opfsMode && status === 'error' && statusText === '⚠ Reconnect Needed') {
  const reconnectBtn = document.createElement('button');
  // ... rest unchanged
```

And update `handleDisconnectFile` to branch on mode:

```js
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
```

- [ ] **Step 5: Fix `refreshPersistenceWarning` to use the right getFileName**

Replace `SyncManager.getFileName()` in `refreshPersistenceWarning`:

```js
const fileName = _opfsMode ? OPFSStore.getFileName() : SyncManager.getFileName();
```

- [ ] **Step 6: Verify the build compiles without errors**

```bash
cd C:/Users/nab221/CODE/budget-app && npx vite build 2>&1 | tail -20
```

Expected: build completes with no errors.

- [ ] **Step 7: Run full test suite**

```bash
cd C:/Users/nab221/CODE/budget-app && npx vitest run 2>&1 | tail -30
```

Expected: all pre-existing tests plus the new OPFSStore tests pass.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/nab221/CODE/budget-app
git add src/ui/file-sync.js
git commit -m "feat(mobile): route to OPFSStore on mobile when FSA unavailable"
```

---

## Manual Verification Checklist

After implementing, verify in browser DevTools (or on a real Android device):

- [ ] **Desktop Chrome**: `checkFileSupport()` returns true → existing FSA flow unchanged
- [ ] **Mobile Chrome/Firefox/Safari**: `checkOPFSSupport()` returns true → OPFS branch runs, toolbar shows "Auto-saving to budget-data.json"
- [ ] **Add income entry on mobile** → `db:mutated` fires → `scheduleAutoSave` triggers → OPFS file updates (confirm in DevTools → Application → Storage → OPFS)
- [ ] **Disconnect on mobile** → OPFS file removed → page reloads → fresh state
- [ ] **Browser with neither API**: hint banner appears
