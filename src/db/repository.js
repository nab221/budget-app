import { db } from './schema.js';
import { toPence } from '../utils/currency.js';

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
    const fixedCount = await db.fixedSpends.where('categoryId').equals(categoryId).count();
    const varCount = await db.variableSpends.where('categoryId').equals(categoryId).count();
    const subCount = await db.subscriptions.where('categoryId').equals(categoryId).count();
    const incCount = await db.income.where('categoryId').equals(categoryId).count();

    return (fixedCount + varCount + subCount + incCount) > 0;
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
 * Fixed Spends Repository
 */
export const fixedSpendRepository = {
  ...createBaseRepository(db.fixedSpends),
  async getByMonth(monthStr) {
    return await db.fixedSpends.where('date').startsWith(monthStr).toArray();
  }
};

/**
 * Variable Spends Repository
 */
export const variableSpendRepository = {
  ...createBaseRepository(db.variableSpends),
  async getByMonth(monthStr) {
    return await db.variableSpends.where('date').startsWith(monthStr).toArray();
  }
};

/**
 * Subscription Repository
 */
export const subscriptionRepository = createBaseRepository(db.subscriptions);

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
 * Dashboard Data Aggregation
 * @param {string} periodType - 'month', 'ytd', or 'all'
 * @param {string} targetMonth - YYYY-MM string
 * @returns {Promise<Object>}
 */
export async function getDashboardData(periodType, targetMonth) {
  let incomeQuery = db.income;
  let fixedQuery = db.fixedSpends;
  let variableQuery = db.variableSpends;

  if (periodType === 'month') {
    incomeQuery = incomeQuery.where('date').startsWith(targetMonth);
    fixedQuery = fixedQuery.where('date').startsWith(targetMonth);
    variableQuery = variableQuery.where('date').startsWith(targetMonth);
  } else if (periodType === 'ytd') {
    const year = targetMonth.split('-')[0];
    const startOfYear = `${year}-01-01`;
    // Using a high day number to cover the end of the month
    const endOfMonth = `${targetMonth}-31`; 
    incomeQuery = incomeQuery.where('date').between(startOfYear, endOfMonth, true, true);
    fixedQuery = fixedQuery.where('date').between(startOfYear, endOfMonth, true, true);
    variableQuery = variableQuery.where('date').between(startOfYear, endOfMonth, true, true);
  }
  // For 'all', we use the full table (no .where())

  const [incomeList, fixedList, variableList, subs, debts, assets] = await Promise.all([
    incomeQuery.toArray(),
    fixedQuery.toArray(),
    variableQuery.toArray(),
    db.subscriptions.toArray(),
    db.debts.toArray(),
    db.assets.toArray()
  ]);

  const sum = (arr, field = 'amount') => arr.reduce((acc, curr) => acc + (curr[field] || 0), 0);

  // Group spending by categoryId
  const categorySpending = {};
  [...fixedList, ...variableList].forEach(spend => {
    const cid = spend.categoryId;
    if (cid) {
      categorySpending[cid] = (categorySpending[cid] || 0) + (spend.amount || 0);
    }
  });

  const incomeTotal = sum(incomeList);
  const fixedTotal = sum(fixedList);
  const variableTotal = sum(variableList);
  const totalSubscriptions = sum(subs);
  const totalDebt = sum(debts, 'currentBalance');
  const totalAssets = sum(assets, 'currentBalance');

  return {
    income: incomeTotal,
    fixed: fixedTotal,
    variable: variableTotal,
    netPosition: incomeTotal - (fixedTotal + variableTotal),
    totalSubscriptions,
    totalDebt,
    totalAssets,
    netWorth: totalAssets - totalDebt,
    fixedToIncomeRatio: incomeTotal > 0 ? Math.round((fixedTotal / incomeTotal) * 100) : 0,
    categorySpending
  };
}
