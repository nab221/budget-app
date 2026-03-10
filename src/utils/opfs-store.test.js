import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OPFSStore } from './opfs-store.js';

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

    // Mock the db import
    vi.mock('../db/schema.js', () => ({
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
