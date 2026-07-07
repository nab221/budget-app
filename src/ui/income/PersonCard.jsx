import Money from '../components/Money.jsx';
import { formatDay } from '../components/dates.js';
import { EVENT_KIND_LABELS } from './EventForm.jsx';

/** Whole-pound label for a threshold, e.g. 5027000 → "£50,270". */
const poundsLabel = (pence) =>
  `£${Math.round(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

/**
 * One threshold meter: how far the person's figure is toward a limit, with
 * headroom ("≈ £X more dividends before …") or a crossed state.
 */
function ThresholdMeter({ label, valuePence, limitPence, headroomPence, over, overText }) {
  const pct = limitPence > 0 ? Math.min(100, Math.round((valuePence / limitPence) * 100)) : 0;
  return (
    <div className={`util threshold${over ? ' threshold--over' : ''}`}>
      <div className="util__label threshold__head">
        <span>{label}</span>
        <span className="threshold__pct">{pct}%</span>
      </div>
      <div className="util__bar">
        <div className="util__fill threshold__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="util__label">
        {over ? (
          <span className="threshold__over">{overText}</span>
        ) : (
          <span>
            ≈ <Money pence={headroomPence} /> more dividends before this line
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * A person's tax-year card (spec §4.8): headline income figures, the two
 * threshold meters (£50,270 / £100,000), the tax split, and the year's
 * dividend draws + salary adjustments. Everything displayed here is computed
 * at read time by `gatherIncomeData` — nothing persisted.
 *
 * @param {object} props.entry - one entry from `gatherIncomeData().people`.
 * @param {object} props.table - the tax-year rate table in force (thresholds).
 */
export default function PersonCard({
  entry,
  table,
  onAddDividend,
  onAddAdjustment,
  onEdit,
  onDelete,
  onEditEvent,
  onDeleteEvent,
}) {
  const { name, input, summary, events } = entry;

  return (
    <li className="card person-card">
      <div className="debt-card__head">
        <span className="debt-card__name">{name}</span>
        <div className="debt-card__actions">
          <button type="button" className="btn btn--sm" onClick={onEdit}>
            Edit details
          </button>
          <button type="button" className="btn btn--sm" onClick={onDelete}>
            Remove
          </button>
        </div>
      </div>

      <dl className="debt-card__facts person-card__facts">
        <div>
          <dt>Gross income</dt>
          <dd>
            <Money pence={summary.grossIncomePence} />
          </dd>
        </div>
        <div>
          <dt>Adjusted net income</dt>
          <dd>
            <Money pence={summary.adjustedNetIncomePence} />
          </dd>
        </div>
        <div>
          <dt>Salary (after sacrifice)</dt>
          <dd>
            <Money pence={input.salaryPence} />
          </dd>
        </div>
        <div>
          <dt>Dividends drawn</dt>
          <dd>
            <Money pence={input.dividendTotalPence} />
          </dd>
        </div>
      </dl>

      <ThresholdMeter
        label={`40% tax band (${poundsLabel(table.higherRateThresholdPence)} income)`}
        valuePence={summary.grossIncomePence}
        limitPence={table.higherRateThresholdPence}
        headroomPence={summary.headroomToHigherRatePence}
        over={summary.overHigherRate}
        overText="Over the 40% band — further dividends are taxed at the higher dividend rate."
      />
      <ThresholdMeter
        label={`${poundsLabel(table.taperThresholdPence)} childcare line (adjusted net income)`}
        valuePence={summary.adjustedNetIncomePence}
        limitPence={table.taperThresholdPence}
        headroomPence={summary.headroomTo100kPence}
        over={summary.over100k}
        overText={`Over ${poundsLabel(table.taperThresholdPence)} — the household loses Tax-Free Childcare and free hours.`}
      />

      <div className="person-card__tax">
        <div className="stat">
          <span className="stat__label">Income tax for the year</span>
          <span className="stat__value">
            <Money pence={summary.totalTaxPence} />
          </span>
          <span className="stat__sub">
            of which PAYE on salary ≈ <Money pence={summary.nonDividendTaxPence} />
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Extra bill from dividends</span>
          <span className="stat__value person-card__extra">
            <Money pence={summary.dividendTaxPence} />
          </span>
          <span className="stat__sub">paid later via Self Assessment</span>
        </div>
      </div>

      <div className="debt-card__actions">
        <button type="button" className="btn btn--primary" onClick={onAddDividend}>
          Add dividend draw
        </button>
        <button type="button" className="btn" onClick={onAddAdjustment}>
          Add salary adjustment
        </button>
      </div>

      {events.length > 0 && (
        <ul className="event-list">
          {events.map((ev) => (
            <li key={ev.id} className="event-list__row">
              <span className={`badge badge--${ev.kind === 'dividend' ? 'income' : 'source'}`}>
                {EVENT_KIND_LABELS[ev.kind]}
              </span>
              <span className="event-list__date">{formatDay(ev.date)}</span>
              <span className="event-list__amount">
                <Money pence={ev.amountPence} />
              </span>
              <span className="event-list__note muted">{ev.note}</span>
              <span className="event-list__actions">
                <button type="button" className="btn btn--sm" onClick={() => onEditEvent(ev)}>
                  Edit
                </button>
                <button type="button" className="btn btn--sm" onClick={() => onDeleteEvent(ev)}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
