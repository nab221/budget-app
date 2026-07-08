import { differenceInCalendarDays, parseISO } from 'date-fns';
import { monthlyInterestPence } from '../../engine/insights.js';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDay } from '../components/dates.js';

/**
 * Z5b — debt facts: per-card utilisation meters, 0% promo countdowns, and the
 * per-debt interest cost that explains the KPI strip's "Interest / month".
 */
export default function DebtFacts({ data, fromStr }) {
  const debts = (data.debts || []).filter((d) => (d.balancePence || 0) > 0);
  const interest = monthlyInterestPence(data.debts, fromStr);
  const interestByDebt = new Map(interest.byDebt.map((d) => [d.id, d.pence]));

  const cardsWithLimit = debts.filter(
    (d) => d.debtType === 'credit-card' && (d.creditLimitPence || 0) > 0
  );
  const promos = debts.filter(
    (d) => d.debtType === 'credit-card' && d.promoEndDate && d.promoEndDate >= fromStr
  );

  return (
    <section className="panel">
      <h3 className="panel__title">Debt facts</h3>
      {debts.length === 0 ? (
        <EmptyState hint="No debts with a balance — nothing to worry about here." />
      ) : (
        <>
          {cardsWithLimit.length > 0 && (
            <div className="debtfacts__group">
              {cardsWithLimit.map((d) => {
                const pct = Math.min(
                  100,
                  Math.max(0, (d.balancePence / d.creditLimitPence) * 100)
                );
                return (
                  <div className="util" key={d.id}>
                    <div className="util__label threshold__head">
                      <span>{d.name}</span>
                      <span className="threshold__pct">{pct.toFixed(0)}% used</span>
                    </div>
                    <div className="util__bar">
                      <div
                        className={`util__fill${pct >= 90 ? ' util__fill--high' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="muted util__label">
                      <Money pence={d.balancePence} /> of <Money pence={d.creditLimitPence} />{' '}
                      limit
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {promos.length > 0 && (
            <ul className="debtfacts__promos">
              {promos.map((d) => {
                const days = differenceInCalendarDays(parseISO(d.promoEndDate), parseISO(fromStr));
                return (
                  <li key={d.id} className={`badge badge--promo${days <= 30 ? ' badge--promo-ending' : ''}`}>
                    {d.name}: 0% ends {formatDay(d.promoEndDate)} ({days} day{days === 1 ? '' : 's'})
                  </li>
                );
              })}
            </ul>
          )}

          <table className="table">
            <thead>
              <tr>
                <th>Debt</th>
                <th className="num">Balance</th>
                <th className="num">Interest / month</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="num">
                    <Money pence={d.balancePence} />
                  </td>
                  <td className="num">
                    <Money pence={interestByDebt.get(d.id) || 0} />
                  </td>
                </tr>
              ))}
              <tr className="txn-totals">
                <td>Total</td>
                <td className="num">
                  <Money pence={debts.reduce((t, d) => t + (d.balancePence || 0), 0)} />
                </td>
                <td className="num">
                  <Money pence={interest.totalPence} />
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
