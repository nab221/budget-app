/**
 * Phase 27: Data Integrity Validator
 *
 * Checks foreign-key relationships that Dexie does not enforce automatically.
 * Run on app startup (non-blocking) and after cloud pull to detect orphaned records.
 *
 * Public API:
 *   validateDataIntegrity() → Promise<{ valid: boolean, issues: Array<Issue> }>
 *   cleanOrphanedRecords(issues) → Promise<void>
 *
 * Issue shape: { store, recordId, field, referencedStore, missingId }
 */
import { db } from '../db/schema.js';

/**
 * FK relationships to validate.
 * nullable: true → skip records where field value is null/undefined.
 */
const FK_RULES = [
  { childStore: 'statements',        field: 'debtId',            parentStore: 'debts',             nullable: false },
  { childStore: 'childcareLedger',   field: 'accountId',         parentStore: 'childcareAccounts', nullable: false },
  { childStore: 'recurrentExpenses', field: 'linkedStatementId', parentStore: 'statements',        nullable: true  },
  { childStore: 'recurrentExpenses', field: 'categoryId',        parentStore: 'categories',        nullable: true  },
  { childStore: 'oneOffExpenses',    field: 'categoryId',        parentStore: 'categories',        nullable: true  },
  { childStore: 'income',            field: 'categoryId',        parentStore: 'categories',        nullable: true  },
  { childStore: 'categoryMappings',  field: 'categoryId',        parentStore: 'categories',        nullable: false },
];

/**
 * Check one FK relationship using Dexie bulkGet() for O(1) round-trips.
 * Returns an array of Issue objects for each orphaned record found.
 */
async function checkForeignKey(childStore, field, parentStore, nullable) {
  const issues = [];

  let children;
  try {
    // toArray() materialises the whole child table in memory; acceptable for
    // typical budget-app datasets, but revisit with chunking/streaming if a
    // deployment expects very large tables (10k+ rows).
    children = await db.table(childStore).toArray();
  } catch (err) {
    // Table may not exist in older schema versions — skip silently
    console.warn(`[data-integrity] Skipping ${childStore}: ${err.message}`);
    return issues;
  }

  // Collect unique non-null referenced IDs
  const ids = [
    ...new Set(
      children
        .map(r => r[field])
        .filter(id => (nullable ? id != null : true))
    ),
  ];

  if (ids.length === 0) return issues;

  let parents;
  try {
    parents = await db.table(parentStore).bulkGet(ids);
  } catch (err) {
    console.warn(`[data-integrity] bulkGet failed on ${parentStore}: ${err.message}`);
    return issues;
  }

  // Build a presence map: id → exists (boolean)
  const existsMap = new Map(ids.map((id, i) => [id, parents[i] !== undefined]));

  for (const record of children) {
    const refId = record[field];
    if (nullable && refId == null) continue;
    if (!existsMap.get(refId)) {
      issues.push({
        store: childStore,
        recordId: record.id,
        field,
        referencedStore: parentStore,
        missingId: refId,
      });
    }
  }

  return issues;
}

/**
 * Run all FK checks and return a consolidated result.
 * @returns {Promise<{ valid: boolean, issues: Array<{store, recordId, field, referencedStore, missingId}> }>}
 */
export async function validateDataIntegrity() {
  const allIssues = [];

  for (const rule of FK_RULES) {
    const issues = await checkForeignKey(
      rule.childStore,
      rule.field,
      rule.parentStore,
      rule.nullable
    );
    allIssues.push(...issues);
  }

  return { valid: allIssues.length === 0, issues: allIssues };
}

/**
 * Delete all records identified as orphans by validateDataIntegrity().
 * Groups deletes by store and uses bulkDelete() for efficiency.
 * Caller is responsible for obtaining user confirmation before calling this.
 *
 * @param {Array<{store: string, recordId: number|string}>} issues
 * @returns {Promise<void>}
 */
export async function cleanOrphanedRecords(issues) {
  if (!issues || issues.length === 0) return;

  // Group record IDs by store
  const byStore = {};
  for (const issue of issues) {
    if (!byStore[issue.store]) byStore[issue.store] = [];
    byStore[issue.store].push(issue.recordId);
  }

  // Deduplicate IDs per store (a record might appear in multiple FK check results)
  for (const store of Object.keys(byStore)) {
    byStore[store] = [...new Set(byStore[store])];
  }

  const storeNames = Object.keys(byStore);
  const tables = storeNames.map(s => db.table(s));

  await db.transaction('rw', tables, async () => {
    for (const [storeName, ids] of Object.entries(byStore)) {
      await db.table(storeName).bulkDelete(ids);
    }
  });
}
