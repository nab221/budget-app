import { useState } from 'react';
import Money from '../components/Money.jsx';

const INITIAL_VISIBLE = 24;

/**
 * Consolidated month-by-month payoff schedule (spec §4.4), built from a
 * `simulatePayoff` history. First 24 months shown; the rest expand on request.
 * Scrolls inside its own container so the page never scrolls sideways.
 */
export default function ScheduleTable({ history }) {
  const [expanded, setExpanded] = useState(false);

  if (!history || history.length === 0) {
    return <p className="muted">No schedule to show.</p>;
  }

  const rows = expanded ? history : history.slice(0, INITIAL_VISIBLE);
  const hasMore = history.length > INITIAL_VISIBLE;

  return (
    <div className="schedule">
      <div className="table-wrap schedule__scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Paid</th>
              <th className="num">Interest</th>
              <th className="num">Principal</th>
              <th className="num">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const paid = m.payments.reduce((t, p) => t + p.amount, 0);
              return (
                <tr key={m.month}>
                  <td>{m.date}</td>
                  <td className="num">
                    <Money pence={paid} />
                  </td>
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
      {hasMore && (
        <button type="button" className="btn btn--sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show first 24 months' : `Show all ${history.length} months`}
        </button>
      )}
    </div>
  );
}
