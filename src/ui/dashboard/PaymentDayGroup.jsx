import Money from '../components/Money.jsx';
import { formatDay } from '../components/dates.js';

/**
 * One day's committed payments: a header carrying the date and that day's
 * total, then each payment as `label · amount`. Shared by the payment
 * calendar's selected-day detail and the dashboard's "Next payments" list, so
 * both read identically. Totals are summed live from `rows` — nothing persisted.
 *
 * @param {{ dateStr: string, rows: Array<{label, amountPence, isAdjusted}> }}
 */
export default function PaymentDayGroup({ dateStr, rows }) {
  const totalPence = rows.reduce((t, r) => t + (r.amountPence || 0), 0);
  return (
    <div className="day-group">
      <div className="day-group__head">
        <span className="day-group__date">{formatDay(dateStr)}</span>
        <Money pence={totalPence} className="day-group__total" />
      </div>
      <ul className="upcoming-list">
        {rows.map((r, i) => (
          <li className="upcoming-list__row" key={`${r.label}-${i}`}>
            <span className="upcoming-list__label">
              {r.label}
              {r.isAdjusted && <span className="tag">shifted</span>}
            </span>
            <Money pence={r.amountPence} className="upcoming-list__amount" />
          </li>
        ))}
      </ul>
    </div>
  );
}
