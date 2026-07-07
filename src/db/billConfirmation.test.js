import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema.js';
import { recurringBillsRepo, transactionsRepo } from './repositories.js';
import { confirmBillPayment, unconfirmBillPayment } from './billConfirmation.js';

beforeEach(resetDb);

async function makeBill(over = {}) {
  const id = await recurringBillsRepo.add({
    label: 'Netflix',
    amountPence: 15, // £15 (pounds at the edge)
    categoryId: 7,
    frequency: 'monthly',
    nextDueDate: '2026-01-15',
    adjustToWorkingDay: true,
    active: true,
    ...over,
  });
  return recurringBillsRepo.get(id); // pounds edge
}

describe('confirmBillPayment', () => {
  it('creates a linked spend transaction and advances nextDueDate one month (monthly)', async () => {
    const bill = await makeBill({ frequency: 'monthly', nextDueDate: '2026-01-15' });
    const result = await confirmBillPayment(bill, bill.nextDueDate);

    expect(result.created).toBe(true);
    expect(result.nextDueDate).toBe('2026-02-15');

    const tx = await transactionsRepo.get(result.transactionId);
    expect(tx.source).toBe('bill');
    expect(tx.billId).toBe(bill.id);
    expect(tx.kind).toBe('spend');
    expect(tx.date).toBe('2026-01-15');
    expect(tx.description).toBe('Netflix');
    expect(tx.amountPence).toBeCloseTo(15, 5); // pounds at the edge
    // raw row is integer pence
    const raw = await db.transactions.get(result.transactionId);
    expect(raw.amountPence).toBe(1500);

    const after = await recurringBillsRepo.get(bill.id);
    expect(after.nextDueDate).toBe('2026-02-15');
  });

  it('advances by 3 months for quarterly', async () => {
    const bill = await makeBill({ frequency: 'quarterly', nextDueDate: '2026-01-15' });
    const result = await confirmBillPayment(bill, bill.nextDueDate);
    expect(result.nextDueDate).toBe('2026-04-15');
  });

  it('advances by a full year for annual (not treated as monthly)', async () => {
    const bill = await makeBill({ frequency: 'annual', nextDueDate: '2026-02-15' });
    const result = await confirmBillPayment(bill, bill.nextDueDate);
    expect(result.nextDueDate).toBe('2027-02-15');
    const after = await recurringBillsRepo.get(bill.id);
    expect(after.nextDueDate).toBe('2027-02-15');
  });

  it('honours an amount override at confirm time', async () => {
    const bill = await makeBill({ amountPence: 15 });
    const result = await confirmBillPayment(bill, bill.nextDueDate, { amountPounds: 17.5 });
    const raw = await db.transactions.get(result.transactionId);
    expect(raw.amountPence).toBe(1750);
  });

  it('is idempotent — a duplicate confirm creates nothing and does not advance again', async () => {
    const bill = await makeBill({ frequency: 'monthly', nextDueDate: '2026-01-15' });
    await confirmBillPayment(bill, bill.nextDueDate);

    // Re-fetch is unnecessary: guard keys off billId + occurrenceDate.
    const second = await confirmBillPayment(bill, bill.nextDueDate);
    expect(second.created).toBe(false);
    expect(second.alreadyConfirmed).toBe(true);

    const all = await db.transactions.toArray();
    expect(all.filter((t) => t.source === 'bill' && t.billId === bill.id)).toHaveLength(1);

    const after = await recurringBillsRepo.get(bill.id);
    expect(after.nextDueDate).toBe('2026-02-15'); // advanced once only
  });

  it('defaults occurrenceDate to the bill nextDueDate', async () => {
    const bill = await makeBill({ nextDueDate: '2026-03-01' });
    const result = await confirmBillPayment(bill);
    const tx = await transactionsRepo.get(result.transactionId);
    expect(tx.date).toBe('2026-03-01');
  });
});

describe('unconfirmBillPayment', () => {
  it('round-trips: deletes the row and rolls nextDueDate back exactly one step', async () => {
    for (const [frequency, start, advanced] of [
      ['monthly', '2026-01-15', '2026-02-15'],
      ['quarterly', '2026-01-15', '2026-04-15'],
      ['annual', '2026-02-15', '2027-02-15'],
    ]) {
      await resetDb();
      const bill = await makeBill({ frequency, nextDueDate: start });
      const confirmed = await confirmBillPayment(bill, bill.nextDueDate);
      expect((await recurringBillsRepo.get(bill.id)).nextDueDate).toBe(advanced);

      const tx = await transactionsRepo.get(confirmed.transactionId);
      const undo = await unconfirmBillPayment(tx);

      expect(undo.deleted).toBe(true);
      expect(undo.rolledBack).toBe(true);
      expect(await transactionsRepo.get(confirmed.transactionId)).toBeUndefined();
      expect((await recurringBillsRepo.get(bill.id)).nextDueDate).toBe(start);
    }
  });

  it('deletes but does NOT roll back when nextDueDate has drifted', async () => {
    const bill = await makeBill({ frequency: 'monthly', nextDueDate: '2026-01-15' });
    const confirmed = await confirmBillPayment(bill, bill.nextDueDate);

    // Simulate drift: the bill's due date moved on (e.g. a later confirm/edit).
    await recurringBillsRepo.update(bill.id, { nextDueDate: '2026-05-15' });

    const tx = await transactionsRepo.get(confirmed.transactionId);
    const undo = await unconfirmBillPayment(tx);

    expect(undo.deleted).toBe(true);
    expect(undo.rolledBack).toBe(false);
    expect(undo.reason).toBe('drifted');
    expect(undo.warning).toBeTruthy();
    expect(await transactionsRepo.get(confirmed.transactionId)).toBeUndefined();
    // due date left untouched
    expect((await recurringBillsRepo.get(bill.id)).nextDueDate).toBe('2026-05-15');
  });

  it('deletes the row and warns when the linked bill no longer exists', async () => {
    const bill = await makeBill();
    const confirmed = await confirmBillPayment(bill, bill.nextDueDate);
    await recurringBillsRepo.delete(bill.id);

    const tx = await transactionsRepo.get(confirmed.transactionId);
    const undo = await unconfirmBillPayment(tx);

    expect(undo.deleted).toBe(true);
    expect(undo.rolledBack).toBe(false);
    expect(undo.reason).toBe('bill-missing');
    expect(await transactionsRepo.get(confirmed.transactionId)).toBeUndefined();
  });
});

describe('transactionsRepo bill-confirmation query helpers', () => {
  it('findBillPayment locates an existing confirmation', async () => {
    const bill = await makeBill({ nextDueDate: '2026-01-15' });
    await confirmBillPayment(bill, bill.nextDueDate);
    const found = await transactionsRepo.findBillPayment(bill.id, '2026-01-15');
    expect(found).toBeTruthy();
    expect(found.source).toBe('bill');
    const missing = await transactionsRepo.findBillPayment(bill.id, '2026-01-16');
    expect(missing).toBeNull();
  });

  it('billPaymentsBetween returns only bill-source rows inside the half-open window', async () => {
    const bill = await makeBill({ nextDueDate: '2026-01-15' });
    await confirmBillPayment(bill, bill.nextDueDate); // 2026-01-15
    // a manual spend in-window should NOT be returned
    await transactionsRepo.add({
      date: '2026-01-20',
      kind: 'spend',
      amountPence: 5,
      categoryId: 7,
      description: 'Coffee',
      source: 'manual',
    });

    const inWindow = await transactionsRepo.billPaymentsBetween('2026-01-01', '2026-02-01');
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0].date).toBe('2026-01-15');

    // end is exclusive
    const excludeEnd = await transactionsRepo.billPaymentsBetween('2026-01-16', '2026-02-01');
    expect(excludeEnd).toHaveLength(0);
  });
});
