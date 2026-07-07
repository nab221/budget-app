import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import CurrencyInput from '../components/CurrencyInput.jsx';

const KINDS = [
  { value: 'spend', label: 'Spending' },
  { value: 'income', label: 'Income' },
];

const today = () => format(new Date(), 'yyyy-MM-dd');

function blankForm() {
  return {
    date: today(),
    kind: 'spend',
    description: '',
    amountPence: '',
    categoryId: '',
  };
}

/**
 * Add / edit form for a single ledger transaction (spec §4.2). Category options
 * are filtered to those matching the currently-selected `kind`; switching kind
 * clears an incompatible category.
 *
 * @param {object} [props.initial] - existing row (repo shape, pounds edge) when editing.
 * @param {Array} props.categories - all categories ({ id, name, kind }).
 * @param {(payload:object)=>Promise<void>|void} props.onSubmit
 * @param {()=>void} props.onCancel
 */
export default function TransactionForm({ initial, categories = [], onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...blankForm(),
    ...(initial
      ? {
          date: initial.date,
          kind: initial.kind,
          description: initial.description || '',
          amountPence: initial.amountPence,
          categoryId: initial.categoryId ?? '',
        }
      : {}),
  }));
  const [error, setError] = useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const kindCatKind = form.kind === 'income' ? 'income' : 'spending';
  const options = useMemo(
    () => categories.filter((c) => c.kind === kindCatKind),
    [categories, kindCatKind]
  );

  const changeKind = (kind) => {
    const nextKind = kind === 'income' ? 'income' : 'spending';
    const stillValid = categories.some(
      (c) => String(c.id) === String(form.categoryId) && c.kind === nextKind
    );
    set({ kind, categoryId: stillValid ? form.categoryId : '' });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.date) {
      setError('Date is required.');
      return;
    }
    if (!form.description.trim()) {
      setError('Description is required.');
      return;
    }
    if (form.amountPence === '' || form.amountPence == null) {
      setError('Amount is required.');
      return;
    }
    if (Number(form.amountPence) <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!form.categoryId) {
      setError('Choose a category.');
      return;
    }
    const payload = {
      date: form.date,
      kind: form.kind,
      description: form.description.trim(),
      amountPence: Number(form.amountPence), // pounds at the repository edge
      categoryId: Number(form.categoryId),
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
        <div className="field">
          <label>Date</label>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Type</label>
          <select
            className="input"
            value={form.kind}
            onChange={(e) => changeKind(e.target.value)}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="field field--grow">
          <label>Description</label>
          <input
            className="input"
            type="text"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="e.g. Tesco"
          />
        </div>
        <div className="field">
          <label>Amount</label>
          <CurrencyInput value={form.amountPence} onChange={(v) => set({ amountPence: v })} />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label>Category</label>
          <select
            className="input"
            value={form.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
          >
            <option value="">Select…</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="form__error">{error}</p>}

      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary">
          {initial ? 'Save' : 'Add transaction'}
        </button>
      </div>
    </form>
  );
}
