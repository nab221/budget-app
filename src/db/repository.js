import { db } from './schema.js';
import { toPence } from '../utils/currency.js';
import { findBestMatch } from '../utils/string-similarity.js';

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
  for (const tx of transactions) {
    if (!tx.description || !tx.categoryId) continue;

    const existing = await db.categoryMappings.where('description').equals(tx.description).first();
    
    if (existing) {
      if (existing.categoryId !== Number(tx.categoryId)) {
        await db.categoryMappings.update(existing.id, { categoryId: Number(tx.categoryId) });
      }
    } else {
      await db.categoryMappings.add({
        description: tx.description,
        categoryId: Number(tx.categoryId)
      });
    }
  }
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
    return await db.categories.add({
      group,
      name: name.trim()
    });
  },

  /**
   * Delete a category by ID.
   * @param {number} id - Category ID
   * @returns {Promise<void>}
   */
  async deleteCategory(id) {
    await db.categories.delete(id);
  },

  /**
   * Seed default categories if the table is empty.
   * @returns {Promise<boolean>} - True if seeded, false if already has data.
   */
  async seedDefaultCategories() {
    const count = await db.categories.count();
    if (count > 0) return false;

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

    await db.categories.bulkAdd(toAdd);
    return true;
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
    return await table.add(toSave);
  },

  async update(id, data) {
    const toUpdate = { ...data };
    for (const field of amountFields) {
      if (toUpdate[field] !== undefined) {
        toUpdate[field] = toPence(toUpdate[field]);
      }
    }
    return await table.update(id, toUpdate);
  },

  async delete(id) {
    return await table.delete(id);
  }
});

/**
 * Income Repository
 */
export const incomeRepository = {
  ...createBaseRepository(db.income),
  async getByMonth(monthStr) {
    return await db.income.where('date').startsWith(monthStr).toArray();
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
        const updates = { status: 'paid' };
        if (item.cycleTotal > 0) {
          updates.cycleCurrent = Math.min((item.cycleCurrent || 0) + 1, item.cycleTotal);
        }
        await db.recurrentExpenses.update(item.id, updates);
      }
    });
  }
};

/**
 * One-off Expense Repository
 * Handles singular or infrequent expenses (previously "variable spends").
 */
export const oneOffExpenseRepository = {
  ...createBaseRepository(db.oneOffExpenses),
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
export const statementRepository = createBaseRepository(db.statements, ['amount', 'interest', 'fees']);

/**
 * Target Repository
 */
export const targetRepository = {
  ...createBaseRepository(db.targets),
  async getByCategory(categoryId) {
    return await db.targets.where('categoryId').equals(Number(categoryId)).first();
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

  const [incomeList, recurrentList, oneOffList, debts, assets] = await Promise.all([
    incomeQuery.toArray(),
    recurrentQuery.toArray(),
    oneOffQuery.toArray(),
    db.debts.toArray(),
    db.assets.toArray()
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
  const totalAssets = sum(assets, 'currentBalance');

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
    categorySpending
  };
}
