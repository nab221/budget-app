import Money from '../components/Money.jsx';
import { simulateLoanPayoff } from '../../engine/finance.js';

const monthsLabel = (m) => {
  if (m >= 600) return 'Never';
  const y = Math.floor(m / 12);
  const r = m % 12;
  if (y === 0) return `${m} mo`;
  return r === 0 ? `${y} yr` : `${y} yr ${r} mo`;
};

/**
 * Loan overpayment modeling (spec §4.4): with the same extra-payment input,
 * compare keeping the current schedule vs overpaying (term reduction), and note
 * the payment-reduction alternative. Loans are finance-shape (pence).
 */
export default function LoanOverpayment({ loans, extraPence }) {
  if (!loans || loans.length === 0) return null;

  const baseline = simulateLoanPayoff(loans, 'term-reduction', 0);
  const termReduction = simulateLoanPayoff(loans, 'term-reduction', extraPence);
  const interestSaved = Math.max(0, baseline.totalInterest - termReduction.totalInterest);
  const monthsSaved = Math.max(0, baseline.monthsToClear - termReduction.monthsToClear);

  return (
    <section className="panel">
      <h3 className="panel__title">Loans — overpayment</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th className="num">Paid off in</th>
              <th className="num">Total interest</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Current payments only</td>
              <td className="num">{monthsLabel(baseline.monthsToClear)}</td>
              <td className="num">
                <Money pence={baseline.totalInterest} />
              </td>
            </tr>
            <tr className="strategy-row--selected">
              <td>
                With <Money pence={extraPence} />/mo extra (term reduction)
              </td>
              <td className="num">{monthsLabel(termReduction.monthsToClear)}</td>
              <td className="num">
                <Money pence={termReduction.totalInterest} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {extraPence > 0 && (
        <p className="muted">
          Overpaying clears the loan {monthsSaved} month{monthsSaved === 1 ? '' : 's'} sooner and
          saves <Money pence={interestSaved} /> in interest. Alternatively, a payment-reduction
          approach keeps the original term but lowers your monthly payment.
        </p>
      )}
    </section>
  );
}
