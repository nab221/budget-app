import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { PAY_DATE_RULES } from './payRule.js';

const blank = { name: '', amountPence: '', payDateRule: 'nth-of-month', payDateDay: 28, active: true };

/**
 * Add/edit form for an income source. `initial` seeds edit mode; omit for add.
 * Calls `onSubmit(payload)` with pounds-at-the-edge money; the parent persists
 * via the repository (which validates and may throw).
 */
export default function IncomeSourceForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({ ...blank, ...initial }));
  const [error, setError] = useState(null);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      name: form.name.trim(),
      amountPence: form.amountPence === '' || form.amountPence == null ? 0 : Number(form.amountPence),
      payDateRule: form.payDateRule,
      active: !!form.active,
    };
    if (form.payDateRule === 'nth-of-month') {
      payload.payDateDay = Number(form.payDateDay);
    } else {
      payload.payDateDay = null;
    }
    if (!payload.name) {
      setError('Name is required.');
      return;
    }
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form card" onSubmit={submit}>
      <div className="field">
        <label>Name</label>
        <input
          className="input"
          type="text"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="e.g. Salary"
        />
      </div>

      <div className="field">
        <label>Amount</label>
        <CurrencyInput value={form.amountPence} onChange={(v) => set({ amountPence: v })} />
      </div>

      <div className="form-row">
        <div className="field">
          <label>Pay date rule</label>
          <select
            className="input"
            value={form.payDateRule}
            onChange={(e) => set({ payDateRule: e.target.value })}
          >
            {PAY_DATE_RULES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {form.payDateRule === 'nth-of-month' && (
          <div className="field">
            <label>Day (1–28)</label>
            <input
              className="input"
              type="number"
              min="1"
              max="28"
              value={form.payDateDay}
              onChange={(e) => set({ payDateDay: e.target.value })}
            />
          </div>
        )}
      </div>

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
          {initial ? 'Save' : 'Add income source'}
        </button>
      </div>
    </form>
  );
}
