import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { gatherPlanData } from '../db/planData.js';
import { buildPlan } from '../engine/plan.js';
import { settings } from '../db/settings.js';
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
    return {
      now,
      plan: buildPlan(planData, offset),
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

      <PayPeriodPanel plan={data.plan} offset={offset} onOffsetChange={setOffset} />

      <ThisMonthPanel />
    </div>
  );
}
