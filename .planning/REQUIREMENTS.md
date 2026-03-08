# Requirements: Budget App v2.5 — Debt Tab UX Overhaul

**Defined:** 2026-03-07
**Core Value:** A personal budget tracker that helps a UK household track income, expenses, debts, assets, and forecast cash flow — fully offline, PWA-ready, no server required.

## v1 Requirements (Milestone v2.5)

Requirements for the Debt Tab UX Overhaul milestone.

### Modal Structure

- [ ] **MODAL-01**: User sees a modal dialog (not an inline banner) when adding or editing a debt
- [ ] **MODAL-02**: User can dismiss the modal by clicking the backdrop (outside the dialog)
- [ ] **MODAL-03**: Page scroll is locked while the debt modal is open
- [ ] **MODAL-04**: Name field receives focus automatically when the modal opens

### Type Fields

- [ ] **TYPE-01**: Credit Card fields (credit limit, current balance, interest rate, min payment) appear automatically when Credit Card is selected — no switch-away workaround needed
- [ ] **TYPE-02**: Mortgage fields (property value, remaining balance, term, interest rate, ERC) appear when Mortgage is selected
- [ ] **TYPE-03**: Personal Loan fields (original amount, remaining balance, term, interest rate) appear when Personal Loan is selected
- [ ] **TYPE-04**: Generic/Other fields appear when Other type is selected

### Add Flow

- [ ] **ADD-01**: User can add a new debt — clicking Add saves the form and closes the modal
- [ ] **ADD-02**: Validation errors appear inline below the relevant field (not as alert popups)
- [ ] **ADD-03**: Form opens empty/reset each time Add New Debt is clicked

### Edit Flow

- [ ] **EDIT-01**: User can save an edited debt — clicking Save works for all debt types and closes the modal
- [ ] **EDIT-02**: All fields are pre-populated from the existing debt data when the edit modal opens
- [ ] **EDIT-03**: The correct type-specific fields auto-show for the debt's existing type (no switch-away needed)

## Future Requirements

### UX Enhancements (post-v2.5)

- **UX-01**: Discard-changes confirmation when dismissing modal with unsaved edits
- **UX-02**: Blur-time field validation (validate as user tabs away from each field)
- **UX-03**: Haptic feedback on successful save (already supported by haptics.js)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New npm packages | Native `<dialog>` covers everything needed |
| DB schema changes | Schema v15 already stores all required fields |
| Debt deletion from modal | Delete stays on the card swipe/button — not a modal concern |
| Bulk edit | Out of scope for this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MODAL-01 | Phase 11 | Pending |
| MODAL-02 | Phase 11 | Pending |
| MODAL-03 | Phase 11 | Pending |
| MODAL-04 | Phase 11 | Pending |
| TYPE-01 | Phase 12 | Pending |
| TYPE-02 | Phase 12 | Pending |
| TYPE-03 | Phase 12 | Pending |
| TYPE-04 | Phase 12 | Pending |
| EDIT-03 | Phase 12 | Pending |
| ADD-01 | Phase 13 | Pending |
| ADD-02 | Phase 13 | Pending |
| ADD-03 | Phase 13 | Pending |
| EDIT-01 | Phase 13 | Pending |
| EDIT-02 | Phase 13 | Pending |

**Coverage:**
- v2.5 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 — traceability finalized during roadmap creation*
