import { format, parseISO } from 'date-fns';
import {
  periodWindow,
  actualTotalPence,
  normalisedTotalPence,
} from '../../engine/spending.js';
import { categoryBreakdown, costRows } from '../../engine/breakdown.js';
import { monthlyInterestPence } from '../../engine/insights.js';
import { debtFreeProjection } from '../../engine/payoff.js';
import Money from '../components/Money.jsx';
import { formatDay } from '../components/dates.js';

/**
 * Z7 — the Monthly Money Report: a text-and-tables view of the whole
 * dashboard, designed for the print stylesheet (browser print → PDF, no new
 * dependency). Rendered only while printing; `@media print` in styles.css
 * hides everything else. No canvases — tables print, charts don't.
 */
export default function MonthlyReport({ data, insights, fromStr, now }) {
  const { startStr, endStr } = periodWindow('month', now);
  const monthTotal = actualTotalPence(data, startStr, endStr);
  const monthAvg = normalisedTotalPence(data, 'month', fromStr);
  const breakdown = categoryBreakdown(data, data.categories, fromStr);
  const rows = costRows(data, data.categories, fromStr);
  const interest = monthlyInterestPence(data.debts, fromStr);
  const strategy = data.payoffStrategy === 'snowball' ? 'snowball' : 'avalanche';
  const projection = debtFreeProjection(
    data.debts,
    strategy,
    data.payoffExtraPence || 0,
    fromStr
  );
  const debts = (data.debts || []).filter((d) => (d.balancePence || 0) > 0);
  const totalDebt = debts.reduce((t, d) => t + (d.balancePence || 0), 0);
  const people = data.income?.people ?? [];

  return (
    <article className="money-report">
      <header>
        <h1>Monthly Money Report — {format(parseISO(startStr), 'MMMM yyyy')}</h1>
        <p className="muted">Generated {formatDay(fromStr)} · committed schedule, computed live</p>
      </header>

      <section>
        <h2>At a glance</h2>
        <ul className="money-report__facts">
          <li>
            Going out this month: <Money pence={monthTotal} /> (long-run average{' '}
            <Money pence={monthAvg} /> / month)
          </li>
          <li>
            Total debt: <Money pence={totalDebt} /> across {debts.length} debt
            {debts.length === 1 ? '' : 's'} · interest ≈ <Money pence={interest.totalPence} /> /
            month
          </li>
          <li>
            {projection.hasDebts
              ? projection.neverClears
                ? 'Debt-free: not on track — current payments never clear the balance'
                : `Debt-free ${format(parseISO(`${projection.clearMonth}-01`), 'MMMM yyyy')} on ${strategy}`
              : 'No debts to pay off'}
            {projection.hasDebts && !projection.neverClears && (
              <>
                {' '}
                (projected interest <Money pence={projection.totalInterestPence} />)
              </>
            )}
          </li>
        </ul>
      </section>

      {insights.length > 0 && (
        <section>
          <h2>Worth acting on</h2>
          <ul>
            {insights.map((c) => (
              <li key={c.id}>
                <strong>{c.title}.</strong> {c.body}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Where it goes (monthly average)</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">/ month</th>
              <th className="num">/ year</th>
              <th className="num">Share</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.rows.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td className="num">
                  <Money pence={r.monthlyPence} />
                </td>
                <td className="num">
                  <Money pence={r.annualPence} />
                </td>
                <td className="num">{Math.round(r.shareOfTotal * 100)}%</td>
              </tr>
            ))}
            <tr className="txn-totals">
              <td>Total committed</td>
              <td className="num">
                <Money pence={Math.round(breakdown.totalAnnualPence / 12)} />
              </td>
              <td className="num">
                <Money pence={breakdown.totalAnnualPence} />
              </td>
              <td className="num">100%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>What everything costs</h2>
        <table className="table">
          <thead>
            <tr>
              <th>What</th>
              <th>Category</th>
              <th className="num">/ month</th>
              <th className="num">/ year</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.label}</td>
                <td>{r.category}</td>
                <td className="num">
                  <Money pence={r.monthlyPence} />
                </td>
                <td className="num">
                  <Money pence={r.annualPence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {debts.length > 0 && (
        <section>
          <h2>Debts</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Debt</th>
                <th className="num">Balance</th>
                <th className="num">Rate</th>
                <th className="num">Interest / month</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="num">
                    <Money pence={d.balancePence} />
                  </td>
                  <td className="num">
                    {d.debtType === 'loan' ? (d.interestRate ?? 0) : (d.apr ?? 0)}%
                  </td>
                  <td className="num">
                    <Money
                      pence={interest.byDebt.find((x) => x.id === d.id)?.pence || 0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {people.length > 0 && (
        <section>
          <h2>Income &amp; tax — {data.income.taxYear}</h2>
          <ul>
            {people.map((p) => (
              <li key={p.id}>
                <strong>{p.name}:</strong> adjusted net income{' '}
                <Money pence={p.summary.adjustedNetIncomePence} />
                {' · '}
                {p.summary.over100k
                  ? 'OVER the £100,000 childcare line'
                  : (
                      <>
                        ≈ <Money pence={p.summary.headroomTo100kPence} /> before the £100,000 line
                      </>
                    )}
                {' · '}tax ≈ <Money pence={p.summary.totalTaxPence} /> (PAYE ≈{' '}
                <Money pence={p.summary.payeTaxPence} />, Self Assessment ≈{' '}
                <Money pence={p.summary.selfAssessmentTaxPence} />)
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="muted">
        Figures are the committed schedule normalised over time (weekly ≈ ×4.35 a month); card
        minimums and childcare deposits computed at today's balances. GBP throughout.
      </footer>
    </article>
  );
}
