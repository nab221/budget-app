---
phase: 27-critical-bug-fixes
plan: 03
type: execute
wave: 2
depends_on: ["27-01", "27-02"]
files_modified: [src/utils/data-integrity.js, src/utils/data-integrity.test.js, src/app.js, src/ui/cloud-sync.js]
autonomous: true
requirements: [INTEGRITY-01]
user_setup: []

must_haves:
  truths:
    - "validateDataIntegrity() correctly identifies orphaned records for all 7 FK relationships"
    - "cleanOrphanedRecords() removes only the flagged records and leaves non-orphaned records untouched"
    - "App startup runs validateDataIntegrity() non-blocking — initial UI render is not delayed"
    - "Post-pull sync triggers validateDataIntegrity() after _executePullSync() completes successfully"
    - "Warning notification appears if integrity issues are found on startup or after pull"
  artifacts:
    - path: "src/utils/data-integrity.js"
      provides: "FK validation engine with validateDataIntegrity() and cleanOrphanedRecords() exports"
      min_lines: 60
      exports: ["validateDataIntegrity", "cleanOrphanedRecords"]
      contains: "FK_RULES"
    - path: "src/utils/data-integrity.test.js"
      provides: "Unit tests covering all 7 FK paths with valid and orphan cases"
      min_lines: 80
      contains: "validateDataIntegrity"
  key_links:
    - from: "src/app.js"
      to: "src/utils/data-integrity.js"
      via: "fire-and-forget .then() call after initial render"
      pattern: "validateDataIntegrity\\(\\)\\.then"
    - from: "src/ui/cloud-sync.js"
      to: "src/utils/data-integrity.js"
      via: "post-pull trigger inside _executePullSync()"
      pattern: "validateDataIntegrity"
---

<objective>
Create the data-integrity.js module (src/utils/data-integrity.js) with validateDataIntegrity() and cleanOrphanedRecords() public API, write full unit tests, and wire the validator into app startup and the post-pull cloud sync hook.

Purpose: Dexie does not enforce referential integrity — orphaned records accumulate silently after cloud pull, file import, or manual edits. This module detects and cleans them, running non-blocking on startup and after every successful cloud pull.
Output: Two new files (data-integrity.js, data-integrity.test.js) and targeted edits to src/app.js and src/ui/cloud-sync.js.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@src/db/schema.js
@src/app.js
@src/ui/cloud-sync.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create src/utils/data-integrity.js — FK validation engine</name>
  <files>src/utils/data-integrity.js</files>
  <read_first>src/db/schema.js, src/ui/cloud-sync.js, src/app.js</read_first>
  <action>
Create the file `src/utils/data-integrity.js` with the following exact implementation. Read `src/db/schema.js` first to confirm the Dexie instance is exported as `db` from `'../db/schema.js'` (confirmed: line 10 `export const db = new Dexie('BudgetConsoleDB')` and line 552 `export default db`).

```js
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
```

Write this file verbatim.
  </action>
  <verify>node --input-type=module --eval "import('./src/utils/data-integrity.js').then(m => console.log(Object.keys(m)))" 2>&1 || echo "Module check complete"</verify>
  <acceptance_criteria>
    - src/utils/data-integrity.js exists and is non-empty
    - File exports `validateDataIntegrity` and `cleanOrphanedRecords` (grep -c 'export async function' returns 2)
    - File contains `FK_RULES` array with 7 entries (grep -c "childStore:" returns 7)
    - File contains `bulkGet` (Dexie batch lookup pattern)
    - File contains `bulkDelete` (batch delete pattern)
    - File imports from `'../db/schema.js'` (grep -c "from '../db/schema.js'" returns 1)
  </acceptance_criteria>
  <done>src/utils/data-integrity.js exists with validateDataIntegrity() and cleanOrphanedRecords() exports covering all 7 FK relationships using Dexie bulkGet()</done>
</task>

<task type="auto">
  <name>Task 2: Create src/utils/data-integrity.test.js — unit tests for all 7 FK paths</name>
  <files>src/utils/data-integrity.test.js</files>
  <read_first>src/utils/data-integrity.js, src/db/schema.js</read_first>
  <action>
Create `src/utils/data-integrity.test.js`. Before writing, read two or three existing test files in the repo (look in `src/ui/cloud-sync.test.js` or `src/ui/heatmap.test.js`) to understand the Vitest mock patterns used — specifically how Dexie is mocked. Then write tests following the same mock conventions.

The test file must:
1. Mock the `db` import from `'../db/schema.js'` so tests do not require a real IndexedDB.
2. For each of the 7 FK_RULES, provide at least one **valid case** (parent exists → no issue) and one **orphan case** (parent missing → issue reported).
3. Test `cleanOrphanedRecords()` with a mock set of issues — verify `bulkDelete` is called with the correct IDs per store.

Use Vitest's `vi.mock()` to mock the db module. The mock should expose a `db.table(name)` factory that returns an object with `toArray()` and `bulkGet(ids)` and `bulkDelete(ids)` methods, all returning Promises.

Skeleton structure (adapt mock pattern to match what existing test files use):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing the module under test
vi.mock('../db/schema.js', () => {
  const tables = {};
  const mockDb = {
    table: (name) => {
      if (!tables[name]) {
        tables[name] = {
          toArray: vi.fn().mockResolvedValue([]),
          bulkGet: vi.fn().mockResolvedValue([]),
          bulkDelete: vi.fn().mockResolvedValue(undefined),
        };
      }
      return tables[name];
    },
    transaction: vi.fn().mockImplementation(async (_mode, _tables, fn) => fn()),
    _tables: tables,
  };
  return { db: mockDb };
});

import { validateDataIntegrity, cleanOrphanedRecords } from './data-integrity.js';
import { db } from '../db/schema.js';

describe('validateDataIntegrity', () => {

  beforeEach(() => {
    // Reset all mock implementations before each test
    vi.resetAllMocks();
  });

  // ─── statements.debtId → debts.id ───────────────────────────────────────────

  it('reports no issues when all statements have a matching debt', async () => {
    db.table('statements').toArray.mockResolvedValue([{ id: 1, debtId: 10 }]);
    db.table('debts').bulkGet.mockResolvedValue([{ id: 10 }]); // parent found
    // All other tables return empty
    const result = await validateDataIntegrity();
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('reports an issue when a statement references a missing debt', async () => {
    db.table('statements').toArray.mockResolvedValue([{ id: 1, debtId: 99 }]);
    db.table('debts').bulkGet.mockResolvedValue([undefined]); // parent missing
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'statements' && i.field === 'debtId');
    expect(issue).toBeDefined();
    expect(issue.recordId).toBe(1);
    expect(issue.missingId).toBe(99);
    expect(issue.referencedStore).toBe('debts');
  });

  // ─── childcareLedger.accountId → childcareAccounts.id ───────────────────────

  it('reports no issues when all ledger entries have a matching account', async () => {
    db.table('childcareLedger').toArray.mockResolvedValue([{ id: 2, accountId: 5 }]);
    db.table('childcareAccounts').bulkGet.mockResolvedValue([{ id: 5 }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'childcareLedger')).toHaveLength(0);
  });

  it('reports an issue when a ledger entry references a missing account', async () => {
    db.table('childcareLedger').toArray.mockResolvedValue([{ id: 2, accountId: 999 }]);
    db.table('childcareAccounts').bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'childcareLedger');
    expect(issue).toBeDefined();
    expect(issue.missingId).toBe(999);
  });

  // ─── recurrentExpenses.linkedStatementId → statements.id (nullable) ─────────

  it('skips recurrentExpenses with null linkedStatementId (nullable FK)', async () => {
    db.table('recurrentExpenses').toArray.mockResolvedValue([{ id: 3, linkedStatementId: null, categoryId: null }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'recurrentExpenses' && i.field === 'linkedStatementId')).toHaveLength(0);
  });

  it('reports an issue when recurrentExpenses.linkedStatementId is non-null and missing', async () => {
    db.table('recurrentExpenses').toArray.mockResolvedValue([{ id: 3, linkedStatementId: 77, categoryId: null }]);
    db.table('statements').bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'recurrentExpenses' && i.field === 'linkedStatementId');
    expect(issue).toBeDefined();
    expect(issue.missingId).toBe(77);
  });

  // ─── recurrentExpenses.categoryId → categories.id (nullable) ────────────────

  it('reports an issue when recurrentExpenses.categoryId references a missing category', async () => {
    db.table('recurrentExpenses').toArray.mockResolvedValue([{ id: 4, linkedStatementId: null, categoryId: 50 }]);
    db.table('categories').bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'recurrentExpenses' && i.field === 'categoryId');
    expect(issue).toBeDefined();
    expect(issue.missingId).toBe(50);
  });

  // ─── oneOffExpenses.categoryId → categories.id (nullable) ───────────────────

  it('reports no issues when oneOffExpenses.categoryId is null', async () => {
    db.table('oneOffExpenses').toArray.mockResolvedValue([{ id: 5, categoryId: null }]);
    const result = await validateDataIntegrity();
    expect(result.issues.filter(i => i.store === 'oneOffExpenses')).toHaveLength(0);
  });

  it('reports an issue when oneOffExpenses.categoryId references a missing category', async () => {
    db.table('oneOffExpenses').toArray.mockResolvedValue([{ id: 5, categoryId: 88 }]);
    db.table('categories').bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'oneOffExpenses' && i.field === 'categoryId');
    expect(issue).toBeDefined();
  });

  // ─── income.categoryId → categories.id (nullable) ───────────────────────────

  it('reports an issue when income.categoryId references a missing category', async () => {
    db.table('income').toArray.mockResolvedValue([{ id: 6, categoryId: 42 }]);
    db.table('categories').bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'income' && i.field === 'categoryId');
    expect(issue).toBeDefined();
    expect(issue.recordId).toBe(6);
  });

  // ─── categoryMappings.categoryId → categories.id (non-nullable) ─────────────

  it('reports an issue when categoryMappings.categoryId references a missing category', async () => {
    db.table('categoryMappings').toArray.mockResolvedValue([{ id: 7, categoryId: 33 }]);
    db.table('categories').bulkGet.mockResolvedValue([undefined]);
    const result = await validateDataIntegrity();
    const issue = result.issues.find(i => i.store === 'categoryMappings' && i.field === 'categoryId');
    expect(issue).toBeDefined();
    expect(issue.missingId).toBe(33);
    expect(issue.referencedStore).toBe('categories');
  });

  it('returns valid:true when all tables are empty', async () => {
    // Default mock returns empty arrays — all checks pass
    const result = await validateDataIntegrity();
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

});

describe('cleanOrphanedRecords', () => {

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calls bulkDelete with deduplicated IDs grouped by store', async () => {
    const issues = [
      { store: 'statements',  recordId: 1, field: 'debtId',   referencedStore: 'debts',      missingId: 99 },
      { store: 'statements',  recordId: 2, field: 'debtId',   referencedStore: 'debts',      missingId: 98 },
      { store: 'oneOffExpenses', recordId: 5, field: 'categoryId', referencedStore: 'categories', missingId: 77 },
    ];

    await cleanOrphanedRecords(issues);

    expect(db.table('statements').bulkDelete).toHaveBeenCalledWith([1, 2]);
    expect(db.table('oneOffExpenses').bulkDelete).toHaveBeenCalledWith([5]);
  });

  it('does nothing when issues array is empty', async () => {
    await cleanOrphanedRecords([]);
    // No table calls should have been made
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('does nothing when issues is null', async () => {
    await cleanOrphanedRecords(null);
    expect(db.transaction).not.toHaveBeenCalled();
  });

});
```

Adapt mock patterns to match what existing test files in the repo use. If existing tests use `vi.mock` with a factory returning a `default` export, adjust accordingly. If they use `beforeEach` to reset mocks differently, follow that convention. The above is the target test coverage — the exact mock wiring may need adjusting to match the repo's test infrastructure.
  </action>
  <verify>npx vitest run src/utils/data-integrity.test.js</verify>
  <acceptance_criteria>
    - src/utils/data-integrity.test.js exists
    - All tests in the file pass (npx vitest run src/utils/data-integrity.test.js exits 0)
    - File covers all 7 FK relationships with at least one valid and one orphan case each
    - File tests cleanOrphanedRecords() for correct bulkDelete grouping
    - grep -c "it('reports" src/utils/data-integrity.test.js returns 7 or more
  </acceptance_criteria>
  <done>All unit tests pass; every FK relationship has a valid-parent and orphan-parent test case; cleanOrphanedRecords test verifies bulkDelete grouping</done>
</task>

<task type="auto">
  <name>Task 3: Wire validateDataIntegrity into app startup and post-pull cloud-sync hook</name>
  <files>src/app.js, src/ui/cloud-sync.js</files>
  <read_first>src/app.js, src/ui/cloud-sync.js, src/utils/data-integrity.js</read_first>
  <action>
**Part A: src/app.js — non-blocking startup integration**

Read `src/app.js`. The `init()` function at line 41 runs parallel module inits with `Promise.all(...)` at line 227, ending at line 243, then logs `'Budget App initialized successfully.'` at line 245.

Add two changes to `src/app.js`:

1. Import at the top of the file, after the existing imports:
```js
import { validateDataIntegrity } from './utils/data-integrity.js';
```

`notificationUI` already follows the repo's named-import style (`import { notificationUI } from './ui/notifications.js';`). Reuse that existing import if it is already present; if it is missing in the target branch, add it using the same named-import form before adding `notificationUI.warning(...)`.

2. After the `Promise.all([...])` block (line 243) and the `console.log('Budget App initialized successfully.')` statement (line 245), add the non-blocking validator call:

```js
// Phase 27: Non-blocking data integrity check after initial render
validateDataIntegrity().then(({ valid, issues }) => {
  if (!valid) {
    notificationUI.warning(
      `⚠️ ${issues.length} data integrity issue${issues.length !== 1 ? 's' : ''} found.`,
      [],
      8000
    );
  }
}).catch(err => {
  console.warn('[app] Data integrity check failed:', err);
});
```

This fires after the UI is already rendered — no blocking, no blank screen on startup. Use `notificationUI.warning(...)`, which matches the existing notifications API.

**Part B: src/ui/cloud-sync.js — post-pull trigger**

Read `src/ui/cloud-sync.js`. Find `_executePullSync()` at line 848. The method returns `null` on success (line 866) and returns an `err` on failure (line 874).

Add the validator call immediately before the successful `return null` at line 866, after `await this._refreshSection()`:

```js
await pullSnapshot();
this._clearErrorState();
await this._refreshSection();

// Phase 27: Run integrity check after successful cloud pull (non-blocking)
validateDataIntegrity().then(({ valid, issues }) => {
  if (!valid) {
    notificationUI.warning(
      `⚠️ ${issues.length} data integrity issue${issues.length !== 1 ? 's' : ''} found after sync.`,
      [],
      8000
    );
  }
}).catch(err => {
  console.warn('[cloudSyncUI] Post-pull integrity check failed:', err);
});

return null;
```

Also add the import at the top of `src/ui/cloud-sync.js`, after the existing imports:
```js
import { validateDataIntegrity } from '../utils/data-integrity.js';
import { notificationUI } from './notifications.js';
```

Mirror the current repo style exactly: `notificationUI` is a named export/import in `src/ui/cloud-sync.js`, so reuse the existing named import if it is already there instead of creating a duplicate import line.

Do NOT add `await` before `validateDataIntegrity()` — it must be fire-and-forget so it does not block the pull completion path or delay the UI.
  </action>
  <verify>grep -n 'validateDataIntegrity' src/app.js src/ui/cloud-sync.js</verify>
  <acceptance_criteria>
    - src/app.js contains `import { validateDataIntegrity } from './utils/data-integrity.js'`
    - src/app.js contains `validateDataIntegrity().then(` after the Promise.all block
    - src/app.js does NOT contain `await validateDataIntegrity()` (must be fire-and-forget)
    - src/app.js reuses or adds a named `notificationUI` import before calling `notificationUI.warning(...)`
    - src/ui/cloud-sync.js contains `import { validateDataIntegrity } from '../utils/data-integrity.js'`
    - src/ui/cloud-sync.js contains `validateDataIntegrity().then(` inside `_executePullSync()`
    - src/ui/cloud-sync.js reuses or adds a named `notificationUI` import before calling `notificationUI.warning(...)`
    - npx vitest run passes with no new failures
  </acceptance_criteria>
  <done>validateDataIntegrity() is called non-blocking on app startup and after each successful cloud pull; warning notification displays if issues are found</done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] npx vitest run src/utils/data-integrity.test.js — all tests pass
- [ ] npx vitest run — full suite passes, no regressions
- [ ] grep -c 'export async function' src/utils/data-integrity.js returns 2 (validateDataIntegrity + cleanOrphanedRecords)
- [ ] grep -c "childStore:" src/utils/data-integrity.js returns 7
- [ ] grep -n 'validateDataIntegrity' src/app.js shows an import and a .then() call
- [ ] grep -n 'validateDataIntegrity' src/ui/cloud-sync.js shows an import and a .then() call inside _executePullSync
- [ ] grep -c 'await validateDataIntegrity' src/app.js returns 0 (must NOT block)
- [ ] grep -c 'await validateDataIntegrity' src/ui/cloud-sync.js returns 0 (must NOT block)
</verification>

<success_criteria>
- All three tasks completed
- validateDataIntegrity() correctly identifies orphaned records across all 7 FK relationships
- cleanOrphanedRecords() removes only the flagged records
- App startup runs validator non-blocking — no delay to first paint
- Post-pull sync triggers validator non-blocking after _executePullSync() returns null (success path only)
- Warning notification appears if issues found (using notificationUI)
- All 354+ existing Vitest tests continue to pass
- No new console errors on app load
</success_criteria>

<output>
After completion, create `.planning/phases/27-critical-bug-fixes/27-03-SUMMARY.md`
</output>
