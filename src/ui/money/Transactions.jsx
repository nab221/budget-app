import { useMemo, useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { useLiveData } from '../../db/useLiveData.js';
import { transactionsRepo, categoriesRepo } from '../../db/repositories.js';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import TransactionForm from './TransactionForm.jsx';
import { filterTransactions, computeTotals, sortTransactions } from './transactionFilters.js';

const monthKey = (date) => format(date, 'yyyy-MM');
const monthLabel = (key) => format(parseISO(`${key}-01`), 'MMMM yyyy');
const fmtDate = (iso) => {
  try {
    return format(parseISO(iso), 'd MMM');
  } catch {
    return iso;
  }
};

const SOURCE_LABEL = { manual: 'Manual', import: 'Import', bill: 'Bill' };

/**
 * The "Actual" transactions ledger (spec §4.2): month navigator, a unified
 * income + spending table (add / edit / delete, inline category re-assignment),
 * description search, category filter, and a totals row for the filtered view.
 *
 * All money crosses the pounds↔pence boundary inside the `Money` component and
 * the pure `transactionFilters` helpers; this component only orchestrates.
 */
export default function Transactions() {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data, loading } = useLiveData(async () => {
    const [txns, categories] = await Promise.all([
      transactionsRepo.forMonth(month),
      categoriesRepo.getAll(),
    ]);
    return { txns, categories };
  }, [month]);

  const categories = data?.categories ?? [];
  const allTxns = data?.txns ?? [];
  const catName = (id) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised';
  const catsFor = (kind) =>
    categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'spending'));

  const visible = useMemo(
    () => sortTransactions(filterTransactions(allTxns, { search, categoryId })),
    [allTxns, search, categoryId]
  );
  const totals = useMemo(() => computeTotals(visible), [visible]);

  const shift = (n) => setMonth(monthKey(addMonths(parseISO(`${month}-01`), n)));

  const add = async (payload) => {
    await transactionsRepo.add({ ...payload, source: 'manual' });
    setAdding(false);
  };
  const save = async (id, payload) => {
    await transactionsRepo.update(id, payload);
    setEditingId(null);
  };
  const changeCategory = (t, nextCategoryId) =>
    transactionsRepo.update(t.id, { categoryId: Number(nextCategoryId) });
  const remove = async () => {
    await transactionsRepo.delete(confirmDelete.id);
    setConfirmDelete(null);
  };

  const hasAnyThisMonth = allTxns.length > 0;

  return (
    <section className="subsection">
      <div className="subsection__head">
        <div>
          <h3>Transactions</h3>
          <p className="payperiod__label">{monthLabel(month)}</p>
        </div>
        <div className="txn-toolbar">
          <div className="payperiod__nav">
            <button type="button" className="btn btn--sm" onClick={() => shift(-1)}>
              ‹ Prev
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setMonth(monthKey(new Date()))}
              disabled={month === monthKey(new Date())}
            >
              This month
            </button>
            <button type="button" className="btn btn--sm" onClick={() => shift(1)}>
              Next ›
            </button>
          </div>
          {!adding && (
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              Add transaction
            </button>
          )}
        </div>
      </div>

      {adding && (
        <TransactionForm
          categories={categories}
          onSubmit={add}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="txn-filters">
        <input
          className="input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description…"
          aria-label="Search transactions by description"
        />
        <select
          className="input"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : !hasAnyThisMonth ? (
        <EmptyState
          title="No transactions this month"
          hint="Add a one-off transaction, mark a bill as paid, or import a bank statement to populate this month."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No matches"
          hint="No transactions match your search and filter for this month."
        />
      ) : (
        <div className="table-wrap">
          <table className="table txn-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th className="num">Amount</th>
                <th>Source</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((t) =>
                editingId === t.id ? (
                  <tr key={t.id}>
                    <td colSpan={7}>
                      <TransactionForm
                        initial={t}
                        categories={categories}
                        onSubmit={(payload) => save(t.id, payload)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td>{fmtDate(t.date)}</td>
                    <td>{t.description || <span className="muted">—</span>}</td>
                    <td>
                      <select
                        className="input input--inline"
                        value={t.categoryId ?? ''}
                        onChange={(e) => changeCategory(t, e.target.value)}
                        aria-label={`Category for ${t.description || 'transaction'}`}
                      >
                        {!catsFor(t.kind).some((c) => c.id === t.categoryId) && (
                          <option value={t.categoryId ?? ''}>{catName(t.categoryId)}</option>
                        )}
                        {catsFor(t.kind).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`badge badge--${t.kind}`}>
                        {t.kind === 'income' ? 'Income' : 'Spend'}
                      </span>
                    </td>
                    <td className="num">
                      {t.kind === 'income' ? (
                        <span className="amount amount--income">
                          +<Money pounds={t.amountPence} />
                        </span>
                      ) : (
                        <Money pounds={t.amountPence} />
                      )}
                    </td>
                    <td>
                      <span className="badge badge--source">{SOURCE_LABEL[t.source] ?? t.source}</span>
                    </td>
                    <td className="row-actions">
                      <button type="button" className="btn btn--sm" onClick={() => setEditingId(t.id)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        onClick={() => setConfirmDelete(t)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
            <tfoot>
              <tr className="txn-totals">
                <td colSpan={4}>
                  {totals.count} shown · Income <Money pence={totals.incomePence} /> · Spend{' '}
                  <Money pence={totals.spendPence} />
                </td>
                <td className="num">
                  <Money
                    pence={totals.netPence}
                    className={totals.netPence < 0 ? 'stat__value--neg' : ''}
                  />
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete transaction"
        message={
          confirmDelete
            ? `Delete "${confirmDelete.description || 'this transaction'}"? This can't be undone.${
                confirmDelete.source === 'bill'
                  ? ' It was created by marking a bill paid — deleting it here will not roll the bill’s next due date back (use “Unmark” for that).'
                  : ''
              }`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
