import { db } from './schema.js';
import { generateUUID } from '../utils/security.js';
import { toPence, fromPence } from '../utils/currency.js';
import { findBestMatch } from '../utils/string-similarity.js';
import { calculateTopUp, getEntitlementPeriod, calculateFundingGap } from '../utils/childcare.js';
import { calcMinPayment, calculateBalanceChain, simulatePayoff } from '../utils/finance.js';
export { calcMinPayment, calculateBalanceChain, simulatePayoff };
import { advanceNextDate } from '../utils/recurrence.js';

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
function createBaseRepository(table, penceFields = [], defaults = {}) {
  return {
    async getAll() { return await table.toArray(); },
    async get(id) { return await table.get(id); },
    async add(data) {
      const toSave = { ...defaults, ...data };
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

const integrityDefaults = { isCleared: false, isReconciled: false };

export const incomeRepository = {
  ...createBaseRepository(db.income, ['amount'], integrityDefaults),
  async getByMonth(monthStr) {
    return await db.income.where('date').startsWith(monthStr).toArray();
  },
  async getThreeMonthHistory(currentMonthStr) {
    const [year, month] = currentMonthStr.split('-').map(Number);
    // Calculate the start of the 3-month window (3 months before currentMonthStr)
    const startDate = new Date(year, month - 4, 1);
    const endDate = new Date(year, month - 1, 0); // Last day of previous month
    
    const startStr = startDate.toISOString().slice(0, 10);
    const endStr = endDate.toISOString().slice(0, 10);
    
    return await db.income.where('date').between(startStr, endStr, true, true).toArray();
  }
};
export const recurrentExpenseRepository = {
  ...createBaseRepository(db.recurrentExpenses, ['amount'], integrityDefaults),
  async add(data) {
    const base = createBaseRepository(db.recurrentExpenses, ['amount'], integrityDefaults);
    const id = await base.add(data);
    const date = data.nextDate || data.date || new Date().toISOString().slice(0, 10);
    triggerBalanceRecalc(date).catch(() => {});
    return id;
  },
  async update(id, data) {
    const base = createBaseRepository(db.recurrentExpenses, ['amount'], integrityDefaults);
    const existing = await this.get(id);
    await base.update(id, data);
    const date = data.nextDate || data.date || (existing ? (existing.nextDate || existing.date) : null) || new Date().toISOString().slice(0, 10);
    triggerBalanceRecalc(date).catch(() => {});
    return 1;
  },
  async delete(id) {
    const base = createBaseRepository(db.recurrentExpenses, ['amount'], integrityDefaults);
    const existing = await this.get(id);
    await base.delete(id);
    if (existing) {
      const date = existing.nextDate || existing.date || new Date().toISOString().slice(0, 10);
      triggerBalanceRecalc(date).catch(() => {});
    }
  },
  async getByMonth(monthStr) {
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
      const { nextDate: newNextDate, cycleCurrent: newCycleCurrent } = advanceNextDate(item);
      await db.recurrentExpenses.update(item.id, {
        status: 'paid',
        nextDate: newNextDate,
        cycleCurrent: newCycleCurrent
      });
    }
    triggerSync();
  },
  async bulkAdd(items) {
    const toSave = items.map(i => ({
      ...integrityDefaults,
      ...i,
      amount: toPence(i.amount)
    }));
    await db.recurrentExpenses.bulkAdd(toSave);
    triggerSync();
  }
};

export const oneOffExpenseRepository = {
  ...createBaseRepository(db.oneOffExpenses, ['amount'], integrityDefaults),
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
  
  async addWithExpense(data, debtName) {
    const penceFields = ['amount', 'interest', 'fees', 'openingBalance', 'minimumPayment'];
    const toSave = { ...data };
    penceFields.forEach(f => { if (toSave[f] !== undefined) toSave[f] = toPence(toSave[f]); });

    return await db.transaction('rw', [db.statements, db.recurrentExpenses, db.categories], async () => {
      const stmtId = await db.statements.add(toSave);

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

      await db.statements.update(stmtId, { linkedExpenseId: expenseId });
      
      triggerSync();
      return stmtId;
    });
  },

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

  async recordPayment(stmtId, amountPounds, paymentDate) {
    const amountPence = toPence(amountPounds);
    const statement = await db.statements.get(stmtId);
    if (!statement) throw new Error('Statement not found');

    return await db.transaction('rw', [db.statements, db.recurrentExpenses], async () => {
      await db.statements.update(stmtId, {
        actualPaymentAmount: amountPence,
        actualPaymentDate: paymentDate
      });

      if (statement.linkedExpenseId) {
        const expense = await db.recurrentExpenses.get(statement.linkedExpenseId);
        const { nextDate: newNextDate, cycleCurrent: newCycleCurrent } = advanceNextDate(expense);
        await db.recurrentExpenses.update(statement.linkedExpenseId, {
          status: 'paid',
          amount: amountPence,
          cycleCurrent: newCycleCurrent,
          date: paymentDate,
          nextDate: newNextDate
        });
      }
      
      triggerSync();
    });
  },

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

/**
 * PDF Import Repository Functions
 */

/**
 * Finds potential duplicate transactions across income, recurrentExpenses, and oneOffExpenses.
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

export const targetRepository = {
  ...createBaseRepository(db.targets, ['amount']),
  async getByBucket(bucketName) {
    return await db.targets.where('bucket').equals(bucketName).first();
  }
};

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

  const categorySpending = {};
  [...recurrentList, ...oneOffList].forEach(r => {
    const catId = r.categoryId || 0;
    categorySpending[catId] = (categorySpending[catId] || 0) + (r.amount || 0);
  });

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
    totalSubscriptions: 0, 
    totalDebt,
    totalAssets,
    netWorth: totalAssets - totalDebt,
    fixedToIncomeRatio: incomeTotal > 0 ? Math.round((recurrentTotal / incomeTotal) * 100) : 0,
    categorySpending,
    bucketSpending: {
      recurrent: recurrentTotal,
      'one-off': oneOffTotal
    },
    childcareSummary,
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
  
  const latest = await db.dailyBalanceSnapshots.orderBy('date').last();
  return latest ? latest.closingBalance : 0;
}

/**
 * Balance Snapshot Repository
 */
export const balanceSnapshotRepository = {
  async getByMonth(monthStr) {
    return await db.balanceSnapshots.where('month').equals(monthStr).first();
  },
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
  async getLatestSnapshot() {
    return await db.balanceSnapshots.orderBy('month').last();
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
  },
  async getLatestSnapshot() {
    return await db.dailyBalanceSnapshots.orderBy('date').last();
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
  async isOverrideActive(date) {
    const override = await this.getOverride(date);
    return override ? !!override.isOpen : null;
  }
};

/**
 * Adjust the account balance by creating a balancing transaction.
 */
export async function adjustBalance(enteredAmountPence, date) {
  const snapshots = await dailyBalanceRepository.getAll();
  const snap = snapshots.find(s => s.date === date);
  const currentBalance = snap ? snap.closingBalance : 0;
  
  const diff = enteredAmountPence - currentBalance;
  if (Math.abs(diff) < 1) return; 

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
 */
export const childcareRepository = {
  async getAccounts() {
    return await db.childcareAccounts.toArray();
  },
  async getAccount(id) {
    return await db.childcareAccounts.get(id);
  },
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

    await this._recalculateBalances(id);
    triggerSync();
    return id;
  },
  async deleteAccount(id) {
    await db.transaction('rw', [db.childcareAccounts, db.childcareLedger], async () => {
      await db.childcareLedger.where('accountId').equals(id).delete();
      await db.childcareAccounts.delete(id);
    });
    triggerSync();
  },
  async getLedger(accountId) {
    return await db.childcareLedger
      .where('accountId').equals(accountId)
      .sortBy('date');
  },
  async getBalance(accountId) {
    const account = await db.childcareAccounts.get(accountId);
    const lastEntry = await db.childcareLedger
      .where('accountId').equals(accountId)
      .reverse()
      .sortBy('date')
      .then(entries => entries[0]);
    
    return lastEntry ? lastEntry.runningBalance : (account?.openingBalance || 0);
  },
  async addLedgerEntry(entry) {
    const id = await db.childcareLedger.add({
      ...entry,
      amount: toPence(entry.amount)
    });
    await this._recalculateBalances(entry.accountId);
    triggerSync();
    return id;
  },
  async deleteLedgerEntry(id, accountId) {
    await db.childcareLedger.delete(id);
    await this._recalculateBalances(accountId);
    triggerSync();
  },
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

/**
 * Aggregates daily spending for a specific year for heatmap visualization.
 * @param {string|number} year 
 * @returns {Promise<Object>} Map of date string (YYYY-MM-DD) to daily stats
 */
export async function getYearlyDailySpending(year) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [oneOff, recurrent, categories] = await Promise.all([
    db.oneOffExpenses.where('date').between(start, end, true, true).toArray(),
    db.recurrentExpenses.toArray(),
    db.categories.toArray()
  ]);

  const catMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.name;
    return acc;
  }, {});

  const dailyData = {};

  // Process one-off expenses
  oneOff.forEach(exp => {
    const date = exp.date;
    if (!date) return;
    if (!dailyData[date]) {
      dailyData[date] = { total: 0, categories: {} };
    }
    const amount = exp.amount || 0;
    dailyData[date].total += amount;
    const catName = catMap[exp.categoryId] || 'Uncategorized';
    dailyData[date].categories[catName] = (dailyData[date].categories[catName] || 0) + amount;
  });

  // Process paid recurrent expenses using the actual paid occurrence date.
  recurrent.filter(exp => exp.status === 'paid').forEach(exp => {
    const date = exp.date || exp.nextDate;
    if (!date || date < start || date > end) return;
    if (!dailyData[date]) {
      dailyData[date] = { total: 0, categories: {} };
    }
    const amount = exp.amount || 0;
    dailyData[date].total += amount;
    const catName = catMap[exp.categoryId] || 'Uncategorized';
    dailyData[date].categories[catName] = (dailyData[date].categories[catName] || 0) + amount;
  });

  // Finalize data structure: find top category per day
  const result = {};
  Object.keys(dailyData).forEach(date => {
    const day = dailyData[date];
    let topCategory = 'None';
    let topCategoryAmount = 0;

    Object.keys(day.categories).forEach(cat => {
      if (day.categories[cat] > topCategoryAmount) {
        topCategory = cat;
        topCategoryAmount = day.categories[cat];
      }
    });

    result[date] = {
      total: day.total,
      topCategory,
      topCategoryAmount
    };
  });

  return result;
}

/**
 * Aggregates daily income for a specific year for heatmap visualization.
 * @param {string|number} year
 * @returns {Promise<Object>} Map of date string (YYYY-MM-DD) to daily stats
 */
export async function getYearlyDailyIncome(year) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [incomeRows, categories] = await Promise.all([
    db.income.where('date').between(start, end, true, true).toArray(),
    db.categories.toArray()
  ]);

  const catMap = categories.reduce((acc, cat) => {
    acc[cat.id] = cat.name;
    return acc;
  }, {});

  const dailyData = {};

  incomeRows.forEach(inc => {
    const date = inc.date;
    if (!date) return;

    if (!dailyData[date]) {
      dailyData[date] = { total: 0, categories: {} };
    }

    const amount = inc.amount || 0;
    dailyData[date].total += amount;

    const label = inc.source || catMap[inc.categoryId] || 'Uncategorized';
    dailyData[date].categories[label] = (dailyData[date].categories[label] || 0) + amount;
  });

  const result = {};
  Object.keys(dailyData).forEach(date => {
    const day = dailyData[date];
    let topCategory = 'None';
    let topCategoryAmount = 0;

    Object.keys(day.categories).forEach(cat => {
      if (day.categories[cat] > topCategoryAmount) {
        topCategory = cat;
        topCategoryAmount = day.categories[cat];
      }
    });

    result[date] = {
      total: day.total,
      topCategory,
      topCategoryAmount
    };
  });

  return result;
}
