import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { formatPayMonth } from '../components/dates.js';

/**
 * Add / edit the payslip for one pay month (income redesign, amendment (c)).
 * Full-detail entry per the owner's decision: gross pay, before-tax pension,
 * the payrolled benefit in kind (amendment (d)), and the income tax actually
 * deducted — the tax figure powers the PAYE sanity check on the card. Money
 * is pounds at the repository edge.
 *
 * @param {object} props
 * @param {string} props.month - 'yyyy-MM' pay month being entered.
 * @param {string} props.personName - shown in the form title.
 * @param {object} [props.initial] - existing payslip (pounds at edge) when editing.
 * @param {number} [props.projectedPounds] - the month's projected taxable pay,
 *   pre-filling gross on a fresh entry so a normal month is confirm-and-save.
 * @param {() => void} [props.onDelete] - offered only when editing.
 */
export default function PayslipForm({
  month,
  personName,
  initial,
  projectedPounds,
  onSubmit,
  onDelete,
  onCancel,
}) {
  const [form, setForm] = useState(() => ({
    grossPence: initial ? initial.grossPence : (projectedPounds ?? ''),
    pensionPence: initial?.pensionPence || '',
    bikPence: initial?.bikPence || '',
    taxPaidPence: initial?.taxPaidPence || '',
    note: initial?.note || '',
  }));
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const gross = form.grossPence === '' || form.grossPence == null ? null : Number(form.grossPence);
    if (gross == null || Number.isNaN(gross) || gross < 0) {
      setError('Gross pay for the month is required (0 is fine for a nil month).');
      return;
    }
    const optional = (v) => (v === '' || v == null ? 0 : Number(v));
    const pension = optional(form.pensionPence);
    const bik = optional(form.bikPence);
    const taxPaid = optional(form.taxPaidPence);
    if (pension < 0 || bik < 0 || taxPaid < 0) {
      setError('Pension, BIK, and tax figures can’t be negative.');
      return;
    }
    try {
      await onSubmit({
        month,
        grossPence: gross, // pounds edge
        pensionPence: pension,
        bikPence: bik,
        taxPaidPence: taxPaid,
        note: form.note.trim(),
      });
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form card" onSubmit={submit}>
      <h3 className="form__title">
        {initial ? 'Edit' : 'Add'} payslip — {personName}, {formatPayMonth(month)}
      </h3>
      <div className="form-row">
        <div className="field">
          <label>Gross pay this month</label>
          <CurrencyInput value={form.grossPence} onChange={(v) => set({ grossPence: v })} />
          <p className="field__hint">
            The month’s gross from the payslip — after any salary sacrifice, before tax.
            Includes extra sessions, on-call, a bonus…
          </p>
        </div>
        <div className="field">
          <label>Pension taken before tax</label>
          <CurrencyInput value={form.pensionPence} onChange={(v) => set({ pensionPence: v })} />
          <p className="field__hint">
            The workplace pension line deducted before tax (e.g. NHS pension). £0 if none.
          </p>
        </div>
        <div className="field">
          <label>Payrolled benefit (BIK)</label>
          <CurrencyInput value={form.bikPence} onChange={(v) => set({ bikPence: v })} />
          <p className="field__hint">
            The benefit-in-kind line PAYE adds to taxable pay (e.g. a salary-sacrifice car).
            Taxable pay on the payslip = gross − pension + this. £0 if none.
          </p>
        </div>
        <div className="field">
          <label>Income tax deducted</label>
          <CurrencyInput value={form.taxPaidPence} onChange={(v) => set({ taxPaidPence: v })} />
          <p className="field__hint">The PAYE tax line only — not NI or student loan.</p>
        </div>
        <div className="field field--grow">
          <label>Note (optional)</label>
          <input
            className="input"
            type="text"
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="e.g. first LTFT month"
          />
        </div>
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        {initial && onDelete && (
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            Remove payslip
          </button>
        )}
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : 'Add payslip'}
        </button>
      </div>
    </form>
  );
}
