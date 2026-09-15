// src/ui/pension/PensionCard.jsx
import Money from '../components/Money.jsx';
import { formatDay } from '../components/dates.js';
import { SCHEMES, TAPER_THRESHOLD_INCOME_PENCE, FIRST_ESTIMATE_YEAR } from '../../engine/pension.js';
import { formatGBP } from '../../engine/currency.js';
import PensionYearsTable from './PensionYearsTable.jsx';

/** 0.038 → "3.8%". */
const pct = (rate) => `${((rate || 0) * 100).toFixed(1)}%`;

/**
 * One person's annual-allowance card (amendment (k)): scheme + anchor,
 * the headline (used, carry-forward, SIPP headroom), this year's estimate
 * with its inputs, the taper warning, and the four-year table. Everything
 * is computed at read time by `gatherPensionData` — nothing persisted.
 *
 * @param {object} props.entry - a `gatherPensionData` person (`entry.pension` on the Income data).
 * @param {object} props.summary - the person's `computePersonTax` summary (for adjusted net income).
 */
export default function PensionCard({ entry, summary, onEditDetails, onEditYear }) {
  const { name, scheme, anchor, rows, years, current, carryForwardPence, headroomGrossPence, headroomNetPence, over, chargeablePence } = entry;
  const schemeLabel = scheme ? SCHEMES[scheme].label : 'No DB scheme';
  const noteByYear = new Map(rows.map((r) => [r.taxYear, r.note]));
  const yearsWithNotes = years.map((y) => ({ ...y, note: noteByYear.get(y.taxYear) || '' }));
  const est = current.estimate;
  const taper = summary && summary.adjustedNetIncomePence > TAPER_THRESHOLD_INCOME_PENCE;

  return (
    <li className="card pension-card">
      <div className="debt-card__head">
        <span className="debt-card__name">{name}</span>
        <span className={`badge ${scheme ? 'badge--income' : 'badge--source'}`}>{schemeLabel}</span>
        <div className="debt-card__actions">
          <button type="button" className="btn btn--sm" onClick={onEditDetails}>
            Edit pension details
          </button>
        </div>
      </div>

      {anchor ? (
        <p className="muted">
          <Money pence={anchor.pence} /> accrued at {formatDay(anchor.date)} (opens {anchor.openingYear})
        </p>
      ) : (
        <p className="muted">
          SIPP-only — set the scheme and the statement figure to include the NHS/LGPS pension.
        </p>
      )}

      <div className="kpi-row">
        <div className="stat">
          <span className="stat__label">Allowance used this year</span>
          <span className="stat__value">
            <Money pence={current.usedPence} />
          </span>
          <span className="stat__sub muted">of {formatGBP(current.allowancePence)}</span>
        </div>
        <div className="stat">
          <span className="stat__label">Carry-forward available</span>
          <span className="stat__value">
            <Money pence={carryForwardPence} />
          </span>
          <span className="stat__sub muted">
            unused from {years[0].taxYear} – {years[years.length - 2].taxYear}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">SIPP headroom</span>
          {over ? (
            <span className="stat__value stat__value--neg">
              <Money pence={chargeablePence} /> over
            </span>
          ) : (
            <span className="stat__value">
              <Money pence={headroomGrossPence} /> gross · pay in <Money pence={headroomNetPence} />
            </span>
          )}
          <span className="stat__sub muted">
            {over
              ? 'Over the allowance after carry-forward — the excess is taxed at your marginal rate.'
              : 'Gross includes the 25% relief the provider adds.'}
          </span>
        </div>
      </div>

      {taper && (
        <p className="banner banner--warn">
          Adjusted net income is over {formatGBP(TAPER_THRESHOLD_INCOME_PENCE)} — the tapered annual
          allowance may apply and the {formatGBP(current.allowancePence)} figure could be lower. Not
          modelled here.
        </p>
      )}

      <section className="pension-estimate">
        <h4>
          This year’s estimate
          {current.piaSource === 'entered' && <span className="muted"> (for reference — entered figure in force)</span>}
        </h4>
        {est ? (
          <dl className="debt-card__facts">
            <div>
              <dt>Opening pension</dt>
              <dd><Money pence={est.openingPence} /></dd>
            </div>
            <div>
              <dt>CPI</dt>
              <dd>{pct(est.cpi)}</dd>
            </div>
            <div>
              <dt>Revaluation applied</dt>
              <dd>{pct(est.cpi + SCHEMES[scheme].realRevaluation)}</dd>
            </div>
            <div>
              <dt>Pensionable earnings</dt>
              <dd>
                <Money pence={est.earningsPence} />{' '}
                <span className="muted">({est.earningsSource === 'override' ? 'override' : 'from salary timeline'})</span>
              </dd>
            </div>
            <div>
              <dt>Accrual added</dt>
              <dd><Money pence={Math.round(est.earningsPence / SCHEMES[scheme].accrualDenominator)} /></dd>
            </div>
            <div>
              <dt>Closing pension</dt>
              <dd><Money pence={est.closingPence} /></dd>
            </div>
            <div>
              <dt>Pension input amount</dt>
              <dd><Money pence={est.piaPence} /></dd>
            </div>
          </dl>
        ) : (
          <p className="muted">
            {!scheme || !anchor
              ? 'No estimate without a scheme and a statement anchor.'
              : anchor.openingYear < FIRST_ESTIMATE_YEAR
                ? 'The anchor predates 2022-23 — enter a statement figure dated 31 March 2022 or later.'
                : current.taxYear < anchor.openingYear
                  ? `The anchor opens ${anchor.openingYear}; earlier years are entered, not estimated.`
                  : 'No estimate — the September CPI for this year is not recorded yet.'}
          </p>
        )}
      </section>

      <PensionYearsTable years={yearsWithNotes} onEditYear={onEditYear} />
    </li>
  );
}
