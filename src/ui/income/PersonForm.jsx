import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

const blank = {
  name: '',
  annualSalaryPence: '',
  salarySacrificePence: '',
  pensionAnnualPence: '',
  benefitsInKindPence: '',
  otherIncomePence: '',
};

const numOrZero = (v) => (v === '' || v == null ? 0 : Number(v));

/**
 * Add / edit form for a person (spec amendment 2026-07-07 (b)). All money
 * fields are ANNUAL figures in pounds at the repository edge. The field hints
 * carry the tax meaning so the owner doesn't need to remember the rules.
 */
export default function PersonForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...blank,
    ...(initial
      ? {
          name: initial.name || '',
          annualSalaryPence: initial.annualSalaryPence || '',
          salarySacrificePence: initial.salarySacrificePence || '',
          pensionAnnualPence: initial.pensionAnnualPence || '',
          benefitsInKindPence: initial.benefitsInKindPence || '',
          otherIncomePence: initial.otherIncomePence || '',
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
    const money = {
      annualSalaryPence: numOrZero(form.annualSalaryPence),
      salarySacrificePence: numOrZero(form.salarySacrificePence),
      pensionAnnualPence: numOrZero(form.pensionAnnualPence),
      benefitsInKindPence: numOrZero(form.benefitsInKindPence),
      otherIncomePence: numOrZero(form.otherIncomePence),
    };
    if (Object.values(money).some((v) => v < 0)) {
      setError('Annual figures can’t be negative.');
      return;
    }
    try {
      await onSubmit({ name: form.name.trim(), ...money }); // pounds edge
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form card" onSubmit={submit}>
      <div className="form-row">
        <div className="field field--grow">
          <label>Name</label>
          <input
            className="input"
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Anderson"
          />
        </div>
        <div className="field">
          <label>Annual gross salary</label>
          <CurrencyInput
            value={form.annualSalaryPence}
            onChange={(v) => set({ annualSalaryPence: v })}
          />
          <p className="field__hint">The contract figure, before tax.</p>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Salary sacrifice / year</label>
          <CurrencyInput
            value={form.salarySacrificePence}
            onChange={(v) => set({ salarySacrificePence: v })}
          />
          <p className="field__hint">
            Car scheme, cycle-to-work, pension via sacrifice — taken out of pay before tax.
            A sacrificed car usually creates a benefit in kind: put that in the P11D field.
          </p>
        </div>
        <div className="field">
          <label>Personal pension / year</label>
          <CurrencyInput
            value={form.pensionAnnualPence}
            onChange={(v) => set({ pensionAnnualPence: v })}
          />
          <p className="field__hint">
            Only pension you pay from taxed pay — it lowers the income counted for the
            £100k childcare line. If the provider adds 25% tax relief, enter the total
            including that top-up. Leave £0 for salary-sacrifice or employer-only pensions.
          </p>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Benefits in kind (P11D) / year</label>
          <CurrencyInput
            value={form.benefitsInKindPence}
            onChange={(v) => set({ benefitsInKindPence: v })}
          />
          <p className="field__hint">Company car, private medical… from the P11D.</p>
        </div>
        <div className="field">
          <label>Other income / year</label>
          <CurrencyInput
            value={form.otherIncomePence}
            onChange={(v) => set({ otherIncomePence: v })}
          />
          <p className="field__hint">Interest, rental — anything else taxable.</p>
        </div>
      </div>

      {error && <p className="form__error">{error}</p>}

      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : 'Add person'}
        </button>
      </div>
    </form>
  );
}
