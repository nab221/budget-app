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
 * Add / edit form for a person. All money fields are ANNUAL figures in pounds
 * at the repository edge. The field hints carry the tax meaning so the owner
 * doesn't need to remember the rules.
 *
 * Since the income redesign (amendment (c)) salary and salary sacrifice live
 * on the person's salary TIMELINE, not here: the add form still asks for them
 * to seed the first timeline entry, the edit form doesn't (edit the timeline
 * on the card instead). What stays here is the person-level annual figures —
 * taxed-pay personal pension, benefits in kind, other income.
 */
export default function PersonForm({ initial, onSubmit, onCancel }) {
  const editing = !!initial;
  const [form, setForm] = useState(() => ({
    ...blank,
    ...(initial
      ? {
          name: initial.name || '',
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
      pensionAnnualPence: numOrZero(form.pensionAnnualPence),
      benefitsInKindPence: numOrZero(form.benefitsInKindPence),
      otherIncomePence: numOrZero(form.otherIncomePence),
    };
    if (!editing) {
      money.annualSalaryPence = numOrZero(form.annualSalaryPence);
      money.salarySacrificePence = numOrZero(form.salarySacrificePence);
    }
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
    <form className="form" onSubmit={submit}>
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
        {!editing && (
          <div className="field">
            <label>Annual gross salary</label>
            <CurrencyInput
              value={form.annualSalaryPence}
              onChange={(v) => set({ annualSalaryPence: v })}
            />
            <p className="field__hint">
              The current contract figure, before tax — it becomes the first entry on the
              salary timeline (add later changes on the card).
            </p>
          </div>
        )}
      </div>

      <div className="form-row">
        {!editing && (
          <div className="field">
            <label>Salary sacrifice / year</label>
            <CurrencyInput
              value={form.salarySacrificePence}
              onChange={(v) => set({ salarySacrificePence: v })}
            />
            <p className="field__hint">
              Car scheme, cycle-to-work, pension via sacrifice — taken out of pay before tax.
              A sacrificed car usually creates a benefit in kind: if it shows on the payslip
              as a BIK line, put it on the salary timeline; otherwise in the P11D field.
            </p>
          </div>
        )}
        <div className="field">
          <label>Personal pension / year</label>
          <CurrencyInput
            value={form.pensionAnnualPence}
            onChange={(v) => set({ pensionAnnualPence: v })}
          />
          <p className="field__hint">
            Only pension you pay from taxed pay — it lowers the income counted for the
            £100k childcare line. If the provider adds 25% tax relief, enter the total
            including that top-up. Leave £0 for salary-sacrifice, before-tax (NHS-style),
            or employer-only pensions.
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
          <p className="field__hint">
            Company car, private medical… from the P11D — only benefits NOT on the payslip.
            A BIK line that appears on the payslip each month is payrolled: enter it on the
            salary timeline and payslips instead, or it counts twice.
          </p>
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
