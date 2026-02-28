import Dexie from 'dexie';

/**
 * BudgetConsoleDB
 * 
 * IndexedDB database for budget data using Dexie.js.
 * Stores all financial records as integer pence to avoid floating-point errors.
 */
export const db = new Dexie('BudgetConsoleDB');

// Define version 1 schema
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

// Handle schema updates in other tabs
db.on('versionchange', function() {
  db.close();
  // Refresh the page to use the new schema
  window.location.reload();
});

// Handle blocked upgrades
db.on('blocked', function() {
  alert('A database upgrade is pending. Please close other tabs of this app to continue.');
});

export default db;
