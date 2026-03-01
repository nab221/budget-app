import Dexie from 'dexie';

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
