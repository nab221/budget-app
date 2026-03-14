# v3.0 Roadmap Critical Review (Opus 4.6)

## Overall Assessment

The Sonnet 4.6-authored roadmap is well-structured and covers the feature set comprehensively. The phase ordering is logical (P0 bugs first, then infrastructure, then features). The following issues were identified and must be corrected before implementation begins.

---

## Critical Issues (Must Fix)

### 1. INTEGRITY-01 Placed Too Late

**Problem:** The referential integrity validator (INTEGRITY-01) was originally assigned to Phase 38 (technical hygiene). However, the integrity checker must run after every cloud pull and after every file import — both of which happen from Phase 27 onwards. If INTEGRITY-01 is not implemented until Phase 38, there is no integrity checking for the entire v3.0 build cycle.

**Fix Applied:** INTEGRITY-01 moved to Phase 27 (the first phase). The data integrity checker is now a deliverable of Phase 27 alongside the bug fixes.

**Impact:** Phase 27 complexity remains Low — the integrity checker is a new utility file (~80 LOC) with no UI changes beyond a warning toast.

---

### 2. Schema Version Coordination

**Problem:** The original roadmap did not assign schema versions to phases. This creates a risk of conflicting migrations if phases are implemented by different agents or in different orders.

**Fix Applied:** Schema versions assigned explicitly:
- v13 → Phase 31 (banking calendar fields on `recurringExpenses`)
- v14 → Phase 32 (debt type fields on `debts`)
- v15 → Phase 33 (new `incomeSources` + `spendingBuckets` stores)
- v16 → Phase 35 (new `childcareProviders` store)

Phases 27–30 and 34, 36–39 do not require schema changes.

---

### 3. Phase 33 Hard Dependency on Phase 31 Not Stated

**Problem:** Phase 33 (Income & Spending Configuration) requires the `nextWorkingDay()` function from Phase 31 (Banking Calendar Utility) to display banking-calendar-adjusted paydays. This dependency was not stated in the roadmap, creating a risk that Phase 33 would be implemented before Phase 31.

**Fix Applied:** Phase 33 now explicitly states: *"Hard dependency: Phase 31 must be complete before Phase 33 begins."* The dependency chain in ROADMAP.md is updated: `31 → 32 → 33 → 34` is now a hard chain.

---

### 4. TECH-06 (Cloud Sync Store Registration) Missing From Phase 33

**Problem:** Phase 33 introduces two new IndexedDB stores (`incomeSources`, `spendingBuckets`) but the original roadmap did not include TECH-06 (cloud sync store registration) as a requirement for Phase 33. This would cause the new stores to be invisible to the Supabase sync layer until Phase 35.

**Fix Applied:** TECH-06 added to Phase 33 requirements. Both `incomeSources` and `spendingBuckets` must be registered in `supabase-sync.js` as part of Phase 33.

---

### 5. Phase 31 Complexity Underestimated

**Problem:** Phase 31 (Banking Calendar Utility & Recurrence Upgrade) was marked as "Medium" complexity. However, it involves:
- A new utility module with UK bank holiday data
- A non-trivial date arithmetic algorithm (`nextWorkingDay`)
- A schema migration
- Extension of the recurrence engine
- New test suite with ≥80% coverage requirement

**Fix Applied:** Phase 31 complexity raised to **Medium-High**.

---

## Minor Issues (Incorporated)

### 6. INTEGRITY-02 (Legacy Data Import) Placement

**Original:** INTEGRITY-02 was not in the roadmap at all.

**Fix Applied:** INTEGRITY-02 added to Phase 38 as a P2 requirement. Since the app is not in active use with real users, legacy import is a convenience feature and correctly deferred.

---

### 7. CodeRabbit Feedback — Validation Gaps

The following validation requirements were strengthened based on CodeRabbit patterns:

**PLAN-06 (Income Configuration):** Added explicit validation rule: *"When `payDateRule === 'nth-of-month'`, `payDateDay` must be present, integer, and in the range 1..28."* This prevents dates like Feb 29 from causing runtime errors.

**DEBT-03 (Debt Snapshot Confirmation):** Added explicit threshold: *"When confirmed balance differs from computed balance by more than 5% (configurable via `CONFIRM_BALANCE_WARNING_THRESHOLD`), show a warning before finalizing."*

**CHILD-01 (Childcare Top-Up):** Added explicit formula: *"For 'termly' frequency, `monthlyEquivalent = amount / 3`."* Prevents ambiguity in the childcare planner calculation.

---

### 8. CodeRabbit Feedback — MOB-01 Breakpoint Ambiguity

**Original:** MOB-01 described responsive behaviour for small viewports but did not specify a CSS strategy.

**Fix Applied:** MOB-01 now specifies the three-tier CSS strategy explicitly:
- Default (>420px): full icon + label
- `@media (max-width:420px)`: labels truncated to 6 chars with ellipsis
- `@media (max-width:360px)`: icons only, 44×44px tap targets (WCAG minimum)

This matches the implementation guidance in Phase 28.

---

## Summary of Changes Applied

| Change | Location |
|--------|----------|
| INTEGRITY-01 moved to Phase 27 | ROADMAP.md, REQUIREMENTS.md |
| Schema versions assigned (v13–v16) | ROADMAP.md, PROJECT.md |
| Phase 33 hard dependency on Phase 31 | ROADMAP.md |
| TECH-06 added to Phase 33 | ROADMAP.md, REQUIREMENTS.md |
| Phase 31 complexity raised to Medium-High | ROADMAP.md |
| INTEGRITY-02 added to Phase 38 | ROADMAP.md, REQUIREMENTS.md |
| PLAN-06 validation strengthened | REQUIREMENTS.md |
| DEBT-03 threshold made explicit | REQUIREMENTS.md |
| CHILD-01 formula made explicit | REQUIREMENTS.md |
| MOB-01 CSS strategy made explicit | REQUIREMENTS.md, ROADMAP.md |

---

*Review conducted: 2026-03-14 by Opus 4.6*
*Roadmap status: Approved for implementation*
