import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import {
  periodWindow,
  actualTotalPence,
  normalisedTotalPence,
} from '../../engine/spending.js';
import { monthlyInterestPence } from '../../engine/insights.js';
import { debtFreeProjection } from '../../engine/payoff.js';
import Money from '../components/Money.jsx';

const PERIOD_TILES = [
  { period: 'week', label: 'This week', noun: 'weekly' },
  { period: 'month', label: 'This month', noun: 'monthly' },
  { period: 'year', label: 'This year', noun: 'yearly' },
];

// A balance older than this makes the total-debt tile flag staleness (the
// 60-day insight card is the louder escalation).
const BALANCE_HINT_DAYS = 35;

/** Sub-line comparing an actual period total to the long-run average. */
function AverageDelta({ actualPence, avgPence, noun }) {
  const diff = actualPence - avgPence;
  if (Math.abs(diff) < 100) {
    return <span className="muted stat__sub">on your {noun} average</span>;
  }
  return (
    <span className="muted stat__sub">
      <Money pence={Math.abs(diff)} /> {diff > 0 ? 'above' : 'below'} your {noun} average
    </span>
  );
}

/**
 * Z1 — the KPI strip (dashboard plan): the three period totals with their
 * delta to the normalised average, plus total debt, estimated interest cost
 * per month, and the projected debt-free date. Stat tiles only — no charts.
 */
export default function KpiStrip({ data, strategy, extraPence, fromStr, now }) {
  const debts = data.debts || [];
  const withBalance = debts.filter((d) => (d.balancePence || 0) > 0);
  const totalDebtPence = withBalance.reduce((t, d) => t + (d.balancePence || 0), 0);
  const interest = monthlyInterestPence(debts, fromStr);
  const projection = debtFreeProjection(debts, strategy, extraPence, fromStr);

  // Oldest balance update among live debts (null = at least one never set).
  let oldestAgeDays = null;
  let hasUnknownAge = false;
  for (const d of withBalance) {
    if (!d.balanceAsOf) {
      hasUnknownAge = true;
      continue;
    }
    const age = differenceInCalendarDays(parseISO(fromStr), parseISO(d.balanceAsOf));
    if (oldestAgeDays === null || age > oldestAgeDays) oldestAgeDays = age;
  }
  const balancesStale = hasUnknownAge || (oldestAgeDays !== null && oldestAgeDays > BALANCE_HINT_DAYS);

  const debtFreeValue = !projection.hasDebts
    ? '—'
    : projection.neverClears
      ? 'Not on track'
      : format(parseISO(`${projection.clearMonth}-01`), 'MMM yyyy');

  return (
    <section className="panel">
      <h3 className="panel__title">At a glance</h3>
      <div className="tile-row kpi-row">
        {PERIOD_TILES.map(({ period, label, noun }) => {
          const { startStr, endStr } = periodWindow(period, now);
          const actual = actualTotalPence(data, startStr, endStr);
          return (
            <div className="stat" key={period}>
              <span className="stat__label">{label}</span>
              <Money pence={actual} className="stat__value" />
              <AverageDelta
                actualPence={actual}
                avgPence={normalisedTotalPence(data, period, fromStr)}
                noun={noun}
              />
            </div>
          );
        })}

        <div className="stat">
          <span className="stat__label">Total debt</span>
          <Money pence={totalDebtPence} className="stat__value" />
          {totalDebtPence > 0 ? (
            balancesStale ? (
              <span className="stat__sub stat__sub--warn">
                {hasUnknownAge
                  ? 'some balances never updated'
                  : `oldest balance update ${oldestAgeDays} days ago`}
              </span>
            ) : (
              <span className="muted stat__sub">
                across {withBalance.length} debt{withBalance.length === 1 ? '' : 's'}
              </span>
            )
          ) : (
            <span className="muted stat__sub">nothing owed</span>
          )}
        </div>

        <div className="stat">
          <span className="stat__label">Interest / month</span>
          <Money pence={interest.totalPence} className="stat__value" />
          <span className="muted stat__sub">estimated at current balances</span>
        </div>

        <div className="stat">
          <span className="stat__label">Debt-free</span>
          <span
            className={`stat__value${projection.neverClears ? ' stat__value--neg' : ''}`}
          >
            {debtFreeValue}
          </span>
          {projection.hasDebts ? (
            projection.neverClears ? (
              <span className="stat__sub stat__sub--warn">
                current payments never clear the balance
              </span>
            ) : (
              <span className="muted stat__sub">
                {projection.monthsToClear} months on {strategy}
                {extraPence > 0 && (
                  <>
                    {' + '}
                    <Money pence={extraPence} /> extra
                  </>
                )}
              </span>
            )
          ) : (
            <span className="muted stat__sub">no debts to pay off</span>
          )}
        </div>
      </div>
    </section>
  );
}
