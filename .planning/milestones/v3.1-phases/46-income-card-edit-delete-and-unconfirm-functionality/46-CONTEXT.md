# Phase 46: Income Card Edit/Delete and Unconfirm Functionality - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Two distinct fixes for the Income tab:

1. **Fix income source card Edit/Delete buttons** — The Edit and Delete buttons on income source cards (Phase 44 card grid) are currently broken, throwing uncaught errors. Users cannot delete or edit a source they no longer need.

2. **Add edit/unconfirm to confirmed income entries in the modal** — Once an income entry is confirmed ("Received" badge), there is no way to correct it. Users need a small inline edit option per entry to fix wrong amounts or wrong dates, and the ability to unconfirm (revert to pending).

</domain>

<decisions>
## Implementation Decisions

### Income source card Edit/Delete (bug fix)
- The Edit and Delete buttons on the income card grid throw uncaught errors — fix them
- Delete source: show confirmation dialog before deleting (matches existing `_handleDeleteSource` pattern which uses `window.confirm`)
- Edit source: opens the inline add/edit form pre-populated with the source's data (same as existing `_renderAddEditForm(source)` flow)
- After fix, behaviour should match what the old table view's Edit/Delete did

### Confirmed entry display in modal
- Currently shows only a "Received" badge with no detail
- Show the actual saved amount and date from the database (e.g. "Received £2,450.00 on 25 Mar")
- Especially useful when the user adjusted the amount at confirm time

### Edit flow for confirmed entries
- Small "Edit" option inline next to the Received badge, same row
- Clicking Edit replaces the row with the same date + amount input form used during the initial confirm flow (reuse `showIncomeConfirmPrompt` UI pattern)
- Saving an edit: use `incomeRepository.update()` (update in place — preserves record ID)
- After saving: refresh modal in place (re-open same source modal, consistent with `confirmIncomeEntry`) + call `window.app.renderAll()` to sync Transactions tab

### Unconfirm for confirmed entries
- Small "Unconfirm" button inline next to the Received badge (same row as Edit button)
- Unconfirm = delete the income record entirely, reverting entry to "Confirm" pending state
- Requires confirmation dialog before executing (destructive action on a financial record)
- After unconfirming: refresh modal in place + call `window.app.renderAll()`
- Label: "Unconfirm" (mirrors "Confirm" as inverse; matches existing Phase 45 language)

### Scope
- Income-only: debt history unconfirm is out of scope for this phase
- Matching strategy: source name + date (consistent with existing `_renderIncomeEntryStatuses` pattern)
- Window: keep existing ±90 day modal window unchanged

### Claude's Discretion
- Exact button size/styling for Edit and Unconfirm (small ghost buttons, consistent with existing "sm ghost" pattern)
- How to look up the income record ID for update/delete (query `incomeRepository.getAll()` filtered by source name + date)

</decisions>

<specifics>
## Specific Ideas

- User described the problem clearly: "wrong value or wrong date" — edit is a correction flow, not a new feature
- User wants a "small edit option on the cell list inside the income modal" — inline, not a separate modal within modal
- Edit/Delete on cards are throwing uncaught errors right now — this is a bug fix, not new functionality

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `showIncomeConfirmPrompt(sourceId, adjustedDate, amountPence)` — global window handler already renders date + amount inputs inline; can be reused or extended for edit flow
- `confirmIncomeEntry(sourceId, adjustedDate)` — existing save handler; edit save needs a variant that calls `incomeRepository.update()` instead of `add()`
- `incomeRepository.update(id, data)` — exists in repository.js, ready to use
- `incomeRepository.delete(id)` — exists in repository.js, ready to use
- `_renderIncomeEntryStatuses(sourceId)` — already queries all income and builds confirmed set; needs to expose the income record ID for edit/delete operations
- `_handleDeleteSource(id)` / `_renderAddEditForm(source)` — existing patterns for card Edit/Delete; fix is likely a wiring issue in click delegation

### Established Patterns
- Global `window.*` handlers used for inline onclick attributes in modal HTML (Phase 43 and 44 pattern)
- `openIncomeModal(sourceId)` called after any mutation to refresh modal in place
- `window.app.renderAll()` called after income mutations to sync other tabs
- `window.confirm()` used for destructive action confirmation (existing in `_handleDeleteSource`)

### Integration Points
- `_renderIncomeEntryStatuses()` — the confirmed entry rendering is where edit/unconfirm buttons need to be added
- `_bindEvents()` click delegation — where the card Edit/Delete bug likely lives (check data-action routing for edit-source and delete-source on card buttons vs. the modal click handler)

</code_context>

<deferred>
## Deferred Ideas

- Debt history unconfirm (same pattern for loan payment entries) — separate phase
- Extend modal window beyond ±90 days for historical entries — revisit if user feedback warrants it

</deferred>

---

*Phase: 46-income-card-edit-delete-and-unconfirm-functionality*
*Context gathered: 2026-03-22*
