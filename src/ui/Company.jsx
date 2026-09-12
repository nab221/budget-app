import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { gatherCompanyData } from '../db/companyData.js';
import {
  financialYearForDate,
  shiftFinancialYear,
  financialYearBounds,
} from '../engine/corporation-tax.js';
import EmptyState from './components/EmptyState.jsx';
import { formatDay } from './components/dates.js';
import CompanySummary from './company/CompanySummary.jsx';
import { fyTitle } from './company/format.js';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Company tab (spec amendment 2026-09-12 (j)) — corporation tax on the
 * dividends both people draw from the same limited company. A dividend can
 * only be paid out of profit AFTER corporation tax, so the dividends drawn
 * in a company year (1 April – 31 March, the owner's year-end) imply a
 * profit and a CT bill; this screen shows both, where the year sits against
 * the £50,000 small-profits line, and — via the draw calculator — what one
 * more dividend would cost the company and the person drawing it.
 *
 * The ledger IS the Income tab's dividend events. Nothing is stored here:
 * profit, CT, and previews are computed at read time by `gatherCompanyData`,
 * per the "never persist computed rows" rule.
 */
export default function Company() {
  const [fy, setFy] = useState(() => financialYearForDate(today()));

  const { data, loading } = useLiveData(() => gatherCompanyData(fy), [fy]);

  const currentFy = financialYearForDate(today());
  const bounds = financialYearBounds(fy);
  const people = data?.people ?? [];

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Company</h2>
        <div className="screen__head-actions">
          <div className="taxyear-nav" role="group" aria-label="Company year">
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Previous company year"
              onClick={() => setFy((y) => shiftFinancialYear(y, -1))}
            >
              ‹
            </button>
            <span className="taxyear-nav__label">
              Company year {fyTitle(fy)}
              <span className="muted taxyear-nav__dates">
                {formatDay(bounds.startDate)} – {formatDay(bounds.endDate)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Next company year"
              onClick={() => setFy((y) => shiftFinancialYear(y, 1))}
            >
              ›
            </button>
            {fy !== currentFy && (
              <button type="button" className="btn btn--sm" onClick={() => setFy(currentFy)}>
                Today
              </button>
            )}
          </div>
          {/* Task 7 adds the "Record dividend" button here. */}
        </div>
      </header>

      {data && data.tableYear !== data.financialYear && (
        <p className="banner banner--info">
          No corporation-tax rules recorded for {fyTitle(data.financialYear)} — figures use
          the {fyTitle(data.tableYear)} rules.
        </p>
      )}

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState
          title="No people yet"
          hint="Add yourself and your wife on the Income tab first. Every dividend recorded there is pooled here as a draw from the company."
        />
      ) : (
        <>
          <CompanySummary data={data} />
          {/* Task 8 adds <DrawCalculator> here. */}
          {/* Task 7 adds <DividendLedger> here. */}
        </>
      )}
    </div>
  );
}
