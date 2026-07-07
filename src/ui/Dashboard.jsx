import { useLiveData } from '../db/useLiveData.js';
import { recurringBillsRepo, debtsRepo, childrenRepo } from '../db/repositories.js';
import {
  mapBillsToPence,
  mapDebtsToPence,
  childcareDepositsFromChildren,
} from '../db/planData.js';
import {
  periodWindow,
  actualTotalPence,
  normalisedTotalPence,
  upcomingPayments,
  localDayStr,
} from '../engine/spending.js';
import Money from './components/Money.jsx';
import EmptyState from './components/EmptyState.jsx';
import { formatDay } from './components/dates.js';

const TILES = [
  { period: 'week', label: 'This week' },
  { period: 'month', label: 'This month' },
  { period: 'year', label: 'This year' },
];

/**
 * Dashboard — deliberately minimal while the full redesign waits its turn:
 * how much goes out this week / month / year, and the next payments due.
 * Everything is computed live from the Expenses schedule (plus the childcare
 * deposits the Childcare tab computes); nothing to confirm.
 */
export default function Dashboard() {
  const { data, loading } = useLiveData(async () => {
    const [bills, debts, children] = await Promise.all([
      recurringBillsRepo.getAll(),
      debtsRepo.getAll(),
      childrenRepo.getAll(),
    ]);
    return {
      recurringBills: mapBillsToPence(bills),
      debts: mapDebtsToPence(debts),
      childcareDeposits: childcareDepositsFromChildren(children),
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="screen">
        <header className="screen__head">
          <h2>Dashboard</h2>
        </header>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const now = new Date();
  const from = localDayStr(now);
  const upcoming = upcomingPayments(data, from, 8);
  const hasAnything =
    (data.recurringBills?.length || 0) +
      (data.debts?.length || 0) +
      (data.childcareDeposits?.length || 0) >
    0;

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Dashboard</h2>
      </header>

      {!hasAnything ? (
        <EmptyState
          title="Nothing set up yet"
          hint="Add your credit cards, loans, and recurring expenses on the Expenses tab — totals and upcoming payments appear here."
        />
      ) : (
        <>
          <section className="panel">
            <h3 className="panel__title">Going out</h3>
            <div className="tile-row">
              {TILES.map(({ period, label }) => {
                const { startStr, endStr } = periodWindow(period, now);
                return (
                  <div className="stat" key={period}>
                    <span className="stat__label">{label}</span>
                    <Money
                      pence={actualTotalPence(data, startStr, endStr)}
                      className="stat__value"
                    />
                    <span className="muted stat__sub">
                      avg <Money pence={normalisedTotalPence(data, period, from)} />
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <h3 className="panel__title">Next payments</h3>
            {upcoming.length === 0 ? (
              <EmptyState hint="Nothing due — add expenses on the Expenses tab." />
            ) : (
              <ul className="upcoming-list">
                {upcoming.map((r, i) => (
                  <li className="upcoming-list__row" key={`${r.date}-${r.label}-${i}`}>
                    <span className="upcoming-list__date">{formatDay(r.date)}</span>
                    <span className="upcoming-list__label">
                      {r.label}
                      {r.isAdjusted && <span className="tag">shifted</span>}
                    </span>
                    <Money pence={r.amountPence} className="upcoming-list__amount" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
