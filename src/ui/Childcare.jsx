import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { childrenRepo } from '../db/repositories.js';
import EmptyState from './components/EmptyState.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import ChildCard from './childcare/ChildCard.jsx';
import ChildForm from './childcare/ChildForm.jsx';

/**
 * Childcare tab (spec §4.5) — the simplified Tax-Free Childcare top-up
 * calculator. Per child: provider monthly cost + hand-updated TFC balance; the
 * app computes the required monthly parent deposit (incl. the 25% government
 * top-up, honouring the quarterly cap) and feeds it into the pay-period plan as
 * a committed outgoing. No ledger, no providers-with-frequencies.
 */
export default function Childcare() {
  const { data: children, loading } = useLiveData(() => childrenRepo.getAll(), []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const list = children ?? [];

  const add = async (payload) => {
    await childrenRepo.add(payload);
    setAdding(false);
  };
  const save = async (payload) => {
    await childrenRepo.update(editing.id, payload);
    setEditing(null);
  };
  const remove = async () => {
    await childrenRepo.delete(confirmDelete.id);
    setConfirmDelete(null);
  };
  // Quick "Update balance" flow — pounds at the repo edge; repo converts to pence.
  const updateBalance = (id, pounds, asOf) =>
    childrenRepo.update(id, { tfcBalancePence: pounds, tfcBalanceAsOf: asOf });

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Childcare</h2>
        <div className="screen__head-actions">
          <p className="muted">
            Tax-Free Childcare top-up calculator. The required deposit appears in your pay period
            automatically.
          </p>
          {!adding && !editing && (
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              Add child
            </button>
          )}
        </div>
      </header>

      {adding && <ChildForm onSubmit={add} onCancel={() => setAdding(false)} />}
      {editing && (
        <ChildForm initial={editing} onSubmit={save} onCancel={() => setEditing(null)} />
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <EmptyState
          title="No children yet"
          hint="Add a child with their provider’s monthly cost and your current Tax-Free Childcare balance to see the deposit you need to make each month."
        />
      ) : (
        <ul className="card-list childcare-list">
          {list.map((c) => (
            <ChildCard
              key={c.id}
              child={c}
              onUpdateBalance={updateBalance}
              onEdit={() => setEditing(c)}
              onDelete={() => setConfirmDelete(c)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove child"
        message={
          confirmDelete
            ? `Remove "${confirmDelete.name}"? Their childcare deposit will stop appearing in your pay period. This can't be undone.`
            : ''
        }
        confirmLabel="Remove"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
