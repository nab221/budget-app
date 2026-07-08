import { useState } from 'react';
import Money from '../components/Money.jsx';

const INITIAL_VISIBLE = 24;

/**
 * Month-by-month payoff schedule (spec §4.4), built from a `simulatePayoff`
 * history. When `debtColumns` (priority-ordered `{ id, name }`) is provided,
 * each debt gets its own payment column so the owner can see exactly where
 * every month's money goes; the month a card clears is marked. First 24
 * months shown; the rest expand on request. Scrolls inside its own container
 * so the page never scrolls sideways.
 */
export default function ScheduleTable({ history, debtColumns = [] }) {
  const [expanded, setExpanded] = useState(false);

  if (!history || history.length === 0) {
    return <p className="muted">No schedule to show.</p>;
  }

  const rows = expanded ? history : history.slice(0, INITIAL_VISIBLE);
  const hasMore = history.length > INITIAL_VISIBLE;
  const perDebt = debtColumns.length > 1; // one card needs no breakdown

  return (
    <div className="schedule">
      <div className="table-wrap schedule__scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              {perDebt ? (
                debtColumns.map((d) => (
                  <th key={d.id} className="num">
                    {d.name}
                  </th>
                ))
              ) : (
                <th className="num">Paid</th>
              )}
              <th className="num">Interest</th>
              <th className="num">Principal</th>
              <th className="num">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const paid = m.payments.reduce((t, p) => t + p.amount, 0);
              const byDebt = new Map(m.payments.map((p) => [p.debtId, p]));
              return (
                <tr key={m.month}>
                  <td>{m.date}</td>
                  {perDebt ? (
                    debtColumns.map((d) => {
                      const p = byDebt.get(d.id);
                      if (!p || p.amount <= 0) {
                        return (
                          <td key={d.id} className="num muted">
                            —
                          </td>
                        );
                      }
                      const clearsThisMonth = p.remainingBalance === 0;
                      return (
                        <td
                          key={d.id}
                          className={`num${clearsThisMonth ? ' schedule__cell--cleared' : ''}`}
                        >
                          <Money pence={p.amount} />
                          {clearsThisMonth && <span className="schedule__cleared-mark"> ✓</span>}
                        </td>
                      );
                    })
                  ) : (
                    <td className="num">
                      <Money pence={paid} />
                    </td>
                  )}
                  <td className="num">
                    <Money pence={m.totalInterestCharged} />
                  </td>
                  <td className="num">
                    <Money pence={m.totalPrincipalPaid} />
                  </td>
                  <td className="num">
                    <Money pence={m.totalRemainingBalance} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {perDebt && (
        <p className="muted schedule__legend">✓ marks the month a card is fully cleared.</p>
      )}
      {hasMore && (
        <button type="button" className="btn btn--sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show first 24 months' : `Show all ${history.length} months`}
        </button>
      )}
    </div>
  );
}
