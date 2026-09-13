// src/ui/expenses/ExpensesTable.jsx
import { useState } from 'react';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDay } from '../components/dates.js';
import SortHeader from './SortHeader.jsx';
import { sortRows, toggleSort } from './sortRows.js';
import { expenseTotals } from './tableRows.js';
import { FREQ_SUFFIX } from './ExpenseCard.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'amountPence', label: 'Amount', numeric: true },
  { key: 'frequency', label: 'Frequency' },
  { key: 'perMonthPence', label: 'Per month', numeric: true },
  { key: 'perYearPence', label: 'Per year', numeric: true },
  { key: 'nextDate', label: 'Next payment' },
  { key: 'status', label: 'Status' },
];

const STATUS_LABEL = { active: 'Active', paused: 'Paused', ended: 'Ended' };

/**
 * Read-only, sortable table of every recurring expense and childcare deposit
 * (design §3.2). `rows` come from `buildExpenseRows` (pence).
 */
export default function ExpensesTable({ rows, onJump }) {
  const [sort, setSort] = useState({ key: 'perMonthPence', dir: 'desc' });
  const sorted = sortRows(rows, sort.key, sort.dir);
  const totals = expenseTotals(rows);

  return (
    <section className="panel">
      <h3 className="panel__title">Recurring expenses</h3>
      {rows.length === 0 ? (
        <EmptyState hint="No recurring expenses yet. Add one from the Cards view." />
      ) : (
        <div className="table-wrap">
          <table className="table expenses-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <SortHeader
                    key={c.key}
                    column={c.key}
                    label={c.label}
                    numeric={c.numeric}
                    sort={sort}
                    onSort={(key) => setSort(toggleSort(sort, key))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className={r.status === 'active' ? undefined : 'is-inactive'}>
                  <td>
                    <button type="button" className="rowlink" onClick={() => onJump(r.domId)}>
                      {r.name}
                    </button>
                  </td>
                  <td>{r.category}</td>
                  <td className="num">
                    <Money pence={r.amountPence} />
                  </td>
                  <td>{FREQ_SUFFIX[r.frequency] ?? r.frequency}</td>
                  <td className="num">
                    <Money pence={r.perMonthPence} />
                  </td>
                  <td className="num">
                    <Money pence={r.perYearPence} />
                  </td>
                  <td>
                    {r.nextDate ? formatDay(r.nextDate) : '—'}
                    {r.nextAdjusted && <span className="tag">shifted</span>}
                  </td>
                  <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="txn-totals">
                <td>Total</td>
                <td />
                <td />
                <td />
                <td className="num">
                  <Money pence={totals.perMonthPence} />
                </td>
                <td className="num">
                  <Money pence={totals.perYearPence} />
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
