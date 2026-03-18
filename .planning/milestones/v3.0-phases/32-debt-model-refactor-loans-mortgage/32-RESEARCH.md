# Phase 32: Debt Model Refactor — Loans & Mortgage - Research

**Researched:** 2026-03-15
**Domain:** Dexie.js schema migration, amortisation mathematics, IndexedDB UI rendering, Vitest testing patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**debtType taxonomy:**
```
debtType: 'credit-card'    → existing statement flow (unchanged)
debtType: 'personal-loan'  → amortisation model, no statements
debtType: 'mortgage'       → amortisation model, no statements
```

**Amortisation formula (simple monthly interest — no daily compounding):**
- `monthlyInterest = outstandingBalance × (annualInterestRate / 12)`
- `principalReduction = monthlyPayment - monthlyInterest`
- `newBalance = outstandingBalance - principalReduction`
- Guard: if `monthlyPayment ≤ monthlyInterest` throw `Error('Monthly payment does not cover interest — loan will never be repaid')`

**Function location:** `src/utils/finance.js` as `calculateAmortisationSchedule(params)`

**Confirm Current Balance flow:**
- Modal with currency input
- Validates: new balance > 0 AND new balance < previous balance (inline errors otherwise)
- Updates `outstandingBalance` in IndexedDB
- Recalculates schedule immediately
- Toast: "Balance updated. New payoff date: [Month Year]"

**DEBT-03 threshold (from REQUIREMENTS.md):** When confirmed balance differs from computed balance by more than 5% (configurable via `CONFIRM_BALANCE_WARNING_THRESHOLD`), show a warning before finalising.

**Schema fields to add (from CONTEXT.md):** `debtType`, `annualInterestRate`, `monthlyPayment`, bump Dexie version, migrate existing records to `debtType = 'credit-card'`

**Files to change:**
- `src/db/schema.js`
- `src/db/repository.js`
- `src/utils/finance.js`
- `src/utils/finance.test.js`
- `src/ui/debts.js`
- `src/ui/debts.test.js`
- `src/ui/cloud-sync.js`

### Claude's Discretion
None explicitly stated — all implementation choices follow the locked schema and formula above.

### Deferred Ideas (OUT OF SCOPE)
None listed in CONTEXT.md.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-01 | Loans and mortgages use predictive amortisation model; no statement import/PDF upload; display remaining balance, projected payoff date, amortisation schedule | `calculateAmortisationSchedule()` in finance.js; conditional modal rendering based on `debtType` in debts.js |
| DEBT-03 | Allow user to confirm/update current balance at any time after overpayment; warn when confirmed balance differs from computed by > 5% (`CONFIRM_BALANCE_WARNING_THRESHOLD`) | Confirm Balance modal in debts.js; `confirmBalance()` repository helper; threshold constant |
</phase_requirements>

---

## Summary

Phase 32 adds a predictive amortisation model for loans and mortgages, replacing the statement-entry flow for those debt types. The work is primarily: (1) a pure `calculateAmortisationSchedule()` utility in `finance.js`, (2) a new conditional UI path in the debt card modal that shows amortisation data instead of the statement table for `personal-loan` and `mortgage` types, and (3) a "Confirm Current Balance" modal for ad-hoc balance updates.

**Critical pre-existing schema finding:** The `debtType` discriminator and the fields described in CONTEXT.md as "new" (`annualInterestRate` maps to `interestRate`, `monthlyPayment` maps to `fixedMonthlyPayment`) were already introduced in schema version 13 (Phase 12). The current schema is version 19. This means **no new Dexie version bump is required for field additions** — all necessary fields already exist. What IS needed is the `paymentDayOfMonth` field on `debts` (referenced in CONTEXT.md amortisation params) if it does not already exist on the debts table (it currently only exists on `recurrentExpenses`). A version 20 bump would only be needed for `paymentDayOfMonth` on `debts`.

The cloud sync module (`supabase-sync.js`) already syncs ALL Dexie tables via `db.tables.map(t => t.toArray())` — no allowlist exists. The `debts` store is automatically included. No changes to `cloud-sync.js` are needed beyond confirming existing sync path works.

**Primary recommendation:** Focus implementation effort on `calculateAmortisationSchedule()` (new pure function), the amortisation panel in `_buildHistoryModalHTML()` (conditional on `debtType`), and the "Confirm Current Balance" modal. The schema migration cost is near zero because fields already exist.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^3.x (v19 currently) | IndexedDB wrapper; schema migration | Established in codebase |
| date-fns | (existing) | Date arithmetic for payoff date projection | Already imported in finance.js |
| Vitest | (existing) | Unit test framework | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| safeHTML (render.js) | project | XSS-safe template literal for UI HTML | All UI string assembly |
| notificationUI | project | Toast notifications | Balance updated confirmation |
| modalUI | project | Modal dialog abstraction | Confirm Balance modal |
| formatGBP / fromPence | currency.js | Pence ↔ display string | All monetary display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple monthly interest | Compound daily (APR) | CONTEXT.md mandates simple monthly — do not deviate |
| Inline balance update in card | Separate modal | CONTEXT.md mandates modal flow |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
No new files/folders needed. All changes are within existing files:
```
src/
├── utils/finance.js          ← add calculateAmortisationSchedule()
├── utils/finance.test.js     ← add amortisation test suite
├── db/schema.js              ← add version 20 if paymentDayOfMonth needed on debts
├── db/repository.js          ← add confirmBalance() helper on debtRepository
├── ui/debts.js               ← conditional modal content + Confirm Balance flow
└── ui/debts.test.js          ← extend with amortisation rendering tests
```

### Pattern 1: Pure Function for Amortisation Schedule
**What:** `calculateAmortisationSchedule(params)` returns full schedule array plus summary fields
**When to use:** Called on render of loan/mortgage modal and on Confirm Balance update

**Parameters (from CONTEXT.md):**
```javascript
// Source: 32-CONTEXT.md
calculateAmortisationSchedule({
  outstandingBalance,   // integer pence
  annualInterestRate,   // decimal e.g. 0.049
  monthlyPayment,       // integer pence
  paymentDayOfMonth,    // int 1-28
  paymentAdjustment,    // 'none' | 'next-working-day'
})
// Returns:
// {
//   schedule: [{ month, interestPence, principalPence, balancePence, paymentDate }],
//   projectedPayoffDate: 'YYYY-MM',
//   remainingTermMonths: number,
//   totalInterestRemaining: integer pence
// }
```

**Guard (from CONTEXT.md):**
```javascript
const monthlyInterest = outstandingBalance * (annualInterestRate / 12);
if (monthlyPayment <= monthlyInterest) {
  throw new Error('Monthly payment does not cover interest — loan will never be repaid');
}
```

**Worked example for test fixture (from CONTEXT.md):**
- Balance: £10,000 (1,000,000p), APR: 4.9% (0.049), Monthly: £300 (30,000p)
- Month 1: interest = 1,000,000 × (0.049/12) = 4,083p (£40.83), principal = 25,917p, balance = 974,083p
- Month 2: interest = 974,083 × (0.049/12) = 3,977p (£39.77), principal = 26,023p, balance = 948,060p
- Month 3: interest = 948,060 × (0.049/12) = 3,870p (£38.70), principal = 26,130p, balance = 921,930p

**Pence arithmetic note:** All intermediate calculations should stay in pence (integer). Monthly interest in pence = `Math.round(balancePence * annualInterestRate / 12)`. The worked example figures in CONTEXT.md are in pounds and use decimal rounding — the pence implementation may differ by 1-2p per month due to `Math.round`, so tests should use `toBe` against pence-rounded values, not the pound figures directly.

### Pattern 2: Conditional Modal Content
**What:** `_buildHistoryModalHTML(debt)` already branches on `type === 'credit-card'` for some elements. Extend the branch to return entirely different modal content for `personal-loan` and `mortgage`.
**When to use:** `openHistoryModal(debtId)` — existing entry point, no change needed to callers.

```javascript
// Source: src/ui/debts.js _buildHistoryModalHTML (existing pattern)
_buildHistoryModalHTML(debt) {
  const type = debt.debtType || 'credit-card';
  if (type === 'personal-loan' || type === 'mortgage') {
    return this._buildAmortisationModalHTML(debt); // NEW
  }
  // existing statement HTML...
}
```

**Amortisation modal must show (from CONTEXT.md DEBT-01):**
- Outstanding balance
- Monthly payment
- APR / interest rate
- Projected payoff date
- Remaining term in months
- Total interest remaining
- "Confirm Current Balance" button

### Pattern 3: Confirm Balance Flow
**What:** Button in amortisation modal opens inline or sub-modal with currency input
**Pattern:** Follow existing `toggleStmtForm()` pattern — use `modalUI.show()` or an inline form container

```javascript
// Pattern from existing code (debts.js toggleStmtForm):
async confirmBalance(debtId) {
  const debt = await debtRepository.get(debtId);
  // show confirm modal with validation
  // on submit: call debtRepository.confirmBalance(debtId, newBalancePence)
}
```

**Repository helper:**
```javascript
// In debtRepository (repository.js)
async confirmBalance(id, newBalancePence) {
  const debt = await db.debts.get(id);
  // validate: newBalancePence > 0 && newBalancePence < debt.currentBalance
  await db.debts.update(id, { currentBalance: newBalancePence });
  triggerSync();
  return { previousBalance: debt.currentBalance, newBalance: newBalancePence };
}
```

**DEBT-03 threshold check:** Before committing, check `Math.abs(newBalance - computedBalance) / computedBalance > CONFIRM_BALANCE_WARNING_THRESHOLD`. The computed balance is the `balancePence` at the current month's position in the amortisation schedule. Export `CONFIRM_BALANCE_WARNING_THRESHOLD = 0.05` as a named constant from `debts.js` or `finance.js`.

### Anti-Patterns to Avoid
- **Pence / pounds confusion in tests:** The worked example in CONTEXT.md is in pounds. Tests must use pence integers. Do not copy the pound figures directly as expected values.
- **Blocking the UI with schedule computation:** `calculateAmortisationSchedule()` is synchronous. For very long mortgages (25 years = 300 months), the loop runs 300 iterations — negligible CPU cost, no async needed.
- **Nesting safeHTML calls:** Project pattern established in Phase 09 — return plain string from inner helpers; outer `safeHTML` template sanitises once.
- **Mutating debt objects in schedule calc:** Function must not modify input params — operate on local copies only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic for payoff month | Custom month addition | `addMonths(date, n)` from date-fns | Already imported in finance.js |
| Modal dialog | Custom overlay | `modalUI.show()` from render.js | Established project abstraction |
| Toast notifications | Custom div | `notificationUI.success()` | Established project abstraction |
| XSS-safe HTML | Manual escaping | `safeHTML` tag | Project requirement, DOMPurify-backed |
| Pence formatting | Custom formatter | `formatGBP(pence)` from currency.js | Existing utility |

**Key insight:** The amortisation algorithm itself has no library. It is a simple iterative loop — custom implementation is correct here. Do not reach for a finance library.

---

## Common Pitfalls

### Pitfall 1: Schema Fields Already Exist
**What goes wrong:** Developer adds duplicate fields (`annualInterestRate`, `monthlyPayment`) when `interestRate` and `fixedMonthlyPayment` already exist and contain the same data.
**Why it happens:** CONTEXT.md names fields using the new taxonomy; existing schema uses legacy names from earlier phases.
**How to avoid:** Use existing field names `interestRate` (decimal, e.g. `0.049`) and `fixedMonthlyPayment` (pence) in the implementation. Map them to the CONTEXT.md parameter names at the call site of `calculateAmortisationSchedule()`.
**Warning signs:** If a Dexie version bump changes the `debts` store structure to add `annualInterestRate`, that is a duplicate. Only add `paymentDayOfMonth` if needed.

### Pitfall 2: debtType Field Already Exists on debts
**What goes wrong:** Attempting to write a migration that sets `debtType = 'credit-card'` for existing records — but `debtType` was already migrated in schema version 13.
**Why it happens:** CONTEXT.md describes what the schema should have, not what changed between v13 and now.
**How to avoid:** Inspect the v13 `upgrade()` block — it already sets `debtType`. The v20 migration (if needed) should only touch `paymentDayOfMonth`.

### Pitfall 3: Infinite Loop Guard
**What goes wrong:** `calculateAmortisationSchedule()` enters an infinite loop when `monthlyPayment ≤ monthlyInterest`.
**Why it happens:** If payment doesn't cover interest, balance grows each month and the loop never terminates.
**How to avoid:** Check guard BEFORE the loop. Additionally, add a `maxMonths = 600` safety cap (consistent with existing `simulatePayoff` and `simulateLoanPayoff` patterns).
**Warning signs:** Test timeout in Vitest if guard is missing.

### Pitfall 4: Cloud Sync — No Allowlist Needed
**What goes wrong:** Developer adds explicit `debts` store registration to `cloud-sync.js` thinking it is required.
**Why it happens:** CONTEXT.md says "ensure `debts` remains registered" — implying an allowlist exists.
**How to avoid:** `supabase-sync.js::pushSnapshot()` iterates `db.tables` (all tables). There is no allowlist. The `debts` table is synced automatically. No change to `cloud-sync.js` is needed for this purpose.

### Pitfall 5: Pence Rounding in Amortisation
**What goes wrong:** Monthly interest calculation accumulates rounding error over hundreds of months, causing payoff to occur a month earlier or later than expected.
**Why it happens:** `Math.round(balance * rate / 12)` rounds each month independently.
**How to avoid:** This is acceptable — standard mortgage calculators have the same behavior. Tests should verify the first 3 months exactly (as per worked example) and check that the final balance reaches ≤ 0 without going materially negative.

### Pitfall 6: `openHistoryModal` Called for Loans — Currently Shows Statement View
**What goes wrong:** For `personal-loan` and `mortgage` types, `openHistoryModal` currently opens the statement history view (including "+ Log Statement" button). This must be replaced, not patched.
**Why it happens:** The modal content is built by `_buildHistoryModalHTML(debt)` which only conditionally hides the PDF import button. The "+ Log Statement" button is always shown.
**How to avoid:** `_buildHistoryModalHTML` must fully branch: if `debtType` is `personal-loan` or `mortgage`, return the amortisation HTML; otherwise return the statement HTML. The existing approach of hiding individual elements is insufficient.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Finance Function Pattern (finance.js)
```javascript
// Source: src/utils/finance.js simulateLoanPayoff()
// All monetary values in pence. Loop with maxMonths guard.
export function simulateLoanPayoff(debts, strategy, extraMonthlyPence = 0, startDate = new Date()) {
  // ...
  const maxMonths = 600; // 50 years limit to prevent infinite loops
  while (currentDebts.some(d => d.balance > 0) && months < maxMonths) {
    months++;
    // interest: Math.round((debt.balance * ((debt.interestRate || 0) / 100)) / 12)
  }
}
```

### Existing Repository Confirm Pattern
```javascript
// Source: src/db/repository.js debtRepository.update()
async update(id, data) {
  const existing = await db.debts.get(id);
  const toUpdate = { ...data };
  // pence conversion for monetary fields
  const fields = ['currentBalance', 'creditLimit', 'originalPrincipal', 'fixedMonthlyPayment', 'earlyRepaymentFee'];
  fields.forEach(f => { if (toUpdate[f] !== undefined) toUpdate[f] = toPence(toUpdate[f]); });
  await db.debts.update(id, toUpdate);
  triggerSync();
  return 1;
},
```

### Existing Conditional Modal HTML Pattern (debts.js)
```javascript
// Source: src/ui/debts.js _buildHistoryModalHTML()
_buildHistoryModalHTML(debt) {
  const type = debt.debtType || 'credit-card';
  return safeHTML`
    <div ...>
      <button class="primary" onclick="debtUI.toggleStmtForm(${debt.id}, true)">+ Log Statement</button>
      ${type === 'credit-card' ? `<button ...>📄 Import PDF</button>` : ''}
    </div>
    ...
  `;
},
```

### Existing Schema Version Bump Pattern
```javascript
// Source: src/db/schema.js (version 19 pattern)
db.version(20).stores({
  // copy all existing stores verbatim, add new field to debts if needed
  debts: '++id, name, debtType, ..., paymentDayOfMonth',
  // all other stores unchanged
}).upgrade(async tx => {
  await tx.table('debts').toCollection().modify(debt => {
    if (debt.paymentDayOfMonth === undefined) debt.paymentDayOfMonth = 1;
  });
});
```

### Existing Toast Pattern
```javascript
// Source: src/ui/debts.js (various locations)
notificationUI.success('Balance updated. New payoff date: Jan 2031');
notificationUI.error('New balance must be less than current balance');
```

### Existing date-fns Usage in finance.js
```javascript
// Source: src/utils/finance.js top of file
import { addMonths, parseISO, isBefore, format, startOfMonth } from 'date-fns';
// Use addMonths(startDate, n) to compute each payment date
// Use format(date, 'MMM yyyy') for projectedPayoffDate display
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All debt types used statement flow | `debtType` discriminator introduced in schema v13 | Phase 12 | The taxonomy exists; Phase 32 builds the UI/utility on top of it |
| `type` field (underscore, e.g. `credit_card`) | `debtType` field (hyphenated, e.g. `credit-card`) | Schema v13 | Phase 32 uses `debtType` throughout |
| `interestRate` as percent | `annualInterestRate` as decimal per CONTEXT.md | Phase 32 | CONTEXT.md uses decimal (0.049). Existing DB field `interestRate` is stored as percent (e.g. 4.9). Conversion needed: `annualInterestRate = debt.interestRate / 100` when calling `calculateAmortisationSchedule()` |

**Critical field-naming discrepancy:** The existing `debts.interestRate` field stores the rate as a percentage integer/decimal (e.g. `4.9` for 4.9%). The CONTEXT.md amortisation formula uses `annualInterestRate` as a decimal (e.g. `0.049`). The `calculateAmortisationSchedule()` function signature must accept the decimal form. At the call site in `debts.js`, divide `debt.interestRate` by 100.

---

## Open Questions

1. **`paymentDayOfMonth` on debts table**
   - What we know: `paymentAdjustment` is on `recurrentExpenses` (v19). `paymentDayOfMonth` is NOT currently indexed on `debts`. CONTEXT.md lists it as a parameter to `calculateAmortisationSchedule()`.
   - What's unclear: Is `paymentDayOfMonth` needed for the amortisation schedule computation itself, or only for generating the payment dates? The formula only needs balance/rate/payment to produce the schedule. Payment dates within the schedule could derive from `paymentDayOfMonth`.
   - Recommendation: Include `paymentDayOfMonth` as a parameter to `calculateAmortisationSchedule()` but make it optional (default `1`). Add `paymentDayOfMonth` to the `debts` store in schema v20 migration. This is low-risk and matches the CONTEXT.md parameter list.

2. **`CONFIRM_BALANCE_WARNING_THRESHOLD` constant location**
   - What we know: REQUIREMENTS.md DEBT-03 defines this configurable threshold at 5%.
   - What's unclear: CONTEXT.md does not mention it. The implementation must decide where to define the constant.
   - Recommendation: Define `export const CONFIRM_BALANCE_WARNING_THRESHOLD = 0.05;` in `src/ui/debts.js` alongside the Confirm Balance logic. This keeps it near its only consumer and makes it easy to test.

3. **"Computed balance" for DEBT-03 5% check**
   - What we know: The DEBT-03 requirement says to warn when confirmed balance differs from "computed balance" by more than 5%.
   - What's unclear: The "computed balance" is the amortisation schedule's expected balance at the current month — but this requires knowing how many months have elapsed since loan start. The `debts` table does not store a loan start date.
   - Recommendation: Use `debt.currentBalance` (the last stored outstanding balance) as the "computed balance" for the diff check. This is practical: the warning triggers if the user enters a value > 5% different from what the DB currently records.

---

## Sources

### Primary (HIGH confidence)
- `src/db/schema.js` (read directly) — confirmed debtType, interestRate, fixedMonthlyPayment all exist from v13; current version is 19
- `src/utils/finance.js` (read directly) — confirmed pence arithmetic patterns, `simulateLoanPayoff` function signature and max-months guard
- `src/ui/debts.js` (read directly) — confirmed `_buildHistoryModalHTML` branches, `openHistoryModal` entry point, existing card rendering
- `src/db/repository.js` (read directly) — confirmed `debtRepository.update()` and `confirmBalance` pattern needed
- `src/utils/supabase-sync.js` (read directly) — confirmed `db.tables.map(t => t.toArray())` syncs all stores, no allowlist

### Secondary (MEDIUM confidence)
- `.planning/phases/32-debt-model-refactor-loans-mortgage/32-CONTEXT.md` — amortisation formula, worked example, acceptance criteria

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against codebase directly
- Architecture: HIGH — confirmed existing patterns from source files
- Pitfalls: HIGH — discovered by reading actual schema versions and sync code
- Schema migration scope: HIGH — v13 already has the fields; only `paymentDayOfMonth` possibly missing from debts

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable codebase, no fast-moving dependencies)
