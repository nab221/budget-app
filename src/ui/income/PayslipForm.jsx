import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';
import Money from '../components/Money.jsx';

/**
 * Add / edit the payslip for one pay month (income redesign, amendment (c)).
 * Full-detail entry per the owner's decision: gross pay, before-tax pension,
 * the payrolled benefit in kind (amendment (d)), and the income tax actually
 * deducted — the tax figure powers the PAYE sanity check on the card. Money
 * is pounds at the repository edge. Rendered inside a Modal, which carries
 * the title (person + pay month).
 *
 * Field hints name the labels real payslips use (amendment (f)) — both
 * household payslips word these differently — and a live "Taxable pay" line
 * shows gross − pension + BIK so it can be checked against the payslip's own
 * Taxable Pay figure before saving.
 *
 * @param {object} props
 * @param {string} props.month - 'yyyy-MM' pay month being entered.
 * @param {object} [props.initial] - existing payslip (pounds at edge) when editing.
 * @param {number} [props.projectedPounds] - the month's projected taxable pay,
 *   pre-filling gross on a fresh entry so a normal month is confirm-and-save.
 * @param {() => void} [props.onDelete] - offered only when editing.
 */
export default function PayslipForm({
  month,
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

  // Live cross-check against the payslip's own "Taxable Pay" line. Form
  // values are pounds (repo edge); Money wants pence.
  const pounds = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? 0 : Number(v));
  const taxablePreviewPence = Math.round(
    (Math.max(0, pounds(form.grossPence) - pounds(form.pensionPence)) + pounds(form.bikPence)) *
      100
  );

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
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label>Gross pay this month</label>
          <CurrencyInput value={form.grossPence} onChange={(v) => set({ grossPence: v })} />
          <p className="field__hint">
            “Gross Pay” / “Total Gross Pay” on the payslip — already after any salary
            sacrifice, before tax. Includes extra sessions, on-call, a bonus… Not
            “Taxable Pay” and not “Pensionable Pay” (the base a pension is worked out on).
          </p>
        </div>
        <div className="field">
          <label>Pension taken before tax</label>
          <CurrencyInput value={form.pensionPence} onChange={(v) => set({ pensionPence: v })} />
          <p className="field__hint">
            The pension contribution deducted before tax — “Pension” or “Pension Pay” on
            the payslip (e.g. NHS pension). £0 if none.
          </p>
        </div>
        <div className="field">
          <label>Payrolled benefit (BIK)</label>
          <CurrencyInput value={form.bikPence} onChange={(v) => set({ bikPence: v })} />
          <p className="field__hint">
            The benefit-in-kind line PAYE adds to taxable pay (e.g. a salary-sacrifice car).
            £0 if none.
          </p>
        </div>
        <div className="field">
          <label>Income tax deducted</label>
          <CurrencyInput value={form.taxPaidPence} onChange={(v) => set({ taxPaidPence: v })} />
          <p className="field__hint">
            “Tax Paid” / “PAYE” — the income-tax line only, not NI and not student or
            postgraduate loan (those never reduce tax).
          </p>
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
      <p className="muted">
        Taxable pay this month = <Money pence={taxablePreviewPence} /> (gross − pension +
        BIK) — should match the “Taxable Pay” figure on the payslip.
      </p>
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
