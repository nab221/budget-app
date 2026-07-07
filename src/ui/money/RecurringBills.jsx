import { useMemo, useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import {
  recurringBillsRepo,
  categoriesRepo,
  debtsRepo,
  transactionsRepo,
} from '../../db/repositories.js';
import { confirmBillPayment } from '../../db/billConfirmation.js';
import { confirmDebtPayment } from '../../db/debtPayment.js';
import { buildDebtBillRows } from './debtBillRows.js';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import RecurringBillForm from './RecurringBillForm.jsx';
import MarkPaidControl from './MarkPaidControl.jsx';

const FREQ_LABEL = {
  weekly: 'Weekly',
  '2-weekly': 'Every 2 weeks',
  '4-weekly': 'Every 4 weeks',
  '5-weekly': 'Every 5 weeks',
  '6-weekly': 'Every 6 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  '6-monthly': 'Every 6 months',
  annual: 'Annually',
};

export default function RecurringBills() {
  const { data, loading } = useLiveData(async () => {
    const [bills, categories, debts, debtPayments] = await Promise.all([
      recurringBillsRepo.getAll(),
      categoriesRepo.getAll(),
      debtsRepo.getAll(),
      transactionsRepo.debtPaymentOccurrences(),
    ]);
    return { bills, categories, debts, debtPayments };
  }, []);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [payingKey, setPayingKey] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const bills = data?.bills ?? [];
  const categories = data?.categories ?? [];
  const debts = data?.debts ?? [];
  const debtPayments = data?.debtPayments ?? [];
  const spending = categories.filter((c) => c.kind === 'spending');
  const catName = (id) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';

  const debtRows = useMemo(
    () => buildDebtBillRows(debts, debtPayments, new Date()),
    [debts, debtPayments]
  );
  const debtById = useMemo(() => new Map(debts.map((d) => [d.id, d])), [debts]);

  // Descriptor per selectable/confirmable row, keyed by a stable string.
  const rowByKey = useMemo(() => {
    const m = new Map();
    for (const b of bills) {
      if (b.active) m.set(`bill:${b.id}`, { type: 'bill', label: b.label, amountPounds: b.amountPence, bill: b });
    }
    for (const r of debtRows) {
      m.set(`debt:${r.debtId}`, { type: 'debt', label: r.label, amountPounds: r.amountPounds, row: r });
    }
    return m;
  }, [bills, debtRows]);

  const add = async (payload) => {
    await recurringBillsRepo.add(payload);
    setAdding(false);
  };
  const save = async (id, payload) => {
    await recurringBillsRepo.update(id, payload);
    setEditingId(null);
  };
  const remove = async () => {
    await recurringBillsRepo.delete(confirmDelete.id);
    setConfirmDelete(null);
  };
  const toggleActive = (b) => recurringBillsRepo.update(b.id, { active: !b.active });

  // Confirm a single descriptor at the given pounds amount.
  const confirmRow = (desc, amountPounds) => {
    if (desc.type === 'bill') {
      return confirmBillPayment(desc.bill, desc.bill.nextDueDate, { amountPounds });
    }
    const debt = debtById.get(desc.row.debtId);
    return confirmDebtPayment(debt, desc.row.occurrenceDate, { amountPounds, categories });
  };

  const markPaid = async (key, amountPounds) => {
    const desc = rowByKey.get(key);
    if (!desc) return;
    const result = await confirmRow(desc, amountPounds);
    setPayingKey(null);
    setNotice(
      result.created
        ? `Marked "${desc.label}" paid.`
        : `"${desc.label}" was already marked paid.`
    );
  };

  const toggleSelect = (key) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectedKeys = [...selected].filter((k) => rowByKey.has(k));
  const selectedTotalPounds = selectedKeys.reduce(
    (sum, k) => sum + (rowByKey.get(k)?.amountPounds || 0),
    0
  );

  const runBulk = async () => {
    setBulkBusy(true);
    try {
      let count = 0;
      for (const key of selectedKeys) {
        const desc = rowByKey.get(key);
        if (!desc) continue;
        // Sequential: one db:mutated storm at the end is fine (bills advance,
        // debt occurrences drop). Await each so writes never interleave.
        // eslint-disable-next-line no-await-in-loop
        const result = await confirmRow(desc, desc.amountPounds);
        if (result.created) count += 1;
      }
      setSelected(new Set());
      setBulkConfirmOpen(false);
      setNotice(`Marked ${count} item${count === 1 ? '' : 's'} paid.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const hasRows = bills.length > 0 || debtRows.length > 0;

  return (
    <section className="subsection">
      <div className="subsection__head">
        <h3>Recurring bills</h3>
        {!adding && (
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            Add bill
          </button>
        )}
      </div>

      {notice && (
        <div className="banner banner--info" role="status">
          {notice}
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      )}

      {adding && (
        <RecurringBillForm
          spendingCategories={spending}
          onSubmit={add}
          onCancel={() => setAdding(false)}
        />
      )}

      {selectedKeys.length > 0 && (
        <div className="bulk-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={bulkBusy}
            onClick={() => setBulkConfirmOpen(true)}
          >
            {bulkBusy ? 'Marking…' : `Mark selected paid (${selectedKeys.length})`}
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : !hasRows && !adding ? (
        <EmptyState
          title="No recurring bills yet"
          hint="Add subscriptions, utilities, and other repeating payments. These become committed outgoings in the pay-period view. Active debts also appear here as read-only payment rows."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Label</th>
                <th>Category</th>
                <th className="num">Amount</th>
                <th>Frequency</th>
                <th>Next due</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {bills.map((b) =>
                editingId === b.id ? (
                  <tr key={b.id}>
                    <td colSpan={7}>
                      <RecurringBillForm
                        initial={b}
                        spendingCategories={spending}
                        onSubmit={(payload) => save(b.id, payload)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={b.id} className={b.active ? '' : 'is-inactive'}>
                    <td className="select-cell">
                      {b.active && (
                        <input
                          type="checkbox"
                          checked={selected.has(`bill:${b.id}`)}
                          onChange={() => toggleSelect(`bill:${b.id}`)}
                          aria-label={`Select ${b.label}`}
                        />
                      )}
                    </td>
                    <td>
                      {b.label}
                      {!b.adjustToWorkingDay && <span className="tag">no WD shift</span>}
                    </td>
                    <td>{catName(b.categoryId)}</td>
                    <td className="num">
                      <Money pounds={b.amountPence} />
                    </td>
                    <td>{FREQ_LABEL[b.frequency] ?? b.frequency}</td>
                    <td>{b.nextDueDate}</td>
                    <td className="row-actions">
                      {b.active &&
                        (payingKey === `bill:${b.id}` ? (
                          <MarkPaidControl
                            label={b.label}
                            occurrenceDate={b.nextDueDate}
                            defaultAmountPounds={b.amountPence}
                            onConfirm={(amt) => markPaid(`bill:${b.id}`, amt)}
                            onCancel={() => setPayingKey(null)}
                          />
                        ) : (
                          <button
                            type="button"
                            className="btn btn--sm btn--primary"
                            onClick={() => {
                              setNotice(null);
                              setPayingKey(`bill:${b.id}`);
                            }}
                          >
                            Mark paid
                          </button>
                        ))}
                      <button type="button" className="btn btn--sm" onClick={() => toggleActive(b)}>
                        {b.active ? 'Active' : 'Inactive'}
                      </button>
                      <button type="button" className="btn btn--sm" onClick={() => setEditingId(b.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        onClick={() => setConfirmDelete(b)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}

              {/* Derived, read-only debt-payment rows (spec §4.2/§4.3). Edits
                  happen on the Debts tab; here they only support Mark paid. */}
              {debtRows.map((r) => {
                const key = `debt:${r.debtId}`;
                return (
                  <tr key={key} className="row--derived">
                    <td className="select-cell">
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => toggleSelect(key)}
                        aria-label={`Select ${r.label}`}
                      />
                    </td>
                    <td>
                      {r.label}
                      <span className="tag tag--from-debts">from Debts</span>
                    </td>
                    <td>Debt Payment</td>
                    <td className="num">
                      <Money pence={r.amountPence} />
                    </td>
                    <td>Monthly</td>
                    <td>
                      {r.occurrenceDate}
                      {r.isAdjusted && <span className="tag">shifted</span>}
                    </td>
                    <td className="row-actions">
                      {payingKey === key ? (
                        <MarkPaidControl
                          label={r.label}
                          occurrenceDate={r.occurrenceDate}
                          defaultAmountPounds={r.amountPounds}
                          onConfirm={(amt) => markPaid(key, amt)}
                          onCancel={() => setPayingKey(null)}
                        />
                      ) : (
                        <button
                          type="button"
                          className="btn btn--sm btn--primary"
                          onClick={() => {
                            setNotice(null);
                            setPayingKey(key);
                          }}
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete bill"
        message={confirmDelete ? `Delete "${confirmDelete.label}"? This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="Mark selected paid"
        message={`Mark ${selectedKeys.length} item${selectedKeys.length === 1 ? '' : 's'} paid, totalling £${selectedTotalPounds.toFixed(2)}? Each is confirmed at its planned amount.`}
        confirmLabel="Mark paid"
        onConfirm={runBulk}
        onCancel={() => setBulkConfirmOpen(false)}
      />
    </section>
  );
}
