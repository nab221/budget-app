import Money from '../components/Money.jsx';

const monthsLabel = (months, neverClears) => {
  if (neverClears) return 'Never';
  if (months <= 0) return '—';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} mo`;
  return rem === 0 ? `${years} yr` : `${years} yr ${rem} mo`;
};

/**
 * Avalanche vs snowball vs minimums-only comparison table with a strategy
 * picker (spec §4.4). The picked strategy drives the dashboard recommendation.
 */
export default function StrategyComparison({ comparison, strategy, onStrategyChange }) {
  return (
    <div className="table-wrap">
      <table className="table strategy-table">
        <thead>
          <tr>
            <th />
            <th>Strategy</th>
            <th>Payoff order</th>
            <th className="num">Debt-free in</th>
            <th className="num">Total interest</th>
            <th className="num">Interest saved</th>
          </tr>
        </thead>
        <tbody>
          {comparison.rows.map((row) => {
            const selectable = row.key !== 'min';
            const selected = strategy === row.key;
            return (
              <tr key={row.key} className={selected ? 'strategy-row--selected' : ''}>
                <td>
                  {selectable ? (
                    <label className="checkbox">
                      <input
                        type="radio"
                        name="payoff-strategy"
                        checked={selected}
                        onChange={() => onStrategyChange(row.key)}
                      />
                    </label>
                  ) : (
                    <span className="muted">base</span>
                  )}
                </td>
                <td>{row.label}</td>
                <td className="strategy-order">
                  {row.orderNames ? row.orderNames.join(' → ') : <span className="muted">—</span>}
                </td>
                <td className="num">{monthsLabel(row.monthsToClear, row.neverClears)}</td>
                <td className="num">
                  <Money pence={row.totalInterestPence} />
                </td>
                <td className="num">
                  {row.key === 'min' ? '—' : <Money pence={row.interestSavedPence} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
