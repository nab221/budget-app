/**
 * The balanceUpdates log (dashboard plan §7, schema v4): every path that
 * changes a debt's balance appends a row — creation, the quick update flow
 * (debt card + statement PDF), and the edit form when the balance actually
 * changed — and deleting a debt removes its log.
 */
import { resetDb } from './test-utils.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema.js';
import { debtsRepo, balanceUpdatesRepo } from './repositories.js';

beforeEach(resetDb);

const addCard = (over = {}) =>
  debtsRepo.add({
    name: 'Visa',
    debtType: 'credit-card',
    balancePence: 1000, // £1,000 (pounds at the repo edge)
    apr: 20,
    paymentDayOfMonth: 15,
    balanceAsOf: '2026-07-01',
    ...over,
  });

describe('balanceUpdates log', () => {
  it('creating a debt seeds the log with the opening balance', async () => {
    const id = await addCard();
    const rows = await balanceUpdatesRepo.allByDate();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      debtId: id,
      date: '2026-07-01', // balanceAsOf wins over "today"
      balancePence: 1000, // pounds at the edge, like every repo read
      source: 'create',
    });
    // Pence at rest.
    expect((await db.balanceUpdates.toArray())[0].balancePence).toBe(100000);
  });

  it('updateBalance appends a row (the card + statement-PDF path)', async () => {
    const id = await addCard();
    await debtsRepo.updateBalance(id, 900, '2026-07-08');
    const rows = await balanceUpdatesRepo.allByDate();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      debtId: id,
      date: '2026-07-08',
      balancePence: 900,
      source: 'update',
    });
  });

  it('the edit form logs only when the balance actually changed', async () => {
    const id = await addCard();
    // Edit that keeps the balance → no new row.
    await debtsRepo.update(id, { name: 'Visa Platinum', balancePence: 1000 });
    expect(await balanceUpdatesRepo.allByDate()).toHaveLength(1);
    // Edit that changes it → logged.
    await debtsRepo.update(id, { balancePence: 850, balanceAsOf: '2026-07-09' });
    const rows = await balanceUpdatesRepo.allByDate();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ balancePence: 850, date: '2026-07-09', source: 'edit' });
  });

  it('deleting a debt cascades its log rows away', async () => {
    const id = await addCard();
    const other = await addCard({ name: 'Amex' });
    await debtsRepo.updateBalance(id, 900, '2026-07-08');
    await debtsRepo.delete(id);
    const rows = await balanceUpdatesRepo.allByDate();
    expect(rows).toHaveLength(1);
    expect(rows[0].debtId).toBe(other);
  });
});
