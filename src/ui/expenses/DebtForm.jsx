import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

const today = () => new Date().toISOString().slice(0, 10);

const blankCard = {
  debtType: 'credit-card',
  name: '',
  balancePence: '',
  balanceAsOf: today(),
  apr: '',
  creditLimitPence: '',
  promoEndDate: '',
  postPromoApr: '',
  minPaymentOverridePence: '',
  paymentDayOfMonth: 1,
};

const blankLoan = {
  debtType: 'loan',
  name: '',
  balancePence: '',
  balanceAsOf: today(),
  interestRate: '',
  fixedMonthlyPaymentPence: '',
  paymentDayOfMonth: 1,
};

const numOrNull = (v) => (v === '' || v == null ? null : Number(v));

/**
 * Type-specific add/edit form. `debtType` selects the field set (spec §4.3).
 */
export default function DebtForm({ debtType, initial, onSubmit, onCancel }) {
  const base = debtType === 'loan' ? blankLoan : blankCard;
  // Optional debt fields persist as null; coerce to '' so the inputs stay
  // controlled (React warns on a null `value`). numOrNull maps '' back to null.
  const [form, setForm] = useState(() => {
    const merged = { ...base, ...initial, debtType };
    for (const k of Object.keys(merged)) if (merged[k] == null) merged[k] = '';
    return merged;
  });
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    let payload;
    if (debtType === 'loan') {
      payload = {
        debtType: 'loan',
        name: form.name.trim(),
        balancePence: numOrNull(form.balancePence) ?? 0,
        balanceAsOf: form.balanceAsOf || today(),
        interestRate: numOrNull(form.interestRate) ?? 0,
        fixedMonthlyPaymentPence: numOrNull(form.fixedMonthlyPaymentPence) ?? 0,
        paymentDayOfMonth: Number(form.paymentDayOfMonth) || 1,
      };
    } else {
      payload = {
        debtType: 'credit-card',
        name: form.name.trim(),
        balancePence: numOrNull(form.balancePence) ?? 0,
        balanceAsOf: form.balanceAsOf || today(),
        apr: numOrNull(form.apr) ?? 0,
        creditLimitPence: numOrNull(form.creditLimitPence),
        promoEndDate: form.promoEndDate || null,
        postPromoApr: numOrNull(form.postPromoApr),
        minPaymentOverridePence: numOrNull(form.minPaymentOverridePence),
        paymentDayOfMonth: Number(form.paymentDayOfMonth) || 1,
      };
    }
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row">
        <div className="field">
          <label>Name</label>
          <input
            className="input"
            type="text"
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={debtType === 'loan' ? 'e.g. Car loan' : 'e.g. Barclaycard'}
          />
        </div>
        <div className="field">
          <label>Current balance</label>
          <CurrencyInput value={form.balancePence} onChange={(v) => set({ balancePence: v })} />
        </div>
        <div className="field">
          <label>Balance as of</label>
          <input
            className="input"
            type="date"
            value={form.balanceAsOf}
            onChange={(e) => set({ balanceAsOf: e.target.value })}
          />
        </div>
      </div>

      {debtType === 'loan' ? (
        <div className="form-row">
          <div className="field">
            <label>Interest rate (%)</label>
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.interestRate}
              onChange={(e) => set({ interestRate: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Fixed monthly payment</label>
            <CurrencyInput
              value={form.fixedMonthlyPaymentPence}
              onChange={(v) => set({ fixedMonthlyPaymentPence: v })}
            />
          </div>
          <div className="field">
            <label>Payment day (1–28)</label>
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
      ) : (
        <>
          <div className="form-row">
            <div className="field">
              <label>APR (%)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.apr}
                onChange={(e) => set({ apr: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Credit limit (optional)</label>
              <CurrencyInput
                value={form.creditLimitPence}
                onChange={(v) => set({ creditLimitPence: v })}
              />
            </div>
            <div className="field">
              <label>Payment day (1–28)</label>
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
              <label>0% promo ends (optional)</label>
              <input
                className="input"
                type="date"
                value={form.promoEndDate || ''}
                onChange={(e) => set({ promoEndDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Post-promo APR (%)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.postPromoApr}
                onChange={(e) => set({ postPromoApr: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Min payment override (optional)</label>
              <CurrencyInput
                value={form.minPaymentOverridePence}
                onChange={(v) => set({ minPaymentOverridePence: v })}
              />
            </div>
          </div>
        </>
      )}

      {error && <p className="form__error">{error}</p>}

      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : `Add ${debtType === 'loan' ? 'loan' : 'credit card'}`}
        </button>
      </div>
    </form>
  );
}
