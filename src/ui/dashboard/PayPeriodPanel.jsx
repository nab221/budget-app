import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import RecommendationCard from './RecommendationCard.jsx';
import MarkPaidControl from '../money/MarkPaidControl.jsx';
import { confirmBillPayment, unconfirmBillPayment } from '../../db/billConfirmation.js';

const KIND_LABEL = {
  bill: 'Bill',
  'debt-min': 'Card min',
  loan: 'Loan',
  childcare: 'Childcare',
  allowance: 'Everyday',
};

function fmtDate(iso) {
  try {
    return format(parseISO(iso), 'EEE d MMM');
  } catch {
    return iso;
  }
}

/**
 * The headline pay-period panel (spec §4.1): period label + navigation, income
 * line, committed-outgoings timeline with a running projected balance, warning
 * banner, projected end balance, and the recommendation card.
 *
 * ── Bill confirmation (Phase 4) ────────────────────────────────────────────
 * Bill rows in the CURRENT period (offset 0) carry an unobtrusive "Mark paid"
 * affordance on their earliest occurrence. Confirming creates a `source:'bill'`
 * transaction and advances the bill's `nextDueDate`, so the occurrence then
 * DROPS OUT of the read-time plan automatically (no double counting — the plan
 * never reads transactions; the running balance is projected from the manual
 * anchor). To keep the paid item visible we render already-confirmed
 * bill-source transactions for the period as a dimmed, ticked informational
 * list below the table; those do not affect the projected balance.
 *
 * @param {object} plan - buildPlan output.
 * @param {number} offset
 * @param {(next:number)=>void} onOffsetChange
 * @param {Array} [bills] - repository recurring bills (pounds edge) for confirm.
 * @param {Array} [paidBillTxns] - bill-source transactions within this period.
 */
export default function PayPeriodPanel({ plan, offset, onOffsetChange, bills = [], paidBillTxns = [] }) {
  const [payingKey, setPayingKey] = useState(null);
  const [notice, setNotice] = useState(null);

  const boundaryEvents = (plan.incomeEvents || []).filter((e) => e.isBoundary);
  const billById = useMemo(() => new Map(bills.map((b) => [b.id, b])), [bills]);

  // The earliest timeline row per bill is its current-due occurrence — the only
  // one we offer "Mark paid" on (and only in the current period).
  const markableIndexByBill = useMemo(() => {
    const first = new Map();
    (plan.timeline || []).forEach((row, i) => {
      if (row.kind !== 'bill' || row.sourceId == null) return;
      if (!first.has(row.sourceId)) first.set(row.sourceId, i);
    });
    return new Set(first.values());
  }, [plan.timeline]);

  const canMark = offset === 0;

  const label =
    plan.hasPeriod && plan.periodStart
      ? `${fmtDate(plan.periodStart)} → ${fmtDate(plan.periodEnd)}`
      : 'Pay period';

  const markPaid = async (bill, amountPounds) => {
    const result = await confirmBillPayment(bill, bill.nextDueDate, { amountPounds });
    setPayingKey(null);
    setNotice(
      result.created
        ? `Marked "${bill.label}" paid.`
        : `"${bill.label}" was already marked paid for this date.`
    );
  };

  const unmarkPaid = async (txn) => {
    const result = await unconfirmBillPayment(txn);
    setNotice(result.rolledBack ? 'Payment unmarked; bill due date restored.' : result.warning || 'Payment unmarked.');
  };

  return (
    <section className="panel payperiod">
      <div className="payperiod__head">
        <div>
          <h3 className="panel__title">Pay period</h3>
          <p className="payperiod__label">{label}</p>
        </div>
        <div className="payperiod__nav">
          <button type="button" className="btn btn--sm" onClick={() => onOffsetChange(offset - 1)}>
            ‹ Prev
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => onOffsetChange(0)}
            disabled={offset === 0}
          >
            Today
          </button>
          <button type="button" className="btn btn--sm" onClick={() => onOffsetChange(offset + 1)}>
            Next ›
          </button>
        </div>
      </div>

      {notice && (
        <div className="banner banner--info" role="status">
          {notice}
          <button type="button" className="btn btn--sm" onClick={() => setNotice(null)} aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}

      {!plan.hasPeriod ? (
        <EmptyState
          title={plan.needsIncome ? 'No income set up yet' : 'No pay period to show'}
          hint={
            plan.needsIncome
              ? 'Add an income source in Money In & Out so we can work out your pay periods.'
              : 'Navigate back towards today to see a pay period.'
          }
        />
      ) : (
        <>
          {boundaryEvents.length > 0 && (
            <p className="payperiod__income">
              Next payday {fmtDate(plan.periodEnd)}:{' '}
              {boundaryEvents.map((e, i) => (
                <span key={`${e.sourceId}-${i}`}>
                  {i > 0 ? ', ' : ''}
                  {e.label} <Money pence={e.amountPence} />
                </span>
              ))}
            </p>
          )}

          {!plan.needsBalance && (plan.negativeDate || plan.belowBufferDate) && (
            <div className={`banner ${plan.negativeDate ? 'banner--danger' : 'banner--warn'}`}>
              {plan.negativeDate
                ? `Heads up: your balance is projected to go negative on ${fmtDate(plan.negativeDate)}.`
                : `Your balance dips below your safety buffer on ${fmtDate(plan.belowBufferDate)}.`}
            </div>
          )}

          <div className="table-wrap">
            <table className="table payperiod__table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th className="num">Amount</th>
                  {!plan.needsBalance && <th className="num">Balance</th>}
                </tr>
              </thead>
              <tbody>
                {!plan.needsBalance && (
                  <tr className="payperiod__opening">
                    <td>{fmtDate(plan.periodStart)}</td>
                    <td>Opening balance</td>
                    <td className="num" />
                    <td className="num">
                      <Money pence={plan.openingBalancePence} />
                    </td>
                  </tr>
                )}
                {plan.timeline.length === 0 ? (
                  <tr>
                    <td colSpan={plan.needsBalance ? 3 : 4} className="muted">
                      No committed outgoings this period.
                    </td>
                  </tr>
                ) : (
                  plan.timeline.map((row, i) => {
                    const below =
                      !plan.needsBalance && row.runningBalancePence < plan.safetyBufferPence;
                    const negative = !plan.needsBalance && row.runningBalancePence < 0;
                    const bill = row.kind === 'bill' ? billById.get(row.sourceId) : null;
                    const markable = canMark && bill && markableIndexByBill.has(i);
                    return (
                      <tr
                        key={i}
                        className={negative ? 'row--negative' : below ? 'row--below' : ''}
                      >
                        <td>
                          {fmtDate(row.date)}
                          {row.isAdjusted && <span className="tag">shifted</span>}
                        </td>
                        <td>
                          {row.label}
                          <span className="tag">{KIND_LABEL[row.kind] ?? row.kind}</span>
                          {markable &&
                            (payingKey === i ? (
                              <MarkPaidControl
                                label={bill.label}
                                occurrenceDate={bill.nextDueDate}
                                defaultAmountPounds={bill.amountPence}
                                onConfirm={(amt) => markPaid(bill, amt)}
                                onCancel={() => setPayingKey(null)}
                              />
                            ) : (
                              <button
                                type="button"
                                className="btn btn--sm payperiod__markpaid"
                                onClick={() => {
                                  setNotice(null);
                                  setPayingKey(i);
                                }}
                              >
                                Mark paid
                              </button>
                            ))}
                        </td>
                        <td className="num">
                          −<Money pence={row.amountPence} />
                        </td>
                        {!plan.needsBalance && (
                          <td className="num">
                            <Money pence={row.runningBalancePence} />
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {!plan.needsBalance && (
                <tfoot>
                  <tr>
                    <td>{fmtDate(plan.periodEnd)}</td>
                    <td>Projected before next payday</td>
                    <td className="num" />
                    <td className="num">
                      <Money pence={plan.projectedEndBalancePence} className="payperiod__end" />
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {paidBillTxns.length > 0 && (
            <div className="payperiod__paid">
              <p className="payperiod__paid-title muted">Paid this period</p>
              <ul className="payperiod__paid-list">
                {paidBillTxns.map((txn) => (
                  <li key={txn.id} className="payperiod__paid-item is-inactive">
                    <span className="payperiod__paid-tick" aria-hidden="true">
                      ✓
                    </span>
                    <span>{fmtDate(txn.date)}</span>
                    <span className="payperiod__paid-label">{txn.description}</span>
                    <Money pounds={txn.amountPence} />
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => unmarkPaid(txn)}
                    >
                      Unmark
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <RecommendationCard plan={plan} />
        </>
      )}
    </section>
  );
}
