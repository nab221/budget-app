import { useEffect, useMemo, useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import {
  debtsRepo,
  recurringBillsRepo,
  categoriesRepo,
  childrenRepo,
} from '../db/repositories.js';
import {
  mapBillsToPence,
  mapDebtsToPence,
  childcareDepositsFromChildren,
} from '../db/planData.js';
import {
  periodWindow,
  actualTotalPence,
  normalisedTotalPence,
  annualisedBillPence,
  annualToPeriodPence,
  nextBillOccurrence,
  nextDebtPayment,
  nextChildcareDeposit,
  localDayStr,
} from '../engine/spending.js';
import Money from './components/Money.jsx';
import PeriodSelector from './components/PeriodSelector.jsx';
import EmptyState from './components/EmptyState.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import Modal from './components/Modal.jsx';
import { formatDay, formatMonth } from './components/dates.js';
import DebtCard from './expenses/DebtCard.jsx';
import { debtMonthlyPence } from './expenses/minPayment.js';
import DebtForm from './expenses/DebtForm.jsx';
import ExpenseCard from './expenses/ExpenseCard.jsx';
import ExpenseForm from './expenses/ExpenseForm.jsx';
import StatementImport from './expenses/StatementImport.jsx';

const PERIOD_NOUN = { week: 'week', month: 'month', year: 'year' };

/**
 * Expenses — the heart of the app: every committed outgoing as a card
 * (credit cards, loans, and recurring expenses grouped by category), plus
 * "how much goes out this week / month / year". Nothing here is confirmed or
 * ticked off — occurrences and totals are computed live from the schedule.
 */
export default function Expenses() {
  const { data, loading } = useLiveData(async () => {
    const [debts, bills, categories, children] = await Promise.all([
      debtsRepo.getAll(),
      recurringBillsRepo.getAll(),
      categoriesRepo.getAll(),
      childrenRepo.getAll(),
    ]);
    return { debts, bills, categories, children };
  }, []);

  const [period, setPeriod] = useState('month');
  // adding: null | 'expense' | 'credit-card' | 'loan'; `picking` shows the chooser.
  const [adding, setAdding] = useState(null);
  const [picking, setPicking] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // {kind:'debt'|'bill', row}
  const [importing, setImporting] = useState(false);

  const debts = data?.debts ?? [];
  const bills = data?.bills ?? [];
  const categories = data?.categories ?? [];
  const children = data?.children ?? [];
  const spendingCategories = categories.filter((c) => c.kind === 'spending');

  const now = new Date();
  const from = localDayStr(now);

  // Engine (pence) views of the same rows, for totals and next-payment dates.
  // Childcare deposits are the same computed commitments the Childcare tab
  // shows — included here read-only so the period totals are the whole truth.
  const penceData = useMemo(
    () => ({
      recurringBills: mapBillsToPence(bills),
      debts: mapDebtsToPence(debts),
      childcareDeposits: childcareDepositsFromChildren(children),
    }),
    [bills, debts, children]
  );

  const { startStr, endStr } = periodWindow(period, now);
  const actualPence = actualTotalPence(penceData, startStr, endStr);
  const normalisedPence = normalisedTotalPence(penceData, period, from);

  const nextByBill = useMemo(() => {
    const m = new Map();
    for (const b of penceData.recurringBills) m.set(b.id, nextBillOccurrence(b, from));
    return m;
  }, [penceData, from]);

  const nextByDebt = useMemo(() => {
    const m = new Map();
    for (const d of penceData.debts) m.set(d.id, nextDebtPayment(d, from));
    return m;
  }, [penceData, from]);

  const cards = debts.filter((d) => d.debtType === 'credit-card');
  const loans = debts.filter((d) => d.debtType === 'loan');

  // Recurring expenses grouped by category name (alphabetical, Uncategorised last).
  const billGroups = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c.name]));
    const groups = new Map();
    for (const b of bills) {
      const name = byId.get(b.categoryId) ?? 'Uncategorised';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(b);
    }
    return [...groups.entries()].sort(([a], [b]) =>
      a === 'Uncategorised' ? 1 : b === 'Uncategorised' ? -1 : a.localeCompare(b)
    );
  }, [bills, categories]);

  // Per-category monthly average (pence) for group headers.
  const groupMonthlyPence = (groupBills) =>
    annualToPeriodPence(
      groupBills.reduce((t, b) => {
        const pb = penceData.recurringBills.find((x) => x.id === b.id);
        return t + (pb ? annualisedBillPence(pb) : 0);
      }, 0),
      'month'
    );

  const closeForms = () => {
    setAdding(null);
    setEditingDebt(null);
    setEditingBill(null);
  };

  const addDebt = async (payload) => {
    await debtsRepo.add(payload);
    setAdding(null);
  };
  const saveDebt = async (payload) => {
    await debtsRepo.update(editingDebt.id, payload);
    setEditingDebt(null);
  };
  const addBill = async (payload) => {
    await recurringBillsRepo.add(payload);
    setAdding(null);
  };
  const saveBill = async (payload) => {
    await recurringBillsRepo.update(editingBill.id, payload);
    setEditingBill(null);
  };
  const remove = async () => {
    if (confirmDelete.kind === 'debt') await debtsRepo.delete(confirmDelete.row.id);
    else await recurringBillsRepo.delete(confirmDelete.row.id);
    setConfirmDelete(null);
  };
  const updateBalance = (id, pounds, asOf) => debtsRepo.updateBalance(id, pounds, asOf);
  const toggleBillActive = (b) => recurringBillsRepo.update(b.id, { active: !b.active });

  const startAdd = (type) => {
    setPicking(false);
    setAdding(type);
  };

  // The Add chooser is modal: Escape closes it (initial focus lands on its
  // first option via autoFocus below).
  useEffect(() => {
    if (!picking) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPicking(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const periodLabel =
    period === 'week'
      ? `Week of ${formatDay(startStr)}`
      : period === 'month'
        ? formatMonth(startStr)
        : startStr.slice(0, 4);

  const debtGroup = (title, list, emptyHint) => (
    <section className="debt-group">
      <div className="debt-group__head">
        <h3>{title}</h3>
        <span className="debt-group__subtotal muted">
          Balance <Money pounds={list.reduce((t, d) => t + (d.balancePence || 0), 0)} />
          {list.length > 0 && (
            <>
              {' · ≈ '}
              <Money pence={list.reduce((t, d) => t + debtMonthlyPence(d, from), 0)} />
              {' / month'}
            </>
          )}
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
              nextPayment={nextByDebt.get(d.id)}
              onUpdateBalance={updateBalance}
              onEdit={() => setEditingDebt(d)}
              onDelete={() => setConfirmDelete({ kind: 'debt', row: d })}
            />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Expenses</h2>
        <div className="screen__head-actions">
          <button type="button" className="btn" onClick={() => setImporting(true)}>
            Import statement (PDF)
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setPicking(true)}>
            Add
          </button>
        </div>
      </header>

      <section className="panel spending-summary">
        <div className="spending-summary__row">
          <PeriodSelector value={period} onChange={setPeriod} />
          <div className="stat">
            <span className="stat__label">Going out — {periodLabel}</span>
            <Money pence={actualPence} className="stat__value" />
          </div>
          <div className="stat">
            <span className="stat__label">Average per {PERIOD_NOUN[period]}</span>
            <Money pence={normalisedPence} className="stat__value stat__value--muted" />
          </div>
        </div>
        <p className="muted spending-summary__hint">
          Credit cards count their minimum payment, loans their fixed payment, childcare its
          computed deposit; everything else by its schedule. The average smooths every expense
          out (weekly ≈ ×4.35 a month).
        </p>
      </section>

      {importing && <StatementImport onClose={() => setImporting(false)} />}

      {editingDebt && (
        <Modal
          title={`Edit ${editingDebt.debtType === 'loan' ? 'loan' : 'credit card'}`}
          onClose={closeForms}
        >
          <DebtForm
            debtType={editingDebt.debtType}
            initial={editingDebt}
            onSubmit={saveDebt}
            onCancel={closeForms}
          />
        </Modal>
      )}
      {(adding === 'credit-card' || adding === 'loan') && (
        <Modal
          title={`Add ${adding === 'loan' ? 'loan' : 'credit card'}`}
          onClose={closeForms}
        >
          <DebtForm debtType={adding} onSubmit={addDebt} onCancel={closeForms} />
        </Modal>
      )}
      {editingBill && (
        <Modal title="Edit expense" onClose={closeForms}>
          <ExpenseForm
            initial={editingBill}
            spendingCategories={spendingCategories}
            onSubmit={saveBill}
            onCancel={closeForms}
          />
        </Modal>
      )}
      {adding === 'expense' && (
        <Modal title="Add recurring expense" onClose={closeForms}>
          <ExpenseForm
            spendingCategories={spendingCategories}
            onSubmit={addBill}
            onCancel={closeForms}
          />
        </Modal>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {debtGroup(
            'Credit cards',
            cards,
            'No credit cards yet. Add one to see its minimum payment and next payment date.'
          )}
          {debtGroup('Loans', loans, 'No loans yet. Add a loan with its fixed monthly payment.')}

          {billGroups.length === 0 ? (
            <section className="debt-group">
              <div className="debt-group__head">
                <h3>Other expenses</h3>
              </div>
              <EmptyState hint="No recurring expenses yet. Add subscriptions, utilities, groceries — anything that repeats." />
            </section>
          ) : (
            billGroups.map(([name, groupBills]) => (
              <section className="debt-group" key={name}>
                <div className="debt-group__head">
                  <h3>{name}</h3>
                  <span className="debt-group__subtotal muted">
                    ≈ <Money pence={groupMonthlyPence(groupBills)} /> / month
                  </span>
                </div>
                <ul className="card-list debt-list">
                  {groupBills.map((b) => (
                    <ExpenseCard
                      key={b.id}
                      bill={b}
                      next={nextByBill.get(b.id)}
                      onToggleActive={() => toggleBillActive(b)}
                      onEdit={() => setEditingBill(b)}
                      onDelete={() => setConfirmDelete({ kind: 'bill', row: b })}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          {/* Read-only: computed on the Childcare tab, counted here so the
              period totals are complete. */}
          {penceData.childcareDeposits.length > 0 && (
            <section className="debt-group">
              <div className="debt-group__head">
                <h3>Childcare</h3>
                <span className="debt-group__subtotal muted">
                  ≈{' '}
                  <Money
                    pence={penceData.childcareDeposits.reduce(
                      (t, d) => t + (d.amountPence || 0),
                      0
                    )}
                  />{' '}
                  / month
                </span>
              </div>
              <ul className="card-list debt-list">
                {penceData.childcareDeposits.map((dep) => {
                  const next = nextChildcareDeposit(dep, from);
                  return (
                    <li className="card debt-card expense-card" key={dep.label}>
                      <div className="debt-card__head">
                        <span className="debt-card__name">{dep.label}</span>
                      </div>
                      <div className="debt-card__balance">
                        <Money pence={dep.amountPence} className="debt-card__amount" />
                        <span className="muted"> / month</span>
                      </div>
                      <p className="expense-card__next muted">
                        {next ? (
                          <>
                            Next: {formatDay(next.date)}
                            {next.isAdjusted && <span className="tag">shifted</span>}
                          </>
                        ) : (
                          '—'
                        )}
                      </p>
                      <p className="expense-card__next muted">Edit on the Childcare tab</p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      {picking && (
        <div className="dialog__overlay" role="dialog" aria-modal="true" aria-label="Add">
          <div className="dialog">
            <h3 className="dialog__title">What are you adding?</h3>
            <div className="type-picker__buttons">
              {/* eslint-disable-next-line jsx-a11y/no-autofocus -- modal: focus must leave the background trigger */}
              <button type="button" className="btn btn--primary" autoFocus onClick={() => startAdd('expense')}>
                Recurring expense
              </button>
              <button type="button" className="btn btn--primary" onClick={() => startAdd('credit-card')}>
                Credit card
              </button>
              <button type="button" className="btn btn--primary" onClick={() => startAdd('loan')}>
                Loan
              </button>
            </div>
            <p className="muted">
              Credit cards and loans carry interest and appear in the Payoff planner; a recurring
              expense is anything else that repeats.
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn" onClick={() => setPicking(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.kind === 'debt' ? 'Delete debt' : 'Delete expense'}
        message={
          confirmDelete
            ? `Delete "${confirmDelete.row.name || confirmDelete.row.label}"? This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
