import Money from '../components/Money.jsx';

const aprLabel = (row) => {
  if (row.promoActive) return '0% promo';
  return `${row.effectiveApr}%`;
};

/**
 * The "which card do I pay?" breakdown for the selected strategy (spec §4.4).
 * Debts appear in priority order — #1 is where the extra money goes — with
 * this month's payment split into minimum + extra and the month each clears.
 */
export default function PaymentPlan({ breakdown, extraPence }) {
  const { rows } = breakdown;
  if (rows.length === 0) return null;

  const focus = rows.find((r) => r.id === breakdown.focusId) ?? rows[0];

  return (
    <div className="payment-plan">
      {focus.extraPence > 0 ? (
        <p className="payment-plan__callout">
          This month: pay the minimum on every card, plus{' '}
          <strong>
            <Money pence={focus.extraPence} /> extra to {focus.name}
          </strong>
          . When it clears, the money rolls onto the next card down.
        </p>
      ) : extraPence > 0 ? (
        // Extra is set but nothing can absorb it — every balance is already
        // covered by its own minimum this month.
        <p className="payment-plan__callout">
          The minimum payments alone clear every balance this month — no extra needed.
        </p>
      ) : (
        <p className="payment-plan__callout payment-plan__callout--warn">
          No extra payment set — minimums only. The order below still shows which card your
          extra money should hit first once you have some.
        </p>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Card</th>
              <th className="num">APR</th>
              <th className="num">Balance</th>
              <th className="num">Pay this month</th>
              <th className="num">of which extra</th>
              <th className="num">Cleared by</th>
              <th className="num">Interest paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.id === breakdown.focusId ? 'strategy-row--selected' : ''}>
                <td className="num">{row.priority}</td>
                <td>{row.name}</td>
                <td className="num">{aprLabel(row)}</td>
                <td className="num">
                  <Money pence={row.balancePence} />
                </td>
                <td className="num">
                  <Money pence={row.paymentPence} />
                </td>
                <td className="num">
                  {row.extraPence > 0 ? <Money pence={row.extraPence} /> : '—'}
                </td>
                <td className="num">{row.neverClears ? 'Never' : row.clearedLabel}</td>
                <td className="num">
                  <Money pence={row.totalInterestPence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
