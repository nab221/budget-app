# Architecture Patterns: Data & File Synchronization

**Domain:** Persistence Layer
**Researched:** 2024-05-24

## Recommended Architecture

A repository-based architecture for all database operations, combined with a dedicated "File Sync Manager" that observes mutations.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `Repository` | Low-level IndexedDB CRUD operations. | `Dexie.js` |
| `SyncManager` | Watches for repository mutations and schedules file writes. | `FileSystemAccess API`, `Repository` |
| `PermissionManager` | Handles `queryPermission` and `requestPermission` lifecycle. | `IndexedDB` (Handle storage), `UI` |

### Data Flow

```
User Action → Repository Mutation → (Event/Observable) → SyncManager → FileSystemHandle.createWritable() → Disk
```

## Database Mutation Audit

The following mutation points were identified in the existing codebase:

### `src/db/repository.js`
- **Balance Snapshots:** `triggerBalanceRecalc`, `balanceSnapshotRepository.deleteFrom`, `save`
- **Daily Forecast:** `triggerDailyForecastRecalc`, `dailyBalanceRepository.bulkSave`, `save`, `deleteFrom`
- **Categories:** `categoryRepository.addCategory`, `deleteCategory`, `seedDefaultCategories`, `ensureOpeningBalanceCategory`, `updateCategorizationLearningRule`
- **Income/Expenses:** `incomeRepository`, `recurrentExpenseRepository`, `oneOffExpenseRepository` (all have `add`, `update`, `delete` wrappers with recalc triggers)
- **Debts/Assets/Statements:** Standard CRUD via `createBaseRepository`, plus specialized methods in `statementRepository` (`addWithExpense`, `recordPayment`, `resetPayment`, `deleteWithExpense`)
- **Childcare:** `childcareRepository` (`saveAccount`, `deleteAccount`, `addDeposit`, `addSpend`, `_recalculateBalances`)

### `budget-app.html` (Legacy Inline Mutations)
- **Categories:** `db.categories.bulkAdd`, `add`, `delete`
- **Income/Expenses:** `db.income.add`, `db.fixedSpends.add`, `db.variableSpends.add`
- **Subscriptions:** `db.subscriptions.add`
- **Debts/Statements:** `db.debts.add`, `db.statements.add`, `db.statements.delete`
- **Assets:** `db.assets.add`
- **Global Operations:** `importFile` (Bulk adds to all tables), `resetBtn` (Clears all tables)

**Refactoring Recommendation:** Consolidate all `budget-app.html` inline Dexie calls into `src/db/repository.js` to ensure sync triggers and recalculation logic are consistently applied.

## Patterns to Follow

### Handle Persistence Pattern
Store the handle in IndexedDB immediately after picking it.
```javascript
const handle = await window.showSaveFilePicker();
await set('file-handle', handle); // Using idb-keyval
```

### Permission Lifecycle Pattern
Check permissions on page load or before any file operation.
```javascript
async function verifyPermission(handle) {
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  // requestPermission MUST be triggered by user gesture
  if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') return true;
  return false;
}
```

## Anti-Patterns to Avoid

### Syncing Every Field Change
Writing to disk for every single keyup event can trigger excessive cloud sync activity.
Instead: Debounce file writes (e.g., 5 seconds of inactivity) or write only on explicit save/mutation completion.

## Sources

- [V8: Serializing FileHandles](https://v8.dev/blog/serializable-objects)
- [IndexedDB Best Practices](https://web.dev/indexeddb-best-practices/)
