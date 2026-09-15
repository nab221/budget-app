import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { SCHEMES } from '../../engine/pension.js';

/**
 * Scheme + statement anchor for one person (amendment (k)). The anchor is
 * the accrued ANNUAL pension printed on the latest statement (NHS Total
 * Reward Statement / LGPS annual benefit statement) and the date it was true
 * — the engine rolls it forward from there. Pounds at the repository edge.
 *
 * @param {object} props.initial - the raw people row (pounds).
 * @param {(payload: { pensionScheme, pensionAnchorPence, pensionAnchorDate }) => void} props.onSubmit
 */
export default function PensionDetailsForm({ initial, onSubmit, onCancel }) {
  const [scheme, setScheme] = useState(initial?.pensionScheme || '');
  const [anchor, setAnchor] = useState(initial?.pensionAnchorPence || '');
  const [asAt, setAsAt] = useState(initial?.pensionAnchorDate || '');
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!scheme) {
      // No defined-benefit scheme: SIPP-only tracking, anchor cleared.
      try {
        await onSubmit({ pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: '' });
      } catch (err) {
        setError(err.message || String(err));
      }
      return;
    }
    const pounds = anchor === '' || anchor == null ? 0 : Number(anchor);
    if (!(pounds > 0) || !asAt) {
      setError('A scheme needs the accrued pension and its date from the latest statement.');
      return;
    }
    try {
      await onSubmit({ pensionScheme: scheme, pensionAnchorPence: pounds, pensionAnchorDate: asAt }); // pounds edge
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pension-scheme">Scheme</label>
          <select id="pension-scheme" className="input" value={scheme} onChange={(e) => setScheme(e.target.value)}>
            <option value="">No defined-benefit scheme (SIPP only)</option>
            {Object.entries(SCHEMES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="field__hint">
            Career-average public-sector schemes are measured by the growth in the pension,
            not by what you pay in.
          </p>
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="pension-anchor">Accrued annual pension</label>
          <CurrencyInput id="pension-anchor" value={anchor} onChange={setAnchor} />
          <p className="field__hint">
            The pension built up so far, per year, from the latest statement (e.g. £7,900.18).
            Replace it each year when the new statement arrives.
          </p>
        </div>
        <div className="field">
          <label htmlFor="pension-as-at">As at</label>
          <input id="pension-as-at" className="input" type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
          <p className="field__hint">The statement date — usually 31 March.</p>
        </div>
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
