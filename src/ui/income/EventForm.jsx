import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

const today = () => new Date().toISOString().slice(0, 10);

export const EVENT_KIND_LABELS = {
  dividend: 'Dividend draw',
  'salary-adjustment': 'Salary adjustment',
};

/**
 * Add / edit form for an income event (spec amendment 2026-07-07 (b)):
 * a dividend draw or a one-off salary adjustment (bonus, unpaid leave — signed).
 * Money is pounds at the repository edge, as everywhere else.
 *
 * @param {object} props
 * @param {'dividend'|'salary-adjustment'} props.kind
 * @param {string} props.personName - shown in the form title.
 * @param {object} [props.initial] - existing event (pounds at edge) when editing.
 */
export default function EventForm({ kind, personName, initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    date: initial?.date || today(),
    amountPence: initial?.amountPence ?? '',
    note: initial?.note || '',
  }));
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const isDividend = kind === 'dividend';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || '')) {
      setError('A date is required.');
      return;
    }
    const amount = form.amountPence === '' || form.amountPence == null ? null : Number(form.amountPence);
    if (amount == null || Number.isNaN(amount) || amount === 0) {
      setError('An amount is required.');
      return;
    }
    if (isDividend && amount < 0) {
      setError('A dividend draw must be a positive amount.');
      return;
    }
    try {
      await onSubmit({
        date: form.date,
        kind,
        amountPence: amount, // pounds edge
        note: form.note.trim(),
      });
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form card" onSubmit={submit}>
      <h3 className="form__title">
        {initial ? 'Edit' : 'Add'} {EVENT_KIND_LABELS[kind].toLowerCase()} — {personName}
      </h3>
      <div className="form-row">
        <div className="field">
          <label>Date</label>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Amount</label>
          <CurrencyInput
            value={form.amountPence}
            onChange={(v) => set({ amountPence: v })}
          />
        </div>
        <div className="field field--grow">
          <label>Note (optional)</label>
          <input
            className="input"
            type="text"
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder={isDividend ? 'e.g. Q2 dividend' : 'e.g. June bonus'}
          />
        </div>
      </div>
      {!isDividend && (
        <p className="muted">
          Use a negative amount for pay you didn’t receive (e.g. unpaid leave).
        </p>
      )}
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : `Add ${EVENT_KIND_LABELS[kind].toLowerCase()}`}
        </button>
      </div>
    </form>
  );
}
