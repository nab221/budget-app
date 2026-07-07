import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { gatherPlanData } from '../db/planData.js';
import { buildPlan } from '../engine/plan.js';
import { settings } from '../db/settings.js';
import { recurringBillsRepo, transactionsRepo } from '../db/repositories.js';
import BalanceStrip from './dashboard/BalanceStrip.jsx';
import PayPeriodPanel from './dashboard/PayPeriodPanel.jsx';
import ThisMonthPanel from './dashboard/ThisMonthPanel.jsx';

/**
 * Dashboard (spec §4.1) — the home screen. Composes the balance strip, the
 * pay-period panel (with its recommendation centrepiece) and the this-month
 * spending review. All money crosses the pounds↔pence boundary inside
 * `gatherPlanData` / the `Money` component; this screen only orchestrates.
 */
export default function Dashboard() {
  const [offset, setOffset] = useState(0);

  const { data, loading } = useLiveData(async () => {
    const now = new Date();
    const planData = await gatherPlanData(now);
    const balanceAsOf = await settings.getBalanceAsOf();
    const plan = buildPlan(planData, offset);
    // Bill-confirmation support (Phase 4): the repo bills (pounds edge) power
    // the "Mark paid" affordance, and the already-confirmed bill-source
    // transactions inside the period show as paid rows.
    const [bills, paidBillTxns] = await Promise.all([
      recurringBillsRepo.getAll(),
      plan.hasPeriod
        ? transactionsRepo.billPaymentsBetween(plan.periodStart, plan.periodEnd)
        : Promise.resolve([]),
    ]);
    return {
      now,
      plan,
      bills,
      paidBillTxns,
      currentBalancePence: planData.settings.currentBalancePence,
      balanceAsOf,
    };
  }, [offset]);

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

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Dashboard</h2>
      </header>

      <BalanceStrip
        currentBalancePence={data.currentBalancePence}
        balanceAsOf={data.balanceAsOf}
        now={data.now}
      />

      <PayPeriodPanel
        plan={data.plan}
        offset={offset}
        onOffsetChange={setOffset}
        bills={data.bills}
        paidBillTxns={data.paidBillTxns}
      />

      <ThisMonthPanel />
    </div>
  );
}
