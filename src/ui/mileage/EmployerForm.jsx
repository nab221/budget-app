import { useState } from 'react';

/**
 * Add / edit form for an employment (spec amendment 2026-08-02 (h)).
 *
 * The rate is pence **per mile**, not a money amount, so it is a plain integer
 * field rather than a CurrencyInput — and it is stored verbatim rather than
 * going through the pounds-at-the-edge translation.
 *
 * @param {object} props
 * @param {object} [props.initial] - existing employer row when editing.
 */
export default function EmployerForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    ratePencePerMile: initial?.ratePencePerMile ?? 0,
  }));
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    if (!name) {
      setError('A name is required.');
      return;
    }
    const rate = Number(form.ratePencePerMile);
    if (!Number.isFinite(rate) || rate < 0) {
      setError('The mileage rate can’t be negative.');
      return;
    }
    try {
      await onSubmit({ name, ratePencePerMile: Math.round(rate) });
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field field--grow">
          <label htmlFor="employer-name">Employer</label>
          <input
            id="employer-name"
            className="input"
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="e.g. Northern Trust"
          />
        </div>
        <div className="field">
          <label htmlFor="employer-rate">Pays (p per mile)</label>
          <input
            id="employer-rate"
            className="input"
            type="number"
            min="0"
            step="1"
            value={form.ratePencePerMile}
            onChange={(e) => set({ ratePencePerMile: e.target.value })}
          />
          <span className="field__hint">Pre-fills this job’s trips. 0 if unpaid.</span>
        </div>
      </div>
      <p className="muted">
        Each employment gets its own 10,000 miles at the higher rate. Two jobs with the
        same employer, or within one group of companies, share a single allowance — keep
        those as one entry here.
      </p>
      {error && <p className="form__error">{error}</p>}
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : 'Add employer'}
        </button>
      </div>
    </form>
  );
}
