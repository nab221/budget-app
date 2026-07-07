import { useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { toPence } from '../../engine/currency.js';
import { computeRequiredDeposit } from '../../engine/childcare.js';
import Money from '../components/Money.jsx';
import CurrencyInput from '../components/CurrencyInput.jsx';

const today = () => new Date().toISOString().slice(0, 10);
const STALE_DAYS = 30;

/**
 * Per-child card (spec §4.5). Shows the provider cost, the hand-updated TFC
 * account balance (with a quick "Update balance" inline edit, mirroring debts),
 * and the COMPUTED required monthly parent deposit with its top-up breakdown.
 * Nothing computed here is persisted — the required deposit is derived at read
 * time from the child record.
 */
export default function ChildCard({ child, onUpdateBalance, onEdit, onDelete }) {
  const [balancing, setBalancing] = useState(false);
  const [newBalance, setNewBalance] = useState(child.tfcBalancePence);
  const [asOf, setAsOf] = useState(today());

  // Pounds edge → pence for the pure engine.
  const result = computeRequiredDeposit({
    providerCostPence: toPence(child.providerMonthlyCostPence),
    balancePence: toPence(child.tfcBalancePence),
    isDisabled: !!child.isDisabled,
  });

  const staleDays =
    child.tfcBalanceAsOf != null
      ? differenceInCalendarDays(parseISO(today()), parseISO(child.tfcBalanceAsOf))
      : null;
  const isStale = staleDays != null && staleDays > STALE_DAYS;

  const saveBalance = async (e) => {
    e.preventDefault();
    const pounds = newBalance === '' || newBalance == null ? 0 : Number(newBalance);
    await onUpdateBalance(child.id, pounds, asOf);
    setBalancing(false);
  };

  return (
    <li className="card childcare-card">
      <div className="debt-card__head">
        <span className="debt-card__name">{child.name}</span>
        {child.isDisabled && <span className="badge badge--promo">Disabled rate</span>}
      </div>

      <dl className="debt-card__facts">
        <div>
          <dt>Provider cost / month</dt>
          <dd>
            <Money pounds={child.providerMonthlyCostPence} />
          </dd>
        </div>
        <div>
          <dt>TFC account balance</dt>
          <dd>
            <Money pounds={child.tfcBalancePence} />
            {child.tfcBalanceAsOf && <span className="muted"> as of {child.tfcBalanceAsOf}</span>}
          </dd>
        </div>
        <div>
          <dt>Deposit day</dt>
          <dd>{child.paymentDayOfMonth ?? 1}</dd>
        </div>
      </dl>

      {isStale && (
        <p className="form__error childcare-card__stale">
          Balance is {staleDays} days old — update it from your childcare account so the required
          deposit stays accurate.
        </p>
      )}

      <div className="childcare-card__deposit">
        {result.depositPence > 0 ? (
          <>
            <div className="childcare-card__deposit-head">
              <span>Required monthly deposit</span>
              <Money pence={result.depositPence} className="childcare-card__amount" />
            </div>
            <p className="muted childcare-card__breakdown">
              You pay <Money pence={result.depositPence} />, the government adds{' '}
              <Money pence={result.topUpPence} /> — together covering the{' '}
              <Money pence={result.gapPence} /> shortfall.
            </p>
            {result.capBound && (
              <p className="form__error">
                <Money pence={result.uncoveredByTopUpPence} /> of the cost won’t attract top-up this
                quarter (the £{child.isDisabled ? '1,000' : '500'} quarterly cap is reached).
              </p>
            )}
          </>
        ) : (
          <p className="muted">
            The account balance already covers this month’s provider cost — no deposit needed.
          </p>
        )}
      </div>

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
              setNewBalance(child.tfcBalancePence);
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
