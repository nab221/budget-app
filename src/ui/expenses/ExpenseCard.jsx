import Money from '../components/Money.jsx';
import { formatDay } from '../components/dates.js';

const FREQ_SUFFIX = {
  weekly: '/ week',
  '2-weekly': 'every 2 weeks',
  '4-weekly': 'every 4 weeks',
  '5-weekly': 'every 5 weeks',
  '6-weekly': 'every 6 weeks',
  monthly: '/ month',
  quarterly: '/ quarter',
  '6-monthly': 'every 6 months',
  annual: '/ year',
};

/**
 * Panel for one recurring expense: "£xx.xx at [next payment date]".
 * `bill` is a repository row (pounds at the edge); `next` is the computed
 * next occurrence ({ date, isAdjusted, amountPence } — engine pence) or null
 * when the expense is paused or has ended.
 */
export default function ExpenseCard({ bill, next, onToggleActive, onEdit, onDelete }) {
  const paused = bill.active === false;

  return (
    <li className={`card debt-card expense-card${paused ? ' is-inactive' : ''}`}>
      <div className="debt-card__head">
        <span className="debt-card__name">{bill.label}</span>
        {paused && <span className="badge">Paused</span>}
      </div>

      <div className="debt-card__balance">
        <Money pounds={bill.amountPence} className="debt-card__amount" />
        <span className="muted"> {FREQ_SUFFIX[bill.frequency] ?? bill.frequency}</span>
      </div>

      <p className="expense-card__next muted">
        {paused
          ? 'Paused — not counted in totals'
          : next
            ? (
              <>
                Next: {formatDay(next.date)}
                {next.isAdjusted && <span className="tag">shifted</span>}
              </>
            )
            : 'Ended'}
      </p>

      <div className="debt-card__actions">
        <button type="button" className="btn btn--sm" onClick={onToggleActive}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className="btn btn--sm" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="btn btn--sm btn--danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </li>
  );
}
