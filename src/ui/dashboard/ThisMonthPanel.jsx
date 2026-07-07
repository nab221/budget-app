import { useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import { useLiveData } from '../../db/useLiveData.js';
import { transactionsRepo, categoriesRepo } from '../../db/repositories.js';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { summariseMonth } from './monthSummary.js';

const monthKey = (date) => format(date, 'yyyy-MM');
const monthLabel = (key) => format(parseISO(`${key}-01`), 'MMMM yyyy');

/**
 * The spending-review panel (spec §4.1): month navigator, income/spending/net
 * totals, and a sorted spending-by-category table. Reads real transactions
 * (empty until Phase 4 — a gentle empty state covers that).
 */
export default function ThisMonthPanel() {
  const [month, setMonth] = useState(monthKey(new Date()));

  const { data, loading } = useLiveData(async () => {
    const [txns, categories] = await Promise.all([
      transactionsRepo.forMonth(month),
      categoriesRepo.getAll(),
    ]);
    return summariseMonth(txns, categories);
  }, [month]);

  const shift = (n) => setMonth(monthKey(addMonths(parseISO(`${month}-01`), n)));

  return (
    <section className="panel thismonth">
      <div className="payperiod__head">
        <div>
          <h3 className="panel__title">This month</h3>
          <p className="payperiod__label">{monthLabel(month)}</p>
        </div>
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
      </div>

      {loading || !data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="thismonth__totals">
            <div className="stat">
              <span className="stat__label">Income</span>
              <Money pence={data.incomePence} className="stat__value" />
            </div>
            <div className="stat">
              <span className="stat__label">Spending</span>
              <Money pence={data.spendingPence} className="stat__value" />
            </div>
            <div className="stat">
              <span className="stat__label">Net</span>
              <Money
                pence={data.netPence}
                className={`stat__value ${data.netPence < 0 ? 'stat__value--neg' : ''}`}
              />
            </div>
          </div>

          {data.byCategory.length === 0 ? (
            <EmptyState
              title="Nothing recorded yet"
              hint="Once you import a bank statement or add transactions, your spending by category shows up here."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Amount</th>
                    <th className="num">% of spend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byCategory.map((c) => (
                    <tr key={c.categoryId}>
                      <td>{c.name}</td>
                      <td className="num">
                        <Money pence={c.amountPence} />
                      </td>
                      <td className="num">{c.pct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
