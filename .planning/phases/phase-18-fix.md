# Phase 18 — Fix Transaction Inconsistencies (Debt/Expense Mark-as-Paid)

## Context

Four bugs exist in the mark-as-paid flows across the Debts and Expenses tabs. They cause duplicate expenses, items appearing in the wrong month, and UI inconsistency.

Read the following planning/context files first:
- `.planning/PROJECT.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/phases/17-CONTEXT.md` (latest phase for style/convention reference)

Then read these source files (the ones you will modify):
- `src/ui/debts.js`
- `src/ui/expenses.js`
- `src/db/repository.js`
- `src/utils/recurrence.js`

---

## Bug 1 — Debt "Mark as Paid" (Statement History ✓) creates a duplicate one-off expense

### What happens now
When the user clicks the green ✓ in Statement History, `window.confirmMarkPaid` in `src/ui/debts.js` (~line 134) creates a **new one-off expense** via `oneOffExpenseRepository.add()`. But `statementRepository.addWithExpense()` in `src/db/repository.js` already created a **linked recurrent expense** in `db.recurrentExpenses` when the statement was first logged. So the user ends up with **two expenses** for the same payment — one recurrent (pending, from statement logging) and one one-off (paid, from mark-as-paid).

### Root cause
`confirmMarkPaid` ignores the existing linked expense (`statement.linkedExpenseId`) and unconditionally creates a brand-new `oneOffExpenseRepository` entry.

### Fix

In `src/ui/debts.js`, rewrite `window.confirmMarkPaid` as follows:

1. Fetch the statement: `const stmt = await statementRepository.get(stmtId);`
2. **If `stmt.linkedExpenseId` exists** (the normal case — `addWithExpense` already created a recurrent expense):
   - Update that existing recurrent expense via `recurrentExpenseRepository.update(stmt.linkedExpenseId, { status: 'paid', amount: amtPounds, date: paymentDate })`. Note: the repository's `update()` runs `toPence` on `amount` automatically.
   - Do NOT call `oneOffExpenseRepository.add()`.
   - Update the statement with: `await statementRepository.update(stmtId, { actualPaymentAmount: amtPounds, actualPaymentDate: paymentDate });` (the `linkedExpenseId` is already set — do not overwrite it).
3. **If `stmt.linkedExpenseId` does NOT exist** (edge case — old statements from before the addWithExpense logic):
   - Keep the existing `oneOffExpenseRepository.add()` logic as a fallback.
   - After creating the one-off, update the statement: `await statementRepository.update(stmtId, { actualPaymentAmount: amtPounds, actualPaymentDate: paymentDate, linkedExpenseId: expenseId });`
4. Deduct from debt balance as currently done (this part is correct).

**Do NOT change `statementRepository.addWithExpense()`** — that function is correct. The bug is only in `confirmMarkPaid`.

---

## Bug 2 — Expenses "Mark Paid" places the transaction in the next month

### What happens now
When the user marks a debt-payment expense as paid in the Expenses tab (via the pop-up date picker), the item disappears from the current month and appears with "Paid" status in the **next** month.

### Root cause
`statementRepository.recordPayment()` in `src/db/repository.js` (~line 218) calls `advanceNextDate(expense)` and writes the result into `nextDate`:

```js
const { nextDate: newNextDate, cycleCurrent: newCycleCurrent } = advanceNextDate(expense);
await db.recurrentExpenses.update(statement.linkedExpenseId, {
  status: 'paid',
  amount: amountPence,
  cycleCurrent: newCycleCurrent,
  date: paymentDate,
  nextDate: newNextDate   // ← advances to next month
});
```

The Expenses tab renders items by filtering on `nextDate.startsWith(selectedMonth)`. Because `nextDate` is now next month, the item vanishes from the current view and shows up paid in the future month.

### Fix

In `statementRepository.recordPayment()` (`src/db/repository.js`):

1. **Do NOT advance `nextDate`** when marking as paid. Keep `nextDate` unchanged so the item remains visible in the month it was due.
2. Store the actual payment date in the `date` field (already done).
3. Remove the `advanceNextDate` call from this function. The cycle advancement is not needed here — these are statement-linked one-shot expenses, not true recurring series.

Replace the update block with:
```js
if (statement.linkedExpenseId) {
  await db.recurrentExpenses.update(statement.linkedExpenseId, {
    status: 'paid',
    amount: amountPence,
    date: paymentDate
    // nextDate deliberately NOT changed — keeps item in its original month
  });
}
```

**Also apply the same fix to `markAllAsPaid()`** in `recurrentExpenseRepository` (`src/db/repository.js`). Currently it does:
```js
const { nextDate: newNextDate, cycleCurrent: newCycleCurrent } = advanceNextDate(item);
await db.recurrentExpenses.update(item.id, {
  status: 'paid',
  nextDate: newNextDate,
  cycleCurrent: newCycleCurrent
});
```

Change to:
```js
await db.recurrentExpenses.update(item.id, {
  status: 'paid'
  // nextDate deliberately NOT changed
});
```

Only increment `cycleCurrent` if the item has `cycleTotal > 0`:
```js
const updates = { status: 'paid' };
if (item.cycleTotal > 0) {
  updates.cycleCurrent = Math.min((item.cycleCurrent || 0) + 1, item.cycleTotal);
}
await db.recurrentExpenses.update(item.id, updates);
```

---

## Bug 3 — UI inconsistency: Mark Paid button styling differs between Debts and Expenses

### What happens now
- **Debts → Statement History**: green ✓ button (icon-only, `style="color:var(--success)"`)
- **Expenses tab**: text button saying "Mark Paid" / "Paid" with conditional `success`/`ghost` class

The user expects both to look the same.

### Fix

In `src/ui/expenses.js`, in the `render()` method where the mark-paid button is generated (~inside the `items.map` template), replace:
```js
<button class="sm ${isPaid ? 'success' : 'ghost'}" ...>
  ${isPaid ? 'Paid' : 'Mark Paid'}
</button>
```

With:
```js
<button class="sm ${isPaid ? '' : 'ghost'}" style="${isPaid ? 'color:var(--success)' : ''}" ...>
  ${isPaid ? '✓ Paid' : '☐ Mark Paid'}
</button>
```

This gives a green tick for paid items (matching the Debts tab) while keeping the "Mark Paid" affordance for pending items.

---

## Testing checklist

After making the changes, verify:

1. **Debt ✓ mark-as-paid**:
   - Log a new statement via the Debts tab → Statement History → "Log Statement"
   - Click the green ✓ on that statement
   - Enter an amount and date, confirm
   - Go to Expenses tab for the same month → verify only ONE expense appears for this payment (not two)
   - Verify the expense shows as "Paid" with the correct amount and date

2. **Expenses mark-as-paid (debt payment)**:
   - Find a debt-payment expense in the Expenses tab showing as pending
   - Click "Mark Paid", choose a date in the pop-up, confirm
   - Verify the item stays in the CURRENT month view with "Paid" status
   - Verify it does NOT appear in the next month

3. **Expenses mark-as-paid (regular recurrent)**:
   - Toggle a regular (non-debt) recurrent expense to paid
   - Verify it stays in the current month with "Paid" status

4. **Mark All Paid**:
   - With several pending recurrent items, click "Mark all pending as paid"
   - Verify all items remain in the current month, now showing Paid

5. **Button consistency**:
   - Compare the ✓ in Debts Statement History with the mark-paid button in Expenses
   - Both should use a green tick icon when paid

6. **Undo/un-pay**:
   - In the Expenses tab, click the paid button on a debt-payment to un-pay it
   - Verify the statement's payment fields are reset
   - Verify the expense returns to pending in the correct month

---

## Files to modify

| File | Changes |
|------|---------|
| `src/ui/debts.js` | Rewrite `confirmMarkPaid` to update existing linked expense instead of creating a new one-off |
| `src/db/repository.js` | Fix `recordPayment()` — remove `advanceNextDate` call, keep `nextDate` unchanged. Fix `markAllAsPaid()` — same nextDate fix |
| `src/ui/expenses.js` | Update mark-paid button template to use ✓ icon for visual consistency |

## Files NOT to modify

- `src/utils/recurrence.js` — `advanceNextDate()` is correct; the bug is in how callers use it
- `src/db/schema.js` — no schema changes needed
- `src/ui/transactions.js` — income tab, not affected

---

## Constraints

- Do not break the reconciliation flow (isCleared / isReconciled logic is separate and working)
- Do not change the statement form or statement logging flow — `addWithExpense()` is correct
- Preserve the `linkedExpenseId` / `linkedStatementId` relationship between statements and expenses
- All amounts entering the repository layer as pounds are auto-converted to pence by the base repository — do not double-convert
- Run `npm test` after changes to ensure existing tests pass
- Write new tests in `src/ui/debts.test.js` and `src/db/repository.test.js` for the fixed flows
