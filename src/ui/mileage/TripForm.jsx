import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { VEHICLE_KINDS, VEHICLE_LABELS } from '../../engine/mileage.js';

const today = () => new Date().toISOString().slice(0, 10);

/** Miles × pence-per-mile → pounds, to two decimals. */
function reimbursementFor(miles, employerRatePence) {
  const n = Number(miles);
  if (!Number.isFinite(n) || n <= 0 || !employerRatePence) return 0;
  return Math.round(n * employerRatePence) / 100;
}

/** The pence-per-mile in force for a trip: the employer's rate, else the fallback. */
function rateFor(employerId, employers, fallbackPence) {
  if (employerId == null) return fallbackPence;
  return employers.find((e) => e.id === employerId)?.ratePencePerMile ?? 0;
}

/**
 * Add / edit form for one business trip (spec amendment 2026-08-02 (h)).
 * Money is pounds at the repository edge, as everywhere else; miles are a
 * decimal number of miles. Rendered inside a Modal, which carries the title.
 *
 * When a mileage rate is in force, the reimbursement field auto-fills from the
 * miles as they are typed — until the user edits it by hand, after which their
 * figure is left alone. Switching employer re-applies the new rate, since the
 * pre-filled figure came from the old one.
 *
 * @param {object} props
 * @param {object} [props.initial] - existing trip (pounds at edge) when editing.
 * @param {Array<{ id: number, name: string, ratePencePerMile: number }>} [props.employers]
 *   the selectable employments; the picker is hidden when there are none.
 * @param {number} props.employerRatePence - fallback pence per mile, used for a
 *   trip with no employer (0 = none).
 */
export default function TripForm({
  initial,
  employers = [],
  employerRatePence = 0,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(() => ({
    date: initial?.date || today(),
    purpose: initial?.purpose || '',
    vehicle: initial?.vehicle || 'car',
    employerId: initial?.employerId ?? null,
    miles: initial?.miles ?? '',
    reimbursedPence: initial?.reimbursedPence ?? '',
  }));
  // An existing trip's figure is the user's own, so never overwrite it.
  const [reimbursementTouched, setReimbursementTouched] = useState(!!initial);
  const [error, setError] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const activeRatePence = rateFor(form.employerId, employers, employerRatePence);

  const setMiles = (miles) => {
    setForm((f) => ({
      ...f,
      miles,
      reimbursedPence:
        reimbursementTouched || !activeRatePence
          ? f.reimbursedPence
          : reimbursementFor(miles, activeRatePence),
    }));
  };

  const setEmployer = (raw) => {
    const employerId = raw === '' ? null : Number(raw);
    const rate = rateFor(employerId, employers, employerRatePence);
    setForm((f) => ({
      ...f,
      employerId,
      // The old employer's rate produced the current figure, so re-derive it.
      reimbursedPence: reimbursementTouched
        ? f.reimbursedPence
        : reimbursementFor(f.miles, rate),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || '')) {
      setError('A date is required.');
      return;
    }
    const miles = Number(form.miles);
    if (!Number.isFinite(miles) || miles <= 0) {
      setError('Enter the miles driven (more than 0).');
      return;
    }
    const reimbursed =
      form.reimbursedPence === '' || form.reimbursedPence == null
        ? 0
        : Number(form.reimbursedPence);
    if (!Number.isFinite(reimbursed) || reimbursed < 0) {
      setError('Reimbursement can’t be negative.');
      return;
    }
    try {
      await onSubmit({
        date: form.date,
        purpose: form.purpose.trim(),
        vehicle: form.vehicle,
        employerId: form.employerId,
        // Stored to the tenth of a mile — the engine rounds there anyway, so
        // rounding here keeps what is saved and what is claimed identical.
        miles: Math.round(miles * 10) / 10,
        reimbursedPence: reimbursed, // pounds edge
      });
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="trip-date">Date</label>
          <input
            id="trip-date"
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="trip-miles">Miles</label>
          <input
            id="trip-miles"
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            placeholder="0.0"
            value={form.miles}
            onChange={(e) => setMiles(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="trip-vehicle">Vehicle</label>
          <select
            id="trip-vehicle"
            className="input"
            value={form.vehicle}
            onChange={(e) => set({ vehicle: e.target.value })}
          >
            {VEHICLE_KINDS.map((v) => (
              <option key={v} value={v}>
                {VEHICLE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {employers.length > 0 && (
        <div className="form-row">
          <div className="field field--grow">
            <label htmlFor="trip-employer">Employer</label>
            <select
              id="trip-employer"
              className="input"
              value={form.employerId ?? ''}
              onChange={(e) => setEmployer(e.target.value)}
            >
              <option value="">No employer</option>
              {employers.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <span className="field__hint">
              Each employment has its own 10,000 miles at the higher rate.
            </span>
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="field field--grow">
          <label htmlFor="trip-purpose">Purpose</label>
          <input
            id="trip-purpose"
            className="input"
            type="text"
            value={form.purpose}
            onChange={(e) => set({ purpose: e.target.value })}
            placeholder="e.g. Client visit — Leeds"
          />
          <span className="field__hint">
            HMRC expect a record of why each journey was business travel.
          </span>
        </div>
        <div className="field">
          <label htmlFor="trip-reimbursed">Paid by employer</label>
          <CurrencyInput
            id="trip-reimbursed"
            value={form.reimbursedPence}
            onChange={(v) => {
              setReimbursementTouched(true);
              set({ reimbursedPence: v });
            }}
          />
          <span className="field__hint">
            {activeRatePence > 0
              ? `Auto-filled at ${activeRatePence}p per mile — overwrite if this trip differs.`
              : 'Leave at £0 if nothing is paid for this trip.'}
          </span>
        </div>
      </div>

      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : 'Add trip'}
        </button>
      </div>
    </form>
  );
}
