# Phase 43: Debt History Modal - Research

**Researched:** 2026-03-20
**Domain:** Vanilla JS UI extension — amortisation schedule display, per-payment confirmation, IndexedDB persistence
**Confidence:** HIGH

---

## Summary

Phase 43 adds a payment-confirmation workflow for loan and mortgage debt cards. Users open a debt card modal, see the full expected payment schedule (calculated from the loan's start date up to today using the existing `calculateAmortisationSchedule` utility), confirm individual payments as paid, and optionally adjust the payment amount before confirming.

The infrastructure for this already exists in the codebase and only needs to be extended. The `calculateAmortisationSchedule` function in `src/utils/finance.js` generates every expected payment date and amount from any start date. The `debtUI.openHistoryModal()` function already opens a modal for a debt card click. The `confirmMarkPaid` / `showMarkPaidPrompt` pattern in `src/ui/debts.js` already shows how to inline-edit an amount and confirm a payment. What is missing is: (1) generating a virtual schedule list rather than showing a static amortisation table, (2) cross-referencing each expected payment date against existing `recurrentExpenses` to find its confirmed/unconfirmed state, and (3) writing a confirmed payment into `recurrentExpenses` (or updating the existing one) so `getYearlyDailySpending` picks it up for the heatmap.

**Primary recommendation:** Extend `_buildHistoryModalHTML` for `loan`/`mortgage` types to render the payment schedule list instead of the static amortisation summary. Add a "Confirm Paid" inline action per row that reuses the existing `showMarkPaidPrompt` / `confirmMarkPaid` pattern. All data is written to `recurrentExpenses` (status = `'paid'`) which `getYearlyDailySpending` already aggregates for the heatmap.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-05 | User can open a transaction history modal for loan and mortgage debts showing all expected payment dates from loan start up to today | `calculateAmortisationSchedule` generates the schedule; `_buildHistoryModalHTML` already branches on `debtType === 'loan' \| 'mortgage'`; schedule can be filtered to `paymentDate <= today` |
| DEBT-06 | User can confirm each historical loan/mortgage payment as paid in the history modal so it appears in the heatmap | `recurrentExpenses` table is the source of truth for `getYearlyDailySpending`; writing a row with `status: 'paid'`, `isDebtPayment: true`, `linkedDebtId`, and the payment `date` is sufficient for heatmap inclusion |
| DEBT-07 | User can adjust the payment amount for individual loan/mortgage payment entries before confirming | The existing `showMarkPaidPrompt` inline-edit pattern already does this; same UX reused or adapted |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js v7 | v7 (schema v23) | IndexedDB ORM | Project standard; `recurrentExpenses` store is the persistence target |
| date-fns | installed | Date arithmetic | `addMonths`, `parseISO`, `format`, `isBefore` — used by `calculateAmortisationSchedule` |
| DOMPurify | installed | XSS-safe HTML templating | `safeHTML` tag function from `src/ui/render.js` — required for all innerHTML |

### No new dependencies required

This phase is a pure UI extension on top of existing utilities. No new packages.

---

## Architecture Patterns

### Recommended Project Structure

No new files required. All changes go into:

```
src/ui/debts.js          # extend _buildHistoryModalHTML + add schedule-confirm helpers
src/utils/finance.js     # read-only; calculateAmortisationSchedule already exists
src/db/repository.js     # recurrentExpenseRepository.add / update already exist
```

Tests go into:
```
src/ui/debts.test.js     # extend existing test file
```

### Pattern 1: Generate Payment Schedule Filtered to History

The `calculateAmortisationSchedule` function takes `startDate` from `debt.paymentStartDate` and runs forward. For the history modal we only want entries where `paymentDate <= today`:

```javascript
// Source: src/utils/finance.js — calculateAmortisationSchedule
const today = new Date().toISOString().slice(0, 10);
const { schedule } = calculateAmortisationSchedule({
  outstandingBalance: debt.currentBalance,
  annualInterestRate: (debt.interestRate || 0) / 100,
  monthlyPayment: debt.fixedMonthlyPayment || 0,
  paymentDayOfMonth: debt.paymentDayOfMonth || 1,
  paymentAdjustment: debt.paymentAdjustment || 'none',
  startDate: debt.paymentStartDate || debt.createdAt || new Date()
});
const historicalPayments = schedule.filter(entry => entry.paymentDate <= today);
```

**Key fact:** `calculateAmortisationSchedule` always starts from `startDate` and marches forward month by month. There is no "from loan start" parameter — `startDate` IS the loan start. The existing `debt.paymentStartDate` field (set when the debt is saved) is the correct input.

**Edge case:** If `paymentStartDate` is not set, fall back to a safe default and display a hint in the modal prompting the user to edit the debt and add a start date.

### Pattern 2: Cross-Reference Schedule Against Existing recurrentExpenses

Each scheduled payment needs to show its confirmation state. The existing data model links payments to debts via `linkedDebtId` on `recurrentExpenses`:

```javascript
// Load confirmed payments for this debt
const allExpenses = await recurrentExpenseRepository.getAll();
const confirmedPayments = allExpenses.filter(e =>
  e.linkedDebtId === debtId && e.isDebtPayment === true
);
// Build a Set of confirmed dates for O(1) lookup
const confirmedDates = new Set(
  confirmedPayments
    .filter(e => e.status === 'paid')
    .map(e => e.date || e.nextDate)
);
```

Then for each schedule entry:
```javascript
const isPaid = confirmedDates.has(entry.paymentDate);
```

### Pattern 3: Confirm a Payment (inline edit + write)

The existing `showMarkPaidPrompt` / `confirmMarkPaid` pattern renders an inline edit inside a `<td>` identified by `mark-paid-td-{id}`. For the loan history modal, the same approach can be reused by using the `paymentDate` string as the row identifier.

On confirmation, the write path mirrors the existing `confirmMarkPaid` for recurrentExpenses:

```javascript
// Check if a recurrentExpense already exists for this date+debt combo
const existing = confirmedPayments.find(e =>
  (e.date || e.nextDate) === paymentDate
);
if (existing) {
  // Update amount + status
  await recurrentExpenseRepository.update(existing.id, {
    status: 'paid',
    amount: confirmedAmountPounds,
    date: paymentDate
  });
} else {
  // Create new record
  await recurrentExpenseRepository.add({
    date: paymentDate,
    nextDate: paymentDate,
    label: `${debt.name} - payment`,
    amount: confirmedAmountPounds,
    status: 'paid',
    isDebtPayment: true,
    linkedDebtId: debtId,
    isRecurring: false,
    frequency: 'monthly',
    isEssential: true,
    isCleared: false,
    isReconciled: false,
    paymentAdjustment: 'none',
    categoryId: null  // look up 'Credit Cards & Loans' category same as existing confirmMarkPaid
  });
}
```

**Why recurrentExpenses and not oneOffExpenses?**
`getYearlyDailySpending` in `repository.js` reads BOTH tables. But the existing `confirmMarkPaid` code already uses `recurrentExpenseRepository` when a linked expense exists and `oneOffExpenseRepository` as a fallback. For loan payments, creating a `recurrentExpense` is semantically correct (these ARE recurring) and consistent with the existing flow.

**categoryId:** Look up `'Credit Cards & Loans'` category the same way `confirmMarkPaid` does:
```javascript
const debtCategory = await db.categories.where('name').equals('Credit Cards & Loans').first();
```

### Pattern 4: Modal HTML Structure

The existing `_buildHistoryModalHTML` already branches by type:

```javascript
_buildHistoryModalHTML(debt) {
  const type = debt.debtType || 'credit-card';
  if (type === 'loan' || type === 'mortgage') {
    return this._buildAmortisationModalHTML(debt); // <-- currently shows static table
  }
  // credit card path...
}
```

The plan is to replace `_buildAmortisationModalHTML` (or add a new method `_buildLoanHistoryModalHTML`) that:
1. Renders the amortisation summary section (keep existing summary table)
2. Adds a scrollable list of historical payment rows below it
3. Each row shows: expected date, scheduled amount, status (Paid/Unconfirmed), and a confirm button for unpaid rows

### Anti-Patterns to Avoid

- **Don't create a new modal system.** Use the existing `modalUI.show()` from `src/ui/render.js`.
- **Don't use `innerHTML` directly.** Always use `safeHTML` template tag — DOMPurify is enforced throughout the codebase.
- **Don't recalculate the amortisation schedule from current balance.** The schedule must start from `paymentStartDate` — starting from current balance gives wrong historical dates.
- **Don't attempt to roll back the amortisation to reconstruct historical balances.** The feature only needs payment dates and scheduled amounts, not perfect historical balance reconstruction.
- **Don't write to the `statements` table.** Statements are for credit card monthly statement balances. Loan payment confirmations belong in `recurrentExpenses`.
- **Don't add async calls inside `safeHTML` template literals.** Pre-load all data before building the HTML string.
- **Don't register global `window.*` functions inside the modal HTML for the confirm action** unless following the existing pattern (`window.confirmMarkPaid` etc.). Keep it consistent with the pattern already established in `debts.js`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment date generation | Custom date iteration | `calculateAmortisationSchedule` in `finance.js` | Already handles day-of-month clamping, banking-calendar adjustment, 50yr guard |
| Safe HTML rendering | Direct DOM manipulation or template strings | `safeHTML` tag from `render.js` | DOMPurify enforced; existing pattern everywhere in codebase |
| Modal overlay | Custom modal div | `modalUI.show()` from `render.js` | Single overlay already in DOM; Esc/backdrop wired up |
| Pence/pounds conversion | Manual `* 100` | `toPence` / `fromPence` from `currency.js` | Repository auto-converts pence fields; passing pounds to `add()`/`update()` is correct |
| Heatmap data aggregation | Custom aggregation | `getYearlyDailySpending` in `repository.js` | Reads both `recurrentExpenses` (status=paid) and `oneOffExpenses` — writing to recurrentExpenses is sufficient |

---

## Common Pitfalls

### Pitfall 1: paymentStartDate May Not Be Set

**What goes wrong:** `calculateAmortisationSchedule` called with `startDate: undefined` defaults to `new Date()` (today), so the schedule starts from today, showing no historical rows.

**Why it happens:** `paymentStartDate` was added in Phase 18 (schema field is `paymentStartDate`). Older debts may not have it.

**How to avoid:** Guard before calling the schedule function:
```javascript
if (!debt.paymentStartDate) {
  // Render a "No start date set" message with a link to edit the debt
  return safeHTML`<p>No payment start date set. <button onclick="event.stopPropagation(); debtUI.editDebt(${debt.id})">Edit Debt</button> to add one.</p>`;
}
```

**Warning signs:** Modal shows empty history list for a debt that has been active for months.

### Pitfall 2: Amount Stored in Wrong Unit (Double-Pence)

**What goes wrong:** `recurrentExpenseRepository.add()` has `penceFields: ['amount']` — it calls `toPence()` on the amount before saving. If the caller passes pence (integer) instead of pounds (float), the stored value is 100x too large.

**Why it happens:** `toPence` multiplies by 100. If `amount` is already in pence, it becomes `amount * 100`.

**How to avoid:** Always pass pounds (e.g., `200.00`) to repository `add()`/`update()` for the `amount` field. The scheduled amount from `calculateAmortisationSchedule` returns `principalPence` and `interestPence` — the total is `(principalPence + interestPence) / 100` in pounds, or simply use `debt.fixedMonthlyPayment / 100` (which is the scheduled payment in pence, so divide by 100 to get pounds for the repository call).

**Warning signs:** Heatmap cells show amounts 100x larger than expected.

### Pitfall 3: safeHTML Strips onclick Attributes with String Concatenation

**What goes wrong:** `safeHTML` (DOMPurify) allows `onclick` in `ALLOWED_ATTR`, but if the onclick value contains complex expressions or template literals with embedded quotes, DOMPurify may mangle or strip them.

**Why it happens:** DOMPurify parses HTML attributes; embedded quotes in onclick values can break attribute parsing.

**How to avoid:** Keep onclick handlers simple: `onclick="debtUI.confirmLoanPayment(${debtId}, '${paymentDate}')"`. Never embed quotes inside the quoted attribute value. Use `data-*` attributes + a delegated event listener if the handler needs complex data.

**Warning signs:** Clicking confirm button does nothing; no JS error (attribute was silently stripped).

### Pitfall 4: Schedule Entry Count Mismatch With Real Payment History

**What goes wrong:** The amortisation schedule is computed from the current outstanding balance, not the original balance. So calling `calculateAmortisationSchedule` with `outstandingBalance = debt.currentBalance` and `startDate = debt.paymentStartDate` gives wrong months — the schedule doesn't start from month 1 of the original loan.

**Why it happens:** The function models future repayment from whatever balance you give it. Passing the current (reduced) balance with the original start date computes wrong dates.

**How to avoid:** For historical display, pass `originalPrincipal` as `outstandingBalance` if available, OR use the current balance but change `startDate` to today (displaying only future payments). For Phase 43, the correct approach is:
- Use `debt.originalPrincipal` as `outstandingBalance` + `debt.paymentStartDate` as `startDate` — this gives the full lifetime schedule from which you can filter `paymentDate <= today`.

**Warning signs:** Historical rows show wrong dates or wrong count compared to actual loan months elapsed.

### Pitfall 5: Re-rendering Causes Duplicate Event Listeners on Global Functions

**What goes wrong:** `setupEventListeners()` registers `window.confirmMarkPaid`, `window.showMarkPaidPrompt`, etc. If the modal is closed and re-opened, these are re-registered, shadowing the previous reference. This is mostly harmless (last write wins) but could cause confusion if a new handler is added differently.

**Why it happens:** Global `window.*` assignment is idempotent (last wins) in this codebase.

**How to avoid:** Follow the existing pattern exactly — assign to `window.*` in `setupEventListeners()` once. If adding new global handlers for loan payments (e.g., `window.confirmLoanPayment`), add them in the same block.

---

## Code Examples

### Generate Historical Schedule

```javascript
// Source: src/utils/finance.js — calculateAmortisationSchedule
import { calculateAmortisationSchedule } from '../utils/finance.js';

function generateHistoricalSchedule(debt) {
  if (!debt.paymentStartDate) return null;
  if (!debt.originalPrincipal || !debt.fixedMonthlyPayment) return null;

  const today = new Date().toISOString().slice(0, 10);
  let scheduleData;
  try {
    scheduleData = calculateAmortisationSchedule({
      outstandingBalance: debt.originalPrincipal,
      annualInterestRate: (debt.interestRate || 0) / 100,
      monthlyPayment: debt.fixedMonthlyPayment,
      paymentDayOfMonth: debt.paymentDayOfMonth || 1,
      paymentAdjustment: debt.paymentAdjustment || 'none',
      startDate: debt.paymentStartDate,
    });
  } catch (e) {
    return null; // payment doesn't cover interest — show error
  }
  // Filter to dates on or before today
  return scheduleData.schedule.filter(e => e.paymentDate <= today);
}
```

### Load Confirmed State for a Debt

```javascript
// Cross-reference recurrentExpenses to find which payments are confirmed
async function getConfirmedPaymentMap(debtId) {
  const all = await recurrentExpenseRepository.getAll();
  const confirmed = all.filter(e =>
    Number(e.linkedDebtId) === Number(debtId) && e.isDebtPayment
  );
  // Map: paymentDate -> recurrentExpense record
  return new Map(
    confirmed.map(e => [e.date || e.nextDate, e])
  );
}
```

### Write a Confirmed Loan Payment

```javascript
// Called when user confirms a payment from the history list
async function confirmLoanPayment(debtId, paymentDate, amountPounds) {
  const confirmedMap = await getConfirmedPaymentMap(debtId);
  const debt = await debtRepository.get(debtId);
  const debtCategory = await db.categories.where('name').equals('Credit Cards & Loans').first();
  const existing = confirmedMap.get(paymentDate);

  if (existing) {
    await recurrentExpenseRepository.update(existing.id, {
      status: 'paid',
      amount: amountPounds,  // repository converts to pence
      date: paymentDate,
    });
  } else {
    await recurrentExpenseRepository.add({
      date: paymentDate,
      nextDate: paymentDate,
      label: `${debt.name} - payment`,
      amount: amountPounds,  // repository converts to pence
      status: 'paid',
      isDebtPayment: true,
      linkedDebtId: debtId,
      isRecurring: true,
      frequency: 'monthly',
      isEssential: true,
      isCleared: false,
      isReconciled: false,
      paymentAdjustment: 'none',
      categoryId: debtCategory ? debtCategory.id : null,
    });
  }

  triggerHaptic('success');
  await debtUI.openHistoryModal(debtId);  // refresh modal
  if (window.app) window.app.renderAll();  // update heatmap
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loan/mortgage modal shows static amortisation summary | Phase 43: modal shows scrollable payment history with confirm buttons | Phase 43 | Users can confirm individual payments and see them on the heatmap |
| `_buildAmortisationModalHTML` renders summary table only | New method adds historical payment list below summary | Phase 43 | Backward-compatible — keep the summary, add the list |

**Existing behavior to preserve:**
- The amortisation summary table (payoff date, remaining term, total interest) at the top of the modal — keep it, add the history list below it.
- "Confirm Current Balance" button — keep it.
- The modal title "Statement History: {name}" — fine to keep as-is or update to "Payment History".

---

## Open Questions

1. **What happens when `originalPrincipal` is 0 or not set?**
   - What we know: `originalPrincipal` defaults to `currentBalance` in the schema v13 upgrade path (`debt.originalPrincipal = debt.currentBalance || 0`), so it may equal `currentBalance` for debts created before the user entered the original amount.
   - What's unclear: If user entered the original amount correctly, the schedule is accurate. If not, the schedule starts from a smaller balance.
   - Recommendation: Use `debt.originalPrincipal` if set and > `debt.currentBalance`; otherwise fall back to `debt.currentBalance`. Show a hint if the two values match (suggesting the user hasn't set the original principal separately).

2. **Confirm/Unconfirm toggle or confirm-only?**
   - What we know: DEBT-06 says "confirm as paid so it appears on the heatmap" — no mention of unconfirm.
   - What's unclear: Whether a user should be able to undo a confirmation.
   - Recommendation: Phase 43 scope is confirm-only. An undo path is not required by the requirements.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (no explicit version pinned; resolved from node_modules) |
| Config file | vitest.config.js (project root) |
| Quick run command | `npx vitest run src/ui/debts.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-05 | `generateHistoricalSchedule(debt)` returns entries with `paymentDate <= today` for loan with paymentStartDate | unit | `npx vitest run src/ui/debts.test.js` | Needs new test |
| DEBT-05 | Returns null/empty when `paymentStartDate` missing | unit | `npx vitest run src/ui/debts.test.js` | Needs new test |
| DEBT-06 | `confirmLoanPayment` writes a new `recurrentExpense` with `status:'paid', isDebtPayment:true, linkedDebtId` | unit | `npx vitest run src/ui/debts.test.js` | Needs new test |
| DEBT-06 | `confirmLoanPayment` updates existing record if one already exists for that date | unit | `npx vitest run src/ui/debts.test.js` | Needs new test |
| DEBT-07 | `confirmLoanPayment` uses the user-supplied amount, not the scheduled amount | unit | `npx vitest run src/ui/debts.test.js` | Needs new test |

### Sampling Rate

- **Per task commit:** `npx vitest run src/ui/debts.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New test cases in `src/ui/debts.test.js` for the three functions: `generateHistoricalSchedule`, `getConfirmedPaymentMap`, `confirmLoanPayment`
- [ ] Mock for `recurrentExpenseRepository.getAll` needs to return loan payment fixtures (currently only returns `[]`)

*(Existing `debts.test.js` infrastructure — jsdom, vi.mock for render.js, repository.js, schema.js — is already in place and reusable.)*

---

## Sources

### Primary (HIGH confidence)

- `src/ui/debts.js` (full read) — existing `_buildHistoryModalHTML`, `_buildAmortisationModalHTML`, `openHistoryModal`, `confirmMarkPaid`, `showMarkPaidPrompt` patterns
- `src/utils/finance.js` (full read) — `calculateAmortisationSchedule` signature and behavior
- `src/db/schema.js` (full read) — schema v23, `recurrentExpenses` fields, `debts` fields
- `src/db/repository.js` (partial read) — `recurrentExpenseRepository`, `getYearlyDailySpending` heatmap aggregation logic
- `src/ui/render.js` (partial read) — `modalUI.show()`, `safeHTML` DOMPurify config, allowed attributes
- `.planning/REQUIREMENTS.md` — DEBT-05, DEBT-06, DEBT-07 definitions
- `.planning/STATE.md` — accumulated project decisions
- `.planning/PROJECT.md` — schema version history, tech stack, key decisions

### Secondary (MEDIUM confidence)

- `src/ui/debts.test.js` (partial read) — existing mock patterns confirm jsdom environment and repository stub structure
- `src/ui/transactions.js` (partial read) — confirms `getYearlyDailySpending` / `getYearlyDailyIncome` are the heatmap data sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all confirmed from direct source code reads; no external dependencies needed
- Architecture patterns: HIGH — confirmed by reading the full debts.js implementation; patterns directly mirror existing code
- Pitfalls: HIGH — all identified from reading the actual implementation; not speculative

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable vanilla JS codebase; no framework churn risk)
