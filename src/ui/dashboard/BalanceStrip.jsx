import { useState } from 'react';
import Money from '../components/Money.jsx';
import CurrencyInput, { parseCurrencyInput } from '../components/CurrencyInput.jsx';
import { settings } from '../../db/settings.js';
import { balanceAgeDays, isBalanceStale } from './balanceStatus.js';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Top strip: the manually-entered current bank balance (the anchor for every
 * projection), its as-of date, an Update control, and a friendly prompt when it
 * has never been set (spec §4.1).
 *
 * @param {number|null} currentBalancePence - integer pence (or null if unset).
 * @param {string|null} balanceAsOf - ISO date.
 * @param {Date} now
 */
export default function BalanceStrip({ currentBalancePence, balanceAsOf, now }) {
  const [editing, setEditing] = useState(false);
  // Seed the input in POUNDS (CurrencyInput speaks pounds); pence → pounds here.
  const [pounds, setPounds] = useState(
    currentBalancePence == null ? null : currentBalancePence / 100,
  );
  const [asOf, setAsOf] = useState(balanceAsOf || today());

  const isSet = currentBalancePence != null;
  const stale = isBalanceStale(balanceAsOf, now);
  const ageDays = balanceAgeDays(balanceAsOf, now);

  const openEditor = () => {
    setPounds(currentBalancePence == null ? null : currentBalancePence / 100);
    setAsOf(balanceAsOf || today());
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    // pounds → pence happens inside settings.setCurrentBalancePounds.
    await settings.setCurrentBalancePounds(pounds ?? 0);
    await settings.setBalanceAsOf(asOf);
    setEditing(false);
  };

  if (editing) {
    return (
      <section className="balance-strip balance-strip--editing">
        <form className="balance-form" onSubmit={save}>
          <div className="field">
            <label htmlFor="balance-amount">Current bank balance</label>
            <CurrencyInput
              id="balance-amount"
              value={pounds}
              onChange={setPounds}
              onBlur={(e) => setPounds(parseCurrencyInput(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="balance-asof">As of</label>
            <input
              id="balance-asof"
              className="input"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
          <div className="balance-form__actions">
            <button type="button" className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Save balance
            </button>
          </div>
        </form>
      </section>
    );
  }

  if (!isSet) {
    return (
      <section className="balance-strip balance-strip--prompt">
        <div>
          <p className="balance-strip__prompt-title">Add your current bank balance</p>
          <p className="muted">
            Copy the figure from your banking app. It anchors every projection on this page.
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={openEditor}>
          Set balance
        </button>
      </section>
    );
  }

  return (
    <section className="balance-strip">
      <div className="balance-strip__main">
        <span className="balance-strip__label">Current balance</span>
        <Money pence={currentBalancePence} className="balance-strip__amount" />
        {balanceAsOf && <span className="muted">as of {balanceAsOf}</span>}
      </div>
      <div className="balance-strip__side">
        {stale && (
          <p className="balance-strip__stale">
            Balance last updated {ageDays} days ago — update it for accurate projections.
          </p>
        )}
        <button type="button" className="btn" onClick={openEditor}>
          Update
        </button>
      </div>
    </section>
  );
}
