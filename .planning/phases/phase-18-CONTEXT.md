# Phase 18 — Loan/Mortgage Setup, Debt-Expense Editing Guards & Transaction Consistency

## Preamble

You are working on `nab221/budget-app`. This phase fixes loan/mortgage creation, adds missing UI fields, prevents expense-tab editing from corrupting debt-linked transactions, and fixes a duplicate-generation bug for loan edits. Read these first for project conventions:

- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/phases/17-CONTEXT.md`

Then focus on these source files:

- `src/ui/debts.js`
- `src/ui/expenses.js`
- `src/db/repository.js`
- `src/db/schema.js`
- `src/utils/recurrence.js` (read-only reference)
- `src/utils/finance.js` (read-only reference)

---

## Summary of All Bugs

| # | Bug | File(s) | Severity |
|---|-----|---------|----------|
| 1 | Loan/mortgage form has no monthly payment field → `fixedMonthlyPayment` stays 0 → card shows "Monthly: £0" and generated recurrentExpenses use £0 | `debts.js` | Critical |
| 2 | Loan/mortgage form missing payment start date field → payments always start from today instead of user-chosen date | `debts.js`, `repository.js` | Medium |
| 3 | Editing a **loan/mortgage** debt-linked expense from the Expenses tab triggers `handleSaveExpense` which creates 12 new instances (the "recurring" path) because the expense has `isRecurring: true` and a `recurrenceId` — generating duplicates with same dates | `expenses.js` | Critical |
| 4 | Editing a **credit-card** debt-linked expense from the Expenses tab strips `isDebtPayment`, `linkedStatementId`, `debtType`, `linkedDebtId` flags because `handleSaveExpense` overwrites with a plain payload — the 💳 Debt badge disappears and the Debts tab loses the link | `expenses.js` | High |
| 5 | Debt-linked transactions are editable via the Expenses tab generic form, but changes never sync back to the Debts/Statements tab, creating data divergence | `expenses.js` | High |
| 6 | `getDashboardData` in `repository.js` filters debts using `d.type` (old field) instead of `d.debtType` (current field from schema v13+) — `loanPayments` and `ccPayments` are always 0 on the dashboard | `repository.js` | High |
| 7 | `linkedDebtId` is not indexed in the Dexie schema — `deleteLinkedExpenses` works via table scan but silently degrades on large datasets; should be indexed | `schema.js` | Low |
| 8 | Mortgage form has no interest-only toggle despite `isInterestOnly` existing in schema since v15 | `debts.js` | Medium |

---

## Part A — Loan/Mortgage Form: Add Missing Fields

### A1. Add FIELD_IDS

In `src/ui/debts.js`, add to the `FIELD_IDS` object:

```js
// Phase 18: loan/mortgage monthly payment & start date
mortgageMonthlyPayment: 'mortgageMonthlyPaymentInput',
mortgagePaymentStart:   'mortgagePaymentStartInput',
mortgageInterestOnly:   'mortgageInterestOnlyInput',
loanMonthlyPayment:     'loanMonthlyPaymentInput',
loanPaymentStart:       'loanPaymentStartInput',
```

### A2. Update `_buildFormHTML()` — mortgage fieldset

After the Interest Rate row, add a new `form-row` containing:

```html
<div class="form-row">
  <div>
    <label for="mortgageMonthlyPaymentInput">Monthly Payment (£)</label>
    <input id="mortgageMonthlyPaymentInput" type="number" step="0.01" placeholder="e.g. 1200"/>
  </div>
  <div>
    <label for="mortgagePaymentStartInput">First Payment Date</label>
    <input id="mortgagePaymentStartInput" type="date"/>
  </div>
  <div style="display:flex;align-items:center;gap:6px;padding-top:18px">
    <input id="mortgageInterestOnlyInput" type="checkbox"/>
    <label for="mortgageInterestOnlyInput" style="margin:0">Interest Only</label>
  </div>
</div>
```

### A3. Update `_buildFormHTML()` — loan fieldset

After the Interest Rate row, add a new `form-row` containing:

```html
<div class="form-row">
  <div>
    <label for="loanMonthlyPaymentInput">Monthly Payment (£)</label>
    <input id="loanMonthlyPaymentInput" type="number" step="0.01" placeholder="e.g. 200"/>
  </div>
  <div>
    <label for="loanPaymentStartInput">First Payment Date</label>
    <input id="loanPaymentStartInput" type="date"/>
  </div>
</div>
```

### A4. Update `_populateEditFields(debt)`

Add to the mortgage branch:

```js
set(FIELD_IDS.mortgageMonthlyPayment, fromPence(debt.fixedMonthlyPayment ?? 0));
set(FIELD_IDS.mortgagePaymentStart, debt.paymentStartDate ?? '');
const ioCheckbox = document.getElementById(FIELD_IDS.mortgageInterestOnly);
if (ioCheckbox) ioCheckbox.checked = !!debt.isInterestOnly;
```

Add to the loan branch:

```js
set(FIELD_IDS.loanMonthlyPayment, fromPence(debt.fixedMonthlyPayment ?? 0));
set(FIELD_IDS.loanPaymentStart, debt.paymentStartDate ?? '');
```

### A5. Update `_saveDebt()` — mortgage branch

Replace the current mortgage payload construction with:

```js
} else if (type === 'mortgage') {
  const rate = val(FIELD_IDS.mortgageRate);
  payload = {
    ...payload,
    propertyValue: val(FIELD_IDS.mortgagePropertyValue),
    currentBalance: val(FIELD_IDS.mortgageBalance),
    termMonths: parseInt(document.getElementById(FIELD_IDS.mortgageTerm)?.value) || 0,
    interestRate: rate,
    apr: rate,
    earlyRepaymentFee: val(FIELD_IDS.mortgageErc),
    fixedMonthlyPayment: val(FIELD_IDS.mortgageMonthlyPayment),
    paymentStartDate: str(FIELD_IDS.mortgagePaymentStart) || null,
    isInterestOnly: document.getElementById(FIELD_IDS.mortgageInterestOnly)?.checked || false
  };
```

### A6. Update `_saveDebt()` — loan branch

Replace the current loan payload construction with:

```js
} else if (type === 'loan') {
  const rate = val(FIELD_IDS.loanRate);
  payload = {
    ...payload,
    originalPrincipal: val(FIELD_IDS.loanOriginal),
    currentBalance: val(FIELD_IDS.loanBalance),
    termMonths: parseInt(document.getElementById(FIELD_IDS.loanTerm)?.value) || 0,
    interestRate: rate,
    apr: rate,
    fixedMonthlyPayment: val(FIELD_IDS.loanMonthlyPayment),
    paymentStartDate: str(FIELD_IDS.loanPaymentStart) || null
  };
```

### A7. Update `generateLoanPayments()` in `repository.js`

Change the `startDate` line to honour the debt's `paymentStartDate`:

```js
async generateLoanPayments(debtId, debt) {
  const { generateInstances } = await import('../utils/recurrence.js');
  const category = await db.categories.where('name').equals('Credit Cards & Loans').first();
  const categoryId = category ? category.id : null;

  // Use user-specified start date or fall back to today
  const startDate = debt.paymentStartDate || new Date().toISOString().slice(0, 10);
  const label = `${debt.debtType === 'mortgage' ? 'Mortgage' : 'Loan'} Payment: ${debt.name}`;

  // ... rest unchanged
```

No other changes needed here — `fixedMonthlyPayment` is already read from `debt` and will now contain the correct value.

### A8. Card display

The `render()` method in `debts.js` already reads:

```js
const minPay = type === 'credit-card'
  ? calcMinPayment(debt.currentBalance, debt.apr)
  : (debt.fixedMonthlyPayment || 0);
```

With `fixedMonthlyPayment` now populated, the "Monthly:" line will display correctly. No changes needed here.

---

## Part B — Expense Tab: Protect Debt-Linked Transactions from Generic Editing

### Root cause analysis

When a user clicks "Edit" on a debt-linked expense in the Expenses tab, `expensesUI.openForm(id, 'recurrent')` opens the generic expense form. On save, `handleSaveExpense()`:

1. **For credit-card debts:** Builds a plain payload missing `isDebtPayment`, `linkedStatementId`, `debtType`, `linkedDebtId`, etc. The `update()` call overwrites those fields with `undefined`, stripping the debt link. The 💳 badge disappears and the Debts tab loses the connection.

2. **For loan/mortgage debts:** The item has `isRecurring: true` and a `recurrenceId`. If the user changes anything, the save flow detects it's recurring and offers "Only this instance" / "All future instances". The "All future instances" path calls `updateSeries()`, which is correct. BUT if the user ticks the "Recurring" checkbox (which is pre-checked because `isRecurring: true`), and the save path determines this is a "new" recurring expense (via the type-switch logic), it calls `generateInstances()` to create 12 new instances — producing duplicates.

### Fix strategy

**Debt-linked expenses must not be editable via the generic Expenses form.** Instead:

- The Edit button in Expenses tab should detect `isDebtPayment` and redirect to the Debts tab.
- For credit-card debts (statement-linked): redirect to the statement history modal.
- For loan/mortgage debts (series-linked): redirect to the debt edit modal where the monthly payment can be changed (which triggers `deleteLinkedExpenses` + `generateLoanPayments` regeneration).

### B1. Guard `openForm()` in `expenses.js`

At the top of `openForm()`, after retrieving the item for an edit, add a guard:

```js
async openForm(id = null, type = null) {
  if (id && (this.editingId !== id || this.editingType !== type)) {
    this.editingId = id;
    this.editingType = type;
  } else if (!id) {
    this.editingId = null;
    this.editingType = null;
  }

  // Phase 18: Guard — debt-linked expenses cannot be edited via generic form
  if (this.editingId && this.editingType === 'recurrent') {
    const item = await recurrentExpenseRepository.get(this.editingId);
    if (item && item.isDebtPayment) {
      // Redirect user to Debts tab
      alertWithHaptic(
        'This expense is linked to a debt account. Please edit it from the Debts tab.',
        'info'
      );
      this.editingId = null;
      this.editingType = null;

      // Switch to Debts tab if app navigation is available
      if (window.app && window.app.showTab) {
        window.app.showTab('debts');
      }
      return;
    }
  }

  if (this.reconciliationMode) this.toggleReconciliationMode();
  // ... rest of existing openForm() code
```

### B2. Update the Edit button in the render to show a visual hint

In the `render()` method of `expenses.js`, where the Edit button is generated, update it for debt-linked items to show a redirect icon:

Replace:
```js
<button class="sm ghost" ${isReconciled ? 'disabled title="Reconciled items cannot be edited"' : ''} onclick="expensesUI.editExpense(${item.id}, '${item.type}')">Edit</button>
```

With:
```js
<button class="sm ghost" ${isReconciled ? 'disabled title="Reconciled items cannot be edited"' : ''}
  onclick="expensesUI.editExpense(${item.id}, '${item.type}')"
  title="${item.isDebtPayment ? 'Edit in Debts tab' : 'Edit'}">
  ${item.isDebtPayment ? '↗ Debts' : 'Edit'}
</button>
```

### B3. Also guard `deleteExpense` for debt-linked series

In `setupEventListeners()`, in the `window.deleteExpense` handler, add a guard at the top:

```js
window.deleteExpense = async (id, type) => {
  const repo = type === 'recurrent' ? recurrentExpenseRepository : oneOffExpenseRepository;
  const item = await repo.get(id);
  if (!item) return;

  // Phase 18: Prevent deletion of debt-linked expenses from Expenses tab
  if (item.isDebtPayment) {
    alertWithHaptic(
      'This expense is managed by the Debts tab. Delete the debt or its statement instead.',
      'info'
    );
    return;
  }

  // ... rest of existing delete logic
```

---

## Part C — Fix `getDashboardData` field name mismatch

### Root cause

In `repository.js`, `getDashboardData()` uses the **old** field name `d.type` which was renamed to `d.debtType` in schema v13. The filters for `ccPayments` and `loanPayments` never match anything.

### Fix

In `getDashboardData()`, replace:

```js
ccPayments: debts
  .filter(d => d.type === 'credit-card' || !d.type)
  .reduce((sum, d) => sum + calcMinPayment(d.currentBalance, d.apr, 0, new Date(), d.promoEndDate), 0),
loanPayments: debts
  .filter(d => d.type === 'loan' || d.type === 'mortgage')
  .reduce((sum, d) => sum + (d.monthlyPayment || 0), 0),
```

With:

```js
ccPayments: debts
  .filter(d => d.debtType === 'credit-card' || !d.debtType)
  .reduce((sum, d) => sum + calcMinPayment(d.currentBalance, d.apr, 0, new Date(), d.promoEndDate), 0),
loanPayments: debts
  .filter(d => d.debtType === 'loan' || d.debtType === 'mortgage')
  .reduce((sum, d) => sum + (d.fixedMonthlyPayment || 0), 0),
```

Note: also `d.monthlyPayment` → `d.fixedMonthlyPayment` (the actual field name).

---

## Part D — Add `linkedDebtId` Index to Schema

### Root cause

`debtRepository.deleteLinkedExpenses()` does:

```js
const linked = await db.recurrentExpenses.where('linkedDebtId').equals(debtId).toArray();
```

But `linkedDebtId` is not in the Dexie index definition for `recurrentExpenses`. Dexie silently falls back to a full table scan. This should be indexed.

### Fix

In `schema.js`, create a new **version 17** that adds `linkedDebtId` to the `recurrentExpenses` index. Copy the full v16 stores definition and append `, linkedDebtId` to the `recurrentExpenses` line:

```js
db.version(17).stores({
  // ... all other tables unchanged from v16 ...
  recurrentExpenses: '++id, date, categoryId, label, amount, status, frequency, nextDate, predictedPaymentDate, isEssential, cycleTotal, cycleCurrent, endDate, isDebtPayment, linkedStatementId, isRecurring, recurrenceId, parentDate, debtType, isCleared, isReconciled, linkedDebtId',
  // ... all other tables unchanged ...
});
// No upgrade() needed — Dexie auto-indexes the existing data.
```

**Important:** Copy all other table definitions verbatim from v16. Only the `recurrentExpenses` line changes.

---

## Part E — Mark-Paid Button Consistency in Expenses Tab

### Current state

The Expenses tab uses text buttons ("Mark Paid" / "Paid") while the Debts tab uses a green ✓ icon. For visual consistency:

### Fix

In `expenses.js` `render()`, replace:

```js
<button class="sm ${isPaid ? 'success' : 'ghost'}" ${this.reconciliationMode || isReconciled ? 'disabled' : ''} onclick="toggleExpenseStatus(${item.id}, 'recurrent', '${item.status}')">
  ${isPaid ? 'Paid' : 'Mark Paid'}
</button>
```

With:

```js
<button class="sm ${isPaid ? 'success' : 'ghost'}" ${this.reconciliationMode || isReconciled ? 'disabled' : ''} onclick="toggleExpenseStatus(${item.id}, 'recurrent', '${item.status}')" title="${isPaid ? 'Paid' : 'Mark as Paid'}">
  ${isPaid ? '✓ Paid' : '○ Pending'}
</button>
```

---

## Non-Goals / Constraints

- Do NOT auto-calculate `fixedMonthlyPayment` from term + interest. Always trust user input.
- Do NOT change `simulateLoanPayoff` or `simulatePayoff` logic.
- Do NOT change `recurrence.js` behaviour.
- Do NOT alter any tables other than `recurrentExpenses` in the schema version bump.
- Keep style, naming, and comments consistent with existing code.

---

## Testing Checklist

### Loan/Mortgage creation

1. Add a new personal loan: Original £10,000, Balance £10,000, Term 60, Rate 5%, **Monthly Payment £200**, First Payment 2026-04-01.
   - Card shows "Monthly: £200.00" ✓
   - 12 `recurrentExpenses` created with `amount = 20000` (pence), `nextDate` starting from `2026-04-01` ✓
   - Each instance has `isDebtPayment: true`, `linkedDebtId: <id>`, `debtType: 'loan'` ✓

2. Add a new mortgage: Balance £250,000, Term 300, Rate 4.5%, **Monthly Payment £1,389**, Interest Only checked.
   - Card shows "Monthly: £1,389.00" ✓
   - Debt record has `isInterestOnly: true` ✓

3. Edit loan, change Monthly Payment from £200 to £250.
   - Old 12 recurrentExpenses deleted; new 12 created with amount = 25000 pence ✓
   - Card updates to £250 ✓

### Expense tab edit protection

4. Open Expenses tab, find a credit-card debt payment (💳 badge).
   - Click Edit → alert says "edit from Debts tab", switches to Debts tab ✓
   - Badge and debt link preserved ✓

5. Open Expenses tab, find a loan payment (💰 badge).
   - Click Edit → same redirect behaviour ✓
   - **No 12 duplicate transactions created** ✓

6. Try to delete a debt-linked expense from Expenses tab.
   - Alert says "managed by Debts tab" ✓

### Dashboard

7. Check Dashboard summary after creating loans/mortgages.
   - `ccPayments` reflects credit card minimum payments ✓
   - `loanPayments` reflects `fixedMonthlyPayment` sum ✓

### Regression

8. Create a normal (non-debt) recurring expense from Expenses tab.
   - Edit works normally with "Only this" / "All future" prompt ✓
   - Delete works normally ✓

9. Credit card statement flow still works:
   - Log statement → linked expense created with correct minimumPayment ✓
   - Mark paid via green ✓ in Debts tab → updates existing expense, no duplicate ✓

---

## Files to modify

| File | Changes |
|------|---------|
| `src/ui/debts.js` | A1–A6: FIELD_IDS, form HTML, populate, save |
| `src/ui/expenses.js` | B1–B3: openForm guard, render button, delete guard, E1: button style |
| `src/db/repository.js` | A7: generateLoanPayments startDate, C1: getDashboardData field names |
| `src/db/schema.js` | D1: version 17 with linkedDebtId index |

## Files NOT to modify

- `src/utils/recurrence.js` — read only
- `src/utils/finance.js` — read only
- `src/utils/currency.js` — no changes
- Any planning files — Claude should not touch `.planning/`
