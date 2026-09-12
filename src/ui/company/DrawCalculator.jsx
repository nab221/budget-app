import { useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import { previewPersonalDraw } from '../../db/companyData.js';
import { previewDraw } from '../../engine/corporation-tax.js';
import { taxYearForDate } from '../../engine/tax.js';
import { toPence } from '../../engine/currency.js';
import CurrencyInput from '../components/CurrencyInput.jsx';
import Money from '../components/Money.jsx';
import { formatRate, formatPerPound, fyTitle } from './format.js';

const today = () => new Date().toISOString().slice(0, 10);

/** A two-column "now → after" row. */
function CompareRow({ label, before, after }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td className="num">{before}</td>
      <td className="num compare__after">{after}</td>
    </tr>
  );
}

/**
 * "If I draw £X": the company picture and the drawing person's income-tax
 * picture, before and after. Transient UI state — nothing here is stored
 * until Record is pressed, which writes an ordinary dividend event.
 *
 * Two different years sit side by side on purpose: the company side is the
 * financial year being viewed (1 Apr – 31 Mar); the personal side is the
 * tax year (6 Apr – 5 Apr) that contains the draw DATE. Both are labelled.
 *
 * @param {object} props.data - the `gatherCompanyData` snapshot (pence).
 * @param {(payload: object) => Promise<void>} props.onRecord - pounds payload
 *   for `incomeEventsRepo.add`.
 */
export default function DrawCalculator({ data, onRecord }) {
  const { people, startDate, endDate, table } = data;
  const [amountPounds, setAmountPounds] = useState(null);
  const [personId, setPersonId] = useState(() => people[0]?.id ?? null);
  // Today if it falls inside the viewed company year, else the year's first day.
  const [date, setDate] = useState(() => {
    const t = today();
    return t >= startDate && t <= endDate ? t : startDate;
  });

  const amountPence = amountPounds != null && amountPounds > 0 ? toPence(amountPounds) : 0;
  const dateInYear = date >= startDate && date <= endDate;
  const active = amountPence > 0 && personId != null;

  const company = previewDraw({ dividendPence: data.dividendPence, extraDividendPence: amountPence, table });

  const { data: personal } = useLiveData(
    () => (active && dateInYear ? previewPersonalDraw({ personId, amountPence, date }) : Promise.resolve(null)),
    [active, dateInYear, personId, amountPence, date]
  );

  const record = async () => {
    await onRecord({ personId, date, kind: 'dividend', amountPence: amountPounds, note: '' });
    setAmountPounds(null);
  };

  const combinedTax = company.extraCtPence + (personal?.extraTaxPence ?? 0);

  return (
    <section className="panel company-calc">
      <h3>If I draw…</h3>
      <div className="form-row">
        <div className="field">
          <label htmlFor="company-draw-amount">Amount to draw</label>
          <CurrencyInput id="company-draw-amount" value={amountPounds} onChange={setAmountPounds} />
        </div>
        <div className="field">
          <label htmlFor="company-draw-person">Drawn by</label>
          <select
            id="company-draw-person"
            className="input"
            value={personId ?? ''}
            onChange={(e) => setPersonId(Number(e.target.value))}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="company-draw-date">Dated</label>
          <input
            id="company-draw-date"
            className="input"
            type="date"
            min={startDate}
            max={endDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {!dateInYear && (
        <p className="banner banner--warn">
          That date is outside company year {fyTitle(data.financialYear)} — pick a date between{' '}
          {startDate} and {endDate}, or switch year.
        </p>
      )}

      {active && (
        <>
          <div className="company-calc__grid">
            <div>
              <h3>Company — {fyTitle(data.financialYear)}</h3>
              <table className="table compare">
                <thead>
                  <tr>
                    <th />
                    <th className="num">Now</th>
                    <th className="num">After</th>
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Dividends"
                    before={<Money pence={company.before.dividendPence} />}
                    after={<Money pence={company.after.dividendPence} />}
                  />
                  <CompareRow
                    label="Profit required"
                    before={<Money pence={company.before.profitPence} />}
                    after={<Money pence={company.after.profitPence} />}
                  />
                  <CompareRow
                    label="Corporation tax"
                    before={<Money pence={company.before.ctPence} />}
                    after={<Money pence={company.after.ctPence} />}
                  />
                  <CompareRow
                    label="Effective rate"
                    before={formatRate(company.before.effectiveRate)}
                    after={formatRate(company.after.effectiveRate)}
                  />
                </tbody>
              </table>
              <p className="company-calc__sentence">
                This draw adds <Money pence={company.extraCtPence} /> of corporation tax — set that
                aside. The company needs <Money pence={company.extraProfitPence} /> more profit to fund it
                ({formatRate(company.rateOnExtraProfit)} on the extra profit,{' '}
                {formatPerPound(company.setAsidePerPound)} per £1 drawn).
              </p>
              {company.crossesLowerLimit && (
                <p className="banner banner--warn">
                  This draw takes the year past £50,000 of profit — every pound above that costs{' '}
                  {formatRate(table.mainRate + table.marginalReliefFraction)} instead of{' '}
                  {formatRate(table.smallRate)}.
                </p>
              )}
              {company.crossesUpperLimit && (
                <p className="banner banner--info">
                  This draw takes the year past £250,000 of profit — the {formatRate(table.mainRate)}{' '}
                  main rate then applies to all of it.
                </p>
              )}
            </div>

            <div>
              {personal ? (
                <>
                  <h3>
                    For {personal.name} in tax year {personal.taxYear}
                  </h3>
                  <table className="table compare">
                    <thead>
                      <tr>
                        <th />
                        <th className="num">Now</th>
                        <th className="num">After</th>
                      </tr>
                    </thead>
                    <tbody>
                      <CompareRow
                        label="Gross income"
                        before={<Money pence={personal.before.grossIncomePence} />}
                        after={<Money pence={personal.after.grossIncomePence} />}
                      />
                      <CompareRow
                        label="Total income tax"
                        before={<Money pence={personal.before.totalTaxPence} />}
                        after={<Money pence={personal.after.totalTaxPence} />}
                      />
                      <CompareRow
                        label="Via Self Assessment"
                        before={<Money pence={personal.before.selfAssessmentTaxPence} />}
                        after={<Money pence={personal.after.selfAssessmentTaxPence} />}
                      />
                      <CompareRow
                        label="Headroom to 40%"
                        before={<Money pence={personal.before.headroomToHigherRatePence} />}
                        after={<Money pence={personal.after.headroomToHigherRatePence} />}
                      />
                      <CompareRow
                        label="Headroom to £100k"
                        before={<Money pence={personal.before.headroomTo100kPence} />}
                        after={<Money pence={personal.after.headroomTo100kPence} />}
                      />
                    </tbody>
                  </table>
                  <p className="company-calc__sentence">
                    Extra personal tax ≈ <Money pence={personal.extraTaxPence} />, settled via Self
                    Assessment. <span className="muted">Net in hand</span>{' '}
                    <Money pence={personal.netInHandPence} />.
                  </p>
                  {personal.after.over100k && !personal.before.over100k && (
                    <p className="banner banner--warn">
                      This draw takes {personal.name} over £100,000 — the personal allowance starts
                      tapering and childcare entitlements are affected.
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">
                  {dateInYear
                    ? `Working out the personal side for tax year ${taxYearForDate(date)}…`
                    : 'Personal figures need a date inside the company year.'}
                </p>
              )}
            </div>
          </div>

          {personal && (
            <p className="muted">
              Of <Money pence={company.extraProfitPence} /> of profit:{' '}
              <Money pence={company.extraCtPence} /> corporation tax,{' '}
              <Money pence={personal.extraTaxPence} /> personal tax,{' '}
              <Money pence={personal.netInHandPence} /> in {personal.name}'s pocket (
              {formatRate(combinedTax / company.extraProfitPence)} all-in).
            </p>
          )}

          <div className="form__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!dateInYear}
              onClick={record}
            >
              Record this dividend
            </button>
          </div>
        </>
      )}
    </section>
  );
}
