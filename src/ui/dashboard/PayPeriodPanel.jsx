import { format, parseISO } from 'date-fns';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import RecommendationCard from './RecommendationCard.jsx';

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
 * @param {object} plan - buildPlan output.
 * @param {number} offset
 * @param {(next:number)=>void} onOffsetChange
 */
export default function PayPeriodPanel({ plan, offset, onOffsetChange }) {
  const boundaryEvents = (plan.incomeEvents || []).filter((e) => e.isBoundary);

  const label =
    plan.hasPeriod && plan.periodStart
      ? `${fmtDate(plan.periodStart)} → ${fmtDate(plan.periodEnd)}`
      : 'Pay period';

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

          <RecommendationCard plan={plan} />
        </>
      )}
    </section>
  );
}
