# Phase 39 Context: v3.0 Milestone Verification & Polish

## Objective
Full regression testing, cross-device manual verification, documentation update, and final version bump to v3.0. This phase does not implement new features — it validates all P0 requirements are met, fixes any regressions, and ships the milestone.

## Background
Phase 39 is the capstone phase for v3.0. After 12 implementation phases (27–38), this phase systematically verifies every P0 and P1 requirement is met, polishes rough edges, and ships the release.

## Verification Checklist

### Critical Bug Fixes (Phase 27)
- [ ] Cloud-sync push/pull buttons trigger handler exactly once per click
- [ ] Cloud snapshot modal is safe with special characters in names
- [ ] `cloudSyncUI.init()` is idempotent
- [ ] Heatmap shows only the selected year — no cross-year split
- [ ] Mobile header: save-dot and local icon on same line

### Mobile Navigation (Phase 28)
- [ ] Fixed bottom tab bar visible on all pages, all scroll positions (iOS Safari, Android Chrome)
- [ ] Each tab shows icon + label
- [ ] No content hidden behind bottom bar
- [ ] Desktop tabs unchanged

### Mobile Tables (Phase 29)
- [ ] Income table: date format, amount header, swipe gestures
- [ ] Expenses table: category badges, 3-column headers, status icons, debt-link navigation

### PWA Magic Link (Phase 30)
- [ ] Magic link sign-in works on iOS PWA
- [ ] Magic link sign-in works on Android PWA
- [ ] Service worker does not block auth redirect

### Banking Calendar (Phase 31)
- [ ] `nextWorkingDay()` handles weekends, bank holidays correctly
- [ ] Recurring expenses show banking-calendar adjusted dates

### Debt Model (Phase 32)
- [ ] Loans and mortgages show amortisation view, not statement view
- [ ] "Update Current Balance" saves new anchor point
- [ ] Credit card flow unchanged

### Income & Buckets (Phase 33)
- [ ] Two income sources configured with pay dates
- [ ] Default spending buckets seeded and editable
- [ ] Next expected pay dates correct for each rule type

### Affordability Engine (Phase 34)
- [ ] Current balance entry works and persists
- [ ] Affordability card shows correct "available for extra payments"
- [ ] Upcoming payments timeline is accurate and sorted
- [ ] Warning shown when available amount is negative

### Childcare (Phase 35)
- [ ] Provider costs configured per account
- [ ] Required top-up KPI displayed per child
- [ ] Childcare top-ups appear in affordability calculation

### Navigator Redesign (Phase 36)
- [ ] Segmented control replaces `<select>` dropdown
- [ ] Navigator bar is sticky on mobile
- [ ] Heatmap year navigation works

### Cloud Delta Preview (Phase 37)
- [ ] Push preview shows delta, not full list
- [ ] First sync falls back to full summary
- [ ] "No changes" message shown when nothing changed

### CI/CD (Phase 38)
- [ ] No Node.js deprecation warnings in GitHub Actions
- [ ] Root directory cleaned up

## Regression Tests
- Run `npm test` — all tests must pass (target: 400+ tests)
- Run `npm run build` — no build errors
- Deploy to staging/preview — manual smoke test of all tabs

## Documentation Updates
- `README.md` — update feature list, screenshots, deployment instructions
- `PROJECT.md` — mark v3.0 shipped with date
- `STATE.md` — update milestone to v3.0 completed, reset for v3.1 planning

## Release
- Create GitHub release with tag `v3.0.0`
- Release notes summarising all 13 phases of work
- Merge any outstanding feature branches to `main`

## Files to Change
- `README.md`
- `PROJECT.md`
- `STATE.md`
- Any minor CSS/JS polish identified during verification

## Acceptance Criteria
- [ ] All P0 requirements from REQUIREMENTS.md verified
- [ ] All P1 requirements from REQUIREMENTS.md verified or explicitly deferred to v3.1 with justification
- [ ] Vitest suite: 400+ tests passing (0 failing, 0 skipped)
- [ ] Build succeeds with no errors or warnings
- [ ] Manual cross-device verification documented (iOS Safari, Android Chrome, desktop Chrome/Firefox)
- [ ] GitHub release `v3.0.0` created
- [ ] README reflects v3.0 capabilities

## Sign-Off Criteria
The milestone is considered shipped when:
1. All P0 checklist items above are checked
2. `npm test` passes with 0 failures
3. The app is deployed to GitHub Pages and accessible
4. This CONTEXT file's verification section is completed with evidence
