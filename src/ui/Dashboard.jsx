import { useMemo } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import {
  recurringBillsRepo,
  debtsRepo,
  childrenRepo,
  categoriesRepo,
} from '../db/repositories.js';
import { getSetting } from '../db/settings.js';
import {
  mapBillsToPence,
  mapDebtsToPence,
  childcareDepositsFromChildren,
} from '../db/planData.js';
import { upcomingPayments, localDayStr } from '../engine/spending.js';
import { buildInsights } from '../engine/insights.js';
import Money from './components/Money.jsx';
import EmptyState from './components/EmptyState.jsx';
import { formatDay } from './components/dates.js';
import KpiStrip from './dashboard/KpiStrip.jsx';
import InsightCards from './dashboard/InsightCards.jsx';
import PaymentCalendar from './dashboard/PaymentCalendar.jsx';
import MonthlyOutgoings from './dashboard/MonthlyOutgoings.jsx';
import CategoryBreakdown from './dashboard/CategoryBreakdown.jsx';
import CostTable from './dashboard/CostTable.jsx';

/**
 * Dashboard v2 (specs/DASHBOARD-PLAN.md) — the read-only answers screen.
 * Zones, in the order the questions get asked: the KPI strip (how much),
 * insight cards (anything worth acting on), upcoming payments (when),
 * the category breakdown and cost-of-everything table (where).
 * Everything is computed live from the schedule; nothing is persisted.
 */
export default function Dashboard({ onNavigate }) {
  const { data, loading } = useLiveData(async () => {
    const [bills, debts, children, categories, payoffStrategy, payoffExtraPence, lastExportAt] =
      await Promise.all([
        recurringBillsRepo.getAll(),
        debtsRepo.getAll(),
        childrenRepo.getAll(),
        categoriesRepo.getAll(),
        getSetting('payoffStrategy'),
        getSetting('payoffExtraPence'),
        getSetting('lastExportAt'),
      ]);
    return {
      recurringBills: mapBillsToPence(bills),
      debts: mapDebtsToPence(debts),
      childcareDeposits: childcareDepositsFromChildren(children),
      categories,
      payoffStrategy,
      payoffExtraPence,
      lastExportAt,
    };
  }, []);

  const now = new Date();
  const from = localDayStr(now);

  const insights = useMemo(
    () => (data ? buildInsights(data, from) : []),
    [data, from]
  );

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
          <KpiStrip
            data={data}
            strategy={data.payoffStrategy}
            extraPence={data.payoffExtraPence || 0}
            fromStr={from}
            now={now}
          />

          <InsightCards cards={insights} onNavigate={onNavigate} />

          <div className="dash-cols">
            <PaymentCalendar data={data} fromStr={from} />

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
          </div>

          <MonthlyOutgoings data={data} fromStr={from} />

          <CategoryBreakdown data={data} categories={data.categories} fromStr={from} />
          <CostTable data={data} categories={data.categories} fromStr={from} />
        </>
      )}
    </div>
  );
}
