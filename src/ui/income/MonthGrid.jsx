import Money from '../components/Money.jsx';
import { formatPayMonth } from '../components/dates.js';

const SOURCE_LABELS = { actual: 'Payslip', planned: 'Planned', projected: 'Projected' };
const SOURCE_BADGES = { actual: 'income', planned: 'planned', projected: 'source' };

/** The PAYE check tolerates rounding and week-1/month-1 quirks up to £100. */
const PAYE_WARN_PENCE = 10000;

/**
 * The Apr–Mar pay-month grid (income redesign, amendment (c)): one row per
 * month showing the actual payslip, a planned future amount, or the
 * timeline projection, plus a running total so the approach to the £50,270
 * and £100,000 lines is visible month by month. The current month nudges
 * when its payslip is missing. Below the grid, the cumulative-basis PAYE
 * check compares tax actually deducted against the expected figure.
 *
 * @param {object} props
 * @param {Array<object>} props.monthly - rows from `buildMonthlyPay` (pence).
 * @param {string} props.todayMonth - 'yyyy-MM' of today.
 * @param {object|null} props.payeCheck - from `expectedPayeYtd` (pence).
 * @param {(row: object) => void} props.onEditMonth - open the payslip form.
 */
export default function MonthGrid({ monthly, todayMonth, payeCheck, onEditMonth }) {
  const payeDiffOver = payeCheck && Math.abs(payeCheck.diffPence) > PAYE_WARN_PENCE;

  return (
    <div className="month-grid">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Taxable pay</th>
              <th aria-label="Source" />
              <th className="num">Tax deducted</th>
              <th className="num">Total so far</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {monthly.map((row) => {
              const isCurrent = row.month === todayMonth;
              const needsSlip = isCurrent && row.source === 'projected';
              return (
                <tr
                  key={row.month}
                  className={`month-grid__row${isCurrent ? ' month-grid__row--current' : ''}`}
                >
                  <td>{formatPayMonth(row.month)}</td>
                  <td className={`num${row.source === 'projected' ? ' muted' : ''}`}>
                    <Money pence={row.taxablePence} />
                  </td>
                  <td>
                    <span className={`badge badge--${SOURCE_BADGES[row.source]}`}>
                      {SOURCE_LABELS[row.source]}
                    </span>
                  </td>
                  <td className="num muted">
                    {row.payslip ? <Money pence={row.payslip.taxPaidPence} /> : '—'}
                  </td>
                  <td className="num">
                    <Money pence={row.cumulativePence} />
                  </td>
                  <td className="month-grid__action">
                    <button
                      type="button"
                      className={`btn btn--sm${needsSlip ? ' btn--primary' : ''}`}
                      onClick={() => onEditMonth(row)}
                    >
                      {row.payslip ? 'Edit' : needsSlip ? 'Add payslip' : 'Add'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payeCheck &&
        (payeCheck.complete ? (
          <p className={`month-grid__paye${payeDiffOver ? ' month-grid__paye--warn' : ''}`}>
            PAYE check ({payeCheck.months} month{payeCheck.months === 1 ? '' : 's'}): tax
            deducted <Money pence={payeCheck.paidPence} /> vs expected ≈{' '}
            <Money pence={payeCheck.expectedPence} />
            {payeDiffOver ? (
              <>
                {' '}
                — <Money pence={Math.abs(payeCheck.diffPence)} />{' '}
                {payeCheck.diffPence > 0 ? 'more' : 'less'} than expected. Worth checking your
                tax code with HMRC.
              </>
            ) : (
              ' — looks right.'
            )}
          </p>
        ) : (
          <p className="month-grid__paye muted">
            PAYE check: enter the missing earlier months to compare tax deducted against the
            expected figure.
          </p>
        ))}
    </div>
  );
}
