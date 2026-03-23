# Phase 44: Income Tab Cards - Research

**Researched:** 2026-03-20
**Domain:** Vanilla JS UI extension — income source cards, per-source confirmation modal, IndexedDB persistence
**Confidence:** HIGH

---

## Summary

Phase 44 refactors the Income tab (`src/ui/income-sources.js`) from its current flat-table layout to a card-per-source layout that visually matches the Debt tab card layout, then adds a per-source modal showing income entries (upcoming and recent) with confirm, reschedule, and amount-adjust actions.

The infrastructure is almost entirely in place. The existing `incomeSourceRepository.getActive()` already fetches active sources. The `getUpcomingIncomeEvents()` utility in `src/utils/income.js` generates projected income events per source. The `incomeRepository.add()` call for confirming income already exists inside `confirmIncome()` and `adjustIncome()` on the `incomeSources` object. The `modalUI.show()` system from `render.js` is the standard modal surface. The Debt tab card HTML (class `"card clickable-card"` inside `"grid3"`) is the visual target.

What is missing: (1) replacing `_renderSourceList()` (currently a `<table>`) with a card grid identical to the debt tab layout, (2) replacing the current flat pending-section list with a per-source modal that opens when a card is clicked, and (3) adding date-reschedule and amount-adjust capabilities inside that modal. The modal should follow the same pattern as the debt history modal (`openHistoryModal` in `debts.js`): `modalUI.show(title, content, footerButtons)`, populate the body with a scrollable entry list, and post-render DOM updates for confirm/adjust state.

There are no new dependencies required. No schema changes are needed — confirmed income goes to `incomeRepository.add()` exactly as it does today. Date overrides and amount overrides are stored as confirmed entries (not as modifications to the source schedule), consistent with the current `confirmIncome` / `adjustIncome` pattern.

**Primary recommendation:** Replace `_renderSourceList()` with `_renderSourceCards()` that emits `<div class="card clickable-card">` cards inside `<div class="grid3">`. Add `openIncomeModal(sourceId)` following the `openHistoryModal` pattern from `debts.js`. Use event delegation (not inline `onclick` on the card wrapper) to call `openIncomeModal` so the `safeHTML` DOMPurify restriction on complex attribute values is not a problem.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INCOME-01 | Income tab displays each income source as a card (consistent with Debt tab card layout) | `debts.js` uses `class="card clickable-card"` inside `class="grid3"`; `_renderSourceList` currently uses `<table>`; replacement is a card grid in the same style |
| INCOME-02 | User can click an income source card to open a modal showing income entries to confirm | `modalUI.show()` from `render.js` is the standard modal system; `getUpcomingIncomeEvents()` generates projected events for the source; `incomeRepository.getAll()` (filtered by source name) gives historical confirmed entries |
| INCOME-03 | User can confirm an income entry as received in the income modal | `incomeRepository.add()` already does this; the modal just needs to call it with the projected event data |
| INCOME-04 | User can change the date of an upcoming income entry in the income modal | Date override is stored as a confirmed entry with the user-supplied date — no schema change; a date `<input>` in the modal row with a save button writes via `incomeRepository.add()` |
| INCOME-05 | User can adjust the amount of a specific income entry in the income modal | Amount override reuses the existing `adjustIncome()` path with a user-supplied override amount |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js v7 | v7 (schema v23) | IndexedDB ORM | Project standard; `incomeRepository` and `incomeSourceRepository` are the persistence targets |
| DOMPurify | installed | XSS-safe HTML templating | `safeHTML` tag from `src/ui/render.js` — required for all innerHTML; `onclick` in ALLOWED_ATTR |
| date-fns | installed | (not needed for this phase) | Not required — `income.js` uses its own UTC date arithmetic |

### No new dependencies required

This phase is a UI-only refactor and extension. No new packages.

### Supporting Utilities (already in codebase)

| Utility | Location | Purpose |
|---------|----------|---------|
| `getUpcomingIncomeEvents` | `src/utils/income.js` | Generate projected income events per source with banking-calendar adjustment |
| `getNextIncomeEvent` | `src/utils/income.js` | Per-source next event (used internally by getUpcomingIncomeEvents) |
| `incomeSourceRepository` | `src/db/repository.js` | CRUD for income source configuration records |
| `incomeRepository` | `src/db/repository.js` | Write confirmed income entries |
| `modalUI` | `src/ui/render.js` | Standard modal: `show(title, content, footerButtons)`, `close()` |
| `safeHTML` | `src/ui/render.js` | DOMPurify template tag for safe innerHTML |
| `formatGBP` | `src/utils/currency.js` | Format pence integer as £ string |
| `fromPence` | `src/utils/currency.js` | Convert pence integer to pounds float |
| `triggerHaptic` | `src/utils/haptics.js` | Haptic feedback on confirm |
| `notificationUI` | `src/ui/notifications.js` | Error/success toasts |

---

## Architecture Patterns

### Recommended Project Structure

No new files required for the core feature. All changes go into:

```
src/ui/income-sources.js    # replace _renderSourceList, add openIncomeModal, _buildIncomeModalHTML,
                             # _renderIncomeEntryStatuses; update _bindEvents for card click delegation
src/ui/income-sources.js    # existing confirmIncome / adjustIncome methods remain but are called from
                             # modal instead of from the pending-cards section
```

Tests go into:
```
src/ui/income-sources.test.js    # new test file (no existing test file for this module)
```

### Pattern 1: Card Grid Layout (Debt Tab Pattern)

The debt tab uses `class="card clickable-card"` inside `class="grid3"`:

```javascript
// Source: src/ui/debts.js lines 896-958
_renderSourceCards(sources) {
  if (!sources.length) {
    return `<div style="text-align:center;color:var(--text-muted);padding:32px 16px">
      No income sources configured.
    </div>`;
  }

  const cards = sources.map(s => {
    const ruleLabel = RULE_LABELS[s.payDateRule]?.(s) ?? s.payDateRule;
    return safeHTML`
      <div class="card clickable-card"
           data-source-id="${s.id}"
           data-action="open-income-modal"
           style="border:1px solid var(--border); padding:15px; display:flex;
                  flex-direction:column; gap:8px; cursor:pointer; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <div>
            <h3 style="margin:0; font-size:1.1rem">${s.name}</h3>
            <span class="pill" style="font-size:0.7rem">${ruleLabel}</span>
          </div>
          <div style="display:flex; gap:4px">
            <button class="sm ghost" data-action="edit-source" data-id="${s.id}"
                    onclick="event.stopPropagation()">Edit</button>
            <button class="sm ghost danger" data-action="delete-source" data-id="${s.id}"
                    onclick="event.stopPropagation()">Delete</button>
          </div>
        </div>
        <div style="font-size:1.4rem; font-weight:bold; margin:5px 0">
          <span class="privacy-blur">${formatGBP(s.monthlyAmount)}</span>
        </div>
        <div style="margin-top:auto; padding-top:10px; border-top:1px solid var(--border);">
          <span class="hint" style="font-size:0.7rem">Click to view income entries</span>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="grid3">${cards}</div>`;
}
```

**Key decision:** Use `data-action="open-income-modal"` on the card `<div>` and handle it in the existing `_boundClickHandler` delegation. Do NOT use inline `onclick="incomeSources.openIncomeModal(...)"` on the card wrapper — DOMPurify allows `onclick` only in simple patterns; complex expressions with method calls can be stripped. Using `data-action` + delegated handler is cleaner and consistent with the existing `income-sources.js` event model.

### Pattern 2: Opening a Per-Source Modal

Follow the `openHistoryModal` pattern from `debts.js` exactly:

```javascript
// Source: src/ui/debts.js lines 967-999
async openIncomeModal(sourceId) {
  this.activeSourceId = sourceId;
  const source = await incomeSourceRepository.get(sourceId);
  if (!source) return;

  const title = `Income: ${source.name}`;
  const content = this._buildIncomeModalHTML(source);
  const footer = [
    { label: 'Close', className: 'ghost', onClick: () => this._closeIncomeModal() }
  ];

  modalUI.show(title, content, footer);

  // Post-render: populate entry statuses (confirm/confirmed state)
  await this._renderIncomeEntryStatuses(sourceId);

  if (modalUI.elements.close) {
    modalUI.elements.close.onclick = () => this._closeIncomeModal();
  }
},

_closeIncomeModal() {
  this.activeSourceId = null;
  modalUI.close();
},
```

**Important:** `modalUI.init()` is called in `debts.js`'s `init()`. The `incomeSources` module does NOT currently call `modalUI.init()`. Phase 44 must add `modalUI.init()` to `incomeSources.init()`, or verify it is safe to call it multiple times (it is — `if (this._initialized) return` guards it).

### Pattern 3: Building the Modal HTML

The modal body should show:
1. A header row with the source name, pay rule, and monthly amount
2. A scrollable list of income entries — both upcoming (projected) and recent (confirmed from `incomeRepository`)
3. Each row has date, amount, status, and action buttons (injected post-render via `_renderIncomeEntryStatuses`)

```javascript
_buildIncomeModalHTML(source) {
  const ruleLabel = RULE_LABELS[source.payDateRule]?.(source) ?? source.payDateRule;
  const upcoming = getUpcomingIncomeEvents([source], lookbackDate(), 10)
    .filter(ev => ev.adjustedDate <= lookForwardDate());

  if (!upcoming.length) {
    return safeHTML`
      <p style="color:var(--muted)">No upcoming income entries found for this source.</p>
    `;
  }

  const liItems = upcoming.map(ev => {
    const dateStr = formatDate(ev.adjustedDate);
    const amount = formatGBP(ev.amount);
    return `<li class="income-modal-entry" style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">`
      + `<span>${dateStr}</span>`
      + `<span>${amount}</span>`
      + `<span class="income-entry-status" id="income-entry-status-${source.id}-${ev.adjustedDate}"></span>`
      + `</li>`;
  }).join('');

  return `<ul id="income-modal-list-${source.id}" class="income-modal-list" style="list-style:none;padding:0;margin:0 0 16px 0">${liItems}</ul>`;
}
```

### Pattern 4: Post-Render Entry Status Population

Mirrors `_renderLoanPaymentStatuses` from `debts.js`. This runs after `modalUI.show()` so the DOM is available:

```javascript
async _renderIncomeEntryStatuses(sourceId) {
  const source = await incomeSourceRepository.get(sourceId);
  if (!source) return;

  const upcoming = getUpcomingIncomeEvents([source], lookbackDate(), 10)
    .filter(ev => ev.adjustedDate <= lookForwardDate());

  // Load confirmed income entries for this source
  const allIncome = await incomeRepository.getAll();  // or use getByMonth for perf
  const confirmedDates = new Set(
    allIncome
      .filter(e => e.source === source.name)
      .map(e => e.date)
  );

  for (const ev of upcoming) {
    const span = document.getElementById(`income-entry-status-${sourceId}-${ev.adjustedDate}`);
    if (!span) continue;

    const isConfirmed = confirmedDates.has(ev.adjustedDate);
    if (isConfirmed) {
      span.innerHTML = '<span class="badge badge-success">Received</span>';
    } else {
      span.innerHTML = `<button class="sm primary" onclick="showIncomeConfirmPrompt(${sourceId}, '${ev.adjustedDate}', ${ev.amount})">Confirm</button>`;
    }
  }
},
```

**Note on `incomeRepository.getAll()`:** The `incomeRepository` in `repository.js` only defines `getByMonth` and `getThreeMonthHistory` as custom methods beyond the base repository. The base `getAll()` is inherited from `createBaseRepository`. It is safe to call `incomeRepository.getAll()`.

**Matching on source name:** Confirmed income entries in `incomeRepository` are linked to a source by the `source` string field (e.g., `"Salary"`). This is the only link — there is no `linkedSourceId` field. Cross-reference by `e.source === source.name`.

### Pattern 5: Confirm, Reschedule, Adjust Entry Actions

For entries that are not yet confirmed, show action buttons inside the status span. For INCOME-04 (reschedule) and INCOME-05 (adjust amount), inline edit patterns apply:

```javascript
// window-global handlers, registered in init() following the showMarkPaidPrompt pattern
window.showIncomeConfirmPrompt = (sourceId, adjustedDate, amountPence) => {
  const span = document.getElementById(`income-entry-status-${sourceId}-${adjustedDate}`);
  if (!span) return;
  const amountPounds = (amountPence / 100).toFixed(2);
  // Inline prompt with: confirm button, date override input, amount override input
  span.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:0.8rem">Date:</label>
        <input type="date" id="income-date-override-${sourceId}-${adjustedDate}"
               value="${adjustedDate}" style="width:140px">
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:0.8rem">Amount (£):</label>
        <input type="number" step="0.01" min="0"
               id="income-amount-override-${sourceId}-${adjustedDate}"
               value="${amountPounds}" style="width:100px">
      </div>
      <div style="display:flex;gap:6px">
        <button class="sm primary"
                onclick="confirmIncomeEntry(${sourceId}, '${adjustedDate}')">Save</button>
        <button class="sm ghost"
                onclick="cancelIncomeConfirm(${sourceId}, '${adjustedDate}', ${amountPence})">Cancel</button>
      </div>
    </div>
  `;
};

window.confirmIncomeEntry = async (sourceId, adjustedDate) => {
  const source = await incomeSourceRepository.get(sourceId);
  if (!source) return;
  const dateInput = document.getElementById(`income-date-override-${sourceId}-${adjustedDate}`);
  const amtInput = document.getElementById(`income-amount-override-${sourceId}-${adjustedDate}`);
  const finalDate = dateInput?.value || adjustedDate;
  const finalAmountPounds = parseFloat(amtInput?.value || '0') || 0;
  await incomeRepository.add({
    date: finalDate,
    source: source.name,
    amount: finalAmountPounds,   // repository converts to pence via toPence
    categoryId: null,
    isCleared: false,
    isReconciled: false,
  });
  triggerHaptic('success');
  await incomeSources.openIncomeModal(sourceId);  // refresh modal
  if (window.app) window.app.renderAll();
};
```

This single inline prompt handles INCOME-03 (confirm), INCOME-04 (reschedule via date input), and INCOME-05 (adjust via amount input) in one action.

### Pattern 6: Event Delegation for Card Click

In the existing `_boundClickHandler`, add handling for `data-action="open-income-modal"` before the existing `show-add-form` handler:

```javascript
if (action === 'open-income-modal') {
  const card = btn.closest('[data-source-id]');
  if (!card) return;
  const id = Number(card.dataset.sourceId);
  await this.openIncomeModal(id);
  return;
}
```

### Anti-Patterns to Avoid

- **Don't inline `onclick="incomeSources.openIncomeModal(id)"` on the card div.** The card is rendered via `safeHTML` / `container.innerHTML = ...`. `onclick` on a card wrapper with a method call works, but event delegation via `data-action` is cleaner and consistent with the existing module pattern.
- **Don't create a new modal system.** Use the existing `modalUI.show()` from `render.js`.
- **Don't use `innerHTML` directly on the container.** Always use `safeHTML` tag or plain string + DOMPurify, consistent with the rest of the codebase.
- **Don't pass pence to `incomeRepository.add()` for the amount.** The repository's `penceFields: ['amount']` means it calls `toPence()` on `amount` before saving. Always pass pounds (float).
- **Don't add a `linkedSourceId` field to `incomeRepository`.** The current schema links by `source` name string. Adding a foreign key requires a schema version bump which is out of scope for this phase.
- **Don't replace the add/edit/delete source form flow.** Phase 44 changes only the card display and adds the modal. Source CRUD (add/edit/delete) stays as-is.
- **Don't call `modalUI.init()` more than once.** It is idempotent (guards with `_initialized`), but call it once in `incomeSources.init()` alongside the `window.addEventListener` setup.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Income event projection | Custom date loop per source | `getUpcomingIncomeEvents(sources, fromDate, limit)` | Already handles banking-calendar adjustment, weekends, UK bank holidays, all three payDateRule types |
| Modal overlay | Custom dialog div | `modalUI.show(title, content, footer)` | Single overlay already in DOM; Esc/backdrop/X button wired up |
| Safe HTML rendering | Direct `innerHTML` with template strings | `safeHTML` tag from `render.js` | DOMPurify enforced throughout codebase |
| Pence/pounds conversion | Manual `* 100` | `toPence` / `fromPence` from `currency.js` | Repository auto-converts pence fields; passing pounds to `add()` is correct |
| Amount formatting | Custom `£` formatter | `formatGBP(pence)` | Consistent GBP formatting with privacy-blur support |

---

## Common Pitfalls

### Pitfall 1: incomeRepository.add() Expects Pounds Not Pence

**What goes wrong:** `incomeRepository.add()` has `penceFields: ['amount']` — it calls `toPence()` before saving. If the caller passes pence (integer), the stored value is 100x too large.

**Why it happens:** `event.amount` from `getUpcomingIncomeEvents` is in PENCE (it is `source.monthlyAmount` which is stored in pence). The existing `confirmIncome()` already handles this with `amount: fromPence(event.amount)`.

**How to avoid:** Always call `fromPence(event.amount)` when passing an event's amount to `incomeRepository.add()`. For user-overridden amounts, parse `parseFloat(input.value)` directly — this is already in pounds.

**Warning signs:** Income amounts in the app appear 100x larger than expected.

### Pitfall 2: Confirmed Income Matched by Source Name (Not ID)

**What goes wrong:** `incomeRepository` records store `source: sourceName` (a string). There is no `linkedSourceId`. If a source is renamed, confirmed entries no longer match.

**Why it happens:** The schema was designed before per-source IDs were needed for the income table.

**How to avoid:** Match on `e.source === source.name` when querying confirmed entries. This is the existing behavior — don't try to add a FK link in this phase.

**Warning signs:** Modal shows all entries as unconfirmed even after prior confirmations.

### Pitfall 3: modalUI.init() Not Called in incomeSources.init()

**What goes wrong:** `modalUI.show()` silently fails if `modalUI.elements.overlay` is null (because `init()` was never called to re-query the DOM after initial `document.getElementById` at module load time).

**Why it happens:** `render.js` calls `document.getElementById` at module parse time (before DOM is ready in some environments). `modalUI.init()` re-queries the DOM. `debts.js` calls `modalUI.init()` in its `init()`. `income-sources.js` does not currently call it.

**How to avoid:** Add `modalUI.init()` to `incomeSources.init()`:
```javascript
async init() {
  modalUI.init();
  window.addEventListener('app:refresh', () => this.render());
  this._registerGlobalHandlers();
  await this.render();
},
```

**Warning signs:** Clicking a card does nothing; modal does not appear; no JS error visible.

### Pitfall 4: safeHTML Template Tag on the Card div — DOMPurify Strips onclick on Wrapper Elements

**What goes wrong:** Placing `onclick="incomeSources.openIncomeModal(${s.id})"` directly on the card `<div>` inside a `safeHTML` template literal works IF the ALLOWED_ATTR includes `onclick`. It does — but the safer pattern used elsewhere is `data-action` + delegation.

**Why it happens:** DOMPurify allows `onclick` in this codebase (configured in `render.js`). However, if the onclick expression is complex (contains `.` method calls or embedded single quotes), DOMPurify may mangle it.

**How to avoid:** Use `data-action="open-income-modal"` on the card div and handle it in `_boundClickHandler`. Only use simple numeric `onclick` values like `onclick="event.stopPropagation()"` for the stop-propagation on edit/delete buttons.

**Warning signs:** Card click does nothing; checking the rendered DOM shows no `onclick` attribute on the card div.

### Pitfall 5: Event Accumulation on Re-render

**What goes wrong:** Each call to `render()` calls `_bindEvents(container)` which re-attaches `_boundClickHandler`. Without removing the old handler first, every click fires N times (once per render).

**Why it happens:** Re-renders on `container.innerHTML = ...` leave old listeners attached.

**How to avoid:** The existing code already handles this:
```javascript
if (this._boundClickHandler) {
  container.removeEventListener('click', this._boundClickHandler);
}
```
Keep this pattern. Do NOT add additional event listeners for the card click. Everything goes through the single `_boundClickHandler`.

### Pitfall 6: lookbackDate / lookForwardDate Window May Show No Events

**What goes wrong:** If the current date is near month boundaries or the source has an unusual payDateRule, the ±45 day window may produce 0 entries.

**Why it happens:** The existing pending-section uses the same window and shows nothing if no events fall in range.

**How to avoid:** In the modal, extend the look-forward window to 90 days (3 months) and show at least 3 upcoming events. Use `getUpcomingIncomeEvents([source], lookbackDate(), 6)` filtered to `adjustedDate <= lookForwardDate90()` where `lookForwardDate90` returns today + 90 days. This ensures users always see upcoming entries even if the next payday is far out.

---

## Code Examples

### Complete Card Render

```javascript
// Source: pattern derived from src/ui/debts.js lines 896-958
_renderSourceCards(sources) {
  if (!sources.length) {
    return `<div style="text-align:center;color:var(--text-muted);padding:32px 16px">
      No income sources configured. Add one above.
    </div>`;
  }
  const cards = sources.map(s => {
    const labelFn = RULE_LABELS[s.payDateRule];
    const ruleLabel = labelFn ? labelFn(s) : s.payDateRule;
    return safeHTML`
      <div class="card clickable-card"
           data-source-id="${s.id}"
           data-action="open-income-modal"
           style="border:1px solid var(--border); padding:15px; display:flex;
                  flex-direction:column; gap:8px; cursor:pointer; position:relative;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start">
          <div>
            <h3 style="margin:0; font-size:1.1rem">${s.name}</h3>
            <span class="pill" style="font-size:0.7rem">${ruleLabel}</span>
          </div>
          <div style="display:flex; gap:4px">
            <button class="sm ghost" data-action="edit-source" data-id="${s.id}"
                    onclick="event.stopPropagation()">Edit</button>
            <button class="sm ghost danger" data-action="delete-source" data-id="${s.id}"
                    onclick="event.stopPropagation()">Delete</button>
          </div>
        </div>
        <div style="font-size:1.4rem; font-weight:bold; margin:5px 0">
          <span class="privacy-blur">${formatGBP(s.monthlyAmount)}</span>
        </div>
        <div style="margin-top:auto; padding-top:10px; border-top:1px solid var(--border);">
          <span class="hint" style="font-size:0.7rem">Click to view income entries</span>
        </div>
      </div>
    `;
  }).join('');
  return `<div class="grid3">${cards}</div>`;
},
```

### incomeRepository.getAll() Usage for Confirmed Lookup

```javascript
// incomeRepository inherits getAll() from createBaseRepository
// Source: src/db/repository.js lines 29-45 (createBaseRepository)
const allIncome = await incomeRepository.getAll();
const confirmedForSource = allIncome.filter(e => e.source === source.name);
const confirmedDates = new Set(confirmedForSource.map(e => e.date));
```

### Confirm Entry (handles INCOME-03, INCOME-04, INCOME-05)

```javascript
// Source: pattern derived from confirmIncome / adjustIncome in income-sources.js
await incomeRepository.add({
  date: finalDate,          // INCOME-04: user-supplied date or original adjustedDate
  source: source.name,
  amount: finalAmountPounds, // INCOME-05: user-supplied or original amount in POUNDS
  categoryId: null,
  isCleared: false,
  isReconciled: false,
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Income tab shows flat `<table>` of source rows | Phase 44: card grid identical to Debt tab | Phase 44 | Consistent visual language across Debt and Income tabs |
| Pending income confirmations shown as a flat card list above the table | Phase 44: per-source modal opened by clicking a card | Phase 44 | Users confirm income in context of the source; no separate pending section needed |
| `confirmIncome()` / `adjustIncome()` called from pending section buttons | Phase 44: same functions called from inside the modal | Phase 44 | Logic unchanged; only the trigger point changes |

**Existing behavior to preserve:**
- Add/Edit/Delete source form (inline form with `#income-source-form-wrapper`) — keep as-is.
- `confirmIncome()` and `adjustIncome()` method signatures — keep for backward-compatibility with tests.
- `lookbackDate()` and `lookForwardDate()` helpers — keep; also add `lookForwardDate90()` for the modal.
- The `_boundClickHandler` removal-before-re-add pattern — keep to prevent listener accumulation.

---

## Open Questions

1. **Should the old "Upcoming Income to Confirm" flat pending section be removed?**
   - What we know: The requirements say the modal is the new UX. The pending section currently uses `id="incomePendingConfirmations"` which is a static `<div>` in `index.html`.
   - What's unclear: Whether the flat pending section should be hidden/removed or kept as a summary view.
   - Recommendation: Remove the pending section from `render()` — the per-card modal replaces it. The `id="incomePendingConfirmations"` div in `index.html` can stay but will be empty.

2. **How many entries to show in the modal?**
   - What we know: The ±45 day window in the current pending section may show 0-1 entries per source. The modal should always show something useful.
   - What's unclear: Whether to show only upcoming or also recent confirmed entries.
   - Recommendation: Show upcoming entries in a ±90 day window (today-45 to today+90). Optionally show the last 3 confirmed entries at the bottom of the modal. This gives the user context about recent confirmations without overwhelming the modal.

3. **Does `incomeRepository` have `getAll()` available?**
   - What we know: `incomeRepository = { ...createBaseRepository(db.income, ['amount'], integrityDefaults), getByMonth, getThreeMonthHistory }`. The `createBaseRepository` function explicitly defines `getAll: async () => await table.toArray()`.
   - Conclusion: Yes, `incomeRepository.getAll()` is available and will return all income rows unfiltered. HIGH confidence.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (resolved from node_modules; no explicit version pinned) |
| Config file | vitest.config.js (project root) |
| Quick run command | `npx vitest run src/ui/income-sources.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INCOME-01 | `render()` renders `<div class="card clickable-card">` per active source inside `<div class="grid3">` | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ Wave 0 |
| INCOME-01 | `render()` renders no cards when source list is empty | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ Wave 0 |
| INCOME-02 | `openIncomeModal(id)` calls `modalUI.show()` with title containing source name | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ Wave 0 |
| INCOME-02 | `openIncomeModal(id)` returns early when source not found | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ Wave 0 |
| INCOME-03 | `confirmIncome(event)` calls `incomeRepository.add()` with `amount` in pounds (not pence) | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ Wave 0 |
| INCOME-04 | `confirmIncome`-path with date override writes the user-supplied date to `incomeRepository.add()` | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ Wave 0 |
| INCOME-05 | `adjustIncome(event, overrideAmountPounds)` passes override amount (not event.amount) to `incomeRepository.add()` | unit | `npx vitest run src/ui/income-sources.test.js` | ❌ Wave 0 (existing `adjustIncome` method; verify existing behavior) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/ui/income-sources.test.js`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/ui/income-sources.test.js` — new test file covering INCOME-01 through INCOME-05
- [ ] Mock pattern from `income-spending-settings.test.js` is the closest template: `vi.mock('../db/repository.js', ...)` + `vi.mock('./render.js', ...)` + `vi.mock('../utils/haptics.js', ...)`
- [ ] `render.js` mock must include `modalUI: { init: vi.fn(), show: vi.fn(), close: vi.fn(), elements: {...} }` (same as `debts.test.js` mock)
- [ ] `incomeSourceRepository` mock must implement `get(id)` returning a source record and `getActive()` returning an array
- [ ] `incomeRepository` mock must implement `add(data)` and `getAll()` returning an array

*(No framework install needed — Vitest already configured.)*

---

## Sources

### Primary (HIGH confidence)

- `src/ui/income-sources.js` (full read) — current module structure, existing `confirmIncome`, `adjustIncome`, `_renderSourceList`, `_renderPendingCard`, `_bindEvents`, helper functions
- `src/ui/debts.js` (partial read, lines 896-1134) — debt card HTML structure, `openHistoryModal` pattern, `_renderLoanPaymentStatuses` post-render pattern, `window.showLoanPaymentPrompt` / `window.confirmLoanPayment` global handler registration
- `src/ui/render.js` (full read) — `modalUI.show()`, `safeHTML` DOMPurify config, `ALLOWED_ATTR` list confirming `onclick` and `data-*`
- `src/utils/income.js` (full read) — `getUpcomingIncomeEvents` signature, event shape `{ sourceId, sourceName, amount (pence), nominalDate, adjustedDate }`
- `src/db/repository.js` (partial read) — `incomeRepository` custom methods, `incomeSourceRepository` methods, `createBaseRepository` base `getAll()`
- `src/db/schema.js` (full read) — schema v23 `incomeSources` and `income` table field definitions
- `css/main.css` — `.card`, `.grid3`, `.clickable-card` CSS definitions confirming exact class names to use
- `index.html` lines 309-316 — `#incomeSourcesContainer` and existing static child divs
- `src/app.js` — `incomeSourcesUI.init()` called in app init; `incomeSourcesUI.render()` called on panel switch to `'income-sources'`
- `.planning/REQUIREMENTS.md` — INCOME-01 through INCOME-05 definitions
- `.planning/STATE.md` — accumulated project decisions

### Secondary (MEDIUM confidence)

- `src/ui/income-spending-settings.test.js` — confirms test infrastructure pattern (vi.mock structure, jsdom setup, container DOM scaffold)
- `src/ui/debts.test.js` (partial read, header + Phase 43 tests) — confirms `modalUI` mock shape and `recurrentExpenseRepository` mock pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all confirmed from direct source code reads; no external dependencies needed
- Architecture patterns: HIGH — confirmed by reading full `income-sources.js` and `debts.js`; patterns directly mirror existing code
- Pitfalls: HIGH — identified from reading actual implementations; pence/pounds trap confirmed from existing `confirmIncome` code comment

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable vanilla JS codebase; no framework churn risk)
