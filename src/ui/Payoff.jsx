import { useEffect, useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { gatherPlanData } from '../db/planData.js';
import { buildPlan } from '../engine/plan.js';
import { simulatePayoff } from '../engine/finance.js';
import { settings } from '../db/settings.js';
import Money from './components/Money.jsx';
import EmptyState from './components/EmptyState.jsx';
import CurrencyInput, { parseCurrencyInput } from './components/CurrencyInput.jsx';
import StrategyComparison from './payoff/StrategyComparison.jsx';
import LoanOverpayment from './payoff/LoanOverpayment.jsx';
import BalanceTransferModeler from './payoff/BalanceTransferModeler.jsx';
import ScheduleTable from './payoff/ScheduleTable.jsx';
import {
  defaultExtraPence,
  buildStrategyComparison,
  toFinanceDebts,
} from './payoff/payoffModel.js';

/**
 * Payoff planner (spec §4.4). Strategy + extra payment persist to `settings`
 * (never localStorage) and drive the dashboard recommendation. All money is
 * integer PENCE here — the debts arrive pre-converted from `gatherPlanData`.
 */
export default function Payoff() {
  const { data, loading } = useLiveData(async () => {
    const now = new Date();
    const planData = await gatherPlanData(now);
    const plan = buildPlan(planData, 0);
    const persistedExtra = await settings.getPayoffExtraPence();
    const strategy = await settings.getPayoffStrategy();
    return {
      now,
      debts: planData.debts,
      safeExtraPence: plan.safeExtraPence,
      persistedExtra,
      strategy,
    };
  }, []);

  // Local editable extra (pence). Seeded once data (and its default) is known.
  const [extraPence, setExtraPence] = useState(null);
  const [strategy, setStrategy] = useState(null);

  useEffect(() => {
    if (!data) return;
    setExtraPence((prev) =>
      prev == null ? defaultExtraPence(data.persistedExtra, data.safeExtraPence) : prev,
    );
    setStrategy((prev) => prev ?? data.strategy ?? 'avalanche');
  }, [data]);

  if (loading || !data || extraPence == null || strategy == null) {
    return (
      <div className="screen">
        <header className="screen__head">
          <h2>Payoff</h2>
        </header>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const { cards, loans } = toFinanceDebts(data.debts);

  if (cards.length === 0 && loans.length === 0) {
    return (
      <div className="screen">
        <header className="screen__head">
          <h2>Payoff</h2>
        </header>
        <EmptyState
          title="No debts — nothing to plan"
          hint="When you add credit cards or loans in the Debts tab, this planner shows how to clear them fastest."
        />
      </div>
    );
  }

  const saveExtra = (pounds) => {
    const pence = pounds == null ? 0 : Math.round(pounds * 100); // pounds → pence
    setExtraPence(pence);
    settings.setPayoffExtraPence(pence); // persist (not localStorage)
  };

  const chooseStrategy = (next) => {
    setStrategy(next);
    settings.setPayoffStrategy(next); // persist; drives the dashboard recommendation
  };

  const comparison = cards.length > 0 ? buildStrategyComparison(cards, extraPence, data.now) : null;
  const selectedSim =
    cards.length > 0 ? simulatePayoff(cards, strategy, extraPence, data.now) : null;

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Payoff</h2>
      </header>

      <section className="panel">
        <h3 className="panel__title">Extra to pay each month</h3>
        <div className="form-row">
          <div className="field">
            <label htmlFor="payoff-extra">Extra payment</label>
            {/* CurrencyInput speaks pounds; seed from pence. */}
            <CurrencyInput
              id="payoff-extra"
              value={extraPence / 100}
              onChange={() => {}}
              onBlur={(e) => saveExtra(parseCurrencyInput(e.target.value))}
            />
            <span className="field__hint">
              Defaults to this period's safe-to-pay figure (
              <Money pence={data.safeExtraPence ?? 0} />). Edit to explore scenarios.
            </span>
          </div>
        </div>
      </section>

      {cards.length > 0 && comparison && (
        <section className="panel">
          <h3 className="panel__title">Credit cards — strategy comparison</h3>
          <StrategyComparison
            comparison={comparison}
            strategy={strategy}
            onStrategyChange={chooseStrategy}
          />
        </section>
      )}

      {loans.length > 0 && <LoanOverpayment loans={loans} extraPence={extraPence} />}

      {cards.length > 0 && (
        <section className="panel">
          <h3 className="panel__title">Balance-transfer modeler</h3>
          <BalanceTransferModeler cards={cards} />
        </section>
      )}

      {selectedSim && (
        <section className="panel">
          <h3 className="panel__title">Month-by-month schedule ({strategy})</h3>
          <ScheduleTable history={selectedSim.history} />
        </section>
      )}
    </div>
  );
}
