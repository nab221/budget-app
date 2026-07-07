import { useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import { recurringBillsRepo, categoriesRepo } from '../../db/repositories.js';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import RecurringBillForm from './RecurringBillForm.jsx';

const FREQ_LABEL = { monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' };

export default function RecurringBills() {
  const { data, loading } = useLiveData(async () => {
    const [bills, categories] = await Promise.all([
      recurringBillsRepo.getAll(),
      categoriesRepo.getAll(),
    ]);
    return { bills, categories };
  }, []);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const bills = data?.bills ?? [];
  const categories = data?.categories ?? [];
  const spending = categories.filter((c) => c.kind === 'spending');
  const catName = (id) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';

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

      {adding && (
        <RecurringBillForm
          spendingCategories={spending}
          onSubmit={add}
          onCancel={() => setAdding(false)}
        />
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : bills.length === 0 && !adding ? (
        <EmptyState
          title="No recurring bills yet"
          hint="Add subscriptions, utilities, and other repeating payments. These become committed outgoings in the pay-period view."
        />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
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
                    <td colSpan={6}>
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
    </section>
  );
}
