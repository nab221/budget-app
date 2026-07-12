import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

/**
 * Add / edit the payslip for one pay month (income redesign, amendment (c);
 * taxable-pay-first entry per amendment (g)). The form asks for the figures
 * payslips actually print: the month's TAXABLE PAY (no more assembling it
 * from gross − pension + BIK), the pension contributions (feeds the annual-
 * allowance tracker), and the income tax deducted (powers the PAYE check).
 * Money is pounds at the repository edge. Rendered inside a Modal, which
 * carries the title (person + pay month).
 *
 * @param {object} props
 * @param {string} props.month - 'yyyy-MM' pay month being entered.
 * @param {object} [props.initial] - existing payslip (pounds at edge) when
 *   editing. A pre-(g) row has no taxablePence — its taxable pay is
 *   reconstructed from gross − pension + BIK to prefill the field, and
 *   saving writes the direct figure from then on.
 * @param {number} [props.projectedPounds] - the month's projected taxable pay,
 *   pre-filling a fresh entry so a normal month is confirm-and-save.
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
  const [form, setForm] = useState(() => {
    const n = (v) => Number(v) || 0;
    const legacyTaxable = initial
      ? Math.max(0, n(initial.grossPence) - n(initial.pensionPence)) + n(initial.bikPence)
      : null;
    return {
      taxablePence: initial ? (initial.taxablePence ?? legacyTaxable) : (projectedPounds ?? ''),
      pensionPence: initial?.pensionPence || '',
      taxPaidPence: initial?.taxPaidPence || '',
      note: initial?.note || '',
    };
  });
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const taxable =
      form.taxablePence === '' || form.taxablePence == null ? null : Number(form.taxablePence);
    if (taxable == null || Number.isNaN(taxable) || taxable < 0) {
      setError('Taxable pay for the month is required (0 is fine for a nil month).');
      return;
    }
    const optional = (v) => (v === '' || v == null ? 0 : Number(v));
    const pension = optional(form.pensionPence);
    const taxPaid = optional(form.taxPaidPence);
    if (pension < 0 || taxPaid < 0) {
      setError('Pension and tax figures can’t be negative.');
      return;
    }
    try {
      await onSubmit({
        month,
        taxablePence: taxable, // pounds edge
        pensionPence: pension,
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
          <label>Taxable pay this month</label>
          <CurrencyInput value={form.taxablePence} onChange={(v) => set({ taxablePence: v })} />
          <p className="field__hint">
            The payslip’s “Taxable Pay” for this period, exactly as printed — it already
            excludes salary sacrifice, before-tax pension, and any non-taxable pay, and
            includes a payrolled benefit (car BIK). Not “Gross Pay” or “Pensionable Pay”.
          </p>
        </div>
        <div className="field">
          <label>Pension contributions</label>
          <CurrencyInput value={form.pensionPence} onChange={(v) => set({ pensionPence: v })} />
          <p className="field__hint">
            “Pension Conts” / “Pension Pay” — your contribution deducted this month. Only
            feeds the annual-allowance tracker (taxable pay above already excludes it).
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
