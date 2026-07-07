import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  categoriesRepo,
  recurringBillsRepo,
  transactionsRepo,
} from '../../db/repositories.js';
import { findCategoryUsage, usageBlockMessage } from './categoryUsage.js';

beforeEach(resetDb);

describe('findCategoryUsage', () => {
  it('reports a category as unused when nothing references it', async () => {
    const id = await categoriesRepo.add({ name: 'Spare', kind: 'spending' });
    const usage = await findCategoryUsage(id);
    expect(usage.inUse).toBe(false);
    expect(usageBlockMessage(usage)).toBeNull();
  });

  it('blocks deletion when a recurring bill references it', async () => {
    const id = await categoriesRepo.add({ name: 'Utilities', kind: 'spending' });
    await recurringBillsRepo.add({
      label: 'Water',
      amountPence: 30,
      categoryId: id,
      frequency: 'monthly',
      nextDueDate: '2026-07-01',
    });
    const usage = await findCategoryUsage(id);
    expect(usage).toMatchObject({ bills: 1, inUse: true });
    expect(usageBlockMessage(usage)).toMatch(/recurring bill/);
  });

  it('blocks deletion when a transaction references it, and counts both sources', async () => {
    const id = await categoriesRepo.add({ name: 'Groceries', kind: 'spending' });
    await transactionsRepo.add({ date: '2026-07-03', kind: 'spend', amountPence: 12, categoryId: id });
    await transactionsRepo.add({ date: '2026-07-05', kind: 'spend', amountPence: 8, categoryId: id });
    await recurringBillsRepo.add({
      label: 'Veg box',
      amountPence: 20,
      categoryId: id,
      frequency: 'monthly',
      nextDueDate: '2026-07-10',
    });
    const usage = await findCategoryUsage(id);
    expect(usage).toMatchObject({ transactions: 2, bills: 1, inUse: true });
    const msg = usageBlockMessage(usage);
    expect(msg).toMatch(/2 transactions/);
    expect(msg).toMatch(/1 recurring bill/);
  });
});
