import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { transactionsRepo, categoryMappingsRepo } from './repositories.js';
import { importHash } from '../engine/import-parse.js';

beforeEach(resetDb);

describe('categoryMappingsRepo.upsert (learning round-trip)', () => {
  it('inserts a new mapping then updates it in place on the same key', async () => {
    await categoryMappingsRepo.upsert('tesco stores', 1);
    let all = await categoryMappingsRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ descriptionKey: 'tesco stores', categoryId: 1 });

    // Re-import assigns a different category → same row updated, not duplicated.
    await categoryMappingsRepo.upsert('tesco stores', 2);
    all = await categoryMappingsRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].categoryId).toBe(2);
  });
});

describe('transactionsRepo.importDedupHashes', () => {
  it('includes a stored importHash so a re-import is detected', async () => {
    const hash = importHash({ date: '2025-03-02', amountPence: -1250, description: 'TESCO' });
    await transactionsRepo.add({
      date: '2025-03-02',
      kind: 'spend',
      amountPence: 12.5, // pounds at the edge
      description: 'TESCO',
      source: 'import',
      importHash: hash,
    });
    const hashes = await transactionsRepo.importDedupHashes();
    expect(hashes.has(hash)).toBe(true);
  });

  it('computes a hash from a manually-entered row so it also blocks a re-import', async () => {
    // Manual row, no importHash stored.
    await transactionsRepo.add({
      date: '2025-04-10',
      kind: 'spend',
      amountPence: 45, // £45
      description: 'SHELL PETROL',
      source: 'manual',
    });
    const hashes = await transactionsRepo.importDedupHashes();
    const expected = importHash({
      date: '2025-04-10',
      amountPence: -4500, // signed pence: spend
      description: 'SHELL PETROL',
    });
    expect(hashes.has(expected)).toBe(true);
  });
});
