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
import { parseTaxCode } from '../engine/tax.js';
import { VEHICLE_KINDS } from '../engine/mileage.js';
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
// Week-based frequencies step by exact days; month-based keep a day anchor
// (owner testing feedback, 2026-07-07). Kept in step with `src/engine/plan.js`
// (FREQUENCY_DAYS + FREQUENCY_MONTHS).
const BILL_FREQUENCIES = [
  'weekly',
  '2-weekly',
  '4-weekly',
  '5-weekly',
  '6-weekly',
  'monthly',
  'quarterly',
  '6-monthly',
  'annual',
];
const TRANSACTION_KINDS = ['income', 'spend'];
const INCOME_EVENT_KINDS = ['dividend', 'salary-adjustment', 'other-income', 'sipp-contribution'];
const TRANSACTION_SOURCES = ['manual', 'import', 'bill'];
const DEBT_TYPES = ['credit-card', 'loan'];
// The AMAP rate table has one entry per vehicle kind, so the engine's list is
// the authority — importing it means a new kind can never be priced by the
// engine but rejected here.
const MILEAGE_VEHICLES = VEHICLE_KINDS;

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

function validateIncomeEvent(data) {
  if (data.kind !== undefined && !INCOME_EVENT_KINDS.includes(data.kind)) {
    throw new Error(
      `incomeEvents.kind must be one of ${INCOME_EVENT_KINDS.join(', ')}; got "${data.kind}"`
    );
  }
  if (data.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
    throw new Error(`incomeEvents.date must be an ISO yyyy-MM-dd string; got "${data.date}"`);
  }
  // Only a salary adjustment is signed (unpaid leave); a dividend draw,
  // other income received, or a SIPP payment is a positive amount — enforced
  // here too so direct repo writes can't bypass the form's check.
  if (
    ['dividend', 'other-income', 'sipp-contribution'].includes(data.kind) &&
    data.amountPence !== undefined &&
    Number(data.amountPence) < 0
  ) {
    throw new Error(`incomeEvents.amountPence must be positive for kind "${data.kind}"`);
  }
}

function validatePerson(data) {
  // Blank means "use the standard allowance"; anything else must be a code
  // the engine understands, or the PAYE check would silently ignore it.
  if (data.taxCode !== undefined && data.taxCode !== '' && !parseTaxCode(data.taxCode)) {
    throw new Error(
      `people.taxCode must be a recognised PAYE code (e.g. 1257L, K475, BR, D0, NT) or blank; got "${data.taxCode}"`
    );
  }
}

function validateSalaryPeriod(data) {
  if (data.effectiveFrom !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.effectiveFrom))) {
    throw new Error(
      `salaryPeriods.effectiveFrom must be an ISO yyyy-MM-dd string; got "${data.effectiveFrom}"`
    );
  }
}

function validatePayslip(data) {
  if (data.month !== undefined && !/^\d{4}-\d{2}$/.test(String(data.month))) {
    throw new Error(`payslips.month must be a yyyy-MM string; got "${data.month}"`);
  }
}

function validateMileageTrip(data, mode) {
  // `date` and `miles` have no defaults, and a row missing either is silently
  // broken rather than loudly wrong: an undefined `date` drops out of the
  // index every tax-year read uses, and undefined miles price as zero. Required
  // on `add` only, so a partial `update` still works.
  if (mode === 'add') {
    if (data.date === undefined || data.date === null) {
      throw new Error('mileageTrips.date is required');
    }
    if (data.miles === undefined || data.miles === null) {
      throw new Error('mileageTrips.miles is required');
    }
  }
  if (data.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
    throw new Error(`mileageTrips.date must be an ISO yyyy-MM-dd string; got "${data.date}"`);
  }
  if (data.vehicle !== undefined && !MILEAGE_VEHICLES.includes(data.vehicle)) {
    throw new Error(
      `mileageTrips.vehicle must be one of ${MILEAGE_VEHICLES.join(', ')}; got "${data.vehicle}"`
    );
  }
  if (data.miles !== undefined) {
    const miles = Number(data.miles);
    if (!Number.isFinite(miles) || miles <= 0) {
      throw new Error(`mileageTrips.miles must be a positive number; got ${JSON.stringify(data.miles)}`);
    }
  }
  // A claim is for miles actually driven, so a negative reimbursement is a
  // data-entry slip rather than a meaningful "money back".
  if (data.reimbursedPence !== undefined && Number(data.reimbursedPence) < 0) {
    throw new Error('mileageTrips.reimbursedPence must not be negative');
  }
  // null is meaningful: "no employer recorded", its own claim group.
  if (
    data.employerId !== undefined &&
    data.employerId !== null &&
    !Number.isInteger(data.employerId)
  ) {
    throw new Error(
      `mileageTrips.employerId must be an employer id or null; got ${JSON.stringify(data.employerId)}`
    );
  }
}

function validateEmployer(data) {
  if (data.name !== undefined && !String(data.name).trim()) {
    throw new Error('employers.name is required');
  }
  // Pence PER MILE, not an amount — a whole number of pence, never negative.
  if (data.ratePencePerMile !== undefined) {
    const rate = Number(data.ratePencePerMile);
    if (!Number.isInteger(rate) || rate < 0) {
      throw new Error(
        `employers.ratePencePerMile must be a whole number of pence per mile; got ${JSON.stringify(data.ratePencePerMile)}`
      );
    }
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

export const categoriesRepo = {
  ...createBaseRepository(db.categories, [], {}),

  /**
   * Delete a category AND cascade-delete its learned import mappings (L4). The
   * UI still blocks deletion while transactions/bills reference the category
   * (see `categoryUsage.js`); the dangling `categoryMappings` — which have no
   * such guard — are cleaned up here in one transaction so no orphan learned
   * mapping points at a category that no longer exists.
   * @param {number} id
   */
  async delete(id) {
    await db.transaction('rw', db.categories, db.categoryMappings, async () => {
      await db.categoryMappings.filter((m) => m.categoryId === id).delete();
      await db.categories.delete(id);
    });
    dispatchMutation();
  },
};

export const incomeSourcesRepo = {
  ...createBaseRepository(
    db.incomeSources,
    ['amountPence'],
    { active: true },
    validateIncomeSource
  ),
};

/**
 * Default a bill's `dueDayAnchor` (the original intended day-of-month) from its
 * `nextDueDate` when the caller didn't supply one (M4). Storing the anchor lets
 * the plan walk and the confirm-flow re-clamp month-end bills correctly (31 Jan
 * → 28 Feb → 31 Mar) instead of getting stuck on the 28th forever. Passed
 * through untouched (not a money field).
 */
function withDueDayAnchor(data) {
  if (data.dueDayAnchor == null && data.nextDueDate) {
    const day = Number(String(data.nextDueDate).slice(8, 10));
    if (Number.isInteger(day) && day >= 1 && day <= 31) {
      return { ...data, dueDayAnchor: day };
    }
  }
  return data;
}

export const recurringBillsRepo = (() => {
  const base = createBaseRepository(
    db.recurringBills,
    ['amountPence'],
    { active: true, adjustToWorkingDay: true },
    validateRecurringBill
  );
  return {
    ...base,
    // Default the anchor from nextDueDate on creation. `update` is intentionally
    // NOT wrapped: the confirm flow patches only `nextDueDate` (to the advanced,
    // already-clamped date) and must NOT re-derive the anchor from it, or a
    // 31st-of-month bill clamped to the 28th would lose its 31 anchor. The
    // edit form supplies `dueDayAnchor` explicitly when the due date changes.
    async add(data) {
      return base.add(withDueDayAnchor(data));
    },
  };
})();

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

  /**
   * Find an existing bill-confirmation transaction for a given bill + occurrence
   * date. Used by the confirm flow's idempotent guard. Returns pounds-at-edge or
   * `null`.
   * @param {number} billId
   * @param {string} occurrenceDate - ISO yyyy-MM-dd
   */
  async findBillPayment(billId, occurrenceDate) {
    const rows = await db.transactions
      .where('date')
      .equals(occurrenceDate)
      .filter((t) => t.source === 'bill' && t.billId === billId)
      .toArray();
    return rows.length ? this._fromStorage(rows[0]) : null;
  },

  /**
   * Find an existing debt-payment transaction for a given debt + occurrence date
   * (the idempotent guard for `confirmDebtPayment`). Returns pounds-at-edge or
   * `null`.
   * @param {number} debtId
   * @param {string} occurrenceDate - ISO yyyy-MM-dd
   */
  async findDebtPayment(debtId, occurrenceDate) {
    const rows = await db.transactions
      .where('date')
      .equals(occurrenceDate)
      .filter((t) => t.debtId === debtId)
      .toArray();
    return rows.length ? this._fromStorage(rows[0]) : null;
  },

  /**
   * `{ debtId, date }` for every debt-payment transaction (rows with a `debtId`).
   * Fed to the plan engine so paid debt occurrences drop from the committed
   * timeline, and to the Recurring Bills list so a debt's derived "next due" row
   * advances past occurrences already paid. Raw (no pounds conversion needed —
   * only the debtId + date matter). Uses the `debtId` index (v2).
   */
  async debtPaymentOccurrences() {
    const rows = await db.transactions.where('debtId').above(0).toArray();
    return rows.map((t) => ({ debtId: t.debtId, date: t.date }));
  },

  /**
   * All bill-confirmation transactions whose date falls in [startInclusive,
   * endExclusive). Lets the pay-period panel mark paid occurrences without the
   * plan engine (which never sees transactions) having to know about them.
   * @param {string} startInclusive - ISO yyyy-MM-dd
   * @param {string} endExclusive - ISO yyyy-MM-dd
   */
  async billPaymentsBetween(startInclusive, endExclusive) {
    const rows = await db.transactions
      .where('date')
      .between(startInclusive, endExclusive, true, false)
      .filter((t) => t.source === 'bill')
      .toArray();
    return rows.map(this._fromStorage);
  },
};

/** Today as a local ISO day (the balance-log date when no as-of is supplied). */
const localToday = () => {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};

/**
 * Append a row to the `balanceUpdates` log (dashboard plan §7). Raw pence at
 * rest, like every store. Deliberately append-only — the log is the owner's
 * record of the balances they entered, powering the payoff chart's
 * actual-vs-plan overlay.
 */
async function logBalanceUpdate(debtId, balancePence, date, source) {
  await db.balanceUpdates.add({
    debtId,
    balancePence,
    date: date || localToday(),
    source, // 'create' | 'update' | 'edit'
  });
}

export const debtsRepo = (() => {
  const base = createBaseRepository(
    db.debts,
    [
      'balancePence',
      'creditLimitPence',
      'minPaymentOverridePence',
      'fixedMonthlyPaymentPence',
    ],
    { debtType: 'credit-card' },
    validateDebt
  );
  return {
    ...base,

    /** Creating a debt seeds its balance log with the opening balance. */
    async add(data) {
      const id = await base.add(data);
      if (data.balancePence != null) {
        await logBalanceUpdate(id, toPence(data.balancePence), data.balanceAsOf, 'create');
      }
      dispatchMutation();
      return id;
    },

    /** The edit form logs a balance row only when the balance actually changed. */
    async update(id, data) {
      if (data.balancePence != null) {
        const existing = await db.debts.get(id);
        const newPence = toPence(data.balancePence);
        if (existing && existing.balancePence !== newPence) {
          await logBalanceUpdate(id, newPence, data.balanceAsOf ?? existing.balanceAsOf, 'edit');
        }
      }
      return base.update(id, data);
    },

    /**
     * Quick "update balance" flow (spec §4.3): store a new balance (POUNDS) and
     * its as-of date, and append it to the balance log. Both entry points — the
     * debt card's inline form and the statement-PDF import — go through here.
     * @param {number} id
     * @param {number} poundsBalance - new balance in pounds
     * @param {string} asOfDate - ISO yyyy-MM-dd
     */
    async updateBalance(id, poundsBalance, asOfDate) {
      const balancePence = toPence(poundsBalance);
      const count = await db.debts.update(id, {
        balancePence,
        balanceAsOf: asOfDate,
      });
      if (count) await logBalanceUpdate(id, balancePence, asOfDate, 'update');
      dispatchMutation();
      return count;
    },

    /** Deleting a debt removes its balance log too (no orphan rows). */
    async delete(id) {
      await db.transaction('rw', db.debts, db.balanceUpdates, async () => {
        await db.balanceUpdates.where('debtId').equals(id).delete();
        await db.debts.delete(id);
      });
      dispatchMutation();
    },
  };
})();

export const balanceUpdatesRepo = {
  ...createBaseRepository(db.balanceUpdates, ['balancePence'], {}),

  /** Every log row, oldest first (pounds at the edge, like every repo read). */
  async allByDate() {
    const rows = await db.balanceUpdates.orderBy('date').toArray();
    return rows.map(this._fromStorage);
  },
};

export const childrenRepo = createBaseRepository(
  db.children,
  ['providerMonthlyCostPence', 'tfcBalancePence'],
  { isDisabled: false, paymentDayOfMonth: 1 }
);

export const peopleRepo = {
  ...createBaseRepository(
    db.people,
    [
      'annualSalaryPence',
      'salarySacrificePence',
      'pensionAnnualPence',
      'benefitsInKindPence',
      'otherIncomePence',
    ],
    {
      annualSalaryPence: 0,
      salarySacrificePence: 0,
      pensionAnnualPence: 0,
      benefitsInKindPence: 0,
      otherIncomePence: 0,
      taxCode: '',
    },
    validatePerson
  ),

  /**
   * Delete a person AND their income events, salary periods, and payslips in
   * one transaction, so no orphan rows point at a person that no longer exists.
   * @param {number} id
   */
  async delete(id) {
    await db.transaction(
      'rw',
      db.people,
      db.incomeEvents,
      db.salaryPeriods,
      db.payslips,
      async () => {
        await db.incomeEvents.where('personId').equals(id).delete();
        await db.salaryPeriods.where('personId').equals(id).delete();
        await db.payslips.where('personId').equals(id).delete();
        await db.people.delete(id);
      }
    );
    dispatchMutation();
  },
};

export const salaryPeriodsRepo = {
  ...createBaseRepository(
    db.salaryPeriods,
    ['annualSalaryPence', 'salarySacrificePence', 'workplacePensionAnnualPence', 'bikAnnualPence'],
    {
      annualSalaryPence: 0,
      salarySacrificePence: 0,
      workplacePensionAnnualPence: 0,
      bikAnnualPence: 0,
      note: '',
    },
    validateSalaryPeriod
  ),

  /**
   * A person's salary periods, oldest effectiveFrom first (the order the
   * timeline engine and the UI list both want). Pounds at the edge.
   * @param {number} personId
   */
  async forPerson(personId) {
    const rows = await db.salaryPeriods.where('personId').equals(personId).toArray();
    rows.sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
    return rows.map(this._fromStorage);
  },
};

export const payslipsRepo = {
  ...createBaseRepository(
    db.payslips,
    // `taxablePence` (amendment (g)) is deliberately NOT defaulted: a pre-(g)
    // row keeps computing gross − pension + BIK, and only rows that actually
    // carry the payslip's Taxable Pay figure override it.
    ['taxablePence', 'grossPence', 'pensionPence', 'bikPence', 'taxPaidPence'],
    { grossPence: 0, pensionPence: 0, bikPence: 0, taxPaidPence: 0, note: '' },
    validatePayslip
  ),

  /**
   * All payslips with a month in [startMonth, endMonth] (inclusive — the 12
   * pay months of a tax year). Pounds at the edge, like every repo read.
   * @param {string} startMonth - 'yyyy-MM'
   * @param {string} endMonth - 'yyyy-MM'
   */
  async betweenMonths(startMonth, endMonth) {
    const rows = await db.payslips
      .where('month')
      .between(startMonth, endMonth, true, true)
      .toArray();
    return rows.map(this._fromStorage);
  },

  /**
   * One payslip per person-month: update in place if the month already has
   * one, insert otherwise (the month-grid form always goes through here).
   * @param {number} personId
   * @param {object} data - pounds-at-edge payslip fields incl. `month`.
   */
  async upsert(personId, data) {
    validatePayslip(data);
    // Transaction makes the check-then-write atomic, so two concurrent saves
    // for the same month can't race past the unique [personId+month] index.
    return db.transaction('rw', db.payslips, async () => {
      const existing = await db.payslips
        .where('[personId+month]')
        .equals([personId, data.month])
        .first();
      if (existing) {
        return this.update(existing.id, data);
      }
      return this.add({ ...data, personId });
    });
  },
};

export const incomeEventsRepo = {
  ...createBaseRepository(db.incomeEvents, ['amountPence'], {}, validateIncomeEvent),

  /**
   * All income events dated within [startDate, endDate] (both inclusive —
   * tax-year bounds are inclusive). Pounds at the edge, like every repo read.
   * @param {string} startDate - ISO yyyy-MM-dd
   * @param {string} endDate - ISO yyyy-MM-dd
   */
  async between(startDate, endDate) {
    const rows = await db.incomeEvents
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
    return rows.map(this._fromStorage);
  },
};

export const employersRepo = {
  // `ratePencePerMile` is deliberately NOT a pence field: it is a rate (pence
  // per mile), not a money amount, so it is stored and read back verbatim
  // rather than going through the pounds-at-the-edge translation.
  ...createBaseRepository(db.employers, [], { ratePencePerMile: 0 }, validateEmployer),

  /** Employers in name order — how every list of them is shown. */
  async getAll() {
    const rows = await db.employers.toArray();
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'en-GB'));
    return rows;
  },

  /**
   * Delete an employer and UNASSIGN its trips rather than deleting them: the
   * journeys still happened, and a trip with no employer is a valid claim
   * group of its own. Cascade-deleting a year of mileage because a job ended
   * would be the wrong kind of tidy.
   * @param {number} id
   */
  async delete(id) {
    await db.transaction('rw', db.employers, db.mileageTrips, async () => {
      await db.mileageTrips.where('employerId').equals(id).modify({ employerId: null });
      await db.employers.delete(id);
    });
    dispatchMutation();
  },
};

export const mileageTripsRepo = {
  ...createBaseRepository(
    db.mileageTrips,
    ['reimbursedPence'],
    { vehicle: 'car', reimbursedPence: 0, purpose: '', employerId: null },
    validateMileageTrip
  ),

  /**
   * All trips dated within [startDate, endDate] (both inclusive — tax-year
   * bounds are inclusive), oldest first. Pounds at the edge, like every repo
   * read.
   * @param {string} startDate - ISO yyyy-MM-dd
   * @param {string} endDate - ISO yyyy-MM-dd
   */
  async between(startDate, endDate) {
    const rows = await db.mileageTrips
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();
    rows.sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
    return rows.map(this._fromStorage);
  },
};

export const categoryMappingsRepo = {
  ...createBaseRepository(db.categoryMappings, [], {}),

  /**
   * Upsert a learned description→category mapping (spec §4.6): if a mapping for
   * `descriptionKey` already exists, update its `categoryId`; otherwise insert a
   * new one. `descriptionKey` must already be normalised by the caller.
   * @param {string} descriptionKey
   * @param {number} categoryId
   */
  async upsert(descriptionKey, categoryId) {
    const existing = await db.categoryMappings
      .where('descriptionKey')
      .equals(descriptionKey)
      .first();
    if (existing) {
      await db.categoryMappings.update(existing.id, { categoryId });
    } else {
      await db.categoryMappings.add({ descriptionKey, categoryId });
    }
    dispatchMutation();
  },
};
