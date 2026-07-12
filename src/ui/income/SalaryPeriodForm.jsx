import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

/** The sentinel effectiveFrom created by the v5 migration — "always in force". */
export const PERIOD_START_SENTINEL = '1900-01-01';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add / edit one salary timeline entry (income redesign, amendment (c)):
 * an annual rate in force from a date — a pay raise, a step down to
 * less-than-full-time, or a new contract is just a new entry. Money is
 * pounds at the repository edge. Months without a payslip are projected from
 * whichever entry is in force; the change month is pro-rated by day.
 *
 * @param {object} props
 * @param {string} props.personName - shown in the form title.
 * @param {object} [props.initial] - existing period (pounds at edge) when editing.
 */
export default function SalaryPeriodForm({ personName, initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    effectiveFrom:
      initial && initial.effectiveFrom !== PERIOD_START_SENTINEL ? initial.effectiveFrom : today(),
    keepSentinel: !!initial && initial.effectiveFrom === PERIOD_START_SENTINEL,
    annualSalaryPence: initial?.annualSalaryPence || '',
    salarySacrificePence: initial?.salarySacrificePence || '',
    workplacePensionAnnualPence: initial?.workplacePensionAnnualPence || '',
    note: initial?.note || '',
  }));
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.keepSentinel && !/^\d{4}-\d{2}-\d{2}$/.test(form.effectiveFrom || '')) {
      setError('A from-date is required.');
      return;
    }
    const numOrZero = (v) => (v === '' || v == null ? 0 : Number(v));
    const money = {
      annualSalaryPence: numOrZero(form.annualSalaryPence),
      salarySacrificePence: numOrZero(form.salarySacrificePence),
      workplacePensionAnnualPence: numOrZero(form.workplacePensionAnnualPence),
    };
    if (Object.values(money).some((v) => v < 0)) {
      setError('Annual figures can’t be negative.');
      return;
    }
    try {
      await onSubmit({
        effectiveFrom: form.keepSentinel ? PERIOD_START_SENTINEL : form.effectiveFrom,
        ...money, // pounds edge
        note: form.note.trim(),
      });
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form card" onSubmit={submit}>
      <h3 className="form__title">
        {initial ? 'Edit' : 'Add'} salary change — {personName}
      </h3>
      <div className="form-row">
        <div className="field">
          <label>In force from</label>
          {form.keepSentinel ? (
            <>
              <input className="input" type="text" value="the start" disabled />
              <p className="field__hint">
                This is the starting rate.{' '}
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => set({ keepSentinel: false })}
                >
                  Give it a date
                </button>
              </p>
            </>
          ) : (
            <>
              <input
                className="input"
                type="date"
                value={form.effectiveFrom}
                onChange={(e) => set({ effectiveFrom: e.target.value })}
              />
              <p className="field__hint">
                The day the new pay applies from — the app pro-rates that month by day.
              </p>
            </>
          )}
        </div>
        <div className="field">
          <label>Annual gross salary</label>
          <CurrencyInput
            value={form.annualSalaryPence}
            onChange={(v) => set({ annualSalaryPence: v })}
          />
          <p className="field__hint">
            The full-year contract figure at this rate. For less-than-full-time, enter the
            reduced annual figure (e.g. 80% of the full-time salary), not the percentage.
          </p>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label>Salary sacrifice / year</label>
          <CurrencyInput
            value={form.salarySacrificePence}
            onChange={(v) => set({ salarySacrificePence: v })}
          />
          <p className="field__hint">Car scheme, cycle-to-work… taken out of pay before tax.</p>
        </div>
        <div className="field">
          <label>Workplace pension / year</label>
          <CurrencyInput
            value={form.workplacePensionAnnualPence}
            onChange={(v) => set({ workplacePensionAnnualPence: v })}
          />
          <p className="field__hint">
            Your own before-tax pension deduction (e.g. NHS pension) expected per year at
            this rate — keeps projected months in line with real payslips. £0 if unsure.
          </p>
        </div>
        <div className="field field--grow">
          <label>Note (optional)</label>
          <input
            className="input"
            type="text"
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="e.g. new contract, 0.8 WTE"
          />
        </div>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : 'Add salary change'}
        </button>
      </div>
    </form>
  );
}
