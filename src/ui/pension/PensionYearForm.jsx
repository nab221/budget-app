import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

/**
 * One tax year's entered figures (amendment (k)): the pension input amount
 * from a Pension Savings Statement (or the owner's own reconstruction) and an
 * optional pensionable-earnings override. Blank = null = "use the estimate" /
 * "use the salary timeline". Pounds at the repository edge.
 *
 * @param {string} props.taxYear - "2025-26".
 * @param {object|null} props.initial - the raw pensionYears row (pounds), or null.
 * @param {(payload: { piaPence, pensionableEarningsPence, note }) => void} props.onSubmit
 */
export default function PensionYearForm({ taxYear, initial, onSubmit, onCancel }) {
  const [pia, setPia] = useState(initial?.piaPence ?? '');
  const [earnings, setEarnings] = useState(initial?.pensionableEarningsPence ?? '');
  const [note, setNote] = useState(initial?.note || '');
  const [error, setError] = useState(null);

  const optional = (v) => (v === '' || v == null ? null : Number(v));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const piaPence = optional(pia);
    const pensionableEarningsPence = optional(earnings);
    if ((piaPence != null && piaPence < 0) || (pensionableEarningsPence != null && pensionableEarningsPence < 0)) {
      setError('Figures can’t be negative.');
      return;
    }
    try {
      await onSubmit({ piaPence, pensionableEarningsPence, note: note.trim() }); // pounds edge
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pension-year-pia">Pension input amount</label>
          <CurrencyInput id="pension-year-pia" value={pia} onChange={setPia} />
          <p className="field__hint">
            The {taxYear} figure from the Pension Savings Statement, if you have one. Leave
            blank to use the estimate.
          </p>
        </div>
        <div className="field">
          <label htmlFor="pension-year-earnings">Pensionable earnings</label>
          <CurrencyInput id="pension-year-earnings" value={earnings} onChange={setEarnings} />
          <p className="field__hint">
            Only if the year's pensionable pay differs from the salary timeline. Leave blank to
            use the timeline.
          </p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="pension-year-note">Note</label>
        <input id="pension-year-note" className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. PSS received Oct 2026" />
      </div>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          Save
        </button>
      </div>
    </form>
  );
}
