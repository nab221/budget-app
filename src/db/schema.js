import Dexie from 'dexie';
import { generateUUID } from '../utils/security.js';

/**
 * BudgetConsoleDB
 * 
 * IndexedDB database for budget data using Dexie.js.
 * Stores all financial records as integer pence to avoid floating-point errors.
 */
export const db = new Dexie('BudgetConsoleDB');

// Define version 1 schema (for reference and upgrade path)
db.version(1).stores({
  income: '++id, date, source, amount, categoryId',
  fixedSpends: '++id, date, name, amount, categoryId',
  variableSpends: '++id, date, name, amount, categoryId',
  subscriptions: '++id, name, amount, categoryId',
  debts: '++id, name, amount',
  statements: '++id, date, source, amount',
  assets: '++id, name, value, type',
  categories: '++id, name, group'
});

// Define version 2 schema with refined fields and new entities
db.version(2).stores({
  income: '++id, date, source, amount, categoryId',
  fixedSpends: '++id, date, categoryId, label, amount, status',
  variableSpends: '++id, date, categoryId, note, amount',
  subscriptions: '++id, name, amount, categoryId, frequency, nextDate',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance',
  statements: '++id, debtId, date, amount, interest, fees',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group'
}).upgrade(async tx => {
  // Upgrade fixedSpends: rename name to label, add default status
  await tx.table('fixedSpends').toCollection().modify(spend => {
    spend.label = spend.name;
    delete spend.name;
    if (!spend.status) {
      spend.status = 'pending';
    }
  });

  // Upgrade variableSpends: rename name to note
  await tx.table('variableSpends').toCollection().modify(spend => {
    spend.note = spend.name;
    delete spend.name;
  });

  // Basic cleanup/update for other tables that might have data
  // debts: v1 only had 'name' and 'amount'
  await tx.table('debts').toCollection().modify(debt => {
    if (debt.amount !== undefined) {
      debt.currentBalance = debt.amount;
      delete debt.amount;
    }
    if (!debt.type) debt.type = 'credit_card';
    if (!debt.apr) debt.apr = 0;
    if (!debt.creditLimit) debt.creditLimit = 0;
  });

  // assets: v1 had 'value' and 'type'
  await tx.table('assets').toCollection().modify(asset => {
    if (asset.value !== undefined) {
      asset.currentBalance = asset.value;
      delete asset.value;
    }
    if (!asset.asOfDate) asset.asOfDate = new Date().toISOString().split('T')[0];
  });
});

// NOTE: Version 3 was intentionally skipped during development.
// A partial schema iteration was started and then abandoned before release; the
// version number was already consumed locally, so the next shipped version is 4.
// Dexie.js handles this gap transparently — existing v2 databases upgrade
// directly to v4, which is safe per Dexie semantics (no v3 upgrade() path runs).

// Define version 4 schema with category mappings for PDF import learning
db.version(4).stores({
  income: '++id, date, source, amount, categoryId',
  fixedSpends: '++id, date, categoryId, label, amount, status',
  variableSpends: '++id, date, categoryId, note, amount',
  subscriptions: '++id, name, amount, categoryId, frequency, nextDate',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance',
  statements: '++id, debtId, date, amount, interest, fees',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, categoryId, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId'
});

// Define version 5 schema: consolidated expense model
// Replaces fixedSpends, variableSpends, and subscriptions with recurrentExpenses and oneOffExpenses.
// The deprecated tables are omitted from version 5 stores so Dexie marks them for deletion.
db.version(5).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, isEssential, cycleTotal, cycleCurrent, endDate',
  oneOffExpenses: '++id, date, categoryId, note, amount',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance',
  statements: '++id, debtId, date, amount, interest, fees',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, categoryId, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId'
});

// Define version 6 schema: bucket-based budget targets
// Transitions targets from per-category to two buckets: 'recurrent' and 'one-off'.
// Existing per-category targets are dropped (no migration needed — fresh config).
db.version(6).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, isEssential, cycleTotal, cycleCurrent, endDate',
  oneOffExpenses: '++id, date, categoryId, note, amount',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance',
  statements: '++id, debtId, date, amount, interest, fees',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId'
}).upgrade(async tx => {
  // Clear old category-based targets — they are incompatible with bucket model.
  await tx.table('targets').clear();
});

// Define version 7 schema: Tax-Free Childcare tracking
// Adds childcareAccounts and childcareLedger tables for dedicated TFC tracking.
// childcareLedger is indexed by accountId for efficient per-account queries.
db.version(7).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, isEssential, cycleTotal, cycleCurrent, endDate',
  oneOffExpenses: '++id, date, categoryId, note, amount',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance',
  statements: '++id, debtId, date, amount, interest, fees',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance'
});

// Define version 8 schema: Advanced Debt Tracking
// Adds promoEndDate and postPromoApr for better payoff simulation accuracy.
db.version(8).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, isEssential, cycleTotal, cycleCurrent, endDate',
  oneOffExpenses: '++id, date, categoryId, note, amount',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance, promoEndDate, postPromoApr',
  statements: '++id, debtId, date, amount, interest, fees',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance'
}).upgrade(async tx => {
  // Initialize promo fields for existing debts
  await tx.table('debts').toCollection().modify(debt => {
    if (debt.promoEndDate === undefined) debt.promoEndDate = null;
    if (debt.postPromoApr === undefined) debt.postPromoApr = debt.apr || 0;
  });
});

// Define version 9 schema: Account Balance Carry-Forward
// Adds balanceSnapshots table for tracking monthly opening/closing balances.
// Snapshots are indexed by month (YYYY-MM) for fast lookup.
db.version(9).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, isEssential, cycleTotal, cycleCurrent, endDate',
  oneOffExpenses: '++id, date, categoryId, note, amount',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance, promoEndDate, postPromoApr',
  statements: '++id, debtId, date, amount, interest, fees',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal'
});

// Define version 10 schema: Daily Cash Flow Engine
// Adds dailyBalanceSnapshots, expectedIncome, and bankHolidayOverrides tables.
// Adds predictedPaymentDate to recurrentExpenses for fine-grained forecasting.
db.version(10).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate',
  oneOffExpenses: '++id, date, categoryId, note, amount',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance, promoEndDate, postPromoApr',
  statements: '++id, debtId, date, amount, interest, fees',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  // Initialize predictedPaymentDate for existing recurrent expenses
  await tx.table('recurrentExpenses').toCollection().modify(item => {
    if (item.predictedPaymentDate === undefined) {
      item.predictedPaymentDate = item.nextDate || item.date;
    }
  });
});

// Define version 11 schema: Enhanced Debt Management
// Adds openingBalance, minimumPayment, paymentDueDate, actualPaymentAmount,
// actualPaymentDate, and linkedExpenseId to statements.
// Adds isDebtPayment and linkedStatementId to recurrentExpenses.
db.version(11).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId',
  oneOffExpenses: '++id, date, categoryId, note, amount',
  recurringTemplates: '++id, name, amount, categoryId, frequency, type',
  debts: '++id, name, type, apr, creditLimit, currentBalance, promoEndDate, postPromoApr',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  // Initialize new fields for existing statements
  await tx.table('statements').toCollection().modify(statement => {
    if (statement.openingBalance === undefined) statement.openingBalance = 0;
    if (statement.minimumPayment === undefined) statement.minimumPayment = 0;
    if (statement.paymentDueDate === undefined) statement.paymentDueDate = null;
    if (statement.actualPaymentAmount === undefined) statement.actualPaymentAmount = null;
    if (statement.actualPaymentDate === undefined) statement.actualPaymentDate = null;
    if (statement.linkedExpenseId === undefined) statement.linkedExpenseId = null;
  });

  // Initialize new fields for existing recurrent expenses
  await tx.table('recurrentExpenses').toCollection().modify(expense => {
    if (expense.isDebtPayment === undefined) expense.isDebtPayment = false;
    if (expense.linkedStatementId === undefined) expense.linkedStatementId = null;
  });
});

// Define version 12 schema: Automated Recurring Transactions
// Transitions recurringTemplates to recurrentExpenses and adds recurrence metadata.
db.version(12).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate',
  recurringTemplates: null, // Mark for deletion
  debts: '++id, name, type, apr, creditLimit, currentBalance, promoEndDate, postPromoApr',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  // 1. Update existing recurrentExpenses with defaults
  await tx.table('recurrentExpenses').toCollection().modify(item => {
    if (item.isRecurring === undefined) item.isRecurring = true;
    if (item.frequency === undefined) item.frequency = 'monthly';
    if (item.recurrenceId === undefined) item.recurrenceId = generateUUID();
    if (item.parentDate === undefined) item.parentDate = item.date || item.nextDate;
  });

  // 2. Update existing oneOffExpenses with defaults
  await tx.table('oneOffExpenses').toCollection().modify(item => {
    if (item.isRecurring === undefined) item.isRecurring = false;
    if (item.frequency === undefined) item.frequency = null;
    if (item.recurrenceId === undefined) item.recurrenceId = null;
    if (item.parentDate === undefined) item.parentDate = null;
  });

  // 3. Migrate recurringTemplates to recurrentExpenses
  const templates = await tx.table('recurringTemplates').toArray();
  const now = new Date();
  
  for (const template of templates) {
    const recurrenceId = generateUUID();
    // Start from the current month
    const firstInstanceDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const parentDateStr = firstInstanceDate.toISOString().split('T')[0];
    
    for (let i = 0; i < 12; i++) {
      const instanceDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const dateStr = instanceDate.toISOString().split('T')[0];
      
      await tx.table('recurrentExpenses').add({
        date: dateStr,
        categoryId: template.categoryId,
        label: template.name,
        amount: template.amount,
        status: 'pending',
        frequency: template.frequency || 'monthly',
        nextDate: dateStr,
        predictedPaymentDate: dateStr,
        isEssential: true,
        isRecurring: true,
        recurrenceId: recurrenceId,
        parentDate: parentDateStr,
        isDebtPayment: false,
        linkedStatementId: null
      });
    }
  }
});

// Define version 13 schema: Debt Type Separation
// Adds debtType, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate,
// earlyRepaymentFee, earlyRepaymentFeeIsPercent, and earlyRepaymentAllowed to debts.
db.version(13).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  // 1. Migrate existing debts to new debtType field and initialize new fields
  await tx.table('debts').toCollection().modify(debt => {
    // Map old 'type' (often using underscore) to new 'debtType' (hyphenated)
    if (debt.type) {
      if (debt.type === 'credit_card') debt.debtType = 'credit-card';
      else if (debt.type === 'loan') debt.debtType = 'loan';
      else if (debt.type === 'mortgage') debt.debtType = 'mortgage';
      else debt.debtType = 'credit-card'; // fallback
      delete debt.type;
    } else if (!debt.debtType) {
      debt.debtType = 'credit-card';
    }

    // Initialize new loan/mortgage fields if undefined
    if (debt.originalPrincipal === undefined) debt.originalPrincipal = debt.currentBalance || 0;
    if (debt.termMonths === undefined) debt.termMonths = 0;
    if (debt.fixedMonthlyPayment === undefined) debt.fixedMonthlyPayment = 0;
    if (debt.interestRate === undefined) debt.interestRate = debt.apr || 0;
    if (debt.earlyRepaymentFee === undefined) debt.earlyRepaymentFee = 0;
    if (debt.earlyRepaymentFeeIsPercent === undefined) debt.earlyRepaymentFeeIsPercent = false;
    if (debt.earlyRepaymentAllowed === undefined) debt.earlyRepaymentAllowed = true;
  });

  // 2. Add debtType to existing recurrentExpenses that are debt payments
  await tx.table('recurrentExpenses').toCollection().modify(item => {
    if (item.isDebtPayment && !item.debtType) {
      // Default to credit-card for legacy items; actual refresh happens on next render/recalc
      item.debtType = 'credit-card';
    }
  });
});

// Define version 14 schema: Childcare UX Improvements
// Adds openingBalance to childcareAccounts.
db.version(14).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  // 1. Initialize openingBalance for existing childcare accounts
  await tx.table('childcareAccounts').toCollection().modify(account => {
    if (account.openingBalance === undefined) {
      account.openingBalance = 0;
    }
  });
});

// Define version 15 schema: Advanced Debt Payoff Logic
// Adds isInterestOnly to debts.
db.version(15).stores({
  income: '++id, date, source, amount, categoryId',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  // 1. Initialize isInterestOnly for existing debts
  await tx.table('debts').toCollection().modify(debt => {
    if (debt.isInterestOnly === undefined) {
      debt.isInterestOnly = false;
    }
  });
});

// Define version 16 schema: Integrity (Reconciliation)
// Adds isCleared and isReconciled to income and expenses.
db.version(16).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate, isCleared, isReconciled',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  // 1. Initialize isCleared and isReconciled for existing income
  await tx.table('income').toCollection().modify(item => {
    if (item.isCleared === undefined) item.isCleared = false;
    if (item.isReconciled === undefined) item.isReconciled = false;
  });

  // 2. Initialize isCleared and isReconciled for existing recurrentExpenses
  await tx.table('recurrentExpenses').toCollection().modify(item => {
    if (item.isCleared === undefined) item.isCleared = false;
    if (item.isReconciled === undefined) item.isReconciled = false;
  });

  // 3. Initialize isCleared and isReconciled for existing oneOffExpenses
  await tx.table('oneOffExpenses').toCollection().modify(item => {
    if (item.isCleared === undefined) item.isCleared = false;
    if (item.isReconciled === undefined) item.isReconciled = false;
  });
});

db.version(17).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate, isCleared, isReconciled',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
});
// No upgrade() needed — Dexie auto-indexes the existing data.

db.version(18).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate, isCleared, isReconciled',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  const categories = tx.table('categories');

  await categories.toCollection().modify(category => {
    if (category.group === 'fixed' || category.group === 'variable') {
      category.group = 'expenses';
    }
  });

  const incomeCount = await categories.where('group').equals('income').count();
  if (incomeCount === 0) {
    await categories.add({ name: 'Salary', group: 'income' });
  }
});

db.version(19).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId, paymentAdjustment',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate, isCleared, isReconciled',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  await tx.table('recurrentExpenses').toCollection().modify(item => {
    if (item.paymentAdjustment === undefined) item.paymentAdjustment = 'none';
  });
});

db.version(20).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId, paymentAdjustment',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate, isCleared, isReconciled',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly, paymentDayOfMonth',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen'
}).upgrade(async tx => {
  await tx.table('debts').toCollection().modify(d => {
    if (d.paymentDayOfMonth === undefined) d.paymentDayOfMonth = 1;
  });
});

// Define version 21 schema: Income Sources & Spending Buckets (Phase 33)
// Adds incomeSources for per-source payday configuration and spendingBuckets
// for estimated-outgoing configuration used by Phase 34 affordability engine.
// Both stores are covered by the existing generic db.tables snapshot path in
// supabase-sync.js and require no allowlist registration.
db.version(21).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId, paymentAdjustment',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate, isCleared, isReconciled',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly, paymentDayOfMonth',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen',
  incomeSources: '++id, name, monthlyAmount, payDateRule, payDateDay, isActive, displayOrder',
  spendingBuckets: '++id, name, monthlyAmount, icon, displayOrder'
});
// No upgrade() needed — new tables start empty; default bucket seeding handled in repository.

// Define version 22 schema: Pay-Period Affordability Settings (Phase 34)
// Adds userPreferences key-value table for persisted affordability settings.
// The initial use is safetyBuffer (integer pence, default 20000 = £200).
// Covered by the existing generic db.tables snapshot path in supabase-sync.js —
// no allowlist registration required.
db.version(22).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId, paymentAdjustment',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate, isCleared, isReconciled',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly, paymentDayOfMonth',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen',
  incomeSources: '++id, name, monthlyAmount, payDateRule, payDateDay, isActive, displayOrder',
  spendingBuckets: '++id, name, monthlyAmount, icon, displayOrder',
  userPreferences: '&key, value'
});
// No upgrade() needed — userPreferences starts empty; defaults applied at read time.

// Define version 23 schema: Childcare Providers (Phase 35)
// Adds childcareProviders store for account-scoped provider records.
// Each provider record captures name, billing frequency (monthly/termly),
// and the relevant amount fields for monthly-equivalent calculation.
// Covered by the existing generic db.tables snapshot path in supabase-sync.js —
// no allowlist registration required (TECH-06 compliant).
db.version(23).stores({
  income: '++id, date, source, amount, categoryId, isCleared, isReconciled',
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId, paymentAdjustment',
  oneOffExpenses: '++id, date, categoryId, note, amount, isRecurring, frequency, recurrenceId, parentDate, isCleared, isReconciled',
  debts: '++id, name, debtType, apr, creditLimit, currentBalance, promoEndDate, postPromoApr, originalPrincipal, termMonths, fixedMonthlyPayment, interestRate, earlyRepaymentFee, earlyRepaymentFeeIsPercent, earlyRepaymentAllowed, isInterestOnly, paymentDayOfMonth',
  statements: '++id, debtId, date, amount, interest, fees, actualPaymentDate, linkedExpenseId',
  assets: '++id, name, type, asOfDate, currentBalance',
  categories: '++id, name, group',
  targets: '++id, bucket, amount',
  netWorthSnapshots: '++id, month, totalAssets, totalDebt, netWorth',
  categoryMappings: '++id, description, categoryId',
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled, openingBalance',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance',
  balanceSnapshots: '++id, month, openingBalance, closingBalance, incomeTotal, expenseTotal',
  dailyBalanceSnapshots: '++id, date, openingBalance, closingBalance, incomeTotal, expenseTotal',
  expectedIncome: '++id, date, source, amount, categoryId, status',
  bankHolidayOverrides: '++id, date, isOpen',
  incomeSources: '++id, name, monthlyAmount, payDateRule, payDateDay, isActive, displayOrder',
  spendingBuckets: '++id, name, monthlyAmount, icon, displayOrder',
  userPreferences: '&key, value',
  childcareProviders: '++id, accountId, name, frequency'
});
// No upgrade() needed — childcareProviders starts empty.
// Schema notes: frequency = 'monthly' | 'termly'
// monthly providers: monthlyEquivalentPence stored directly
// termly providers: termlyAmountPence stored (monthlyEquivalent = termlyAmountPence / 3)
// pendingGovernmentBonusPence: optional field for unconfirmed gov bonus credit

// Handle schema updates in other tabs
db.on('versionchange', function() {
  db.close();
  // Refresh the page to use the new schema if possible
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
});

// Handle blocked upgrades
db.on('blocked', function() {
  if (typeof window !== 'undefined') {
    alert('A database upgrade is pending. Please close other tabs of this app to continue.');
  }
});

export default db;
