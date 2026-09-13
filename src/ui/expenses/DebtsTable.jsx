// src/ui/expenses/DebtsTable.jsx
import { useState } from 'react';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDay, formatPayMonth } from '../components/dates.js';
import SortHeader from './SortHeader.jsx';
import { sortRows, toggleSort } from './sortRows.js';
import { debtTotals } from './tableRows.js';

const COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'balancePence', label: 'Balance', numeric: true },
  { key: 'ratePercent', label: 'Rate', numeric: true },
  { key: 'paymentPence', label: 'Payment', numeric: true },
  { key: 'interestPence', label: 'Interest / month', numeric: true },
  { key: 'utilisation', label: 'Utilisation', numeric: true },
  { key: 'payoffMonth', label: 'Payoff' },
  { key: 'nextDate', label: 'Next payment' },
];

/**
 * Read-only, sortable table of every credit card and loan (design §3.1).
 * `rows` come from `buildDebtRows` (pence). Clicking a name calls
 * `onJump(domId)` so the tab can return to that card.
 */
export default function DebtsTable({ rows, onJump }) {
  const [sort, setSort] = useState({ key: 'ratePercent', dir: 'desc' });
  const sorted = sortRows(rows, sort.key, sort.dir);
  const totals = debtTotals(rows);

  return (
    <section className="panel">
      <h3 className="panel__title">Debts</h3>
      {rows.length === 0 ? (
        <EmptyState hint="No credit cards or loans yet. Add one from the Cards view." />
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
                <tr key={r.id}>
                  <td>
                    <button type="button" className="rowlink" onClick={() => onJump(r.domId)}>
                      {r.name}
                    </button>
                  </td>
                  <td>{r.type}</td>
                  <td className="num">
                    <Money pence={r.balancePence} />
                  </td>
                  <td className="num">
                    {r.promoActive ? (
                      <span className="badge badge--promo" title={`Then ${r.postPromoApr}%`}>
                        0% until {formatDay(r.promoEndDate)}
                      </span>
                    ) : (
                      `${r.ratePercent}%`
                    )}
                  </td>
                  <td className="num">
                    <Money pence={r.paymentPence} />
                  </td>
                  <td className="num">
                    <Money pence={r.interestPence} />
                  </td>
                  <td className="num">
                    {r.utilisation == null ? (
                      '—'
                    ) : (
                      <span className="util util--inline">
                        <span className="util__bar">
                          <span className="util__fill" style={{ width: `${r.utilisation}%` }} />
                        </span>
                        <span>{r.utilisation.toFixed(0)}%</span>
                      </span>
                    )}
                  </td>
                  <td>{r.neverClears ? 'Never' : r.payoffMonth ? formatPayMonth(r.payoffMonth) : '—'}</td>
                  <td>
                    {r.nextDate ? formatDay(r.nextDate) : '—'}
                    {r.nextAdjusted && <span className="tag">shifted</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="txn-totals">
                <td>Total</td>
                <td />
                <td className="num">
                  <Money pence={totals.balancePence} />
                </td>
                <td />
                <td className="num">
                  <Money pence={totals.paymentPence} />
                </td>
                <td className="num">
                  <Money pence={totals.interestPence} />
                </td>
                <td />
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
