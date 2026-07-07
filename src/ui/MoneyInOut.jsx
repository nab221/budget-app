import IncomeSources from './money/IncomeSources.jsx';
import RecurringBills from './money/RecurringBills.jsx';

/**
 * Money In & Out — Phase 2 builds the **Planned** side (income sources +
 * recurring bills). The **Actual** transactions ledger arrives in Phase 4.
 */
export default function MoneyInOut() {
  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Money In &amp; Out</h2>
        <p className="muted">Set up the money that repeats. Day-to-day spending lands here later.</p>
      </header>

      <section className="panel">
        <h3 className="panel__title">Planned</h3>
        <IncomeSources />
        <RecurringBills />
      </section>

      <section className="panel panel--placeholder">
        <h3 className="panel__title">Actual</h3>
        <p className="muted">
          The transactions ledger (PDF import, manual entry, bill confirmation) arrives in a later
          phase. Nothing to do here yet.
        </p>
      </section>
    </div>
  );
}
