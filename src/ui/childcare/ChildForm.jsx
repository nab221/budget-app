import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

const today = () => new Date().toISOString().slice(0, 10);

const blank = {
  name: '',
  providerMonthlyCostPence: '',
  tfcBalancePence: '',
  tfcBalanceAsOf: today(),
  isDisabled: false,
  paymentDayOfMonth: 1,
};

const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

/**
 * Add / edit form for a child (spec §4.5). Money fields are pounds at the
 * repository edge (the repo converts to pence at rest).
 */
export default function ChildForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...blank,
    ...(initial
      ? {
          name: initial.name || '',
          providerMonthlyCostPence: initial.providerMonthlyCostPence,
          tfcBalancePence: initial.tfcBalancePence,
          tfcBalanceAsOf: initial.tfcBalanceAsOf || today(),
          isDisabled: !!initial.isDisabled,
          paymentDayOfMonth: initial.paymentDayOfMonth ?? 1,
        }
      : {}),
  }));
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    const day = Number(form.paymentDayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 28) {
      setError('Payment day must be a whole number between 1 and 28.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      providerMonthlyCostPence: numOrNull(form.providerMonthlyCostPence) ?? 0, // pounds edge
      tfcBalancePence: numOrNull(form.tfcBalancePence) ?? 0, // pounds edge
      tfcBalanceAsOf: form.tfcBalanceAsOf || today(),
      isDisabled: !!form.isDisabled,
      paymentDayOfMonth: day,
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
        <div className="field field--grow">
          <label>Child’s name</label>
          <input
            className="input"
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Ava"
          />
        </div>
        <div className="field">
          <label>Provider monthly cost</label>
          <CurrencyInput
            value={form.providerMonthlyCostPence}
            onChange={(v) => set({ providerMonthlyCostPence: v })}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>TFC account balance</label>
          <CurrencyInput
            value={form.tfcBalancePence}
            onChange={(v) => set({ tfcBalancePence: v })}
          />
        </div>
        <div className="field">
          <label>Balance as of</label>
          <input
            className="input"
            type="date"
            value={form.tfcBalanceAsOf}
            onChange={(e) => set({ tfcBalanceAsOf: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Deposit day (1–28)</label>
          <input
            className="input"
            type="number"
            min="1"
            max="28"
            value={form.paymentDayOfMonth}
            onChange={(e) => set({ paymentDayOfMonth: e.target.value })}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.isDisabled}
              onChange={(e) => set({ isDisabled: e.target.checked })}
            />{' '}
            Child qualifies for the disabled TFC rate (£1,000/quarter cap)
          </label>
        </div>
      </div>

      {error && <p className="form__error">{error}</p>}

      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : 'Add child'}
        </button>
      </div>
    </form>
  );
}
