import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
];

const blank = {
  label: '',
  amountPence: '',
  categoryId: '',
  frequency: 'monthly',
  nextDueDate: '',
  adjustToWorkingDay: true,
  endDate: '',
  active: true,
};

/**
 * Add/edit form for a recurring bill (spec §4.2).
 * @param {object[]} spendingCategories - categories with kind 'spending'.
 */
export default function RecurringBillForm({ initial, spendingCategories, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({ ...blank, ...initial }));
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.label.trim()) {
      setError('Label is required.');
      return;
    }
    if (!form.categoryId) {
      setError('Choose a spending category.');
      return;
    }
    if (!form.nextDueDate) {
      setError('Next due date is required.');
      return;
    }
    // Anchor the intended day-of-month from the chosen due date so month-end
    // bills don't drift after a February clamp (M4).
    const anchorDay = Number(String(form.nextDueDate).slice(8, 10)) || 1;
    const payload = {
      label: form.label.trim(),
      amountPence: form.amountPence === '' || form.amountPence == null ? 0 : Number(form.amountPence),
      categoryId: Number(form.categoryId),
      frequency: form.frequency,
      nextDueDate: form.nextDueDate,
      dueDayAnchor: anchorDay,
      adjustToWorkingDay: !!form.adjustToWorkingDay,
      endDate: form.endDate || null,
      active: !!form.active,
    };
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form card" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label>Label</label>
          <input
            className="input"
            type="text"
            value={form.label}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="e.g. Netflix"
          />
        </div>
        <div className="field">
          <label>Amount</label>
          <CurrencyInput value={form.amountPence} onChange={(v) => set({ amountPence: v })} />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Category</label>
          <select
            className="input"
            value={form.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
          >
            <option value="">Select…</option>
            {spendingCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Frequency</label>
          <select
            className="input"
            value={form.frequency}
            onChange={(e) => set({ frequency: e.target.value })}
          >
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Next due date</label>
          <input
            className="input"
            type="date"
            value={form.nextDueDate}
            onChange={(e) => set({ nextDueDate: e.target.value })}
          />
        </div>
        <div className="field">
          <label>End date (optional)</label>
          <input
            className="input"
            type="date"
            value={form.endDate || ''}
            onChange={(e) => set({ endDate: e.target.value })}
          />
        </div>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!form.adjustToWorkingDay}
          onChange={(e) => set({ adjustToWorkingDay: e.target.checked })}
        />
        Shift to next working day if it falls on a weekend/bank holiday
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={!!form.active}
          onChange={(e) => set({ active: e.target.checked })}
        />
        Active
      </label>

      {error && <p className="form__error">{error}</p>}

      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : 'Add bill'}
        </button>
      </div>
    </form>
  );
}
