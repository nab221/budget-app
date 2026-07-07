import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { debtsRepo } from '../db/repositories.js';
import Money from './components/Money.jsx';
import EmptyState from './components/EmptyState.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import DebtCard from './debts/DebtCard.jsx';
import DebtForm from './debts/DebtForm.jsx';
import StatementImport from './debts/StatementImport.jsx';

export default function Debts() {
  const { data: debts, loading } = useLiveData(() => debtsRepo.getAll(), []);
  // addType: null (not adding), or 'credit-card' | 'loan' once a type is picked.
  const [addType, setAddType] = useState(null);
  const [pickingType, setPickingType] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importing, setImporting] = useState(false);

  const cards = (debts ?? []).filter((d) => d.debtType === 'credit-card');
  const loans = (debts ?? []).filter((d) => d.debtType === 'loan');
  const sum = (list) => list.reduce((t, d) => t + (d.balancePence || 0), 0);
  const total = sum(debts ?? []);

  const addDebt = async (payload) => {
    await debtsRepo.add(payload);
    setAddType(null);
  };
  const saveDebt = async (payload) => {
    await debtsRepo.update(editing.id, payload);
    setEditing(null);
  };
  const remove = async () => {
    await debtsRepo.delete(confirmDelete.id);
    setConfirmDelete(null);
  };
  const updateBalance = (id, pounds, asOf) => debtsRepo.updateBalance(id, pounds, asOf);

  const startAdd = (type) => {
    setPickingType(false);
    setAddType(type);
  };

  const renderGroup = (title, list, emptyHint) => (
    <section className="debt-group">
      <div className="debt-group__head">
        <h3>{title}</h3>
        <span className="debt-group__subtotal muted">
          Subtotal <Money pounds={sum(list)} />
        </span>
      </div>
      {list.length === 0 ? (
        <EmptyState hint={emptyHint} />
      ) : (
        <ul className="card-list debt-list">
          {list.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              onUpdateBalance={updateBalance}
              onEdit={() => setEditing(d)}
              onDelete={() => setConfirmDelete(d)}
            />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Debts</h2>
        <div className="screen__head-actions">
          <span className="totals">
            Total debt <Money pounds={total} className="totals__value" />
          </span>
          {!addType && !editing && (
            <>
              <button type="button" className="btn" onClick={() => setImporting(true)}>
                Import statement (PDF)
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setPickingType(true)}>
                Add debt
              </button>
            </>
          )}
        </div>
      </header>

      {importing && <StatementImport onClose={() => setImporting(false)} />}

      {editing && (
        <DebtForm
          debtType={editing.debtType}
          initial={editing}
          onSubmit={saveDebt}
          onCancel={() => setEditing(null)}
        />
      )}

      {addType && (
        <DebtForm debtType={addType} onSubmit={addDebt} onCancel={() => setAddType(null)} />
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {renderGroup(
            'Credit cards',
            cards,
            'No credit cards yet. Add one to see its computed minimum payment and utilisation.'
          )}
          {renderGroup('Loans', loans, 'No loans yet. Add a loan with its fixed monthly payment.')}
        </>
      )}

      {pickingType && (
        <div className="dialog__overlay" role="dialog" aria-modal="true" aria-label="Add a debt">
          <div className="dialog">
            <h3 className="dialog__title">Add a debt</h3>
            <p className="muted">What kind of debt is this?</p>
            <div className="type-picker__buttons">
              <button type="button" className="btn btn--primary" onClick={() => startAdd('credit-card')}>
                Credit card
              </button>
              <button type="button" className="btn btn--primary" onClick={() => startAdd('loan')}>
                Loan
              </button>
            </div>
            <div className="dialog__actions">
              <button type="button" className="btn" onClick={() => setPickingType(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete debt"
        message={confirmDelete ? `Delete "${confirmDelete.name}"? This can't be undone.` : ''}
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
