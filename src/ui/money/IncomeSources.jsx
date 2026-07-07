import { useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import { incomeSourcesRepo } from '../../db/repositories.js';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import IncomeSourceForm from './IncomeSourceForm.jsx';
import { formatPayRule } from './payRule.js';

export default function IncomeSources() {
  const { data: sources, loading } = useLiveData(() => incomeSourcesRepo.getAll(), []);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const add = async (payload) => {
    await incomeSourcesRepo.add(payload);
    setAdding(false);
  };
  const save = async (id, payload) => {
    await incomeSourcesRepo.update(id, payload);
    setEditingId(null);
  };
  const remove = async () => {
    await incomeSourcesRepo.delete(confirmDelete.id);
    setConfirmDelete(null);
  };
  const toggleActive = (s) => incomeSourcesRepo.update(s.id, { active: !s.active });

  return (
    <section className="subsection">
      <div className="subsection__head">
        <h3>Income sources</h3>
        {!adding && (
          <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
            Add income source
          </button>
        )}
      </div>

      {adding && (
        <IncomeSourceForm onSubmit={add} onCancel={() => setAdding(false)} />
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : sources.length === 0 && !adding ? (
        <EmptyState
          title="No income sources yet"
          hint="Add your salary and any other regular income so the pay-period view knows when money arrives."
        />
      ) : (
        <ul className="card-list">
          {sources.map((s) =>
            editingId === s.id ? (
              <li key={s.id}>
                <IncomeSourceForm
                  initial={s}
                  onSubmit={(payload) => save(s.id, payload)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={s.id} className={`card row-card${s.active ? '' : ' is-inactive'}`}>
                <div className="row-card__main">
                  <span className="row-card__title">{s.name}</span>
                  <span className="muted">{formatPayRule(s.payDateRule, s.payDateDay)}</span>
                </div>
                <Money pounds={s.amountPence} className="row-card__amount" />
                <div className="row-card__actions">
                  <button type="button" className="btn btn--sm" onClick={() => toggleActive(s)}>
                    {s.active ? 'Active' : 'Inactive'}
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => setEditingId(s.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => setConfirmDelete(s)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete income source"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
