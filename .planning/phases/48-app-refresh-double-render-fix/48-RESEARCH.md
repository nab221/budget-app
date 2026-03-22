# Phase 48: app:refresh Double-Render Fix - Research

**Researched:** 2026-03-22
**Domain:** Vanilla JS custom event system, UI module render coordination
**Confidence:** HIGH

## Summary

When the user marks an expense as paid, `window.toggleExpenseStatus` (defined in
`src/ui/expenses.js`) does two things after writing to the repository:

1. Calls `await this.render()` directly — renders `expensesUI` immediately.
2. Dispatches `new CustomEvent('app:refresh')` — which triggers the global
   `window.addEventListener('app:refresh', () => window.app.renderAll())` in
   `app.js`, which (when the active tab is `transactions`) calls **both**
   `transactionUI.render()` AND `expensesUI.render()` again.

So for a single toggle action, `expensesUI.render()` fires twice and
`transactionUI.render()` fires once from `app:refresh` without ever being called
directly.

The fix is to remove the redundant `window.dispatchEvent(new CustomEvent('app:refresh'))`
call inside `toggleExpenseStatus`, replace the direct `await this.render()` call
with `window.app.refreshApp()` (or equivalently dispatch `app:refresh` once), and
also ensure the direct `await this.render()` is not there alongside the dispatch.
The simplest correct path: **remove the redundant dispatch and call the two renders
explicitly** OR **drop the direct render call and use only one dispatch**.

A second `app:refresh` dispatch exists at line 1060 of `expenses.js` inside the
debt-payment confirmation handler — that one is intentional (it signals the Debts
tab), but it also has the same `await this.render()` + dispatch double pattern
and should be reviewed.

**Primary recommendation:** In `toggleExpenseStatus`, remove
`window.dispatchEvent(new CustomEvent('app:refresh'))` (line 271). The preceding
`await this.render()` is sufficient for the Expenses tab. The Transactions tab is
kept in sync by its own `app:refresh` listener — which will be triggered if
callers use `window.app.refreshApp()` at the call site, or the dispatch can be
kept and the direct `this.render()` dropped. Either approach yields exactly one
render per module. The cleanest approach that touches the least code: **remove
only the `window.dispatchEvent(...)` at line 271**, leaving the direct
`await this.render()` in place. Then for the Transactions tab UI, because
`transactionUI` is what called `window.toggleExpenseStatus` (via an inline button
in `renderTransactions`), add `await transactionUI.render()` after the status
toggle returns, OR handle this by having `toggleExpenseStatus` call both renders
explicitly without dispatching the broadcast event. See Architecture Patterns
below.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | (existing, `npm test`) | Unit tests for event flow | Already used throughout the project |
| jsdom | (via Vitest) | DOM simulation for event tests | Already configured in vitest.config.js |

No new libraries required. This is a pure refactor of existing JavaScript.

**Installation:** None needed.

## Architecture Patterns

### Existing Event Flow (Current — Broken)

```
User clicks "Mark Paid" button
  → window.toggleExpenseStatus(id, type, status)           [expenses.js:237]
      → recurrentExpenseRepository.update(id, updates)
      → await this.render()                                 [expenses.js:270] — render #1 of expensesUI
      → window.dispatchEvent(new CustomEvent('app:refresh')) [expenses.js:271]
          → window.app.renderAll()                          [app.js:169]
              → transactionUI.render()                      [app.js:150] — render #1 of transactionUI
              → expensesUI.render()                         [app.js:151] — render #2 of expensesUI ← BUG
```

### Fixed Event Flow (Option A — Recommended: remove dispatch from toggleExpenseStatus)

```
User clicks "Mark Paid" button
  → window.toggleExpenseStatus(id, type, status)
      → recurrentExpenseRepository.update(id, updates)
      → await expensesUI.render()                           — render #1 of expensesUI (only)
      → await transactionUI.render()                        — render #1 of transactionUI (only)
      // NO app:refresh dispatch
```

This means `toggleExpenseStatus` explicitly renders both affected modules. It is
self-contained and does not broadcast to unrelated tabs.

### Fixed Event Flow (Option B — drop direct render, use single dispatch)

```
User clicks "Mark Paid" button
  → window.toggleExpenseStatus(id, type, status)
      → recurrentExpenseRepository.update(id, updates)
      // NO await this.render()
      → window.app.refreshApp()                             — dispatches app:refresh once
          → window.app.renderAll()
              → transactionUI.render()                      — render #1
              → expensesUI.render()                         — render #1
```

Option B is simpler (one line change) but `refreshApp` is a broadcast that wakes
up the whole active tab's render stack. Option A is more surgical.

**Project convention alignment:** The codebase currently uses a mix of both
patterns. Direct `await this.render()` is the dominant pattern after local mutations
(see `deleteSubscription`, `handleAddSubscription`, `toggleIncCleared`, etc.).
Option A is consistent with that convention. Option B creates a dependency on
`window.app` being initialized, which is always true at runtime but reduces
testability.

**Decision for planner:** Implement Option A. Remove the
`window.dispatchEvent(new CustomEvent('app:refresh'))` at line 271 of
`expenses.js` and add `await transactionUI.render()` immediately after
`await this.render()` in `toggleExpenseStatus`. Import `transactionUI` at the top
of `expenses.js` (or access via `window.transactionUI` which is already set at
line 849 of `transactions.js`). Using `window.transactionUI` avoids a circular
import.

### Secondary Dispatch to Review

Line 1060 in `expenses.js` (debt payment confirmation handler) also does:
```javascript
await this.render();
window.dispatchEvent(new CustomEvent('app:refresh'));
```
This is intentional — after confirming a debt payment, the Debts tab must also
re-render. However the dispatch causes `expensesUI.render()` to fire twice (once
direct, once via `app:refresh → renderAll`). If the active tab is `transactions`,
it also double-renders `transactionUI`. This is a secondary fix that should be
included in the same phase for completeness per PERF-01.

### Pattern: Checking Active Tab Before Extra Render

`app.js renderAll()` already scopes renders to the active tab panel (line 148–163).
This means `app:refresh` is cheap when non-`transactions` tabs are active. The
double-render only hurts when `panelId === 'transactions'`. This is why it was
masked for so long.

### Anti-Patterns to Avoid
- **Removing app:refresh entirely from modules:** Other modules (assets, childcare,
  debts, income-sources) subscribe to `app:refresh` to stay in sync after cross-tab
  writes. The event is valid; the problem is the caller dispatching it AND calling
  `this.render()` in the same flow.
- **Circular imports:** Do not import `transactionUI` directly into `expenses.js`.
  Use `window.transactionUI` (already registered at `transactions.js:849`).
- **Conditional dispatch:** Don't add `if (activeTab === 'transactions')` checks
  inside `toggleExpenseStatus`. That makes the function view-aware.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deduplication of event dispatches | Custom event queue / debounce layer | Direct render calls per module | Overkill; the issue is one redundant dispatch not a systemic flood |
| Render batching | requestAnimationFrame batching wrapper | None needed | Only 2 modules affected; batching adds complexity with no visible gain |

## Common Pitfalls

### Pitfall 1: Circular Import Between expenses.js and transactions.js
**What goes wrong:** `expenses.js` imports from `transactions.js` and
`transactions.js` imports from `expenses.js` — Vite/Rollup will resolve it but
module-level code runs in unpredictable order, leading to `undefined` at import
time.
**Why it happens:** Both modules export singleton objects that reference each other
in event handlers.
**How to avoid:** Access `transactionUI` via `window.transactionUI` (set at
`transactions.js:849`). No ES module import needed.
**Warning signs:** `transactionUI is not defined` at module scope in expenses.js.

### Pitfall 2: Double-Fix Without Verifying the Transactions-Tab Caller
**What goes wrong:** Removing the dispatch from `toggleExpenseStatus` makes
`expensesUI` correct but leaves `transactionUI` stale because it only re-renders
via the (now-removed) broadcast.
**Why it happens:** `transactionUI.renderTransactions` renders the "Mark Paid"
button with `onclick="window.toggleExpenseStatus(...)"`. When that button fires,
only `expensesUI`'s handler runs — `transactionUI` must be explicitly re-rendered
or the button's row will still show "Mark Paid" (stale).
**How to avoid:** Add `await window.transactionUI?.render()` after
`await this.render()` in `toggleExpenseStatus`.
**Warning signs:** Toggling paid from the Transactions tab doesn't update the
button text to "✓ Paid".

### Pitfall 3: Missing the Second Dispatch (line 1060)
**What goes wrong:** Fix only line 271, leaving line 1060 with the same pattern.
**Why it happens:** Debt payment confirmation is a separate code path in
`showDebtPaymentConfirmation` / its confirmBtn handler.
**How to avoid:** Apply the same pattern to line 1060: replace
`await this.render(); window.dispatchEvent(...)` with explicit renders of
`expensesUI` and `debtUI` (already imported in debts.js; use `window.debtUI`
or check if debts tab is active before the second render).

### Pitfall 4: Stale Test Assertion After Removing Dispatch
**What goes wrong:** Existing tests (if any) that assert `dispatchEvent` was called
will fail after the removal.
**Why it happens:** Tests mock `window.dispatchEvent` and count calls.
**How to avoid:** Audit `expenses.test.js` for `dispatchEvent` assertions before
implementing. Current test file (first 60 lines reviewed) does not appear to
assert on `dispatchEvent` calls, but confirm before implementing.

## Code Examples

### Current (broken) toggleExpenseStatus tail
```javascript
// expenses.js:269–274 (current)
      triggerHaptic('tap');
      await this.render();
      window.dispatchEvent(new CustomEvent('app:refresh'));  // ← causes double-render
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
```

### Fixed toggleExpenseStatus tail (Option A)
```javascript
// expenses.js — after fix
      triggerHaptic('tap');
      await this.render();
      await window.transactionUI?.render();  // ← explicit, scoped, no broadcast
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
```

### Fixed debt payment confirmation handler tail (secondary fix, line ~1058–1061)
```javascript
// expenses.js — showDebtPaymentConfirmation confirmBtn.onclick — after fix
          await this.render();
          await window.debtUI?.render();   // ← replaces app:refresh dispatch
          templateUI.closeModal();
```

Note: `window.debtUI` is set in `debts.js` — confirm it is registered analogously
to `window.transactionUI`. Check debts.js for `window.debtUI = debtUI` assignment.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct DOM manipulation | Event-driven render on `app:refresh` | v2–v3 migration | Correct pattern; abuse of broadcast is the problem not the pattern |
| Global `window.app.renderAll()` for all mutations | Per-module `this.render()` after local writes | Established pattern | Most modules already do this correctly |

**Deprecated/outdated:**
- Using `window.dispatchEvent(new CustomEvent('app:refresh'))` as a substitute
  for explicit targeted renders: was a shortcut that worked when tabs were
  independent; broke when both `transactionUI` and `expensesUI` share the same
  panel and both listen to the same broadcast.

## Open Questions

1. **Does `window.debtUI` exist as a global?**
   - What we know: `debtUI` is exported from `debts.js`, imported in `app.js`
   - What's unclear: Whether `debts.js` sets `window.debtUI = debtUI`
   - Recommendation: Planner should read `debts.js` init() to verify; if not set,
     add it analogously to `window.transactionUI` in `transactions.js:849`, or
     import `debtUI` carefully at the call site.

2. **Are there any Vitest tests that assert on `window.dispatchEvent` call count
   in `expenses.test.js`?**
   - What we know: Reviewed first 60 lines — no `dispatchEvent` mock seen
   - What's unclear: Rest of test file
   - Recommendation: Planner reads `expenses.test.js` fully before implementing
     to check for any `dispatchEvent` spy assertions that would need updating.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (jsdom environment) |
| Config file | `vitest.config.js` |
| Quick run command | `npx vitest run src/ui/expenses.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | `toggleExpenseStatus` triggers `expensesUI.render()` exactly once | unit | `npx vitest run src/ui/expenses.test.js` | ✅ (needs new test) |
| PERF-01 | `toggleExpenseStatus` triggers `transactionUI.render()` exactly once | unit | `npx vitest run src/ui/expenses.test.js` | ✅ (needs new test) |
| PERF-01 | `toggleExpenseStatus` does NOT dispatch `app:refresh` | unit | `npx vitest run src/ui/expenses.test.js` | ✅ (needs new test) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/ui/expenses.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test block in `src/ui/expenses.test.js` covering PERF-01 double-render
  prevention — tests that `expensesUI.render` is called once and `window.transactionUI.render`
  is called once per `toggleExpenseStatus` invocation, and that `window.dispatchEvent`
  is NOT called with `app:refresh`.

*(No new test files required — extend the existing `expenses.test.js`.)*

## Sources

### Primary (HIGH confidence)
- Direct source read: `src/ui/expenses.js` lines 63–68, 237–275, 1045–1066 — `toggleExpenseStatus` implementation and both `app:refresh` dispatches
- Direct source read: `src/app.js` lines 139–169 — `renderAll()` and global `app:refresh` listener
- Direct source read: `src/ui/transactions.js` lines 35–40, 575–583 — `transactionUI` init listener and "Mark Paid" button HTML
- Direct source read: `src/ui/transactions.js` line 849 — `window.transactionUI = transactionUI` global registration

### Secondary (MEDIUM confidence)
- Pattern observed across `subscriptions.js`, `assets.js`, `childcare.js`, `debts.js`, `income-sources.js` — all use direct `this.render()` for local mutations, only some use `app:refresh` broadcast

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Bug location: HIGH — confirmed by direct source read, line numbers cited
- Fix approach: HIGH — follows existing project patterns; no new dependencies
- Secondary dispatch at line 1060: HIGH — same pattern, same fix
- `window.debtUI` existence: MEDIUM — needs planner verification in debts.js

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable codebase; changes only if expenses.js is modified)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | Marking an expense as paid triggers at most one render pass per UI module — no double-render from `app:refresh` | Root cause identified at `expenses.js:271` (and secondary at line 1060). Fix: remove redundant dispatch, add explicit `window.transactionUI?.render()` call. Test: spy on render call counts in existing `expenses.test.js`. |
</phase_requirements>
