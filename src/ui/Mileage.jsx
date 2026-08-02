import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { mileageTripsRepo } from '../db/repositories.js';
import { settings } from '../db/settings.js';
import { gatherMileageData } from '../db/mileageData.js';
import { taxYearForDate, shiftTaxYear, taxYearBounds } from '../engine/tax.js';
import EmptyState from './components/EmptyState.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import Modal from './components/Modal.jsx';
import { formatDay } from './components/dates.js';
import MileageSummary from './mileage/MileageSummary.jsx';
import TripForm from './mileage/TripForm.jsx';
import TripList from './mileage/TripList.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Mileage tab (spec amendment 2026-08-02 (h)) — the business-mileage claim
 * tracker. Log each trip; the app applies HMRC's approved rates for the tax
 * year (45p a mile for the first 10,000 car/van miles, 25p after that; 24p
 * motorcycle, 20p bicycle), nets off whatever the employer already paid, and
 * shows the claim left over and what it is worth as a refund.
 *
 * Only the trips are stored. The band split, the running position against the
 * 10,000-mile line, and the claim are all computed at read time by
 * `gatherMileageData`, per the "never persist computed rows" rule.
 */
export default function Mileage() {
  const [taxYear, setTaxYear] = useState(() => taxYearForDate(today()));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // raw repo row (pounds)
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data, loading } = useLiveData(() => gatherMileageData(taxYear), [taxYear]);

  const currentYear = taxYearForDate(today());
  const bounds = taxYearBounds(taxYear);
  const trips = data?.trips ?? [];

  const add = async (payload) => {
    await mileageTripsRepo.add(payload);
    setAdding(false);
  };
  const save = async (payload) => {
    await mileageTripsRepo.update(editing.id, payload);
    setEditing(null);
  };
  const remove = async () => {
    await mileageTripsRepo.delete(confirmDelete.id);
    setConfirmDelete(null);
  };

  // The list carries pence-domain trips; the edit form needs the pounds row back.
  const openEdit = async (trip) => {
    setEditing(await mileageTripsRepo.get(trip.id));
  };

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Mileage</h2>
        <div className="screen__head-actions">
          <div className="taxyear-nav" role="group" aria-label="Tax year">
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Previous tax year"
              onClick={() => setTaxYear((y) => shiftTaxYear(y, -1))}
            >
              ‹
            </button>
            <span className="taxyear-nav__label">
              Tax year {taxYear}
              <span className="muted taxyear-nav__dates">
                {formatDay(bounds.startDate)} – {formatDay(bounds.endDate)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Next tax year"
              onClick={() => setTaxYear((y) => shiftTaxYear(y, 1))}
            >
              ›
            </button>
            {taxYear !== currentYear && (
              <button type="button" className="btn btn--sm" onClick={() => setTaxYear(currentYear)}>
                Today
              </button>
            )}
          </div>
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            Add trip
          </button>
        </div>
      </header>

      {data && data.tableYear !== data.taxYear && (
        <p className="banner banner--info">
          No approved mileage rates recorded for {data.taxYear} — figures use the{' '}
          {data.tableYear} rates.
        </p>
      )}

      {adding && (
        <Modal title="Add trip" onClose={() => setAdding(false)}>
          <TripForm
            employerRatePence={data?.employerRatePence ?? 0}
            onSubmit={add}
            onCancel={() => setAdding(false)}
          />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit trip — ${formatDay(editing.date)}`} onClose={() => setEditing(null)}>
          <TripForm
            key={editing.id}
            initial={editing}
            employerRatePence={data?.employerRatePence ?? 0}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : trips.length === 0 ? (
        <EmptyState
          title={`No trips logged for ${taxYear}`}
          hint="Add each business journey with its date, miles, and purpose. The first 10,000 car or van miles in a tax year are worth 45p each, then 25p — the app tracks where you are against that line and works out what you can claim back."
        />
      ) : (
        <>
          <MileageSummary
            data={data}
            onEmployerRateChange={(p) => settings.setMileageEmployerRatePence(p)}
            onMarginalRateChange={(r) => settings.setMileageMarginalRate(r)}
          />
          <TripList trips={trips} onEdit={openEdit} onDelete={setConfirmDelete} />
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete trip"
        message={
          confirmDelete
            ? `Delete the ${confirmDelete.miles}-mile trip on ${formatDay(confirmDelete.date)}? Later trips in the year will re-price against the 10,000-mile line. This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
