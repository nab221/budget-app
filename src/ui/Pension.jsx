// src/ui/Pension.jsx
import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { gatherIncomeData } from '../db/incomeData.js';
import { peopleRepo, pensionYearsRepo } from '../db/repositories.js';
import { taxYearForDate, shiftTaxYear, taxYearBounds } from '../engine/tax.js';
import EmptyState from './components/EmptyState.jsx';
import Modal from './components/Modal.jsx';
import { formatDay } from './components/dates.js';
import PensionCard from './pension/PensionCard.jsx';
import PensionDetailsForm from './pension/PensionDetailsForm.jsx';
import PensionYearForm from './pension/PensionYearForm.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Pension tab (spec amendment 2026-09-15 (k)) — the pension annual
 * allowance for defined-benefit members, measured the way HMRC does: by the
 * pension input amount, not by contributions. Per person: scheme + statement
 * anchor, this year's estimate, the three-year carry-forward, and how much
 * more can go into a SIPP. Reads `gatherIncomeData` so the figures are the
 * ones the Income card's meter shows; nothing is stored beyond the entered
 * figures.
 *
 * @param {string} [props.initialTaxYear] - pin the opening year (tests); defaults to today's.
 */
export default function Pension({ initialTaxYear }) {
  const [taxYear, setTaxYear] = useState(() => initialTaxYear || taxYearForDate(today()));
  const [detailsDialog, setDetailsDialog] = useState(null); // income entry (raw person row inside)
  const [yearDialog, setYearDialog] = useState(null); // { personId, personName, taxYear, row }

  const { data, loading } = useLiveData(() => gatherIncomeData(taxYear), [taxYear]);

  const currentYear = taxYearForDate(today());
  const bounds = taxYearBounds(taxYear);
  const people = data?.people ?? [];

  const cpiMissing = [...new Set(people.flatMap((p) => p.pension?.cpiMissing ?? []))].sort();
  const fallbackYears = [
    ...new Set(people.flatMap((p) => (p.pension?.years ?? []).filter((y) => !y.allowanceFromTable).map((y) => y.taxYear))),
  ].sort();

  const saveDetails = async (payload) => {
    await peopleRepo.update(detailsDialog.id, payload);
    setDetailsDialog(null);
  };
  const openYear = async (person, year) => {
    const existing = person.pension.rows.find((r) => r.taxYear === year.taxYear);
    setYearDialog({
      personId: person.id,
      personName: person.name,
      taxYear: year.taxYear,
      row: existing ? await pensionYearsRepo.get(existing.id) : null, // pounds row for the form
    });
  };
  const saveYear = async (payload) => {
    await pensionYearsRepo.upsert(yearDialog.personId, yearDialog.taxYear, payload);
    setYearDialog(null);
  };

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Pension</h2>
        <div className="screen__head-actions">
          <div className="taxyear-nav" role="group" aria-label="Tax year">
            <button type="button" className="btn btn--sm" aria-label="Previous tax year" onClick={() => setTaxYear((y) => shiftTaxYear(y, -1))}>
              ‹
            </button>
            <span className="taxyear-nav__label">
              Tax year {taxYear}
              <span className="muted taxyear-nav__dates">
                {formatDay(bounds.startDate)} – {formatDay(bounds.endDate)}
              </span>
            </span>
            <button type="button" className="btn btn--sm" aria-label="Next tax year" onClick={() => setTaxYear((y) => shiftTaxYear(y, 1))}>
              ›
            </button>
            {taxYear !== currentYear && (
              <button type="button" className="btn btn--sm" onClick={() => setTaxYear(currentYear)}>
                Today
              </button>
            )}
          </div>
        </div>
      </header>

      {cpiMissing.length > 0 && (
        <p className="banner banner--info">
          No September CPI for {cpiMissing.join(', ')} yet — estimates for those years are off. Add
          the figure to SEPTEMBER_CPI in the pension engine once it is published.
        </p>
      )}
      {fallbackYears.length > 0 && (
        <p className="banner banner--info">
          No rate table for {fallbackYears.join(', ')} — the annual allowance shown (*) uses the
          nearest known year.
        </p>
      )}

      {detailsDialog && (
        <Modal title={`Pension details — ${detailsDialog.name}`} onClose={() => setDetailsDialog(null)}>
          <PensionDetailsForm key={detailsDialog.id} initial={detailsDialog.person} onSubmit={saveDetails} onCancel={() => setDetailsDialog(null)} />
        </Modal>
      )}
      {yearDialog && (
        <Modal title={`${yearDialog.personName} — ${yearDialog.taxYear}`} onClose={() => setYearDialog(null)}>
          <PensionYearForm key={`${yearDialog.personId}-${yearDialog.taxYear}`} taxYear={yearDialog.taxYear} initial={yearDialog.row} onSubmit={saveYear} onCancel={() => setYearDialog(null)} />
        </Modal>
      )}

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState title="No people yet" hint="Add yourself and your wife on the Income tab first; each person's scheme and statement figure are set here." />
      ) : (
        <ul className="card-list">
          {people.map((person) => (
            <PensionCard
              key={person.id}
              entry={person.pension}
              summary={person.summary}
              onEditDetails={() => setDetailsDialog(person)}
              onEditYear={(year) => openYear(person, year)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
