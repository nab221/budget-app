import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema.js';
import {
  incomeSourcesRepo,
  recurringBillsRepo,
  transactionsRepo,
  debtsRepo,
  childrenRepo,
  categoriesRepo,
  categoryMappingsRepo,
} from './repositories.js';

beforeEach(resetDb);

describe('pence round-trip', () => {
  it('stores integer pence at rest and returns pounds from the API', async () => {
    const id = await incomeSourcesRepo.add({
      name: 'Salary',
      amountPence: 1234.56, // pounds at the API edge
      payDateRule: 'last-day',
    });

    // Raw Dexie row holds integer pence.
    const raw = await db.incomeSources.get(id);
    expect(raw.amountPence).toBe(123456);
    expect(Number.isInteger(raw.amountPence)).toBe(true);

    // Repository getters return pounds.
    const viaGet = await incomeSourcesRepo.get(id);
    expect(viaGet.amountPence).toBeCloseTo(1234.56, 5);
    const [viaAll] = await incomeSourcesRepo.getAll();
    expect(viaAll.amountPence).toBeCloseTo(1234.56, 5);
  });

  it('converts all debt money fields', async () => {
    const id = await debtsRepo.add({
      name: 'Visa',
      debtType: 'credit-card',
      balancePence: 500,
      creditLimitPence: 2000,
    });
    const raw = await db.debts.get(id);
    expect(raw.balancePence).toBe(50000);
    expect(raw.creditLimitPence).toBe(200000);
    const back = await debtsRepo.get(id);
    expect(back.balancePence).toBeCloseTo(500, 5);
    expect(back.creditLimitPence).toBeCloseTo(2000, 5);
  });

  it('debtsRepo.updateBalance stores pence + as-of date', async () => {
    const id = await debtsRepo.add({ name: 'Loan', debtType: 'loan', balancePence: 1000 });
    await debtsRepo.updateBalance(id, 750.5, '2026-07-07');
    const raw = await db.debts.get(id);
    expect(raw.balancePence).toBe(75050);
    expect(raw.balanceAsOf).toBe('2026-07-07');
  });

  it('transactionsRepo.forMonth filters by month prefix and returns pounds', async () => {
    await transactionsRepo.add({ date: '2026-07-03', kind: 'spend', amountPence: 10, categoryId: 1 });
    await transactionsRepo.add({ date: '2026-07-20', kind: 'spend', amountPence: 20, categoryId: 1 });
    await transactionsRepo.add({ date: '2026-08-01', kind: 'spend', amountPence: 30, categoryId: 1 });

    const july = await transactionsRepo.forMonth('2026-07');
    expect(july).toHaveLength(2);
    expect(july.map((t) => t.amountPence).sort((a, b) => a - b)).toEqual([10, 20]);
  });
});

describe('validation', () => {
  it('incomeSources.payDateRule enum', async () => {
    await expect(
      incomeSourcesRepo.add({ name: 'X', amountPence: 1, payDateRule: 'weekly' })
    ).rejects.toThrow(/payDateRule must be one of/);
  });

  it('incomeSources.payDateDay required 1-28 only for nth-of-month', async () => {
    await expect(
      incomeSourcesRepo.add({ name: 'X', amountPence: 1, payDateRule: 'nth-of-month', payDateDay: 29 })
    ).rejects.toThrow(/payDateDay/);
    await expect(
      incomeSourcesRepo.add({ name: 'X', amountPence: 1, payDateRule: 'nth-of-month' })
    ).rejects.toThrow(/payDateDay/);
    // last-day needs no payDateDay
    await expect(
      incomeSourcesRepo.add({ name: 'X', amountPence: 1, payDateRule: 'last-day' })
    ).resolves.toBeDefined();
    // valid nth-of-month
    await expect(
      incomeSourcesRepo.add({ name: 'X', amountPence: 1, payDateRule: 'nth-of-month', payDateDay: 15 })
    ).resolves.toBeDefined();
  });

  it('recurringBills.frequency enum', async () => {
    await expect(
      recurringBillsRepo.add({ label: 'B', amountPence: 1, categoryId: 1, frequency: 'fortnightly', nextDueDate: '2026-07-01' })
    ).rejects.toThrow(/frequency must be one of/);
    await expect(
      recurringBillsRepo.add({ label: 'B', amountPence: 1, categoryId: 1, frequency: 'quarterly', nextDueDate: '2026-07-01' })
    ).resolves.toBeDefined();
    // Week-based frequencies added per the 2026-07-07 amendment are accepted.
    await expect(
      recurringBillsRepo.add({ label: 'B', amountPence: 1, categoryId: 1, frequency: 'weekly', nextDueDate: '2026-07-01' })
    ).resolves.toBeDefined();
    await expect(
      recurringBillsRepo.add({ label: 'B', amountPence: 1, categoryId: 1, frequency: '5-weekly', nextDueDate: '2026-07-01' })
    ).resolves.toBeDefined();
    await expect(
      recurringBillsRepo.add({ label: 'B', amountPence: 1, categoryId: 1, frequency: '6-monthly', nextDueDate: '2026-07-01' })
    ).resolves.toBeDefined();
  });

  it('transactions.kind and source enums', async () => {
    await expect(
      transactionsRepo.add({ date: '2026-07-01', kind: 'transfer', amountPence: 1, categoryId: 1 })
    ).rejects.toThrow(/kind must be one of/);
    await expect(
      transactionsRepo.add({ date: '2026-07-01', kind: 'spend', amountPence: 1, categoryId: 1, source: 'sync' })
    ).rejects.toThrow(/source must be one of/);
  });

  it('debts.debtType enum', async () => {
    await expect(
      debtsRepo.add({ name: 'M', debtType: 'mortgage', balancePence: 1 })
    ).rejects.toThrow(/debtType must be one of/);
  });
});

describe('mutation events', () => {
  it('dispatches db:mutated on add', async () => {
    let fired = 0;
    const handler = () => { fired += 1; };
    window.addEventListener('db:mutated', handler);
    await childrenRepo.add({ name: 'Kid', providerMonthlyCostPence: 500, tfcBalancePence: 100 });
    window.removeEventListener('db:mutated', handler);
    expect(fired).toBe(1);
  });
});

describe('recurringBills dueDayAnchor default (M4)', () => {
  it('defaults dueDayAnchor from the nextDueDate day when absent', async () => {
    const id = await recurringBillsRepo.add({
      label: 'Rent',
      amountPence: 800,
      categoryId: 1,
      frequency: 'monthly',
      nextDueDate: '2026-01-31',
    });
    const raw = await db.recurringBills.get(id);
    expect(raw.dueDayAnchor).toBe(31);
  });

  it('keeps an explicitly supplied anchor', async () => {
    const id = await recurringBillsRepo.add({
      label: 'Rent',
      amountPence: 800,
      categoryId: 1,
      frequency: 'monthly',
      nextDueDate: '2026-02-28',
      dueDayAnchor: 31,
    });
    const raw = await db.recurringBills.get(id);
    expect(raw.dueDayAnchor).toBe(31);
  });
});

describe('category delete cascades its learned mappings (L4)', () => {
  it('removes categoryMappings pointing at the deleted category', async () => {
    const catId = await categoriesRepo.add({ name: 'Streaming', kind: 'spending' });
    const otherId = await categoriesRepo.add({ name: 'Groceries', kind: 'spending' });
    await categoryMappingsRepo.upsert('netflix', catId);
    await categoryMappingsRepo.upsert('spotify', catId);
    await categoryMappingsRepo.upsert('tesco', otherId);

    await categoriesRepo.delete(catId);

    const remaining = await db.categoryMappings.toArray();
    // Both mappings for the deleted category are gone; the unrelated one stays.
    expect(remaining).toHaveLength(1);
    expect(remaining[0].descriptionKey).toBe('tesco');
    expect(await db.categories.get(catId)).toBeUndefined();
  });
});
