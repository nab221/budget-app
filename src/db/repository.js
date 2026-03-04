import { db } from './schema.js';
import { generateUUID } from '../utils/security.js';
import { toPence, fromPence } from '../utils/currency.js';
import { findBestMatch } from '../utils/string-similarity.js';
import { calculateTopUp, getEntitlementPeriod, calculateFundingGap } from '../utils/childcare.js';
import { calcMinPayment, calculateBalanceChain, simulatePayoff } from '../utils/finance.js';

// ---------------------------------------------------------------------------
// Sync trigger hook
// ---------------------------------------------------------------------------
const triggerSync = () => {
  if (typeof window !== 'undefined' && window.scheduleAutoSave) {
    window.scheduleAutoSave();
  }
};

/**
 * Common base repository operations.
 */
function createBaseRepository(table, penceFields = []) {
  return {
    async getAll() { return await table.toArray(); },
    async get(id) { return await table.get(id); },
    async add(data) {
      const toSave = { ...data };
      penceFields.forEach(f => { if (toSave[f] !== undefined) toSave[f] = toPence(toSave[f]); });
      const id = await table.add(toSave);
      triggerSync();
      return id;
    },
    async update(id, data) {
      const toUpdate = { ...data };
      penceFields.forEach(f => { if (toUpdate[f] !== undefined) toUpdate[f] = toPence(toUpdate[f]); });
      await table.update(id, toUpdate);
      triggerSync();
      return 1;
    },
    async delete(id) {
      await table.delete(id);
      triggerSync();
    }
  };
}

// ---------------------------------------------------------------------------
// Primary Repositories
// ---------------------------------------------------------------------------

export const incomeRepository = {
  ...createBaseRepository(db.income, ['amount']),
  async getByMonth(monthStr) {
    return await db.income.where('date').startsWith(monthStr).toArray();
  }
};
export const recurrentExpenseRepository = {
  ...createBaseRepository(db.recurrentExpenses, ['amount']),
  async getByMonth(monthStr) {
    // Basic filter by date prefix
    return await db.recurrentExpenses.where('nextDate').startsWith(monthStr).toArray();
  },
  async deleteSeries(recurrenceId, fromDate) {
    const toDelete = await db.recurrentExpenses
      .where('recurrenceId').equals(recurrenceId)
      .filter(item => (item.nextDate || item.date) >= fromDate)
      .toArray();
    if (toDelete.length > 0) {
      await db.recurrentExpenses.bulkDelete(toDelete.map(i => i.id));
      triggerSync();
    }
  },
  async updateSeries(recurrenceId, fromDate, updates) {
    const toUpdate = await db.recurrentExpenses
      .where('recurrenceId').equals(recurrenceId)
      .filter(item => (item.nextDate || item.date) >= fromDate)
      .toArray();
    
    const penceFields = ['amount'];
    const processedUpdates = { ...updates };
    penceFields.forEach(f => { if (processedUpdates[f] !== undefined) processedUpdates[f] = toPence(processedUpdates[f]); });

    for (const item of toUpdate) {
      await db.recurrentExpenses.update(item.id, processedUpdates);
    }
    triggerSync();
  },
  async markAllAsPaid() {
    const today = new Date().toISOString().slice(0, 10);
    const monthStr = today.slice(0, 7);
    const pending = await db.recurrentExpenses
      .where('nextDate').startsWith(monthStr)
      .filter(i => i.status === 'pending')
      .toArray();
    for (const item of pending) {
      await db.recurrentExpenses.update(item.id, { status: 'paid' });
    }
    triggerSync();
  },
  async bulkAdd(items) {
    const toSave = items.map(i => ({
      ...i,
      amount: toPence(i.amount)
    }));
    await db.recurrentExpenses.bulkAdd(toSave);
    triggerSync();
  }
};

export const oneOffExpenseRepository = {
  ...createBaseRepository(db.oneOffExpenses, ['amount']),
  async getByMonth(monthStr) {
    return await db.oneOffExpenses.where('date').startsWith(monthStr).toArray();
  }
};

/**
 * Debt Repository
 */
export const debtRepository = {
  ...createBaseRepository(db.debts, ['currentBalance', 'creditLimit', 'originalPrincipal', 'fixedMonthlyPayment', 'earlyRepaymentFee']),

  async add(data) {
    const toSave = { ...data };
    const fields = ['currentBalance', 'creditLimit', 'originalPrincipal', 'fixedMonthlyPayment', 'earlyRepaymentFee'];
    fields.forEach(f => { if (toSave[f] !== undefined) toSave[f] = toPence(toSave[f]); });

    const id = await db.debts.add(toSave);
    
    if (toSave.debtType === 'loan' || toSave.debtType === 'mortgage') {
      await this.generateLoanPayments(id, toSave);
    }

    triggerSync();
    return id;
  },

  async update(id, data) {
    const existing = await db.debts.get(id);
    const toUpdate = { ...data };
    const fields = ['currentBalance', 'creditLimit', 'originalPrincipal', 'fixedMonthlyPayment', 'earlyRepaymentFee'];
    fields.forEach(f => { if (toUpdate[f] !== undefined) toUpdate[f] = toPence(toUpdate[f]); });

    await db.debts.update(id, toUpdate);
    const updated = await db.debts.get(id);

    // If type changed or payment changed, refresh linked expenses
    if (existing.debtType !== updated.debtType || 
        existing.fixedMonthlyPayment !== updated.fixedMonthlyPayment ||
        existing.name !== updated.name) {
      
      await this.deleteLinkedExpenses(id);
      if (updated.debtType === 'loan' || updated.debtType === 'mortgage') {
        await this.generateLoanPayments(id, updated);
      }
    }

    triggerSync();
    return 1;
  },

  async delete(id) {
    await this.deleteLinkedExpenses(id);
    await db.debts.delete(id);
    triggerSync();
  },

  /**
   * Auto-generate recurring expenses for amortising loans/mortgages.
   */
  async generateLoanPayments(debtId, debt) {
    const { generateInstances } = await import('../utils/recurrence.js');
    const category = await db.categories.where('name').equals('Credit Cards & Loans').first();
    const categoryId = category ? category.id : null;

    const startDate = new Date().toISOString().slice(0, 10);
    const label = `${debt.debtType === 'mortgage' ? 'Mortgage' : 'Loan'} Payment: ${debt.name}`;
    
    // Generate 12 months of payments as recurrent expenses
    const baseItem = {
      label,
      amount: fromPence(debt.fixedMonthlyPayment || 0),
      date: startDate,
      nextDate: startDate,
      categoryId,
      isRecurring: true,
      frequency: 'monthly',
      isEssential: true,
      isDebtPayment: true,
      debtType: debt.debtType,
      linkedDebtId: debtId
    };

    const instances = generateInstances(baseItem, 'monthly', 12);
    // Add recurrence metadata
    const recurrenceId = generateUUID();
    const instancesToSave = instances.map(inst => ({
      ...inst,
      recurrenceId,
      parentDate: startDate,
      status: 'pending',
      cycleCurrent: 0,
      cycleTotal: debt.termMonths || 0
    }));

    await db.recurrentExpenses.bulkAdd(instancesToSave);
    
    const lastDate = instancesToSave[instancesToSave.length - 1].date;
    triggerBalanceRecalc(startDate).catch(() => {});
    triggerDailyForecastRecalc(lastDate).catch(() => {});
  },

  async deleteLinkedExpenses(debtId) {
    const linked = await db.recurrentExpenses.where('linkedDebtId').equals(debtId).toArray();
    if (linked.length > 0) {
      await db.recurrentExpenses.bulkDelete(linked.map(l => l.id));
      const earliestDate = linked.sort((a, b) => (a.nextDate || a.date).localeCompare(b.nextDate || b.date))[0]?.date;
      if (earliestDate) triggerBalanceRecalc(earliestDate).catch(() => {});
    }
  }
};

export const statementRepository = {
  ...createBaseRepository(db.statements, ['amount', 'interest', 'fees', 'openingBalance', 'minimumPayment', 'actualPaymentAmount']),
  
  /**
   * Adds a statement and creates a corresponding recurrent expense record.
   */
  async addWithExpense(data, debtName) {
    const penceFields = ['amount', 'interest', 'fees', 'openingBalance', 'minimumPayment'];
    const toSave = { ...data };
    penceFields.forEach(f => { if (toSave[f] !== undefined) toSave[f] = toPence(toSave[f]); });

    return await db.transaction('rw', [db.statements, db.recurrentExpenses], async () => {
      // 1. Create the statement record
      const stmtId = await db.statements.add(toSave);

      // 2. Create a linked pending expense for the minimum payment
      const category = await db.categories.where('name').equals('Credit Cards & Loans').first();
      const expenseId = await db.recurrentExpenses.add({
        date: toSave.date,
        nextDate: toSave.paymentDueDate || toSave.date,
        categoryId: category ? category.id : null,
        label: `Payment: ${debtName}`,
        amount: toSave.minimumPayment,
        status: 'pending',
        frequency: 'monthly',
        isEssential: true,
        isDebtPayment: true,
        linkedStatementId: stmtId,
        isRecurring: false,
        recurrenceId: null,
        parentDate: null
      });

      // 3. Update statement with the linked expense ID
      await db.statements.update(stmtId, { linkedExpenseId: expenseId });
      
      triggerSync();
      return stmtId;
    });
  },

  /**
   * Deletes a statement and its linked expense record.
   */
  async deleteWithExpense(id) {
    const stmt = await db.statements.get(id);
    return await db.transaction('rw', [db.statements, db.recurrentExpenses], async () => {
      if (stmt && stmt.linkedExpenseId) {
        await db.recurrentExpenses.delete(stmt.linkedExpenseId);
      }
      await db.statements.delete(id);
      triggerSync();
    });
  },

  /**
   * Records an actual payment against a statement.
   */
  async recordPayment(stmtId, amountPounds, paymentDate) {
    const amountPence = toPence(amountPounds);
    const statement = await db.statements.get(stmtId);
    if (!statement) throw new Error('Statement not found');

    return await db.transaction('rw', [db.statements, db.recurrentExpenses], async () => {
      // Update statement
      await db.statements.update(stmtId, {
        actualPaymentAmount: amountPence,
        actualPaymentDate: paymentDate
      });

      // Update linked expense if it exists
      if (statement.linkedExpenseId) {
        await db.recurrentExpenses.update(statement.linkedExpenseId, {
          status: 'paid',
          amount: amountPence,
          cycleCurrent: 1,
          date: paymentDate
        });
      }
      
      triggerSync();
    });
  },

  /**
   * Resets a payment on a statement.
   */
  async resetPayment(stmtId) {
    const statement = await db.statements.get(stmtId);
    if (!statement) return;

    return await db.transaction('rw', [db.statements, db.recurrentExpenses], async () => {
      await db.statements.update(stmtId, {
        actualPaymentAmount: null,
        actualPaymentDate: null
      });

      if (statement.linkedExpenseId) {
        await db.recurrentExpenses.update(statement.linkedExpenseId, {
          status: 'pending',
          amount: statement.minimumPayment,
          cycleCurrent: 0,
          date: statement.date
        });
      }
      triggerSync();
    });
  }
};

export const assetRepository = createBaseRepository(db.assets, ['currentBalance']);

export const categoryRepository = {
  ...createBaseRepository(db.categories),
  async getCategories() { return await db.categories.toArray(); },
  async getByGroup(group) { return await db.categories.where('group').equals(group).toArray(); },
  async seedDefaultCategories() {
    const count = await db.categories.count();
    if (count > 0) return;

    const defaults = [
      { group: 'fixed', name: 'Housing (Rent/Mortgage)' },
      { group: 'fixed', name: 'Utilities (Gas/Elec/Water)' },
      { group: 'fixed', name: 'Council Tax' },
      { group: 'fixed', name: 'Insurance' },
      { group: 'fixed', name: 'Subscriptions' },
      { group: 'fixed', name: 'Credit Cards & Loans' },
      { group: 'variable', name: 'Groceries' },
      { group: 'variable', name: 'Transport/Fuel' },
      { group: 'variable', name: 'Dining & Takeaway' },
      { group: 'variable', name: 'Leisure & Hobbies' },
      { group: 'variable', name: 'Health & Beauty' },
      { group: 'variable', name: 'Shopping' },
      { group: 'system', name: 'Opening Balance' }
    ];
    await db.categories.bulkAdd(defaults);
    triggerSync();
  }
};

export const targetRepository = createBaseRepository(db.targets, ['amount']);

export const netWorthRepository = {
  async getAll() { return await db.netWorthSnapshots.orderBy('month').toArray(); },
  async checkAndTakeSnapshot() {
    const now = new Date();
    const monthStr = now.toISOString().slice(0, 7);
    const existing = await db.netWorthSnapshots.where('month').equals(monthStr).first();
    if (existing) return;

    const [assets, debts] = await Promise.all([
      db.assets.toArray(),
      db.debts.toArray()
    ]);

    const totalAssets = assets.reduce((sum, a) => sum + a.currentBalance, 0);
    const totalDebt = debts.reduce((sum, d) => sum + d.currentBalance, 0);

    await db.netWorthSnapshots.add({
      month: monthStr,
      totalAssets,
      totalDebt,
      netWorth: totalAssets - totalDebt
    });
    triggerSync();
  }
};

export const categoryMappingRepository = {
  async getAll() { return await db.categoryMappings.toArray(); },
  async saveMapping(description, categoryId) {
    const existing = await db.categoryMappings.where('description').equals(description).first();
    if (existing) {
      await db.categoryMappings.update(existing.id, { categoryId });
    } else {
      await db.categoryMappings.add({ description, categoryId });
    }
    triggerSync();
  }
};

/**
 * Global balance chain trigger.
 * Deletes all snapshots from the given month onwards to force a fresh chain calculation.
 */
export async function triggerBalanceRecalc(fromDate) {
  const monthStr = fromDate.slice(0, 7);
  await balanceSnapshotRepository.deleteFrom(monthStr);
  await calculateBalanceChain(monthStr);
}

/**
 * Global daily forecast trigger.
 */
export async function triggerDailyForecastRecalc(toDate) {
  // Implementation in finance.js
  triggerSync();
}

/**
 * Dashboard Data Aggregation.
 * Fetches and sums data for the summary view.
 * 
 * @param {string} periodType - 'month', 'ytd', or 'all'.
 * @param {string} targetMonth - YYYY-MM string.
 * @returns {Promise<Object>}
 */
export async function getDashboardData(periodType = 'month', targetMonth) {
  let incomeList, recurrentList, oneOffList, manualAssets, debts;

  if (periodType === 'month') {
    [incomeList, recurrentList, oneOffList, manualAssets, debts] = await Promise.all([
      db.income.where('date').startsWith(targetMonth).toArray(),
      db.recurrentExpenses.where('nextDate').startsWith(targetMonth).toArray(),
      db.oneOffExpenses.where('date').startsWith(targetMonth).toArray(),
      db.assets.toArray(),
      db.debts.toArray()
    ]);
  } else if (periodType === 'ytd') {
    const year = targetMonth.slice(0, 4);
    [incomeList, recurrentList, oneOffList, manualAssets, debts] = await Promise.all([
      db.income.where('date').between(`${year}-01-01`, `${year}-12-31`, true, true).toArray(),
      db.recurrentExpenses.where('nextDate').between(`${year}-01-01`, `${year}-12-31`, true, true).toArray(),
      db.oneOffExpenses.where('date').between(`${year}-01-01`, `${year}-12-31`, true, true).toArray(),
      db.assets.toArray(),
      db.debts.toArray()
    ]);
  } else {
    [incomeList, recurrentList, oneOffList, manualAssets, debts] = await Promise.all([
      db.income.toArray(),
      db.recurrentExpenses.toArray(),
      db.oneOffExpenses.toArray(),
      db.assets.toArray(),
      db.debts.toArray()
    ]);
  }

  const incomeTotal = incomeList.reduce((sum, r) => sum + (r.amount || 0), 0);
  const recurrentTotal = recurrentList.reduce((sum, r) => sum + (r.amount || 0), 0);
  const oneOffTotal = oneOffList.reduce((sum, r) => sum + (r.amount || 0), 0);
  manualAssets = manualAssets.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalDebt = debts.reduce((sum, d) => sum + (d.currentBalance || 0), 0);

  // Group by category for breakdown
  const categorySpending = {};
  [...recurrentList, ...oneOffList].forEach(r => {
    const catId = r.categoryId || 0;
    categorySpending[catId] = (categorySpending[catId] || 0) + (r.amount || 0);
  });

  // TFC summary
  const accounts = await db.childcareAccounts.toArray();
  const childcareSummary = await Promise.all(accounts.map(async account => {
    const balance = await childcareRepository.getBalance(account.id);
    const gapResult = calculateFundingGap(balance, account.targetMonthlySpend || 0);
    return { account, balance, gap: gapResult.gap, suggestedDeposit: gapResult.suggestedDeposit };
  }));

  const childcareTotalBalance = childcareSummary.reduce((sum, c) => sum + c.balance, 0);
  const totalAssets = manualAssets + childcareTotalBalance;

  return {
    income: incomeTotal,
    fixed: recurrentTotal,
    variable: oneOffTotal,
    totalExpenses: recurrentTotal + oneOffTotal,
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
    childcareSummary,
    // Debt payments for Phase 3
    ccPayments: debts
      .filter(d => d.type === 'credit-card' || !d.type)
      .reduce((sum, d) => sum + calcMinPayment(d.currentBalance, d.apr, 0, new Date(), d.promoEndDate), 0),
    loanPayments: debts
      .filter(d => d.type === 'loan' || d.type === 'mortgage')
      .reduce((sum, d) => sum + (d.monthlyPayment || 0), 0),
    extraPayment: (parseFloat(localStorage.getItem('payoffExtra')) || 0) * 100
  };
}

/**
 * Get the current account balance as of today.
 * @returns {Promise<number>} balance in pence
 */
export async function getCurrentBalance() {
  const today = new Date().toISOString().split('T')[0];
  const snap = await db.dailyBalanceSnapshots.where('date').equals(today).first();
  if (snap) return snap.closingBalance;
  
  // Fallback: get latest snapshot
  const latest = await db.dailyBalanceSnapshots.orderBy('date').last();
  return latest ? latest.closingBalance : 0;
}

/**
 * Rolling Financial Overview Data Aggregation.
 * Returns 12 months of Income and Expense data:
 * - 9 months history (actuals)
 * - Current month (actuals so far + projected remainder)
 * - 2 months forecast (recurring income + recurring expenses)
 *
 * @param {string} targetMonth - YYYY-MM string of the current month
 * @returns {Promise<Object>} { labels, income, expenses, currentMonthIndex }
 */
export async function getRollingFinancialData(targetMonth) {
  const [year, month] = targetMonth.split('-').map(Number);
  const today = new Date().toISOString().split('T')[0];
  const labels = [];
  const income = [];
  const expenses = [];
  
  // Calculate the 12-month window: 9 before, 1 current, 2 after
  for (let i = -9; i <= 2; i++) {
    const d = new Date(year, month - 1 + i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    labels.push(monthStr);
  }

  const sum = (arr) => arr.reduce((acc, r) => acc + (r.amount || 0), 0);

  for (const monthStr of labels) {
    let incTotal = 0;
    let expTotal = 0;

    if (monthStr < targetMonth) {
      // Past: Actuals only
      const [incList, recurrentList, oneOffList] = await Promise.all([
        db.income.where('date').startsWith(monthStr).toArray(),
        db.recurrentExpenses.where('nextDate').startsWith(monthStr).toArray(),
        db.oneOffExpenses.where('date').startsWith(monthStr).toArray()
      ]);
      incTotal = sum(incList);
      expTotal = sum(recurrentList) + sum(oneOffList);
    } else if (monthStr === targetMonth) {
      // Current: Hybrid
      // Income: Actuals so far + Expected Income for remainder of month
      const [actualInc, expectedIncRemainder] = await Promise.all([
        db.income.where('date').between(`${monthStr}-01`, today, true, true).toArray(),
        db.expectedIncome.where('date').between(today, `${monthStr}-31`, false, true).toArray()
      ]);
      
      // Expenses: All recurrent for this month + all one-offs for this month
      // (Since RecurrenceManager ensures current month is populated)
      const [recurrentList, oneOffList] = await Promise.all([
        db.recurrentExpenses.where('nextDate').startsWith(monthStr).toArray(),
        db.oneOffExpenses.where('date').startsWith(monthStr).toArray()
      ]);
      
      incTotal = sum(actualInc) + sum(expectedIncRemainder);
      expTotal = sum(recurrentList) + sum(oneOffList);
    } else {
      // Future: Forecast
      const [expectedInc, recurrentList, oneOffList] = await Promise.all([
        db.expectedIncome.where('date').startsWith(monthStr).toArray(),
        db.recurrentExpenses.where('nextDate').startsWith(monthStr).toArray(),
        db.oneOffExpenses.where('date').startsWith(monthStr).toArray()
      ]);
      
      incTotal = sum(expectedInc);
      expTotal = sum(recurrentList) + sum(oneOffList);
    }

    income.push(incTotal);
    expenses.push(expTotal);
  }

  return { labels, income, expenses, currentMonthIndex: 9 };
}

/**
 * Spending Trends Aggregation - last 12 months from targetMonth.
 * @param {string} targetMonth - YYYY-MM
 */
export async function getSpendingTrends(targetMonth) {
  const [year, month] = targetMonth.split('-').map(Number);
  const results = [];

  for (let i = -11; i <= 0; i++) {
    const d = new Date(year, month - 1 + i, 1);
    const monthStr = d.toISOString().slice(0, 7);

    const [incList, recurrentList, oneOffList] = await Promise.all([
      db.income.where('date').startsWith(monthStr).toArray(),
      db.recurrentExpenses.where('nextDate').startsWith(monthStr).toArray(),
      db.oneOffExpenses.where('date').startsWith(monthStr).toArray()
    ]);

    results.push({
      month: monthStr,
      income: incList.reduce((sum, r) => sum + (r.amount || 0), 0),
      fixed: recurrentList.reduce((sum, r) => sum + (r.amount || 0), 0),
      variable: oneOffList.reduce((sum, r) => sum + (r.amount || 0), 0)
    });
  }
  return results;
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
 * Daily Balance Snapshot Repository
 */
export const dailyBalanceRepository = {
  async getAll() { return await db.dailyBalanceSnapshots.orderBy('date').toArray(); },
  async getByDate(date) { return await db.dailyBalanceSnapshots.where('date').equals(date).first(); },
  async save(snapshot) {
    const existing = await db.dailyBalanceSnapshots.where('date').equals(snapshot.date).first();
    if (existing) {
      await db.dailyBalanceSnapshots.update(existing.id, snapshot);
    } else {
      await db.dailyBalanceSnapshots.add(snapshot);
    }
    triggerSync();
  }
};

/**
 * Expected Income Repository
 */
export const expectedIncomeRepository = {
  ...createBaseRepository(db.expectedIncome, ['amount']),
  async getByMonth(monthStr) {
    return await db.expectedIncome.where('date').startsWith(monthStr).toArray();
  }
};

/**
 * Bank Holiday Overrides Repository
 */
export const bankHolidayRepository = {
  ...createBaseRepository(db.bankHolidayOverrides),
  async getAll() { return await db.bankHolidayOverrides.toArray(); },
  async getOverride(date) {
    return await db.bankHolidayOverrides.where('date').equals(date).first();
  },
  /**
   * Returns true/false if explicitly overridden, otherwise null.
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<boolean|null>} null if no override, otherwise the isOpen value.
   */
  async isOverrideActive(date) {
    const override = await this.getOverride(date);
    return override ? !!override.isOpen : null;
  }
};

/**
 * Adjust the account balance by creating a balancing transaction.
 * Calculates delta between enteredAmountPence and currently projected balance for date.
 *
 * @param {number} enteredAmountPence
 * @param {string} date - YYYY-MM-DD
 */
export async function adjustBalance(enteredAmountPence, date) {
  const snapshots = await dailyBalanceRepository.getAll();
  const snap = snapshots.find(s => s.date === date);
  const currentBalance = snap ? snap.closingBalance : 0;
  
  const diff = enteredAmountPence - currentBalance;
  if (Math.abs(diff) < 1) return; // No change needed

  const category = await db.categories.where('name').equals('Opening Balance').first();
  const categoryId = category ? category.id : null;

  if (diff > 0) {
    await incomeRepository.add({
      date,
      source: 'Balance Adjustment',
      amount: diff / 100,
      categoryId
    });
  } else {
    await oneOffExpenseRepository.add({
      date,
      note: 'Balance Adjustment',
      amount: Math.abs(diff) / 100,
      categoryId
    });
  }

  await triggerBalanceRecalc(date);
}

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
   * Get a specific childcare account by ID.
   * @param {number} id
   * @returns {Promise<Object|undefined>}
   */
  async getAccount(id) {
    return await db.childcareAccounts.get(id);
  },

  /**
   * Add or update a childcare account.
   * @param {Object} account - { id?, childName, targetMonthlySpend, entitlementStart, openingBalance }
   * @returns {Promise<number>} The record id.
   */
  async saveAccount(account) {
    const toSave = {
      ...account,
      targetMonthlySpend: toPence(account.targetMonthlySpend),
      openingBalance: toPence(account.openingBalance || 0)
    };

    let id;
    if (toSave.id) {
      await db.childcareAccounts.update(toSave.id, toSave);
      id = toSave.id;
    } else {
      id = await db.childcareAccounts.add({
        ...toSave,
        isDisabled: false
      });
    }

    // Always trigger a balance recalc to ensure openingBalance is respected
    await this._recalculateBalances(id);
    triggerSync();
    return id;
  },

  /**
   * Delete a childcare account and all its ledger history.
   * @param {number} id - Account ID.
   */
  async deleteAccount(id) {
    await db.transaction('rw', [db.childcareAccounts, db.childcareLedger], async () => {
      await db.childcareLedger.where('accountId').equals(id).delete();
      await db.childcareAccounts.delete(id);
    });
    triggerSync();
  },

  // ---------------------------------------------------------------------------
  // Ledger operations
  // ---------------------------------------------------------------------------

  /**
   * Get the full ledger for an account, sorted by date.
   */
  async getLedger(accountId) {
    return await db.childcareLedger
      .where('accountId').equals(accountId)
      .sortBy('date');
  },

  /**
   * Get the current running balance for an account.
   */
  async getBalance(accountId) {
    const account = await db.childcareAccounts.get(accountId);
    const lastEntry = await db.childcareLedger
      .where('accountId').equals(accountId)
      .reverse()
      .sortBy('date')
      .then(entries => entries[0]);
    
    return lastEntry ? lastEntry.runningBalance : (account?.openingBalance || 0);
  },

  /**
   * Adds a ledger entry and recalculates subsequent balances.
   */
  async addLedgerEntry(entry) {
    const id = await db.childcareLedger.add({
      ...entry,
      amount: toPence(entry.amount)
    });
    await this._recalculateBalances(entry.accountId);
    triggerSync();
    return id;
  },

  /**
   * Removes a ledger entry and recalculates subsequent balances.
   */
  async deleteLedgerEntry(id, accountId) {
    await db.childcareLedger.delete(id);
    await this._recalculateBalances(accountId);
    triggerSync();
  },

  /**
   * Internal helper to re-compute the running balance chain for an account.
   * Starts from the account's openingBalance.
   */
  async _recalculateBalances(accountId) {
    const account = await db.childcareAccounts.get(accountId);
    const entries = await db.childcareLedger
      .where('accountId').equals(accountId)
      .sortBy('date');

    let currentBalance = account?.openingBalance || 0;
    for (const entry of entries) {
      if (entry.type === 'deposit') {
        currentBalance += entry.amount;
      } else {
        currentBalance -= entry.amount;
      }
      await db.childcareLedger.update(entry.id, { runningBalance: currentBalance });
    }
  }
};
