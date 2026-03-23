# Phase 49: Reconciliation Mode & Legacy Button Audit - Research

**Researched:** 2026-03-22
**Domain:** Transactions tab UI — legacy button audit, reconciliation mode, HTML/JS wiring
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RECON-01 | All legacy Transactions tab buttons (reconciliation mode, Mark All As Paid, Trigger Recurrence) have been audited and either made functional or removed | Full audit complete — see Architecture Patterns for current state of each button |
| RECON-02 | No broken or dead-end buttons remain in the Transactions tab UI | Three buttons audited: two are broken/misowned, one is wired but misowned; clear remediation path identified |
</phase_requirements>

---

## Summary

Phase 49 is a surgical audit-and-fix phase. The Transactions tab in `index.html` currently has three legacy buttons beyond the standard toolbar: `#toggleIncReconBtn` (Reconciliation Mode), `#markAllPaidBtn` (Mark All As Paid), and `#triggerRecurrenceBtn` (Trigger Recurrence). All three have roots in a pre-Phase-45 world where the Transactions tab combined income and expense concerns in a single panel. Phase 45 unified the tab but left these buttons in the HTML without fully resolving their ownership or verifying they work correctly in the current unified architecture.

The core problem is ownership confusion: `markAllPaidBtn` and `triggerRecurrenceBtn` are wired by `expensesUI.setupEventListeners()`, but `expensesUI.render()` silently no-ops on the Transactions tab because it looks for `#expenseBody` which does not exist in that panel. Both buttons perform data mutations that do not need the render to succeed — they modify the database and dispatch `app:refresh`. However, they also call `await this.render()` afterward which silently fails, leaving the UI stale. `#toggleIncReconBtn` is correctly owned by `transactionUI` and works end-to-end. The reconciliation feature itself (toggle, header panel, finalize flow) is already fully implemented.

The remediation is well-bounded: assess each button, fix the two broken/misleading buttons (either make them actually refresh the visible UI, or remove them as legacy noise), and confirm `#toggleIncReconBtn` works correctly. No new features are required — this is a cleanup phase. The planner should produce at most two plans: an audit/fix plan and a verification plan.

**Primary recommendation:** Remove `#markAllPaidBtn` and `#triggerRecurrenceBtn` from the Transactions tab HTML (they are expense-scoped operations and the Transactions tab now shows a unified view where `transactionUI` owns rendering). Verify `#toggleIncReconBtn` end-to-end. Add Vitest tests proving no dead buttons remain.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | (project default) | Unit tests for JS modules | Established in project — all prior phases use it |
| jsdom | (project default) | DOM environment for Vitest | Used in all `*.test.js` files via `@vitest-environment jsdom` |

No new libraries are needed. This phase touches `index.html` (HTML removal), `src/ui/transactions.js` (possible small wiring check), and `src/ui/transactions.test.js` (new test assertions).

**Installation:** None required.

---

## Architecture Patterns

### Button Audit — Current State (HIGH confidence, code-verified)

#### Button 1: `#toggleIncReconBtn` — "Reconciliation Mode"
**Location in HTML:** `index.html` line 159
**Wired by:** `transactionUI.setupEventListeners()` (`transactions.js` line 71–74)
**Handler:** `transactionUI.toggleReconciliationMode()` (`transactions.js` line 180–199)
**What it does:**
- Toggles `this.reconciliationMode` boolean
- Updates button text/class between ghost and primary
- Shows/hides `#incReconHeader` (a card div populated by `renderReconHeader()`)
- Calls `this.render()` which re-renders the whole transactions table

**Reconciliation header contents (when visible):**
- Cleared Total / Month Total / Difference KPIs (income only)
- "Finalize Reconciliation" button (`transactionUI.finalizeReconciliation()`)
- `finalizeReconciliation()` marks cleared income items as `isReconciled: true` and locks them

**Verdict:** FUNCTIONAL. This button works end-to-end. The income reconciliation feature is complete. Needs Vitest test coverage asserting the toggle fires and the header appears/hides.

---

#### Button 2: `#markAllPaidBtn` — "Mark all as paid"
**Location in HTML:** `index.html` lines 160–162 (inside `#markAllPaidRow` div)
**Wired by:** `expensesUI.setupEventListeners()` (`expenses.js` line 170–173)
**Handler:** `expensesUI.handleMarkAllPaid()` (`expenses.js` line 648–658)
**What it does:**
- Confirms with `window.confirm()`
- Calls `recurrentExpenseRepository.markAllAsPaid()` — marks all pending recurrent items in the current calendar month as paid (real data write)
- Calls `triggerHaptic('success')`
- Calls `await this.render()` — this silently no-ops because `expensesUI.render()` line 663 returns early if `document.getElementById('expenseBody')` is null; there is no `#expenseBody` element in `index.html`

**Verdict:** BROKEN — the data write works but UI does not refresh after. The button is scoped to "all recurrent expenses this calendar month" regardless of which month is currently displayed in the Transactions tab. It is an expense-scoped operation masquerading in a unified tab. Remediation: **remove from Transactions tab HTML**. The function belongs to the Expenses tab if that ever has its own panel; for now it is dead weight.

**Note on `markAllAsPaid()` scope:** The repository implementation uses `today.slice(0, 7)` (today's actual month) — not the `transactionUI.currentMonth` the user is viewing. So even if the UI refresh were fixed, clicking this button while viewing a different month would mark a different month's expenses as paid — a UX footgun.

---

#### Button 3: `#triggerRecurrenceBtn` — "Trigger Recurrence"
**Location in HTML:** `index.html` line 163
**Wired by:** `expensesUI.setupEventListeners()` (`expenses.js` line 176–190)
**Handler:** Inline async; calls `templateUI.manualTrigger()` then `await this.render()`
**What `manualTrigger()` does** (`templates.js` line 21–36):
- Calls `RecurrenceManager.checkAndGenerate()`
- On success: shows notification + dispatches `app:refresh` (which triggers all UI modules including `transactionUI` and `expensesUI` to re-render)
- `app:refresh` dispatch means the visible Transactions tab DOES update after a successful trigger

**Verdict:** PARTIALLY FUNCTIONAL — the recurrence check runs and `app:refresh` will refresh `transactionUI`. However: (1) the button is owned/wired by `expensesUI`, not `transactionUI`; (2) `await this.render()` after the trigger silently no-ops (same `#expenseBody` null guard); (3) the button's purpose (trigger automatic recurrence) is an admin/debug operation of questionable value as a permanently visible toolbar button. Remediation: **remove from Transactions tab HTML**. The `app:refresh` dispatch ensures nothing breaks when the button is gone — `RecurrenceManager` runs on `app:init` automatically.

---

### Recommended Project Structure (no change)
```
src/ui/
├── transactions.js    # Owns Transactions tab rendering and toolbar
├── transactions.test.js  # Add RECON-01/RECON-02 test coverage here
├── expenses.js        # Owns expenses logic; no changes needed
index.html             # Remove markAllPaidBtn, triggerRecurrenceBtn, markAllPaidRow
```

### Pattern: TDD Wave 0 First
All prior phases (43, 44, 45, 46, 47, 48) used TDD: write failing stubs first, then implement. Phase 49 is no different. Wave 0 test stubs for RECON-01 and RECON-02 must be RED before the fix commits.

### Pattern: Null-guard always present in `setupEventListeners`
Both `transactionUI` and `expensesUI` guard every `document.getElementById()` call with `if (element)`. Removing buttons from HTML therefore needs no JS changes to `expensesUI.setupEventListeners()` — the guards already handle missing elements gracefully.

### Pattern: Test fixture reflects post-fix state
Established in Phase 45 (TRANS-03 test was written to assert the post-fix state, not the pre-fix state). RECON-01/02 tests must assert the final desired state: `#markAllPaidBtn` and `#triggerRecurrenceBtn` are null; `#toggleIncReconBtn` exists and its handler fires correctly.

### Anti-Patterns to Avoid
- **Testing the pre-fix state:** Write tests that assert the DESIRED final state. Tests go RED before the fix, GREEN after.
- **Fixing `expensesUI.render()` to handle the Transactions tab:** This is out of scope — `expensesUI` correctly belongs to its own panel. The fix is HTML removal, not JS surgery.
- **Adding a "mark all expenses paid" feature to `transactionUI`:** This was not requested by RECON-01/02 and would add new feature scope to what is explicitly a cleanup phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confirming button removal works | Manual browser check only | Vitest + jsdom DOM assertion | Same pattern used for TRANS-03 in Phase 45 — `expect(document.getElementById('markAllPaidBtn')).toBeNull()` |
| Reconciliation mode toggle test | Complex DOM simulation | Direct call to `transactionUI.toggleReconciliationMode()` + assert `reconciliationMode` property | Same pattern used throughout transactions.test.js |

---

## Common Pitfalls

### Pitfall 1: Assuming `expensesUI.render()` works on Transactions tab
**What goes wrong:** Developer thinks `handleMarkAllPaid` is fully functional because the data write succeeds and there are no thrown errors.
**Why it happens:** `expensesUI.render()` returns early silently when `#expenseBody` is null — no error, no console warning.
**How to avoid:** Check what the render call actually updates. The Transactions tab uses `#incBody` rendered by `transactionUI`, not `#expenseBody`.
**Warning signs:** The UI does not change after clicking "Mark all as paid" despite the database being updated.

### Pitfall 2: Forgetting `markAllAsPaid()` uses today's date, not the current viewed month
**What goes wrong:** The button would mark expenses in the current calendar month, even if the user is viewing March while today is April.
**Why it happens:** `markAllAsPaid()` in `repository.js` line 139 calls `new Date().toISOString().slice(0, 7)` unconditionally.
**How to avoid:** This is a second reason to remove rather than fix the button.

### Pitfall 3: Removing buttons breaks `expensesUI` wiring
**What goes wrong:** Removing `#markAllPaidBtn` from HTML causes `expensesUI.setupEventListeners()` to fail.
**Why it happens:** Assumption that `addEventListener` without null guard throws.
**How to avoid:** Check `expenses.js` line 170: `if (markAllBtn)` — the null guard is already there. Removal is safe.

### Pitfall 4: `#markAllPaidRow` wrapper div left behind
**What goes wrong:** Removing only `#markAllPaidBtn` leaves an empty `#markAllPaidRow` div in the toolbar.
**Why it happens:** The button is wrapped in an extra `<div id="markAllPaidRow">` with no other purpose.
**How to avoid:** Remove both the button AND its wrapping div.

---

## Code Examples

### Current HTML (lines 159–163) — pre-fix state
```html
<!-- From index.html lines 159–163 -->
<button id="toggleIncReconBtn" class="ghost sm">🔍 Reconciliation Mode</button>
<div id="markAllPaidRow">
  <button id="markAllPaidBtn" class="ghost sm">✓ Mark all as paid</button>
</div>
<button id="triggerRecurrenceBtn" class="ghost sm">🔁 Trigger Recurrence</button>
```

### Target HTML — post-fix state (only keep functional reconciliation button)
```html
<!-- index.html: markAllPaidRow div and triggerRecurrenceBtn removed -->
<button id="toggleIncReconBtn" class="ghost sm">🔍 Reconciliation Mode</button>
```

### Vitest test pattern for DOM removal (from TRANS-03, Phase 45)
```javascript
// Source: src/ui/transactions.test.js lines 190–201 (TRANS-03 pattern)
describe('RECON-01: no dead buttons in Transactions tab', () => {
  it('markAllPaidBtn does not exist in Transactions tab HTML', () => {
    document.body.innerHTML = `
      <div data-panel="transactions">
        <button id="toggleIncReconBtn">Reconciliation Mode</button>
      </div>
    `;
    expect(document.getElementById('markAllPaidBtn')).toBeNull();
    expect(document.getElementById('triggerRecurrenceBtn')).toBeNull();
  });
});
```

### Vitest test pattern for reconciliation toggle (existing `transactionUI` pattern)
```javascript
// Mirrors pattern from existing transactionUI tests
describe('RECON-02: reconciliation mode toggles correctly', () => {
  it('toggleReconciliationMode flips reconciliationMode and updates button', () => {
    document.body.innerHTML = `
      <div data-panel="transactions">
        <button id="toggleIncReconBtn" class="ghost sm">Reconciliation Mode</button>
        <div id="incReconHeader" class="hidden"></div>
        <tbody id="incBody"></tbody>
      </div>
    `;
    expect(transactionUI.reconciliationMode).toBe(false);
    transactionUI.toggleReconciliationMode();
    expect(transactionUI.reconciliationMode).toBe(true);
    expect(document.getElementById('incReconHeader').classList.contains('hidden')).toBe(false);
    transactionUI.toggleReconciliationMode();
    expect(transactionUI.reconciliationMode).toBe(false);
    expect(document.getElementById('incReconHeader').classList.contains('hidden')).toBe(true);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Income and Expenses tabs | Unified Transactions tab with merged rows | Phase 45 | `expensesUI` and `transactionUI` both render into `#incBody` region; old expense-scoped toolbar buttons became misowned |
| `#toggleExpReconBtn` for expense reconciliation | Removed (TRANS-03, Phase 45) | Phase 45 | `expensesUI.toggleReconciliationMode()` exists but has no trigger in Transactions tab |
| Manual recurrence trigger as primary UX | `RecurrenceManager` runs on `app:init` automatically | Pre-Phase 45 | `triggerRecurrenceBtn` is now a debug tool; user does not need it in normal workflow |

**Deprecated/outdated:**
- `#markAllPaidRow` + `#markAllPaidBtn`: Were useful when Transactions tab was purely expense-focused. Now misowned by `expensesUI` which can't render back to the Transactions tab.
- `#triggerRecurrenceBtn`: Useful during recurrence system development (pre-v3). Now automatic on init; button is debug scaffolding that was never removed.

---

## Open Questions

1. **Should expense reconciliation mode (`expensesUI.toggleReconciliationMode`) be accessible from the Transactions tab?**
   - What we know: RECON-01 asks for audit + fix or remove. The existing `#expReconHeader` div is still in the Transactions tab HTML (line 178). `expensesUI` has a complete reconciliation feature that no-ops its render.
   - What's unclear: Was expense reconciliation deliberately preserved as a deferred feature?
   - Recommendation: Out of scope for Phase 49. The `#expReconHeader` div and `expSearch` inputs in the Transactions tab are not referenced by any button that a user can click (there is no `#toggleExpReconBtn` after Phase 45). Leave them in place — they do not cause visible dead buttons.

2. **Should `finalizeReconciliation()` use `confirm()` or `modalUI.confirm()`?**
   - What we know: `finalizeReconciliation()` in `transactions.js` line 638 uses `window.confirm()` — all other confirmation dialogs in the codebase use `modalUI.confirm()`.
   - Recommendation: Not required by RECON-01/02. Leave for a future polish phase unless the planner identifies it as in-scope cleanup.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project default) |
| Config file | `vitest.config.js` (project root) |
| Quick run command | `npx vitest run src/ui/transactions.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RECON-01 | `#markAllPaidBtn` and `#triggerRecurrenceBtn` are absent from Transactions tab DOM | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |
| RECON-02 | `#toggleIncReconBtn` fires `toggleReconciliationMode()`; `incReconHeader` toggles hidden class | unit | `npx vitest run src/ui/transactions.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/ui/transactions.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/ui/transactions.test.js` — add RECON-01 describe block asserting `#markAllPaidBtn` null + `#triggerRecurrenceBtn` null
- [ ] `src/ui/transactions.test.js` — add RECON-02 describe block asserting reconciliation toggle behavior

*(Existing test file exists — gaps are new describe blocks within the existing file, not a new file)*

---

## Sources

### Primary (HIGH confidence)
- `src/ui/transactions.js` — direct code read; all reconciliation mode wiring verified
- `src/ui/expenses.js` — direct code read; `handleMarkAllPaid`, `triggerRecurrenceBtn` handler, `render()` null-guard verified
- `index.html` — direct code read; all three button elements located and confirmed
- `src/ui/templates.js` — direct code read; `manualTrigger()` behavior verified
- `src/db/repository.js` — direct code read; `markAllAsPaid()` date-scoping confirmed
- `.planning/phases/45-transactions-tab-fixes/45-RESEARCH.md` — Phase 45 research: TRANS-03 context and decisions

### Secondary (MEDIUM confidence)
- `src/ui/transactions.test.js` — existing test file reviewed; TRANS-03 test pattern confirmed for re-use
- `.planning/STATE.md` — Phase 45 decisions confirm `#toggleExpReconBtn` was removed and reconciliation mode deferred

---

## Metadata

**Confidence breakdown:**
- Button audit (current state): HIGH — code-verified, all three buttons traced end-to-end
- Remediation recommendation: HIGH — null guards in place, removal is safe; TRANS-03 precedent
- Test patterns: HIGH — existing test patterns in `transactions.test.js` directly applicable

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable codebase; no fast-moving dependencies)
