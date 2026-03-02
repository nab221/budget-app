import { db } from './schema.js';
import { toPence } from '../utils/currency.js';
import { findBestMatch } from '../utils/string-similarity.js';
import { calculateTopUp, getEntitlementPeriod, calculateFundingGap } from '../utils/childcare.js';

// ---------------------------------------------------------------------------
// Sync trigger hook
// ---------------------------------------------------------------------------

/**
 * Trigger an automatic file-based synchronization.
 * This is a no-op until the SyncManager is initialized in Phase 3.
 */
export function triggerSync() {
  if (typeof window !== 'undefined' && window.scheduleAutoSave) {
    window.scheduleAutoSave();
  }
}

// ---------------------------------------------------------------------------
// Balance recalculation trigger
// ---------------------------------------------------------------------------

/**
 * Invalidate balance snapshots from the affected month onwards and schedule
 * a background recalculation.
 *
 * Called automatically by incomeRepository and oneOffExpenseRepository on
 * add / update / delete mutations.  Runs asynchronously so callers are not
 * blocked; errors are logged rather than re-thrown.
 *
 * @param {string} date - ISO date string (YYYY-MM-DD) of the modified record.
 */
export async function triggerBalanceRecalc(date) {
  // Derive month string from the affected date
  const monthStr = String(date).slice(0, 7); // "YYYY-MM"
  if (!monthStr || monthStr.length < 7) return;

  try {
    // Lazy-import to avoid circular dependency at module initialisation time.
    const { balanceSnapshotRepository } = await import('./repository.js');
    const { calculateBalanceChain } = await import('../utils/finance.js');

    // 1. Invalidate all snapshots from the changed month onwards
    await balanceSnapshotRepository.deleteFrom(monthStr);

    // 2. Recalculate from the earliest month that has income data
    //    (fallback to the changed month if no earlier data exists).
    const earliest = await db.income.orderBy('date').first();
    const startMonth = earliest ? String(earliest.date).slice(0, 7) : monthStr;

    // Run with a 3-month forward horizon (default)
    await calculateBalanceChain(startMonth, 3);
    window.dispatchEvent(new CustomEvent('app:refresh'));
  } catch (err) {
    console.error('[triggerBalanceRecalc] Failed to recalculate balances:', err);
  }
}

/**
 * Trigger a 90-day daily balance forecast recalculation.
 * @param {string} date - Affected date (YYYY-MM-DD)
 */
export async function triggerDailyForecastRecalc(date) {
  try {
    const { calculateForecast } = await import('../utils/cashflow.js');
    const { dailyBalanceRepository } = await import('./repository.js');

    const today = new Date().toISOString().split('T')[0];
    const startDate = date < today ? date : today;

    // Calculate 90-day forecast starting from today or the affected date (whichever is earlier)
    const snapshots = await calculateForecast(startDate, 90);
    
    // Persist to dailyBalanceSnapshots
    await dailyBalanceRepository.bulkSave(snapshots);
    
    window.dispatchEvent(new CustomEvent('app:refresh'));
  } catch (err) {
    console.error('[triggerDailyForecastRecalc] Failed to recalculate forecast:', err);
  }
}

/**
 * PDF Import Repository Functions
 */

/**
 * Finds potential duplicate transactions across income, fixedSpends, and variableSpends.
 * Matches by exact Date and Amount (in pence).
 * @param {Array<{date: string, amount: number|string}>} transactions 
 * @returns {Promise<Array<Object>>} transactions with `isDuplicate: true` flag and `duplicateOf` original record
 */
export async function findDuplicates(transactions) {
  const [incomes, recurrent, oneOff] = await Promise.all([
    db.income.toArray(),
    db.recurrentExpenses.toArray(),
    db.oneOffExpenses.toArray()
  ]);

  const existing = [...incomes, ...recurrent, ...oneOff];
  
  return transactions.map(tx => {
    const txAmount = typeof tx.amount === 'number' ? tx.amount : toPence(tx.amount);
    
    const duplicate = existing.find(ex => {
      // Allow loose matching on amount in case it's stored differently, but exact date
      return ex.date === tx.date && Math.abs(ex.amount) === Math.abs(txAmount);
    });

    if (duplicate) {
      return { ...tx, isDuplicate: true, duplicateOf: duplicate };
    }
    return { ...tx, isDuplicate: false };
  });
}

/**
 * Suggests a category based on the description using fuzzy matching against learned mappings.
 * @param {string} description 
 * @returns {Promise<number|null>} suggested category ID, or null if no good match
 */
export async function suggestCategory(description) {
  if (!description) return null;

  const mappings = await db.categoryMappings.toArray();
  if (mappings.length === 0) return null;

  const targetStrings = mappings.map(m => m.description);
  const match = findBestMatch(description, targetStrings);

  // Use a 0.85 confidence threshold
  if (match && match.rating >= 0.85) {
    const matchedMapping = mappings.find(m => m.description === match.target);
    return matchedMapping ? matchedMapping.categoryId : null;
  }

  return null;
}

/**
 * Updates the internal mapping of descriptions to categories after a successful import.
 * @param {Array<{description: string, categoryId: number|string}>} transactions 
 */
export async function updateCategorizationLearningRule(transactions) {
  let changed = false;
  for (const tx of transactions) {
    if (!tx.description || !tx.categoryId) continue;

    const existing = await db.categoryMappings.where('description').equals(tx.description).first();
    
    if (existing) {
      if (existing.categoryId !== Number(tx.categoryId)) {
        await db.categoryMappings.update(existing.id, { categoryId: Number(tx.categoryId) });
        changed = true;
      }
    } else {
      await db.categoryMappings.add({
        description: tx.description,
        categoryId: Number(tx.categoryId)
      });
      changed = true;
    }
  }
  if (changed) triggerSync();
}

/**
 * Category Repository
 * Handles all database operations for budget categories.
 */
export const categoryRepository = {
  /**
   * Get all categories.
   * @returns {Promise<Array>}
   */
  async getCategories() {
    return await db.categories.toArray();
  },

  /**
   * Add a new category.
   * @param {string} group - 'fixed' or 'variable'
   * @param {string} name - Category name
   * @returns {Promise<number>} - The ID of the new category
   */
  async addCategory(group, name) {
    if (!name || !name.trim()) {
      throw new Error('Category name is required');
    }
    if (!['fixed', 'variable'].includes(group)) {
      throw new Error('Invalid category group');
    }
    const id = await db.categories.add({
      group,
      name: name.trim()
    });
    triggerSync();
    return id;
  },

  /**
   * Delete a category by ID.
   * @param {number} id - Category ID
   * @returns {Promise<void>}
   */
  async deleteCategory(id) {
    await db.categories.delete(id);
    triggerSync();
  },

  /**
   * Seed default categories if the table is empty.
   * @returns {Promise<boolean>} - True if seeded, false if already has data.
   */
  async seedDefaultCategories() {
    const count = await db.categories.count();
    if (count > 0) {
      // Still ensure "Opening Balance" special category exists (added in v9).
      await categoryRepository.ensureOpeningBalanceCategory();
      return false;
    }

    const DEFAULT_CATS = {
      fixed: [
        'Housing', 'Utilities', 'Credit Cards & Loans', 'Insurance',
        'Health', 'Childcare', 'Professional Subscriptions', 'Savings', 'Other Fixed'
      ],
      variable: [
        'Groceries', 'Eating Out / Takeaway', 'Clothing', 'Fuel / Transport',
        'Miscellaneous', 'Entertainment', 'Gifts', 'Home / Garden'
      ]
    };

    const toAdd = [];
    for (const [group, names] of Object.entries(DEFAULT_CATS)) {
      for (const name of names) {
        toAdd.push({ group, name });
      }
    }
    // Always include the special "Opening Balance" system category
    toAdd.push({ group: 'system', name: 'Opening Balance' });

    await db.categories.bulkAdd(toAdd);
    triggerSync();
    return true;
  },

  /**
   * Ensure the "Opening Balance" system category exists.
   * Safe to call multiple times — idempotent.
   * @returns {Promise<number>} The category id.
   */
  async ensureOpeningBalanceCategory() {
    const existing = await db.categories
      .where('name')
      .equals('Opening Balance')
      .first();
    if (existing) return existing.id;
    const id = await db.categories.add({ group: 'system', name: 'Opening Balance' });
    triggerSync();
    return id;
  },

  /**
   * Check if a category is in use by any transactions.
   * @param {number|string} categoryId - Category ID (or name if legacy)
   * @returns {Promise<boolean>}
   */
  async isCategoryInUse(categoryId) {
    const recurrentCount = await db.recurrentExpenses.where('categoryId').equals(categoryId).count();
    const oneOffCount = await db.oneOffExpenses.where('categoryId').equals(categoryId).count();
    const incCount = await db.income.where('categoryId').equals(categoryId).count();

    return (recurrentCount + oneOffCount + incCount) > 0;
  }
};

/**
 * Base Repository implementation for standard CRUD
 */
const createBaseRepository = (table, amountFields = ['amount']) => ({
  async get(id) {
    return await table.get(id);
  },

  async getAll() {
    return await table.toArray();
  },

  async add(data) {
    const toSave = { ...data };
    for (const field of amountFields) {
      if (toSave[field] !== undefined) {
        toSave[field] = toPence(toSave[field]);
      }
    }
    const id = await table.add(toSave);
    triggerSync();
    return id;
  },

  async update(id, data) {
    const toUpdate = { ...data };
    for (const field of amountFields) {
      if (toUpdate[field] !== undefined) {
        toUpdate[field] = toPence(toUpdate[field]);
      }
    }
    const result = await table.update(id, toUpdate);
    triggerSync();
    return result;
  },

  async delete(id) {
    const result = await table.delete(id);
    triggerSync();
    return result;
  },

  async bulkAdd(items) {
    const toAdd = items.map(item => {
      const formatted = { ...item };
      for (const field of amountFields) {
        if (formatted[field] !== undefined) {
          formatted[field] = toPence(formatted[field]);
        }
      }
      return formatted;
    });
    const result = await table.bulkAdd(toAdd);
    triggerSync();
    return result;
  },

  async clear() {
    const result = await table.clear();
    triggerSync();
    return result;
  }
});

/**
 * Income Repository
 * Mutations trigger a background balance recalculation from the affected month.
 */
export const incomeRepository = {
  ...createBaseRepository(db.income),

  /** Add an income record and trigger recalculation. */
  async add(data) {
    const toSave = { ...data, amount: toPence(data.amount) };
    const id = await db.income.add(toSave);
    triggerBalanceRecalc(toSave.date).catch(() => {}); // fire-and-forget
    triggerDailyForecastRecalc(toSave.date).catch(() => {});
    triggerSync();
    return id;
  },

  /** Update an income record and trigger recalculation from the record's (new) date. */
  async update(id, data) {
    const toUpdate = { ...data };
    if (toUpdate.amount !== undefined) toUpdate.amount = toPence(toUpdate.amount);
    await db.income.update(id, toUpdate);
    // Use the updated date if provided, otherwise look up existing date
    const dateForRecalc = toUpdate.date || (await db.income.get(id))?.date;
    if (dateForRecalc) {
      triggerBalanceRecalc(dateForRecalc).catch(() => {});
      triggerDailyForecastRecalc(dateForRecalc).catch(() => {});
    }
    triggerSync();
    return 1;
  },

  /** Delete an income record and trigger recalculation from the record's date. */
  async delete(id) {
    const record = await db.income.get(id);
    await db.income.delete(id);
    if (record?.date) {
      triggerBalanceRecalc(record.date).catch(() => {});
      triggerDailyForecastRecalc(record.date).catch(() => {});
    }
    triggerSync();
  },

  async getByMonth(monthStr) {
    return await db.income.where('date').startsWith(monthStr).toArray();
  },

  /**
   * Get income records for a 3-month sliding window ending at targetMonthStr.
   * Returns records from the start of (targetMonth - 2) through the end of targetMonth.
   * @param {string} targetMonthStr - YYYY-MM of the current/reference month
   * @returns {Promise<Array>}
   */
  async getThreeMonthHistory(targetMonthStr) {
    const targetDate = new Date(`${targetMonthStr}-01`);

    // Start: first day of 2 months prior
    const startDate = new Date(targetDate);
    startDate.setMonth(startDate.getMonth() - 2);
    const startStr = startDate.toISOString().slice(0, 7) + '-01';

    // End: last day of target month (set day=0 after incrementing month by 1)
    const endDate = new Date(targetDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    const endStr = endDate.toISOString().slice(0, 10);

    return await db.income
      .where('date')
      .between(startStr, endStr, true, true)
      .toArray();
  }
};

/**
 * Fixed Spends Repository (deprecated — tables removed in schema v5)
 * Kept as a no-op stub so any remaining import references don't throw at module load.
 */
export const fixedSpendRepository = {
  get: async () => null,
  getAll: async () => [],
  getByMonth: async () => [],
  add: async () => {},
  update: async () => {},
  delete: async () => {}
};

/**
 * Variable Spends Repository (deprecated — tables removed in schema v5)
 * Kept as a no-op stub so any remaining import references don't throw at module load.
 */
export const variableSpendRepository = {
  get: async () => null,
  getAll: async () => [],
  getByMonth: async () => [],
  add: async () => {},
  update: async () => {},
  delete: async () => {}
};

/**
 * Recurrent Expense Repository
 * Handles recurring (fixed-frequency) expenses: bills, loans, subscriptions, etc.
 */
export const recurrentExpenseRepository = {
  ...createBaseRepository(db.recurrentExpenses),
  /**
   * Get all recurrent expenses that have a nextDate within the given month.
   * Since recurrent items are not strictly date-filtered by entry date,
   * we return all recurrent items (they represent standing commitments).
   * @param {string} monthStr - YYYY-MM
   * @returns {Promise<Array>}
   */
  async getByMonth(monthStr) {
    // Return all recurrent items — they persist across months as standing commitments.
    // Caller can filter by status/nextDate as needed.
    return await db.recurrentExpenses.toArray();
  },
  /**
   * Mark all pending recurrent items as paid for the current cycle.
   * Increments cycleCurrent for items with cycleTotal > 0.
   * @returns {Promise<void>}
   */
  async markAllAsPaid() {
    await db.transaction('rw', db.recurrentExpenses, async () => {
      const pending = await db.recurrentExpenses.where('status').equals('pending').toArray();
      for (const item of pending) {
        // Skip specialized debt payments — they must be marked paid via statement confirmation
        if (item.isDebtPayment) continue;

        const updates = { status: 'paid' };
        if (item.cycleTotal > 0) {
          updates.cycleCurrent = Math.min((item.cycleCurrent || 0) + 1, item.cycleTotal);
        }
        await db.recurrentExpenses.update(item.id, updates);
      }
    });
  },

  /** Add a recurrent expense and trigger balance recalculation. */
  async add(data) {
    const toSave = { ...data, amount: toPence(data.amount) };
    const id = await db.recurrentExpenses.add(toSave);
    const dateForRecalc = toSave.nextDate || toSave.date;
    if (dateForRecalc) {
      triggerBalanceRecalc(dateForRecalc).catch(() => {});
      triggerDailyForecastRecalc(dateForRecalc).catch(() => {});
    }
    triggerSync();
    return id;
  },

  /** Update a recurrent expense and trigger recalculation. */
  async update(id, data) {
    const toUpdate = { ...data };
    if (toUpdate.amount !== undefined) toUpdate.amount = toPence(toUpdate.amount);
    await db.recurrentExpenses.update(id, toUpdate);
    const dateForRecalc = toUpdate.nextDate || toUpdate.date || (await db.recurrentExpenses.get(id))?.nextDate;
    if (dateForRecalc) {
      triggerBalanceRecalc(dateForRecalc).catch(() => {});
      triggerDailyForecastRecalc(dateForRecalc).catch(() => {});
    }
    triggerSync();
    return 1;
  },

  /** Delete a recurrent expense and trigger recalculation. */
  async delete(id) {
    const record = await db.recurrentExpenses.get(id);
    await db.recurrentExpenses.delete(id);
    const dateForRecalc = record?.nextDate || record?.date;
    if (dateForRecalc) {
      triggerBalanceRecalc(dateForRecalc).catch(() => {});
      triggerDailyForecastRecalc(dateForRecalc).catch(() => {});
    }
    triggerSync();
  }
};

/**
 * One-off Expense Repository
 * Handles singular or infrequent expenses (previously "variable spends").
 * Mutations trigger a background balance recalculation from the affected month.
 */
export const oneOffExpenseRepository = {
  ...createBaseRepository(db.oneOffExpenses),

  /** Add a one-off expense and trigger recalculation. */
  async add(data) {
    const toSave = { ...data, amount: toPence(data.amount) };
    const id = await db.oneOffExpenses.add(toSave);
    triggerBalanceRecalc(toSave.date).catch(() => {}); // fire-and-forget
    triggerDailyForecastRecalc(toSave.date).catch(() => {});
    triggerSync();
    return id;
  },

  /** Update a one-off expense and trigger recalculation. */
  async update(id, data) {
    const toUpdate = { ...data };
    if (toUpdate.amount !== undefined) toUpdate.amount = toPence(toUpdate.amount);
    await db.oneOffExpenses.update(id, toUpdate);
    const dateForRecalc = toUpdate.date || (await db.oneOffExpenses.get(id))?.date;
    if (dateForRecalc) {
      triggerBalanceRecalc(dateForRecalc).catch(() => {});
      triggerDailyForecastRecalc(dateForRecalc).catch(() => {});
    }
    triggerSync();
    return 1;
  },

  /** Delete a one-off expense and trigger recalculation. */
  async delete(id) {
    const record = await db.oneOffExpenses.get(id);
    await db.oneOffExpenses.delete(id);
    if (record?.date) {
      triggerBalanceRecalc(record.date).catch(() => {});
      triggerDailyForecastRecalc(record.date).catch(() => {});
    }
    triggerSync();
  },

  /**
   * Get all one-off expenses for the given month (by entry date).
   * @param {string} monthStr - YYYY-MM
   * @returns {Promise<Array>}
   */
  async getByMonth(monthStr) {
    return await db.oneOffExpenses.where('date').startsWith(monthStr).toArray();
  }
};

/**
 * Subscription Repository (deprecated — kept for data-compatibility with older exports)
 */
export const subscriptionRepository = db.subscriptions
  ? createBaseRepository(db.subscriptions)
  : { getAll: async () => [], add: async () => {}, delete: async () => {} };

/**
 * Debt Repository
 */
export const debtRepository = createBaseRepository(db.debts, ['currentBalance', 'creditLimit']);

/**
 * Asset Repository
 */
export const assetRepository = createBaseRepository(db.assets, ['currentBalance']);

/**
 * Recurring Template Repository
 */
export const recurringTemplateRepository = createBaseRepository(db.recurringTemplates);

/**
 * Statement Repository
 */
export const statementRepository = {
  ...createBaseRepository(db.statements, ['amount', 'interest', 'fees', 'openingBalance', 'minimumPayment', 'actualPaymentAmount']),

  /**
   * Add a statement and automatically create a linked minimum payment expense.
   * @param {Object} statementData 
   * @param {string} debtName 
   * @returns {Promise<number>} Statement ID
   */
  async addWithExpense(statementData, debtName) {
    // 1. Convert monetary fields to pence
    const toSave = { ...statementData };
    const fields = ['amount', 'interest', 'fees', 'openingBalance', 'minimumPayment'];
    fields.forEach(f => {
      if (toSave[f] !== undefined) toSave[f] = toPence(toSave[f]);
    });

    // 2. Find category for 'Credit Cards & Loans'
    const category = await db.categories.where('name').equals('Credit Cards & Loans').first();
    const categoryId = category ? category.id : null;

    let statementId;
    // 3. Execute transaction
    await db.transaction('rw', db.statements, db.recurrentExpenses, async () => {
      // 4. Add statement (linkedExpenseId: null for now)
      toSave.linkedExpenseId = null;
      statementId = await db.statements.add(toSave);

      // 5. Add linked expense
      const expenseId = await db.recurrentExpenses.add({
        label: `Min Payment: ${debtName}`,
        amount: toSave.minimumPayment || 0,
        nextDate: toSave.paymentDueDate || toSave.date,
        predictedPaymentDate: toSave.paymentDueDate || toSave.date,
        categoryId: categoryId,
        status: 'pending',
        isDebtPayment: true,
        linkedStatementId: statementId,
        cycleTotal: 1,
        cycleCurrent: 0,
        isEssential: true,
        frequency: 'monthly' // Most debt payments are monthly cycles
      });

      // 6. Update statement with linkedExpenseId
      await db.statements.update(statementId, { linkedExpenseId: expenseId });
    });

    // 7. Trigger recalcs
    if (toSave.date) {
      triggerBalanceRecalc(toSave.date).catch(() => {});
      triggerDailyForecastRecalc(toSave.date).catch(() => {});
    }

    triggerSync();
    return statementId;
  },

  /**
   * Record a payment for a statement and update the linked expense.
   * @param {number} statementId 
   * @param {number|string} actualAmount 
   * @param {string} paymentDate 
   */
  async recordPayment(statementId, actualAmount, paymentDate) {
    const amountPence = toPence(actualAmount);

    await db.transaction('rw', db.statements, db.recurrentExpenses, async () => {
      // 3. Get statement
      const statement = await db.statements.get(statementId);
      if (!statement) throw new Error(`Statement ${statementId} not found`);

      // 4. Update statement
      await db.statements.update(statementId, {
        actualPaymentAmount: amountPence,
        actualPaymentDate: paymentDate
      });

      // 5. Update linked expense if exists
      if (statement.linkedExpenseId) {
        await db.recurrentExpenses.update(statement.linkedExpenseId, {
          status: 'paid',
          amount: amountPence,
          cycleCurrent: 1,
          date: paymentDate
        });
      }
    });

    // 6. Trigger recalcs
    if (paymentDate) {
      triggerBalanceRecalc(paymentDate).catch(() => {});
      triggerDailyForecastRecalc(paymentDate).catch(() => {});
    }
    triggerSync();
  },

  /**
   * Reset a payment for a statement and its linked expense.
   * @param {number} statementId
   */
  async resetPayment(statementId) {
    let dateForRecalc;
    await db.transaction('rw', db.statements, db.recurrentExpenses, async () => {
      // 1. Get statement
      const statement = await db.statements.get(statementId);
      if (!statement) throw new Error(`Statement ${statementId} not found`);

      dateForRecalc = statement.actualPaymentDate || statement.paymentDueDate || statement.date;

      // 2. Update statement
      await db.statements.update(statementId, {
        actualPaymentAmount: null,
        actualPaymentDate: null
      });

      // 3. Update linked expense if exists
      if (statement.linkedExpenseId) {
        await db.recurrentExpenses.update(statement.linkedExpenseId, {
          status: 'pending',
          amount: statement.minimumPayment || 0,
          cycleCurrent: 0,
          date: null
        });
      }
    });

    // 4. Trigger recalcs
    if (dateForRecalc) {
      triggerBalanceRecalc(dateForRecalc).catch(() => {});
      triggerDailyForecastRecalc(dateForRecalc).catch(() => {});
    }
    triggerSync();
  },

  /** Override delete to trigger recalcs */
  async delete(id) {
    const stmt = await db.statements.get(id);
    if (!stmt) return;
    await db.statements.delete(id);
    if (stmt.date) {
      triggerBalanceRecalc(stmt.date).catch(() => {});
      triggerDailyForecastRecalc(stmt.date).catch(() => {});
    }
    triggerSync();
  },

  /** Delete a statement and its linked expense atomically */
  async deleteWithExpense(id) {
    let date;
    await db.transaction('rw', db.statements, db.recurrentExpenses, async () => {
      const stmt = await db.statements.get(id);
      if (!stmt) return;
      date = stmt.date;

      if (stmt.linkedExpenseId) {
        await db.recurrentExpenses.delete(stmt.linkedExpenseId);
      }

      await db.statements.delete(id);
    });

    if (date) {
      triggerBalanceRecalc(date).catch(() => {});
      triggerDailyForecastRecalc(date).catch(() => {});
    }
    triggerSync();
  }
};

/**
 * Target Repository
 * Targets are now bucket-based: 'recurrent' or 'one-off'.
 * The categoryId field has been removed in schema v6.
 */
export const targetRepository = {
  ...createBaseRepository(db.targets),
  /**
   * Get the target record for a given bucket name.
   * @param {string} bucketName - 'recurrent' or 'one-off'
   * @returns {Promise<Object|undefined>}
   */
  async getByBucket(bucketName) {
    return await db.targets.where('bucket').equals(bucketName).first();
  }
};

/**
 * Net Worth Snapshot Repository
 */
export const netWorthRepository = {
  ...createBaseRepository(db.netWorthSnapshots, ['totalAssets', 'totalDebt', 'netWorth']),
  async getByMonth(monthStr) {
    return await db.netWorthSnapshots.where('month').equals(monthStr).first();
  },
  async checkAndTakeSnapshot() {
    const today = new Date().toISOString().slice(0, 7); // YYYY-MM
    const existing = await this.getByMonth(today);
    
    if (existing) return;

    const [debts, assets] = await Promise.all([
      db.debts.toArray(),
      db.assets.toArray()
    ]);

    const totalDebt = debts.reduce((acc, curr) => acc + (curr.currentBalance || 0), 0);
    const totalAssets = assets.reduce((acc, curr) => acc + (curr.currentBalance || 0), 0);

    await db.netWorthSnapshots.add({
      month: today,
      totalAssets,
      totalDebt,
      netWorth: totalAssets - totalDebt,
      timestamp: new Date().toISOString()
    });
    
    triggerSync();
    console.log(`Snapshot taken for ${today}`);
  }
};

/**
 * Spending Trends Aggregation - last 12 months from targetMonth.
 * Returns Income, Fixed, and Variable totals per month.
 * All amounts are in pence.
 * @param {string} targetMonth - YYYY-MM string (the current/reference month)
 * @returns {Promise<Array<{month: string, income: number, fixed: number, variable: number}>>}
 */
export async function getSpendingTrends(targetMonth) {
  // Build list of the last 12 months in ascending order
  const [year, month] = targetMonth.split('-').map(Number);
  const months = [];
  for (let i = 11; i >= 0; i--) {
    let m = month - i;
    let y = year;
    while (m <= 0) { m += 12; y -= 1; }
    const mm = String(m).padStart(2, '0');
    months.push(`${y}-${mm}`);
  }

  const results = await Promise.all(
    months.map(async (monthStr) => {
      const [incomeList, recurrentList, oneOffList] = await Promise.all([
        db.income.where('date').startsWith(monthStr).toArray(),
        // Recurrent items: filter those whose nextDate falls within this month
        db.recurrentExpenses.where('nextDate').startsWith(monthStr).toArray(),
        db.oneOffExpenses.where('date').startsWith(monthStr).toArray()
      ]);
      const sum = (arr) => arr.reduce((acc, r) => acc + (r.amount || 0), 0);
      return {
        month: monthStr,
        income: sum(incomeList),
        fixed: sum(recurrentList),
        variable: sum(oneOffList)
      };
    })
  );

  return results;
}

/**
 * Dashboard Data Aggregation
 * @param {string} periodType - 'month', 'ytd', or 'all'
 * @param {string} targetMonth - YYYY-MM string
 * @returns {Promise<Object>}
 */
export async function getDashboardData(periodType, targetMonth) {
  let incomeQuery = db.income;
  // Recurrent expenses use nextDate for scheduling; one-off expenses use date for entry
  let recurrentQuery = db.recurrentExpenses;
  let oneOffQuery = db.oneOffExpenses;

  if (periodType === 'month') {
    incomeQuery = incomeQuery.where('date').startsWith(targetMonth);
    // For recurrent items, filter by nextDate within the target month
    recurrentQuery = recurrentQuery.where('nextDate').startsWith(targetMonth);
    oneOffQuery = oneOffQuery.where('date').startsWith(targetMonth);
  } else if (periodType === 'ytd') {
    const year = targetMonth.split('-')[0];
    const startOfYear = `${year}-01-01`;
    const endOfMonth = `${targetMonth}-31`;
    incomeQuery = incomeQuery.where('date').between(startOfYear, endOfMonth, true, true);
    recurrentQuery = recurrentQuery.where('nextDate').between(startOfYear, endOfMonth, true, true);
    oneOffQuery = oneOffQuery.where('date').between(startOfYear, endOfMonth, true, true);
  }
  // For 'all', we use the full table (no .where())

  const [incomeList, recurrentList, oneOffList, debts, assets, childcareAccounts] = await Promise.all([
    incomeQuery.toArray(),
    recurrentQuery.toArray(),
    oneOffQuery.toArray(),
    db.debts.toArray(),
    db.assets.toArray(),
    db.childcareAccounts.toArray()
  ]);

  const sum = (arr, field = 'amount') => arr.reduce((acc, curr) => acc + (curr[field] || 0), 0);

  // Group spending by categoryId (recurrent = "fixed", one-off = "variable")
  const categorySpending = {};
  [...recurrentList, ...oneOffList].forEach(spend => {
    const cid = spend.categoryId;
    if (cid) {
      categorySpending[cid] = (categorySpending[cid] || 0) + (spend.amount || 0);
    }
  });

  const incomeTotal = sum(incomeList);
  const recurrentTotal = sum(recurrentList);
  const oneOffTotal = sum(oneOffList);
  const totalDebt = sum(debts, 'currentBalance');
  const manualAssets = sum(assets, 'currentBalance');

  // Include childcare account balances in total assets (Net Worth integration)
  const childcareSummary = await Promise.all(
    childcareAccounts.map(async (account) => {
      const balance = await childcareRepository.getBalance(account.id);
      const { gap, suggestedDeposit } = calculateFundingGap(account.targetMonthlySpend || 0, balance);
      return { account, balance, gap, suggestedDeposit };
    })
  );

  const childcareTotalBalance = childcareSummary.reduce((sum, c) => sum + c.balance, 0);
  const totalAssets = manualAssets + childcareTotalBalance;

  return {
    income: incomeTotal,
    fixed: recurrentTotal,
    variable: oneOffTotal,
    netPosition: incomeTotal - (recurrentTotal + oneOffTotal),
    totalSubscriptions: 0, // Subscriptions are now part of recurrentExpenses
    totalDebt,
    totalAssets,
    netWorth: totalAssets - totalDebt,
    fixedToIncomeRatio: incomeTotal > 0 ? Math.round((recurrentTotal / incomeTotal) * 100) : 0,
    categorySpending,
    // Bucket-based spending for progress bar display
    bucketSpending: {
      recurrent: recurrentTotal,
      'one-off': oneOffTotal
    },
    // Childcare summary for dashboard card
    childcareSummary
  };
}

/**
 * Balance Snapshot Repository
 *
 * Stores monthly opening/closing balance snapshots for the carry-forward system.
 * Each snapshot captures the income, expense, opening, and closing balance for
 * a calendar month (keyed by YYYY-MM string).
 *
 * All monetary values are stored as integer pence.
 */
export const balanceSnapshotRepository = {
  /**
   * Get the snapshot for a specific month.
   * @param {string} monthStr - YYYY-MM string (e.g. "2026-01")
   * @returns {Promise<Object|undefined>}
   */
  async getByMonth(monthStr) {
    return await db.balanceSnapshots.where('month').equals(monthStr).first();
  },

  /**
   * Save (upsert) a balance snapshot for a month.
   * If a snapshot already exists for the month it is overwritten.
   * @param {Object} snapshot - { month, openingBalance, closingBalance, incomeTotal, expenseTotal }
   * @returns {Promise<number>} The record id.
   */
  async save(snapshot) {
    const existing = await db.balanceSnapshots.where('month').equals(snapshot.month).first();
    let id;
    if (existing) {
      await db.balanceSnapshots.update(existing.id, snapshot);
      id = existing.id;
    } else {
      id = await db.balanceSnapshots.add(snapshot);
    }
    triggerSync();
    return id;
  },

  /**
   * Delete all snapshots from a given month onwards (inclusive).
   * Used to invalidate stale snapshots when historical data changes.
   * @param {string} fromMonthStr - YYYY-MM string.
   * @returns {Promise<void>}
   */
  async deleteFrom(fromMonthStr) {
    const all = await db.balanceSnapshots.toArray();
    const toDelete = all
      .filter(s => s.month >= fromMonthStr)
      .map(s => s.id);
    if (toDelete.length > 0) {
      await db.balanceSnapshots.bulkDelete(toDelete);
      triggerSync();
    }
  },

  /**
   * Get the most recent snapshot (highest month value).
   * Returns undefined if no snapshots exist.
   * @returns {Promise<Object|undefined>}
   */
  async getLatestSnapshot() {
    const all = await db.balanceSnapshots.toArray();
    if (all.length === 0) return undefined;
    return all.reduce((latest, s) => (s.month > latest.month ? s : latest), all[0]);
  }
};

/**
 * Childcare Repository
 *
 * Manages Tax-Free Childcare accounts and their associated ledger entries.
 * Handles the "£8 for £2" government top-up, quarterly cap enforcement,
 * running balance recalculation, and budget expense integration.
 *
 * All monetary amounts are stored in integer pence.
 */
export const childcareRepository = {

  // ---------------------------------------------------------------------------
  // Account management
  // ---------------------------------------------------------------------------

  /**
   * Get all childcare accounts.
   * @returns {Promise<Array>}
   */
  async getAccounts() {
    return await db.childcareAccounts.toArray();
  },

  /**
   * Save (add or update) a childcare account.
   * Converts monetary fields to pence before saving.
   * @param {Object} account - Account data. If id is present, performs an update.
   * @returns {Promise<number>} The account id.
   */
  async saveAccount(account) {
    const toSave = { ...account };
    if (toSave.targetMonthlySpend !== undefined) {
      toSave.targetMonthlySpend = toPence(toSave.targetMonthlySpend);
    }
    let id;
    if (toSave.id) {
      const { id: accountId, ...fields } = toSave;
      await db.childcareAccounts.update(accountId, fields);
      id = accountId;
    } else {
      id = await db.childcareAccounts.add(toSave);
    }
    triggerSync();
    return id;
  },

  /**
   * Delete a childcare account and all its ledger entries.
   * @param {number} id - Account id.
   * @returns {Promise<void>}
   */
  async deleteAccount(id) {
    await db.transaction('rw', db.childcareAccounts, db.childcareLedger, async () => {
      await db.childcareLedger.where('accountId').equals(id).delete();
      await db.childcareAccounts.delete(id);
    });
    triggerSync();
  },

  // ---------------------------------------------------------------------------
  // Ledger queries
  // ---------------------------------------------------------------------------

  /**
   * Get all ledger entries for an account, sorted by date ascending.
   * @param {number} accountId
   * @returns {Promise<Array>}
   */
  async getLedger(accountId) {
    const entries = await db.childcareLedger
      .where('accountId')
      .equals(accountId)
      .toArray();
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  },

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Get the remaining top-up capacity for the entitlement period containing `date`.
   * Standard cap: £500 (50000 pence). Disabled-child cap: £1,000 (100000 pence).
   *
   * @param {number} accountId
   * @param {string} date - ISO date string (YYYY-MM-DD).
   * @returns {Promise<number>} Remaining capacity in pence.
   */
  async getRemainingCap(accountId, date) {
    const account = await db.childcareAccounts.get(accountId);
    if (!account) throw new Error(`Childcare account ${accountId} not found`);

    const cap = account.isDisabled ? 100000 : 50000; // pence

    const { start: periodStart, end: periodEnd } = getEntitlementPeriod(
      account.entitlementStart,
      date
    );

    const startStr = periodStart.toISOString().slice(0, 10);
    const endStr = periodEnd.toISOString().slice(0, 10);

    // Sum all 'top-up' entries within this entitlement period
    const topUpEntries = await db.childcareLedger
      .where('accountId')
      .equals(accountId)
      .and(entry => entry.type === 'top-up' && entry.date >= startStr && entry.date < endStr)
      .toArray();

    const used = topUpEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    return Math.max(0, cap - used);
  },

  /**
   * Recalculate and persist running balances for all ledger entries of an account.
   * Entries are ordered by date ascending, then by id (insertion order) for same-day entries.
   *
   * @param {number} accountId
   * @returns {Promise<void>}
   */
  async _recalculateBalances(accountId) {
    const entries = await db.childcareLedger
      .where('accountId')
      .equals(accountId)
      .toArray();

    // Sort by date, then id for same-day stability
    entries.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      return dateCmp !== 0 ? dateCmp : a.id - b.id;
    });

    let balance = 0;
    for (const entry of entries) {
      if (entry.type === 'spend') {
        balance -= entry.amount;
      } else {
        // 'deposit' and 'top-up' are credits
        balance += entry.amount;
      }
      await db.childcareLedger.update(entry.id, { runningBalance: balance });
    }
  },

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  /**
   * Record a user deposit into a childcare account.
   *
   * Steps:
   * 1. Validates account exists.
   * 2. Calculates remaining quarterly top-up cap.
   * 3. Adds a 'deposit' ledger entry.
   * 4. If top-up capacity > 0, adds a 'top-up' ledger entry.
   * 5. Recalculates running balances for all entries on this account.
   * 6. Creates a corresponding one-off expense in the main budget.
   *
   * @param {number} accountId - Childcare account id.
   * @param {string} date - ISO date string (YYYY-MM-DD).
   * @param {number|string} amount - Deposit amount (pounds or pence integer).
   * @param {number|null} categoryId - Budget category id for the expense entry.
   * @returns {Promise<{ depositId: number, topUpId: number|null, expenseId: number }>}
   */
  async addDeposit(accountId, date, amount, categoryId) {
    const account = await db.childcareAccounts.get(accountId);
    if (!account) throw new Error(`Childcare account ${accountId} not found`);

    // Normalise to pence
    const amountPence = typeof amount === 'number' && amount > 10000
      ? amount // already in pence (heuristic: > £100.00 raw)
      : toPence(amount);

    // Calculate remaining cap before opening the transaction — getRemainingCap
    // reads childcareAccounts which is not in the rw transaction scope below.
    const remainingCap = await childcareRepository.getRemainingCap(accountId, date);
    const topUpAmount = calculateTopUp(amountPence, remainingCap);

    let depositId, topUpId = null, expenseId;

    await db.transaction('rw', db.childcareLedger, db.oneOffExpenses, async () => {
      // 1. Add deposit entry
      depositId = await db.childcareLedger.add({
        accountId,
        date,
        type: 'deposit',
        amount: amountPence,
        runningBalance: 0 // placeholder; recalculated below
      });

      // 2. Apply top-up (already calculated above)

      if (topUpAmount > 0) {
        topUpId = await db.childcareLedger.add({
          accountId,
          date,
          type: 'top-up',
          amount: topUpAmount,
          runningBalance: 0 // placeholder
        });
      }

      // 3. Add corresponding one-off expense in main budget
      expenseId = await db.oneOffExpenses.add({
        date,
        note: `Tax-free Childcare: ${account.childName}`,
        amount: amountPence,
        categoryId: categoryId || null
      });
    });

    // 4. Recalculate running balances (outside transaction to avoid re-entrancy issues)
    await childcareRepository._recalculateBalances(accountId);

    triggerSync();
    return { depositId, topUpId, topUpAmount, expenseId };
  },

  /**
   * Record a spend (payment to childcare provider) from a childcare account.
   *
   * @param {number} accountId - Childcare account id.
   * @param {string} date - ISO date string (YYYY-MM-DD).
   * @param {number|string} amount - Spend amount (pounds or pence integer).
   * @param {string} description - Provider name or description.
   * @returns {Promise<{ spendId: number }>}
   */
  async addSpend(accountId, date, amount, description) {
    const account = await db.childcareAccounts.get(accountId);
    if (!account) throw new Error(`Childcare account ${accountId} not found`);

    const amountPence = typeof amount === 'number' && amount > 10000
      ? amount
      : toPence(amount);

    let spendId;

    await db.transaction('rw', db.childcareLedger, async () => {
      spendId = await db.childcareLedger.add({
        accountId,
        date,
        type: 'spend',
        amount: amountPence,
        description: description || '',
        runningBalance: 0 // placeholder
      });
    });

    await childcareRepository._recalculateBalances(accountId);

    triggerSync();
    return { spendId };
  },

  /**
   * Get the current balance for a childcare account (latest ledger entry's runningBalance).
   * Returns 0 if no entries exist.
   *
   * @param {number} accountId
   * @returns {Promise<number>} Balance in pence.
   */
  async getBalance(accountId) {
    const entries = await db.childcareLedger
      .where('accountId')
      .equals(accountId)
      .toArray();

    if (entries.length === 0) return 0;

    // Sort by date desc, then id desc for same-day
    entries.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      return dateCmp !== 0 ? dateCmp : b.id - a.id;
    });

    return entries[0].runningBalance;
  }
};

/**
 * Daily Balance Snapshot Repository
 *
 * Stores daily opening/closing balance snapshots for the cash flow engine.
 * Snapshots capture the state of a single day (keyed by date string YYYY-MM-DD).
 */
export const dailyBalanceRepository = {
  /**
   * Get the snapshot for a specific date.
   * @param {string} date - YYYY-MM-DD string
   * @returns {Promise<Object|undefined>}
   */
  async getByDate(date) {
    return await db.dailyBalanceSnapshots.where('date').equals(date).first();
  },

  /**
   * Get all daily snapshots.
   * @returns {Promise<Array>}
   */
  async getAll() {
    return await db.dailyBalanceSnapshots.toArray();
  },

  /**
   * Save (upsert) a daily balance snapshot.
   * @param {Object} snapshot - { date, openingBalance, closingBalance, incomeTotal, expenseTotal }
   * @returns {Promise<number>}
   */
  async save(snapshot) {
    const existing = await db.dailyBalanceSnapshots.where('date').equals(snapshot.date).first();
    let id;
    if (existing) {
      await db.dailyBalanceSnapshots.update(existing.id, snapshot);
      id = existing.id;
    } else {
      id = await db.dailyBalanceSnapshots.add(snapshot);
    }
    triggerSync();
    return id;
  },

  /**
   * Delete all daily snapshots from a given date onwards (inclusive).
   * @param {string} fromDate - YYYY-MM-DD string.
   * @returns {Promise<void>}
   */
  async deleteFrom(fromDate) {
    const all = await db.dailyBalanceSnapshots.toArray();
    const toDelete = all
      .filter(s => s.date >= fromDate)
      .map(s => s.id);
    if (toDelete.length > 0) {
      await db.dailyBalanceSnapshots.bulkDelete(toDelete);
      triggerSync();
    }
  },

  /**
   * Get the most recent daily snapshot.
   * @returns {Promise<Object|undefined>}
   */
  async getLatestSnapshot() {
    const all = await db.dailyBalanceSnapshots.toArray();
    if (all.length === 0) return undefined;
    return all.reduce((latest, s) => (s.date > latest.date ? s : latest), all[0]);
  },

  /**
   * Bulk save snapshots efficiently.
   * @param {Array} snapshots
   * @returns {Promise<void>}
   */
  async bulkSave(snapshots) {
    // Clear existing snapshots in the horizon to avoid duplicates or stale data
    if (snapshots.length > 0) {
      const dates = snapshots.map(s => s.date);
      const minDate = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
      await this.deleteFrom(minDate);
    }
    await db.dailyBalanceSnapshots.bulkAdd(snapshots);
    triggerSync();
  }
};

/**
 * Expected Income Repository
 */
export const expectedIncomeRepository = {
  ...createBaseRepository(db.expectedIncome),

  /**
   * Get expected income records for a given month.
   * @param {string} monthStr - YYYY-MM
   * @returns {Promise<Array>}
   */
  async getByMonth(monthStr) {
    return await db.expectedIncome.where('date').startsWith(monthStr).toArray();
  },

  /** Add an expected income record and trigger forecast recalculation. */
  async add(data) {
    const id = await createBaseRepository(db.expectedIncome).add(data);
    triggerDailyForecastRecalc(data.date).catch(() => {});
    triggerSync();
    return id;
  },

  /** Update an expected income record and trigger forecast recalculation. */
  async update(id, data) {
    await createBaseRepository(db.expectedIncome).update(id, data);
    const dateForRecalc = data.date || (await db.expectedIncome.get(id))?.date;
    if (dateForRecalc) triggerDailyForecastRecalc(dateForRecalc).catch(() => {});
    triggerSync();
    return 1;
  },

  /** Delete an expected income record and trigger forecast recalculation. */
  async delete(id) {
    const record = await db.expectedIncome.get(id);
    await db.expectedIncome.delete(id);
    if (record?.date) triggerDailyForecastRecalc(record.date).catch(() => {});
    triggerSync();
  }
};

/**
 * Bank Holiday Repository
 *
 * Handles user overrides for bank holidays (e.g., marking a holiday as a working day).
 */
export const bankHolidayRepository = {
  ...createBaseRepository(db.bankHolidayOverrides),

  /**
   * Get override for a specific date.
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<Object|undefined>}
   */
  async getOverride(date) {
    return await db.bankHolidayOverrides.where('date').equals(date).first();
  },

  /**
   * Check if a manual override is active for a date and if it marks it as open/working.
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<boolean|null>} null if no override, otherwise the isOpen value.
   */
  async isOverrideActive(date) {
    const override = await this.getOverride(date);
    return override ? !!override.isOpen : null;
  }
};
