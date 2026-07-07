import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema.js';
import { debtsRepo, transactionsRepo, categoriesRepo } from './repositories.js';
import { confirmDebtPayment, unconfirmDebtPayment } from './debtPayment.js';

beforeEach(resetDb);

describe('confirmDebtPayment', () => {
  it('logs a spend txn linked by debtId, in the Debt Payment category, balance untouched', async () => {
    await categoriesRepo.add({ name: 'Debt Payment', kind: 'spending' }); // id 1
    const debtId = await debtsRepo.add({
      name: 'Visa',
      debtType: 'credit-card',
      balancePence: 2000, // £2000 at the edge
      apr: 24,
      paymentDayOfMonth: 15,
    });
    const debt = await debtsRepo.get(debtId);
    const categories = await categoriesRepo.getAll();

    const result = await confirmDebtPayment(debt, '2026-07-15', { amountPounds: 25, categories });
    expect(result.created).toBe(true);

    const raw = await db.transactions.get(result.transactionId);
    expect(raw.debtId).toBe(debtId);
    expect(raw.source).toBe('bill');
    expect(raw.kind).toBe('spend');
    expect(raw.date).toBe('2026-07-15');
    expect(raw.description).toBe('Visa payment');
    expect(raw.categoryId).toBe(1); // seeded Debt Payment category
    expect(raw.amountPence).toBe(2500); // integer pence at rest
    expect(raw.billId).toBeUndefined();

    // Balance is NOT modified (spec §4.3).
    const after = await debtsRepo.get(debtId);
    expect(after.balancePence).toBe(2000);

    // Idempotent: a second confirm for the same debt + date is a no-op.
    const dup = await confirmDebtPayment(debt, '2026-07-15', { amountPounds: 25, categories });
    expect(dup.created).toBe(false);
    expect(dup.alreadyConfirmed).toBe(true);

    const occ = await transactionsRepo.debtPaymentOccurrences();
    expect(occ).toEqual([{ debtId, date: '2026-07-15' }]);
  });

  it('falls back to the first spending category when Debt Payment is absent', async () => {
    await categoriesRepo.add({ name: 'Groceries', kind: 'spending' }); // id 1
    const debtId = await debtsRepo.add({
      name: 'Car loan',
      debtType: 'loan',
      fixedMonthlyPaymentPence: 250, // £250
      paymentDayOfMonth: 1,
    });
    const debt = await debtsRepo.get(debtId);
    const result = await confirmDebtPayment(debt, '2026-07-01', { amountPounds: 250 });
    const raw = await db.transactions.get(result.transactionId);
    expect(raw.categoryId).toBe(1);
  });
});

describe('unconfirmDebtPayment', () => {
  it('deletes the txn so the occurrence re-appears', async () => {
    await categoriesRepo.add({ name: 'Debt Payment', kind: 'spending' });
    const debtId = await debtsRepo.add({
      name: 'Visa',
      debtType: 'credit-card',
      balancePence: 2000,
      apr: 24,
      paymentDayOfMonth: 15,
    });
    const debt = await debtsRepo.get(debtId);
    const r = await confirmDebtPayment(debt, '2026-07-15', { amountPounds: 25 });
    const tx = await transactionsRepo.get(r.transactionId);

    const undo = await unconfirmDebtPayment(tx);
    expect(undo.deleted).toBe(true);
    expect(await transactionsRepo.get(r.transactionId)).toBeUndefined();
    expect(await transactionsRepo.debtPaymentOccurrences()).toEqual([]);
    // Balance still untouched after the round-trip.
    expect((await debtsRepo.get(debtId)).balancePence).toBe(2000);
  });
});
