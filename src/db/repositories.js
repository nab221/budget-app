/**
 * Per-table repositories for BudgetAppV4.
 *
 * ── Money convention ──────────────────────────────────────────────────────
 * At REST (in IndexedDB) every `*Pence` field is an **integer number of pence**.
 * At the repository **API boundary** those same fields are expressed in
 * **POUNDS** (e.g. `12.34`). `add`/`update` convert pounds → pence on the way
 * in via `toPence`; `get`/`getAll` convert pence → pounds on the way out via
 * `fromPence`. So a field named `amountPence` carries a pounds value when you
 * pass it to / receive it from a repository, but is stored as pence. UI code
 * therefore never touches pence directly.
 *
 * Non-money fields pass through untouched.
 *
 * ── Mutations ─────────────────────────────────────────────────────────────
 * Every mutation dispatches a `db:mutated` event (see `events.js`) so the
 * React layer re-reads. This is the port of the old `triggerSync`, minus sync.
 *
 * ── Validation ────────────────────────────────────────────────────────────
 * Enum/range rules from the task are enforced on `add`/`update`; violations
 * throw descriptive `Error`s. Computed/projection rows are never persisted.
 */

import { db } from './schema.js';
import { toPence, fromPence } from '../engine/currency.js';
import { dispatchMutation } from './events.js';

// ---------------------------------------------------------------------------
// Base repository
// ---------------------------------------------------------------------------

/**
 * Build a repository over a Dexie table.
 *
 * @param {import('dexie').Table} table
 * @param {string[]} penceFields - fields that are pence at rest / pounds at the API edge.
 * @param {object} defaults - default field values merged under `add` input.
 * @param {(data: object, mode: 'add'|'update') => void} [validate] - optional validator; throws on bad data.
 */
export function createBaseRepository(table, penceFields = [], defaults = {}, validate = null) {
  const toStorage = (data) => {
    const out = { ...data };
    for (const f of penceFields) {
      if (out[f] !== undefined && out[f] !== null) out[f] = toPence(out[f]);
    }
    return out;
  };

  const fromStorage = (row) => {
    if (!row) return row;
    const out = { ...row };
    for (const f of penceFields) {
      if (out[f] !== undefined && out[f] !== null) out[f] = fromPence(out[f]);
    }
    return out;
  };

  return {
    _table: table,
    _penceFields: penceFields,
    _fromStorage: fromStorage,

    async getAll() {
      const rows = await table.toArray();
      return rows.map(fromStorage);
    },

    async get(id) {
      return fromStorage(await table.get(id));
    },

    async add(data) {
      const merged = { ...defaults, ...data };
      if (validate) validate(merged, 'add');
      const id = await table.add(toStorage(merged));
      dispatchMutation();
      return id;
    },

    async update(id, data) {
      if (validate) validate(data, 'update');
      const count = await table.update(id, toStorage(data));
      dispatchMutation();
      return count;
    },

    async delete(id) {
      await table.delete(id);
      dispatchMutation();
    },
  };
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const PAY_DATE_RULES = ['nth-of-month', 'last-day', 'last-working-day'];
const BILL_FREQUENCIES = ['monthly', 'quarterly', 'annual'];
const TRANSACTION_KINDS = ['income', 'spend'];
const TRANSACTION_SOURCES = ['manual', 'import', 'bill'];
const DEBT_TYPES = ['credit-card', 'loan'];

function validateIncomeSource(data) {
  if (data.payDateRule !== undefined) {
    if (!PAY_DATE_RULES.includes(data.payDateRule)) {
      throw new Error(
        `incomeSources.payDateRule must be one of ${PAY_DATE_RULES.join(', ')}; got "${data.payDateRule}"`
      );
    }
    if (data.payDateRule === 'nth-of-month') {
      const day = data.payDateDay;
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        throw new Error(
          `incomeSources.payDateDay is required and must be an integer 1-28 for payDateRule "nth-of-month"; got ${JSON.stringify(day)}`
        );
      }
    }
  }
}

function validateRecurringBill(data) {
  if (data.frequency !== undefined && !BILL_FREQUENCIES.includes(data.frequency)) {
    throw new Error(
      `recurringBills.frequency must be one of ${BILL_FREQUENCIES.join(', ')}; got "${data.frequency}"`
    );
  }
}

function validateTransaction(data) {
  if (data.kind !== undefined && !TRANSACTION_KINDS.includes(data.kind)) {
    throw new Error(
      `transactions.kind must be one of ${TRANSACTION_KINDS.join(', ')}; got "${data.kind}"`
    );
  }
  if (data.source !== undefined && !TRANSACTION_SOURCES.includes(data.source)) {
    throw new Error(
      `transactions.source must be one of ${TRANSACTION_SOURCES.join(', ')}; got "${data.source}"`
    );
  }
}

function validateDebt(data) {
  if (data.debtType !== undefined && !DEBT_TYPES.includes(data.debtType)) {
    throw new Error(
      `debts.debtType must be one of ${DEBT_TYPES.join(', ')}; got "${data.debtType}"`
    );
  }
}

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

export const categoriesRepo = createBaseRepository(db.categories, [], {});

export const incomeSourcesRepo = {
  ...createBaseRepository(
    db.incomeSources,
    ['amountPence'],
    { active: true },
    validateIncomeSource
  ),
};

export const recurringBillsRepo = {
  ...createBaseRepository(
    db.recurringBills,
    ['amountPence'],
    { active: true, adjustToWorkingDay: true },
    validateRecurringBill
  ),
};

export const transactionsRepo = {
  ...createBaseRepository(
    db.transactions,
    ['amountPence'],
    { source: 'manual' },
    validateTransaction
  ),

  /**
   * All transactions in the given calendar month.
   * @param {string} yyyyMM - e.g. "2026-07"
   */
  async forMonth(yyyyMM) {
    const rows = await db.transactions.where('date').startsWith(yyyyMM).toArray();
    return rows.map(this._fromStorage);
  },
};

export const debtsRepo = {
  ...createBaseRepository(
    db.debts,
    [
      'balancePence',
      'creditLimitPence',
      'minPaymentOverridePence',
      'fixedMonthlyPaymentPence',
    ],
    { debtType: 'credit-card' },
    validateDebt
  ),

  /**
   * Quick "update balance" flow (spec §4.3): store a new balance (POUNDS) and
   * its as-of date. No statement history.
   * @param {number} id
   * @param {number} poundsBalance - new balance in pounds
   * @param {string} asOfDate - ISO yyyy-MM-dd
   */
  async updateBalance(id, poundsBalance, asOfDate) {
    const count = await db.debts.update(id, {
      balancePence: toPence(poundsBalance),
      balanceAsOf: asOfDate,
    });
    dispatchMutation();
    return count;
  },
};

export const childrenRepo = createBaseRepository(
  db.children,
  ['providerMonthlyCostPence', 'tfcBalancePence'],
  { isDisabled: false }
);

export const categoryMappingsRepo = createBaseRepository(db.categoryMappings, [], {});
