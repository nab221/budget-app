import Money from '../components/Money.jsx';
import { formatGBP } from '../../engine/currency.js';
import { formatDay } from '../components/dates.js';
import { formatRate, formatPerPound } from './format.js';

/**
 * The £50,000 small-profits meter: how far the year's implied profit is
 * from the marginal band, and what the next pound costs once past it.
 *
 * The statutory limits are public constants, so they are plain text via
 * `formatGBP` rather than <Money> — the privacy blur is for the owner's own
 * figures, and plain text keeps each sentence one text run for the tests.
 */
function BandMeter({ data }) {
  const { profitPence, band, marginalRate, headroomDividendPence, table } = data;
  const lower = formatGBP(table.lowerLimitPence);
  const upper = formatGBP(table.upperLimitPence);
  const pct = Math.min(100, Math.round((profitPence / table.lowerLimitPence) * 100));
  const over = band !== 'small';
  return (
    <div className={`util threshold${over ? ' threshold--over' : ''}`}>
      <div className="util__label threshold__head">
        <span>{lower} small-profits limit</span>
        <span className="threshold__pct">{pct}%</span>
      </div>
      <div className="util__bar">
        <div className="util__fill threshold__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="util__label">
        {band === 'small' && (
          <span>
            Next £1 of profit is taxed at {formatRate(marginalRate)} — ≈{' '}
            <Money pence={headroomDividendPence} /> more in dividends before the marginal band.
          </span>
        )}
        {band === 'marginal' && (
          <span className="threshold__over">
            Past {lower} of profit — each further pound costs {formatRate(marginalRate)} (
            {formatPerPound(data.marginalSetAsidePerPound)} per £1 of dividend) until {upper}.
          </span>
        )}
        {band === 'main' && (
          <span className="threshold__over">
            Past {upper} of profit — the {formatRate(marginalRate)} main rate applies to all of
            it.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The company-year headline: dividends drawn by both people, the profit
 * those dividends imply, the corporation tax to set aside, where the year
 * sits against the £50k line, and who drew what. Everything is computed at
 * read time by `gatherCompanyData`.
 *
 * @param {object} props.data - the `gatherCompanyData` snapshot (pence).
 */
export default function CompanySummary({ data }) {
  const { dividendPence, profitPence, ctPence, effectiveRate, perPerson, paymentDate } = data;

  return (
    <section className="panel company-summary">
      <div className="kpi-row">
        <div className="stat">
          <span className="stat__label">Dividends drawn</span>
          <span className="stat__value">
            <Money pence={dividendPence} />
          </span>
          <span className="stat__sub muted">Both people, this company year</span>
        </div>
        <div className="stat">
          <span className="stat__label">Corporation tax to set aside</span>
          <span className="stat__value">
            <Money pence={ctPence} />
          </span>
          <span className="stat__sub muted">Due {formatDay(paymentDate)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Profit required</span>
          <span className="stat__value">
            <Money pence={profitPence} />
          </span>
          <span className="stat__sub muted">Dividends + CT</span>
        </div>
        <div className="stat">
          <span className="stat__label">Effective CT rate</span>
          <span className="stat__value">{formatRate(effectiveRate)}</span>
          <span className="stat__sub muted">
            {formatPerPound(data.averageSetAsidePerPound)} per £1 drawn so far ·{' '}
            {formatPerPound(data.marginalSetAsidePerPound)} on the next £1
          </span>
        </div>
      </div>

      <BandMeter data={data} />

      {perPerson.length > 0 && (
        <div className="table-wrap">
          <table className="table company-split">
            <thead>
              <tr>
                <th>Person</th>
                <th className="num">Dividends</th>
                <th className="num">Share</th>
              </tr>
            </thead>
            <tbody>
              {perPerson.map((p) => (
                <tr key={p.personId}>
                  <td>{p.name ?? <span className="muted">Unknown person</span>}</td>
                  <td className="num">
                    <Money pence={p.dividendPence} />
                  </td>
                  <td className="num">{formatRate(p.share, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
