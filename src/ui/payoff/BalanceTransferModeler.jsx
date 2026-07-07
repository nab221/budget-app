import { useState } from 'react';
import Money from '../components/Money.jsx';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { modelBalanceTransfer } from '../../engine/finance.js';
import { toPence } from '../../engine/currency.js';

/**
 * Balance-transfer modeler (spec §4.4): pick a source card, enter promo months,
 * a fee %, and an optional new-card limit, and see the fee, the monthly payment
 * needed to clear within the promo, and a stay-vs-transfer recommendation.
 *
 * @param {Array} cards - finance-shape credit cards (pence): { id, name, currentBalance, apr }.
 */
export default function BalanceTransferModeler({ cards }) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? null);
  const [promoMonths, setPromoMonths] = useState(18);
  const [feePercent, setFeePercent] = useState(3);
  const [newLimitPounds, setNewLimitPounds] = useState(null);

  if (cards.length === 0) {
    return <p className="muted">Add a credit card to model a balance transfer.</p>;
  }

  const card = cards.find((c) => c.id === cardId) ?? cards[0];
  const months = Number(promoMonths) || 0;
  const fee = Number(feePercent) || 0;

  const result =
    card && months > 0
      ? modelBalanceTransfer(
          {
            currentBalance: card.currentBalance,
            apr: card.apr,
            // Pass promo details so the stay-cost baseline honours an active 0%
            // window and its post-promo rate jump instead of the headline APR (L1).
            promoEndDate: card.promoEndDate ?? null,
            postPromoApr: card.postPromoApr ?? null,
          },
          months,
          fee,
        )
      : null;

  // newLimit is entered in pounds → pence for comparison with the pence balance.
  const newLimitPence = newLimitPounds == null ? null : toPence(newLimitPounds);
  const transferTotal = result ? card.currentBalance + result.transferFeePence : 0;
  const fitsLimit = newLimitPence == null || transferTotal <= newLimitPence;

  let recommendation = null;
  if (result) {
    const saving = result.totalCostCurrent - result.totalCostBT;
    if (!fitsLimit) {
      recommendation = `The balance plus fee (${'£' + (transferTotal / 100).toFixed(2)}) exceeds the new card's limit — it won't all fit.`;
    } else if (saving > 0) {
      recommendation = `Transferring looks cheaper — you'd save about £${(saving / 100).toFixed(2)} versus paying the current card's minimums, if you clear it inside the ${months}-month promo.`;
    } else {
      recommendation = `Staying put is cheaper here — the £${(result.transferFeePence / 100).toFixed(2)} fee outweighs the interest you'd save.`;
    }
  }

  return (
    <div className="bt-modeler">
      <div className="form-row">
        <div className="field">
          <label htmlFor="bt-card">Source card</label>
          <select
            id="bt-card"
            className="input"
            value={cardId ?? ''}
            onChange={(e) => setCardId(Number(e.target.value))}
          >
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bt-months">Promo months</label>
          <input
            id="bt-months"
            className="input"
            type="number"
            min="1"
            max="48"
            value={promoMonths}
            onChange={(e) => setPromoMonths(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="bt-fee">Transfer fee (%)</label>
          <input
            id="bt-fee"
            className="input"
            type="number"
            step="0.1"
            min="0"
            value={feePercent}
            onChange={(e) => setFeePercent(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="bt-limit">New card limit (optional)</label>
          <CurrencyInput id="bt-limit" value={newLimitPounds} onChange={setNewLimitPounds} />
        </div>
      </div>

      {result && (
        <>
          <dl className="bt-results">
            <div>
              <dt>Transfer fee</dt>
              <dd>
                <Money pence={result.transferFeePence} />
              </dd>
            </div>
            <div>
              <dt>Monthly to clear in promo</dt>
              <dd>
                <Money pence={result.recommendedMonthlyPayment} />
              </dd>
            </div>
            <div>
              <dt>Cost if you transfer</dt>
              <dd>
                <Money pence={result.totalCostBT} />
              </dd>
            </div>
            <div>
              <dt>Cost if you stay (min payments)</dt>
              <dd>
                <Money pence={result.totalCostCurrent} />
              </dd>
            </div>
          </dl>
          <p className={`bt-reco ${fitsLimit ? '' : 'bt-reco--warn'}`}>{recommendation}</p>
        </>
      )}
    </div>
  );
}
