# Roadmap: Budget App

## Milestones

- ✅ **v2.3 Advanced Analytics & Mobile Polish** — Phases 1-7 (shipped 2026-03-07)
- ✅ **v2.4 UX Polish & Spending Insights** — Phases 8-10 (shipped 2026-03-07) [Details](.planning/milestones/v2.4-ROADMAP.md)
- 🚧 **v2.5 Debt Tab UX Overhaul** — Phases 11-15 (in progress)

## Phases

<details>
<summary>✅ v2.3 Advanced Analytics & Mobile Polish (Phases 1-7) — SHIPPED 2026-03-07</summary>

Full archive: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>✅ v2.4 UX Polish & Spending Insights (Phases 8-10) — SHIPPED 2026-03-07</summary>

Full archive: `.planning/milestones/v2.4-ROADMAP.md`

</details>

### 🚧 v2.5 Debt Tab UX Overhaul (In Progress)

**Milestone Goal:** Replace the broken inline debt form with a working modal dialog and type-specific field sets for all debt types. Root cause: an unclosed `<div>` in `renderDebtForm()` buries Save/Cancel buttons in a hidden container. Fix: replace `#debtFormContainer` banner with a native `<dialog>` wired through the existing `modalUI` infrastructure.

- [x] **Phase 11: Modal Scaffold** — Working (empty) debt modal that opens, closes, handles Esc, and clears state on all dismiss paths (completed 2026-03-08)
- [x] **Phase 12: Type-Specific Field Logic** — All four debt type fieldsets with correct show/hide on type change and on modal open (completed 2026-03-08)
- [ ] **Phase 13: Save, Edit, and Validation** — Fully working Add and Edit flows for all debt types with inline validation errors
- [ ] **Phase 14: Cleanup and Polish** — Remove dead `#debtFormContainer` HTML, auto-focus, and numeric placeholder hints
- [ ] **Phase 15: Statement History Modal** — Statement history view migrated from inline tab to consistent modal-driven UX

## Phase Details

### Phase 11: Modal Scaffold
**Goal**: Users can open and close a debt modal dialog that correctly manages scroll lock, focus trapping, and state cleanup on every dismiss path
**Depends on**: Nothing (first v2.5 phase; existing modalUI infrastructure in render.js)
**Requirements**: MODAL-01, MODAL-02, MODAL-03, MODAL-04
**Success Criteria** (what must be TRUE):
  1. Clicking "Add New Debt" opens a modal overlay (not an inline banner) with the form visible
  2. Clicking the backdrop (outside the dialog) dismisses the modal
  3. Page scroll is locked while the modal is open and restored on close
  4. Name field receives keyboard focus automatically when the modal opens
**Plans**: 2 plans

Plans:
- [ ] 11-01-PLAN.md — Test scaffold: failing unit tests for MODAL-01 through MODAL-04
- [ ] 11-02-PLAN.md — Implementation: openDebtModal, backdrop click, auto-focus, editingId cleanup

### Phase 12: Type-Specific Field Logic
**Goal**: Users see the correct type-specific fields immediately when selecting a debt type, with no switch-away workaround required in either Add or Edit mode
**Depends on**: Phase 11
**Requirements**: TYPE-01, TYPE-02, TYPE-03, TYPE-04, EDIT-03
**Success Criteria** (what must be TRUE):
  1. Selecting Credit Card shows credit limit, current balance, interest rate, and min payment fields — no other type's fields are visible
  2. Selecting Mortgage shows property value, remaining balance, term, interest rate, and ERC fields
  3. Selecting Personal Loan shows original amount, remaining balance, term, and interest rate fields
  4. Selecting Other shows the generic fallback fields
  5. Opening the Edit modal for an existing debt immediately shows the correct fieldset for that debt's type without the user touching the type selector
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md — Tests (RED): failing unit tests for TYPE-01 through TYPE-04 and EDIT-03
- [ ] 12-02-PLAN.md — Implementation: _buildFormHTML fieldsets, _onTypeChange(), async openDebtModal()

### Phase 13: Save, Edit, and Validation
**Goal**: Users can successfully add a new debt and save edits to an existing debt using the modal, with validation errors shown inline beneath each field
**Depends on**: Phase 12
**Requirements**: ADD-01, ADD-02, ADD-03, EDIT-01, EDIT-02
**Success Criteria** (what must be TRUE):
  1. Clicking Add in Add mode saves the new debt to the database and closes the modal
  2. Clicking Save in Edit mode saves changes for all debt types and closes the modal
  3. Opening Add New Debt always shows an empty, reset form regardless of previous modal use
  4. All fields for an existing debt (including type-specific fields) are pre-populated when the Edit modal opens
  5. Required-field validation errors appear as inline text below the relevant field, not as alert popups
**Plans**: 3 plans

Plans:
- [ ] 13-01-PLAN.md — (legacy UAT plan — superseded by 13-02 and 13-03)
- [ ] 13-02-PLAN.md — Tests (RED): failing unit tests for ADD-01, ADD-02, ADD-03, EDIT-01, EDIT-02
- [ ] 13-03-PLAN.md — Implementation: _saveDebt, _populateEditFields, inline validation, Save/Add button wiring

### Phase 14: Cleanup and Polish
**Goal**: The codebase contains no dead debt form code and the modal delivers polished form interactions including auto-focus and placeholder hints
**Depends on**: Phase 13
**Requirements**: (no additional v1 requirements — delivers clean code state and P2 polish items)
**Success Criteria** (what must be TRUE):
  1. The old `#debtFormContainer` element and its associated `toggleDebtForm()`/`renderDebtForm()` functions are removed from the codebase with no regressions
  2. Numeric input fields display placeholder hints (e.g. "0.00", "2.50%") so users know the expected format
**Plans**: TBD

### Phase 15: Statement History Modal
**Goal**: Users can view a debt's statement history in a modal dialog, replacing the old inline tab behavior for consistency with the new modal-driven UX.
**Depends on**: Phase 14
**Requirements**: (TBD)
**Success Criteria** (what must be TRUE):
  1. Clicking "View History" for a debt opens a modal dialog (using `modalUI`) containing the full statement table.
  2. The history modal does not interfere with the active debt edit modal (if any).
  3. The modal can be dismissed using the standard backdrop click or Esc key.
**Plans**: TBD

## Progress

**Execution Order:** Phases execute in numeric order: 11 → 12 → 13 → 14 → 15

| Phase | Milestone | Plans Complete | Status | Completed |
| ----- | --------- | -------------- | ------ | --------- |
| 1. Integrity (Reconciliation) | v2.3 | 3/3 | Complete | 2026-03-06 |
| 2. Insights (Analytics) | v2.3 | 4/4 | Complete | 2026-03-06 |
| 3. Mobile Polish (UX) | v2.3 | 5/5 | Complete | 2026-03-06 |
| 4. Privacy Hardening & Dashboard Layout | v2.3 | 2/2 | Complete | 2026-03-06 |
| 5. Forecast & Graph Alignment | v2.3 | 2/2 | Complete | 2026-03-06 |
| 6. Rolling Overview - Income/Expense Bars & Binning | v2.3 | 3/3 | Complete | 2026-03-06 |
| 7. Code Inconsistencies & Inefficiencies | v2.3 | 3/3 | Complete | 2026-03-07 |
| 8. Haptic Feedback | v2.4 | 3/3 | Complete | 2026-03-07 |
| 9. Swipe Gesture System | v2.4 | 4/4 | Complete | 2026-03-07 |
| 10. Spending Heatmap | v2.4 | 2/2 | Complete | 2026-03-07 |
| 11. Modal Scaffold | 2/2 | Complete    | 2026-03-08 | - |
| 12. Type-Specific Field Logic | 2/2 | Complete    | 2026-03-08 | - |
| 13. Save, Edit, and Validation | 1/2 | In Progress|  | - |
| 14. Cleanup and Polish | v2.5 | 0/TBD | Not started | - |
| 15. Statement History Modal | v2.5 | 0/TBD | Not started | - |
