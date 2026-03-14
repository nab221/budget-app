# Budget App: Category System Refactoring Task

## Context

You are working on a personal budget web application built with vanilla JavaScript, Dexie.js (IndexedDB wrapper), and Chart.js. The application tracks income, expenses, debts, and assets locally in the browser.

**Repository:** nab221/budget-app (GitHub)

**Key Files:**
- `src/ui/categories.js` - Category UI management (~180 lines)
- `src/db/repository.js` - Repository layer with categoryRepository (~1,400 lines)
- `src/db/schema.js` - Database schema (categories table: `++id, name, group`)
- `index.html` - Settings tab with category management UI

## Current Implementation Overview

### Category System Structure

**Database Schema (categories table):**
- `id` (auto-increment primary key)
- `name` (string) - Category name
- `group` (string) - Currently either `'fixed'` or `'variable'`

**Current Category Groups:**
1. **Fixed** - Used for recurring/essential expenses
   - Default categories: Housing, Utilities, Council Tax, Insurance, Subscriptions, Credit Cards & Loans
2. **Variable** - Used for discretionary/one-off expenses  
   - Default categories: Groceries, Transport/Fuel, Dining & Takeaway, Leisure & Hobbies, Health & Beauty, Shopping
3. **System** (special) - Opening Balance (used for balance adjustments)

**Usage Across the App:**
- Income records have `categoryId` field but share the same category pool as expenses
- Fixed expenses (recurrentExpenses) use categories from `group: 'fixed'`
- Variable expenses (oneOffExpenses) use categories from `group: 'variable'`
- Dropdowns are populated separately: `#fixCat`, `#varCat`, `#subCat` (subscriptions)

### Current Issues

1. **Bug: categoryRepository.addCategory is not a function**
   - The `+Add Category` button in Settings calls `categoryRepository.addCategory(group, name)`
   - This method does NOT exist in repository.js
   - Only `createBaseRepository()` methods exist: `getAll()`, `get()`, `add()`, `update()`, `delete()`
   - The correct method is `categoryRepository.add({ group, name })`

2. **Architectural flaw: Income shares categories with Expenses**
   - Income should have its own category pool
   - Currently income uses the fixed/variable categories which are expense-focused
   - Default income category should be "Salary" but user can add more (e.g., "Freelance", "Dividends", "Benefits")

3. **Outdated grouping: Fixed vs Variable distinction is obsolete**
   - The app now uses unified expense tracking (no longer separate fixed/variable)
   - Categories should be grouped by: **Income** vs **Expenses**
   - All current fixed+variable categories should migrate to "Expenses"

## Task Requirements

### Primary Changes Required

1. **Fix the Add Category button bug**
   - Update `categories.js` to call the correct repository method: `categoryRepository.add({ group, name })`
   - OR add `addCategory(group, name)` wrapper method to categoryRepository

2. **Migrate category groups from Fixed/Variable to Income/Expenses**
   - Change database: `group` field values from `'fixed'/'variable'` to `'income'/'expenses'`
   - All existing categories (fixed + variable) should become `group: 'expenses'`
   - Create new default income category: "Salary" with `group: 'income'`

3. **Update Settings UI**
   - Change dropdown from Fixed/Variable to Income/Expenses
   - Display two category lists: "Income Categories" and "Expense Categories"
   - Update form labels and hints to reflect new grouping

4. **Update category dropdowns throughout the app**
   - Income tab: Show only `group: 'income'` categories
   - Expenses tab: Show only `group: 'expenses'` categories
   - Remove separate fixCat/varCat/subCat distinction

5. **Preserve backward compatibility**
   - Existing data must migrate smoothly
   - No data loss during group renaming

## Your Approach

### Phase 1: Research & Code Review (10 minutes)

1. **Examine repository.js categoryRepository:**
   - Line ~400-420: `categoryRepository` definition
   - Check what methods are available (createBaseRepository vs custom methods)
   - Identify if `seedDefaultCategories()` exists and its structure

2. **Review categories.js:**
   - Line ~33-45: `addCatBtn` event listener - the bug location
   - Line ~105-120: `renderCategoryLists()` - how lists are rendered
   - Line ~145-165: `updateDropdowns()` - how dropdowns are populated

3. **Check schema.js:**
   - Categories table definition (latest version is v17)
   - Current fields: `++id, name, group`
   - Look for existing upgrade() paths to understand migration patterns

4. **Find all dropdown usage locations:**
   - Search codebase for `fixCat`, `varCat`, `subCat` element IDs
   - Identify files that populate or read from category dropdowns
   - Income tab: likely in `src/ui/income.js` or `src/ui/transactions.js`
   - Expenses tab: likely in `src/ui/expenses.js`

### Phase 2: Implementation Planning

Create a detailed plan covering:

**A. Bug Fix (Immediate priority)**
- Identify exact method call causing error
- Choose fix approach: (1) wrapper method OR (2) update call site
- Test category add functionality

**B. Database Migration**
- Add new schema version (v18)
- Write upgrade() function to migrate existing categories:
  - `group: 'fixed'` → `group: 'expenses'`
  - `group: 'variable'` → `group: 'expenses'`
  - `group: 'system'` → `group: 'system'` (preserve)
- Add "Salary" as default income category if none exists
- Handle edge case: what if user already manually created income categories?

**C. Repository Updates**
- Update `seedDefaultCategories()` to use new groups
- Add income defaults: ["Salary"] (expandable by user)
- Update expense defaults: merge existing fixed+variable lists
- Optionally add `addCategory(group, name)` wrapper for backward compatibility

**D. UI Updates in categories.js**
- Change `#catGroup` dropdown options from Fixed/Variable → Income/Expenses
- Update `renderCategoryLists()` to show income/expenses sections
- Update section headers in Settings

**E. UI Updates in index.html**
- Settings tab: update dropdown `<option>` values
- Update section headers from "Fixed Categories" / "Variable Categories" to "Income Categories" / "Expense Categories"

**F. Dropdown Integration**
- Income form: update to use income categories only
- Expense form: update to use expense categories only
- Remove fixCat/varCat distinction (single expense category dropdown)

**G. Testing Strategy**
- Fresh install: verify defaults seed correctly
- Existing data: verify migration runs and preserves all categories
- Add new income category via Settings
- Add new expense category via Settings
- Verify income dropdown shows only income categories
- Verify expense dropdown shows only expense categories

### Phase 3: Execution Order

1. **Quick bug fix first** (categories.js line 38)
2. **Database migration** (schema.js version bump)
3. **Repository updates** (repository.js seedDefaultCategories)
4. **Settings UI updates** (categories.js + index.html)
5. **Form dropdown updates** (income.js, expenses.js, transactions.js)
6. **Full integration test**

## Technical Constraints

- **No breaking changes** - Existing user data must migrate seamlessly
- **Backward compatibility** - Old group values must be converted, not deleted
- **IndexedDB schema versioning** - Dexie.js requires incremental version numbers
- **Dropdown population** - Must update `categoryUI.updateDropdowns()` to handle new groups
- **PDF import** - May reference categoryRepository; check `suggestCategory()` usage

## Reference: Relevant Code Sections

### Bug Location (categories.js:33-45)
```javascript
if (addCatBtn) {
  addCatBtn.addEventListener('click', async () => {
    const group = document.getElementById('catGroup').value;
    const nameInput = document.getElementById('catName');
    const name = nameInput.value.trim();

    if (!name) {
      alertWithHaptic('Please enter a category name.');
      return;
    }

    try {
      await categoryRepository.addCategory(group, name); // ❌ Method does not exist
      triggerHaptic('success');
      nameInput.value = '';
      await this.render();
    } catch (error) {
      console.error('Failed to add category:', error);
      alertWithHaptic('Failed to add category: ' + error.message);
    }
  });
}
```

### CategoryRepository Structure (repository.js:~400)
```javascript
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
      // ... more defaults
      { group: 'variable', name: 'Groceries' },
      // ... more defaults
      { group: 'system', name: 'Opening Balance' }
    ];
    await db.categories.bulkAdd(defaults);
    triggerSync();
  }
};
```

### Current Settings UI (index.html:~line 920)
```html
<h3 style="font-size:.9rem;margin-bottom:8px">Manage Categories</h3>
<div class="hint">Categories appear in the dropdowns for Fixed Spends and Variable expenses.</div>
<div class="form-row" style="margin-bottom:8px">
  <div><label>Group</label><select id="catGroup">
    <option value="fixed">Fixed</option>
    <option value="variable">Variable</option>
  </select></div>
  <div><label>Category name</label><input id="catName" type="text"/></div>
  <div><button id="addCatBtn" class="primary">+ Add Category</button></div>
</div>

<div class="grid2">
  <div>
    <h4>Fixed Categories</h4>
    <div id="fixedCatList"></div>
  </div>
  <div>
    <h4>Variable Categories</h4>
    <div id="varCatList"></div>
  </div>
</div>
```

### Schema Migration Pattern (schema.js example)
```javascript
db.version(18).stores({
  // ... same schema but group semantics changed
  categories: '++id, name, group',
  // ... other tables unchanged
}).upgrade(async tx => {
  // Migrate category groups
  await tx.table('categories').toCollection().modify(category => {
    if (category.group === 'fixed' || category.group === 'variable') {
      category.group = 'expenses';
    }
    // system group remains unchanged
  });

  // Add default income category if none exist
  const incomeCount = await tx.table('categories').where('group').equals('income').count();
  if (incomeCount === 0) {
    await tx.table('categories').add({ group: 'income', name: 'Salary' });
  }
});
```

## Expected Deliverables

1. **Bug fix** - Add Category button works correctly
2. **Schema migration** - Database version 18 with upgrade path
3. **Repository updates** - seedDefaultCategories uses income/expenses groups
4. **Settings UI** - Dropdown and lists reflect Income/Expenses grouping
5. **Form integration** - Income/Expense forms use correct category pools
6. **Backward compatibility** - Existing user data migrates seamlessly

## Success Criteria

- [ ] Clicking "+ Add Category" in Settings successfully adds a category without error
- [ ] Existing categories (fixed/variable) are automatically migrated to "expenses" group
- [ ] New installs have "Salary" as default income category
- [ ] Income form shows only income categories in dropdown
- [ ] Expense form shows only expense categories in dropdown
- [ ] Settings UI displays two sections: "Income Categories" and "Expense Categories"
- [ ] All existing transactions retain their category associations
- [ ] No console errors during migration or category operations

## Additional Notes

- **Migration is one-way** - Once upgraded to v18, rollback is not supported (standard Dexie pattern)
- **System categories** - "Opening Balance" should remain in its own group (not income/expenses)
- **Category deletion** - Existing `isCategoryInUse()` check should work unchanged
- **Multi-select filters** - Expenses tab has category filter; verify it works with new grouping
- The user is a consultant-level clinical neurophysiologist, comfortable with technical implementations

## Reference: Related Files to Review

**Core implementation files:**
- `src/ui/categories.js` - Category management UI and event handlers
- `src/db/repository.js` - CategoryRepository with methods and seeding
- `src/db/schema.js` - Database schema and version management

**Files that use categories:**
- `src/ui/income.js` or `src/ui/transactions.js` - Income form
- `src/ui/expenses.js` - Expenses form  
- `src/utils/pdf-import.js` - May use suggestCategory()

**Files to update:**
- `index.html` - Settings tab HTML (dropdown, section headers)

## Begin Implementation

Start by reviewing the codebase structure to understand the current category flow, then:
1. Fix the immediate bug (Add Category button)
2. Plan the database migration carefully
3. Update seed defaults
4. Refactor UI components incrementally
5. Test thoroughly with both new and migrated data
