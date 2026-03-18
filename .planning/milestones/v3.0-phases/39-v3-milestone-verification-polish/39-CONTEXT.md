# Phase 39 Context: v3.0 Milestone Verification & Polish

## Scope Correction
An earlier draft of this file described Performance & Bundle Optimisation. That work belongs in a future milestone. Phase 39 in the v3.0 roadmap is the final integration-testing, visual-polish, and milestone sign-off phase.

## Objective
Verify that every P0 and P1 requirement from the v3.0 milestone is implemented and meets its acceptance criteria. Apply visual and UX polish across all new Phase 31–38 components. Tag the release as v3.0.0.

## Background

### Verification Scope
Phase 39 is the quality gate for v3.0. It does not introduce new features. Every Phase 31–38 deliverable is re-tested end-to-end to confirm all P0 and P1 requirements are met and all HUMAN-VERIFICATION-REQUIRED items are signed off.

### Cross-Phase Integration Checks
1. **Income → Affordability**: Income sources configured in Phase 33 Settings drive the pay-period window in Phase 34's dashboard. Verified end-to-end with a test fixture.
2. **Childcare → Affordability**: Phase 35 top-up amounts appear as timeline line items in the Phase 34 affordability view.
3. **Banking calendar**: Phase 31 `adjustedPaymentDate()` correctly adjusts projected income dates for UK bank holidays across the next 6 months.
4. **Cloud sync round-trip**: sign in → push → sign out → sign in → pull → verify data integrity for all v3.0 stores (`incomeSources`, `spendingBuckets`, `tfcTransactions`, etc.).
5. **Snapshot delta preview**: Phase 37 delta diff correctly identifies added/deleted/updated records on a known test fixture.
6. **Legacy import**: Phase 38 v2.x importer correctly maps all field types from a known v2.x export fixture.

### Polish Tasks
- Consistent loading states across all new UI components
- Consistent empty-state messages (no blank white boxes)
- Consistent error messages (no raw error objects shown to user)
- Animation/transition review: no janky transitions on mobile
- Colour contrast review on new badges, chips, and status icons (WCAG AA)

### Release Steps
1. Run full Vitest suite — must be green
2. Run Lighthouse mobile on the built app (hosted locally) — score ≥ 90
3. Manual cross-device check: iPhone SE (375px) and Desktop (1440px) minimum
4. Confirm PWA install prompt on Android Chrome
5. Bump `package.json` version to `3.0.0`
6. `git tag v3.0.0`

## Files to Change
- `package.json` — version bump to `3.0.0`
- Any files with outstanding polish TODOs flagged in Phases 31–38 summaries

## Acceptance Criteria
- [ ] All P0 requirements implemented and ACs met (PLAN-01–06, DEBT-01/03/04, CHILD-01–03, NAV-02–04, MOB-01–07, SYNC-01–02, TECH-01–04/06, INTEGRITY-01–02)
- [ ] All P1 requirements implemented or formally deferred to v3.1 with a written note in STATE.md
- [ ] Full Vitest suite passes (target ≥ 400 tests, zero failures)
- [ ] Lighthouse mobile score ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] PWA install prompt works on Android Chrome
- [ ] Offline mode: app loads and displays cached data without network
- [ ] Cloud sync round-trip verified end-to-end for all v3.0 stores
- [ ] Banking calendar: payment date adjustment correct for next 6 months of UK bank holidays
- [ ] Affordability engine output manually verified against known test fixture (HUMAN-VERIFICATION-REQUIRED)
- [ ] Cross-browser: Chrome, Firefox, Safari (desktop) — no critical failures
- [ ] Cross-device: iPhone SE (375px), Desktop 1440px — no layout breakage
- [ ] WCAG AA: no critical accessibility violations (axe scan)
- [ ] No console errors on app load
- [ ] `package.json` version set to `3.0.0`

## Technical Notes
- Do not introduce new features in Phase 39; only fix regressions, apply polish, and ship the milestone
- Document any formal P1 deferrals in `.planning/STATE.md` with a v3.1 note
- Run Lighthouse via `@lhci/cli` or manually; document the score in `39-METRICS.md`
- If outstanding polish TODOs exist in phase SUMMARY files, address them in priority order (P0 before P1)
