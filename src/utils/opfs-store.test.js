import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OPFSStore } from './opfs-store.js';

vi.mock('../db/schema.js', () => ({
  db: {
    tables: [
      { name: 'income', toArray: async () => [{ id: 1 }] },
    ],
  },
}));

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

describe('OPFSStore', () => {
  beforeEach(() => {
    OPFSStore._reset();
    vi.restoreAllMocks();
  });

  it('getFileName returns null before initialize', () => {
    expect(OPFSStore.getFileName()).toBeNull();
  });

  it('getFileName returns budget-data.json after initialize', () => {
    OPFSStore.initialize(vi.fn());
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
    OPFSStore.initialize(vi.fn());
    const saveSpy = vi.spyOn(OPFSStore, 'saveToFile').mockResolvedValue();
    OPFSStore.scheduleAutoSave();
    OPFSStore.scheduleAutoSave();
    expect(saveSpy).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(saveSpy).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('scheduleAutoSave calls status callback with pending immediately', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    OPFSStore.initialize(cb);
    const saveSpy = vi.spyOn(OPFSStore, 'saveToFile').mockResolvedValue();
    OPFSStore.scheduleAutoSave();
    expect(cb).toHaveBeenCalledWith('pending', 'Saving...');
    vi.useRealTimers();
  });

  it('disconnect cancels a pending auto-save', async () => {
    vi.useFakeTimers();
    OPFSStore.initialize(vi.fn());
    const saveSpy = vi.spyOn(OPFSStore, 'saveToFile').mockResolvedValue();
    OPFSStore.scheduleAutoSave();

    // Mock navigator so disconnect doesn't fail
    const { root } = makeOPFSMock();
    mockNavigatorStorage(root);

    await OPFSStore.disconnect();
    await vi.runAllTimersAsync();

    expect(saveSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('initialize removes previous db:mutated listener to avoid duplicates', () => {
    const addedListeners = [];
    const removedListeners = [];

    vi.stubGlobal('window', {
      addEventListener: vi.fn((event, listener) => addedListeners.push({ event, listener })),
      removeEventListener: vi.fn((event, listener) => removedListeners.push({ event, listener })),
    });

    OPFSStore.initialize(vi.fn());
    OPFSStore.initialize(vi.fn()); // second call should remove first listener

    // After second initialize, removeEventListener must have been called for db:mutated
    const removedForMutation = removedListeners.some(({ event }) => event === 'db:mutated');
    expect(removedForMutation).toBe(true);
  });
});
