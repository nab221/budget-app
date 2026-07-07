import IncomeSources from './money/IncomeSources.jsx';
import RecurringBills from './money/RecurringBills.jsx';
import Transactions from './money/Transactions.jsx';

/**
 * Money In & Out — the **Planned** side (income sources + recurring bills) plus
 * the **Actual** transactions ledger (manual entry, bill confirmation, and —
 * later — PDF import all land in the same flat `transactions` table).
 */
export default function MoneyInOut() {
  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Money In &amp; Out</h2>
        <p className="muted">Set up the money that repeats, then track what really happened.</p>
      </header>

      <section className="panel">
        <h3 className="panel__title">Planned</h3>
        <IncomeSources />
        <RecurringBills />
      </section>

      <section className="panel">
        <h3 className="panel__title">Actual</h3>
        <Transactions />
      </section>
    </div>
  );
}
