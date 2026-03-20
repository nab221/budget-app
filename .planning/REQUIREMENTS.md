# Requirements: Budget App v3.1

**Defined:** 2026-03-18
**Core Value:** Based on my current account balance and all upcoming committed outgoings, tell me what I can afford to pay extra toward my debts between now and my next payday.

## v3.1 Requirements

### Header

- [x] **HEADER-01**: User sees the top header stick at the top of all 8 tabs while scrolling
- [x] **HEADER-02**: User sees a shadow separator appear on the header only when the page is scrolled down
- [x] **HEADER-03**: Header height is dynamically measured so the month navigator always positions correctly below it without overlap

### Month Navigator

- [x] **MONNAV-01**: User sees the month navigator (◀ Month ▶) stick at the top below the header on the Transactions tab while scrolling

### Bottom Nav

- [x] **BOTNAV-01**: Mobile bottom tab bar is fixed and visible on all 8 tabs at all times
- [x] **BOTNAV-02**: Tab content on all tabs does not scroll behind the bottom nav bar
- [x] **BOTNAV-03**: Bottom nav iOS safe-area padding works correctly on iPhones with home indicator (viewport-fit=cover)
- [x] **BOTNAV-04**: PWA update bar appears above the bottom nav bar, not overlapping it

### Tab Buttons

- [x] **TABUI-01**: All 8 mobile tab buttons are identical in height and shape in both active and inactive states
- [x] **TABUI-02**: Payoff tab button does not change shape or size when tapped on mobile

### Debt History

- [ ] **DEBT-05**: User can open a transaction history modal for loan and mortgage debts showing all expected payment dates from loan start up to today
- [ ] **DEBT-06**: User can confirm each historical loan/mortgage payment as paid in the history modal so it appears in the heatmap
- [ ] **DEBT-07**: User can adjust the payment amount for individual loan/mortgage payment entries before confirming

### Income Tab

- [ ] **INCOME-01**: Income tab displays each income source as a card (consistent with Debt tab card layout)
- [ ] **INCOME-02**: User can click an income source card to open a modal showing income entries to confirm
- [ ] **INCOME-03**: User can confirm an income entry as received in the income modal
- [ ] **INCOME-04**: User can change the date of an upcoming income entry in the income modal
- [ ] **INCOME-05**: User can adjust the amount of a specific income entry in the income modal

### Transactions Tab

- [ ] **TRANS-01**: User can mark an expense transaction as paid from the Transactions tab and see the status update
- [ ] **TRANS-02**: User can confirm an income transaction as received from the Transactions tab
- [ ] **TRANS-03**: Transactions tab shows exactly one reconciliation mode button (duplicate removed)
- [ ] **TRANS-04**: User can add a transaction via a single "Add" button that lets them select income or expense type inside the modal
- [ ] **TRANS-05**: User can toggle the transaction list sort order between newest first and oldest first
- [ ] **TRANS-06**: Expense transaction amounts display with a minus (−) prefix; income amounts display with a plus (+) prefix
- [ ] **TRANS-07**: Transaction search bar placeholder reads "Search transactions" (not "Search income")
- [ ] **TRANS-08**: Category filter in Transactions tab includes debt-linked transaction categories, not only income categories

## Future Requirements

### Navigation
- Sticky month-nav on desktop (low friction currently; revisit if user feedback warrants it)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Collapsing header on scroll | Critical toolbar buttons live in header — friction without benefit |
| Animate bottom nav in/out per tab | Creates a visibility gap during transition |
| Per-tab CSS overrides on chrome elements | Creates regression surface for every new tab added |
| Hamburger menu on mobile | Phase 28 decision was correct — keep bottom nav |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HEADER-01 | Phase 40 | Complete |
| HEADER-02 | Phase 40 | Complete |
| HEADER-03 | Phase 40 | Complete |
| MONNAV-01 | Phase 40 | Complete |
| BOTNAV-01 | Phase 41 | Complete |
| BOTNAV-02 | Phase 41 | Complete |
| BOTNAV-03 | Phase 41 | Complete |
| BOTNAV-04 | Phase 41 | Complete |
| TABUI-01 | Phase 42 | Complete |
| TABUI-02 | Phase 42 | Complete |
| DEBT-05 | Phase 43 | Pending |
| DEBT-06 | Phase 43 | Pending |
| DEBT-07 | Phase 43 | Pending |
| INCOME-01 | Phase 44 | Pending |
| INCOME-02 | Phase 44 | Pending |
| INCOME-03 | Phase 44 | Pending |
| INCOME-04 | Phase 44 | Pending |
| INCOME-05 | Phase 44 | Pending |

| TRANS-01 | Phase 45 | Pending |
| TRANS-02 | Phase 45 | Pending |
| TRANS-03 | Phase 45 | Pending |
| TRANS-04 | Phase 45 | Pending |
| TRANS-05 | Phase 45 | Pending |
| TRANS-06 | Phase 45 | Pending |
| TRANS-07 | Phase 45 | Pending |
| TRANS-08 | Phase 45 | Pending |

**Coverage:**
- v3.1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after initial definition*
