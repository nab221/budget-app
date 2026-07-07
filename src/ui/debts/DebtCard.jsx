import { useState } from 'react';
import Money from '../components/Money.jsx';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { resolveMinPayment } from './minPayment.js';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Display card for a single debt (credit card or loan). Handles the primary
 * "Update balance" quick-edit inline; full edit/delete are delegated up.
 */
export default function DebtCard({ debt, onUpdateBalance, onEdit, onDelete }) {
  const [balancing, setBalancing] = useState(false);
  const [newBalance, setNewBalance] = useState(debt.balancePence);
  const [asOf, setAsOf] = useState(today());

  const isCard = debt.debtType === 'credit-card';

  const saveBalance = async (e) => {
    e.preventDefault();
    const pounds = newBalance === '' || newBalance == null ? 0 : Number(newBalance);
    await onUpdateBalance(debt.id, pounds, asOf);
    setBalancing(false);
  };

  // Credit-card min payment: computed by the engine (in pence) or an override.
  const minPayment = isCard ? resolveMinPayment(debt, today()) : null;

  const utilisation =
    isCard && debt.creditLimitPence
      ? Math.min(100, Math.max(0, (debt.balancePence / debt.creditLimitPence) * 100))
      : null;

  const promoActive = isCard && debt.promoEndDate && debt.promoEndDate >= today();

  return (
    <li className="card debt-card">
      <div className="debt-card__head">
        <span className="debt-card__name">{debt.name}</span>
        {promoActive && (
          <span className="badge badge--promo">0% until {debt.promoEndDate}</span>
        )}
      </div>

      <div className="debt-card__balance">
        <Money pounds={debt.balancePence} className="debt-card__amount" />
        {debt.balanceAsOf && <span className="muted"> as of {debt.balanceAsOf}</span>}
      </div>

      {utilisation != null && (
        <div className="util">
          <div className="util__bar">
            <div className="util__fill" style={{ width: `${utilisation}%` }} />
          </div>
          <span className="muted util__label">
            {utilisation.toFixed(0)}% of <Money pounds={debt.creditLimitPence} /> limit
          </span>
        </div>
      )}

      <dl className="debt-card__facts">
        {isCard ? (
          <>
            <div>
              <dt>APR</dt>
              <dd>{debt.apr ?? 0}%</dd>
            </div>
            <div>
              <dt>Min payment{minPayment.isOverride ? ' (override)' : ''}</dt>
              <dd>
                <Money pence={minPayment.pence} />
                <button
                  type="button"
                  className="linkbtn"
                  onClick={onEdit}
                  title="Edit minimum payment"
                >
                  edit
                </button>
              </dd>
            </div>
            <div>
              <dt>Payment day</dt>
              <dd>{debt.paymentDayOfMonth ?? '—'}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Interest rate</dt>
              <dd>{debt.interestRate ?? 0}%</dd>
            </div>
            <div>
              <dt>Monthly payment</dt>
              <dd>
                <Money pounds={debt.fixedMonthlyPaymentPence} />
              </dd>
            </div>
            <div>
              <dt>Payment day</dt>
              <dd>{debt.paymentDayOfMonth ?? '—'}</dd>
            </div>
          </>
        )}
      </dl>

      {balancing ? (
        <form className="debt-card__balform" onSubmit={saveBalance}>
          <div className="field">
            <label>New balance</label>
            <CurrencyInput value={newBalance} onChange={setNewBalance} />
          </div>
          <div className="field">
            <label>As of</label>
            <input
              className="input"
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </div>
          <div className="form__actions">
            <button type="button" className="btn btn--sm" onClick={() => setBalancing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn--sm btn--primary">
              Save balance
            </button>
          </div>
        </form>
      ) : (
        <div className="debt-card__actions">
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => {
              setNewBalance(debt.balancePence);
              setAsOf(today());
              setBalancing(true);
            }}
          >
            Update balance
          </button>
          <button type="button" className="btn btn--sm" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn btn--sm btn--danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
