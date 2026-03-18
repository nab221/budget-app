# Phase 39: Manual Verification Checklist

**Template created:** 2026-03-17
**Status:** AWAITING HUMAN VERIFICATION

Fill in each row after performing the check. Update 39-VALIDATION-GATES.md and 39-SIGNOFF.md checkpoints once complete.

---

## Setup

```bash
# Start preview build (run this first)
npm run build
npm run preview
# App will be at http://localhost:4173
```

---

## Device / Browser Matrix

### A. Cross-Device Layout Checks

| Check | iPhone SE (375px) | Desktop (1440px) | Result | Evidence |
|-------|------------------|-----------------|--------|----------|
| Fixed bottom tab bar visible at all times (MOB-01, NAV-01) | [ ] | N/A | | screenshot path |
| Tabs visible while scrolling long content | [ ] | [ ] | | screenshot path |
| Fixed top header + navigator below it (MOB-02, NAV-02) | [ ] | N/A | | screenshot path |
| Header save-dot on same line as sync icon (MOB-06) | [ ] | [ ] | | screenshot path |
| Income tab: Amount column no wrap, dd-MMM date format (MOB-04) | [ ] | [ ] | | screenshot path |
| Expenses tab: badge chip categories, status icon (MOB-05) | [ ] | [ ] | | screenshot path |
| Debt-linked expense rows route to Debts tab (DEBT-04) | [ ] | [ ] | | |
| Pay-period navigator shows date range (PLAN-05) | [ ] | [ ] | | |
| Segmented view toggle visible and functional (MOB-03) | [ ] | [ ] | | |

### B. Cross-Browser Desktop Checks

| Feature | Chrome | Firefox | Safari | Notes |
|---------|--------|---------|--------|-------|
| App loads without errors | [ ] | [ ] | [ ] | |
| Tab navigation works | [ ] | [ ] | [ ] | |
| Cloud sync modal opens | [ ] | [ ] | [ ] | |
| Charts render | [ ] | [ ] | [ ] | |
| No console errors on load | [ ] | [ ] | [ ] | |

---

## Functional Verification

### C. Affordability Engine (PLAN-01, PLAN-02) — HUMAN-VERIFICATION-REQUIRED

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| Enter current balance amount and date | Accepted, shown in header | | |
| Pay-period window shows start → end dates | Today through next payday | | |
| Committed outgoings list appears in window | Recurring expenses shown | | |
| Safety buffer setting persists | Saved correctly | | |
| Suggested max extra payment shown | = balance - committed - safety buffer (if > 0) | | |

**Fixture test:** Add a test income source (e.g. "Test salary", £3000/month, 25th of month). Add a recurring expense (e.g. "Rent", £1000, 1st of month). Observe affordability view.

| Fixture element | Expected result | Actual result |
|----------------|----------------|---------------|
| Pay period shows current period | e.g. "25 Mar → 24 Apr" | |
| Rent appears in timeline | £1,000 on 1 Apr | |
| Closing balance calculated | £3,000 - £1,000 = £2,000 approx | |
| No console errors during render | True | |

### D. Childcare Top-Up Integration (CHILD-01, CHILD-02, CHILD-03)

| Check | Result | Notes |
|-------|--------|-------|
| Childcare tab shows accounts | | |
| Required top-up calculated correctly | | |
| Entitlement period displayed per account | | |
| Top-up amounts appear in affordability committed outgoings | | |

### E. Cloud Sync Round-Trip (TECH-06, SYNC-02)

| Check | Result | Evidence |
|-------|--------|----------|
| Sign in with magic link | | |
| Push data to cloud (all v3 stores) | | |
| Sign out | | |
| Sign in again | | |
| Pull data from cloud | | |
| All v3 stores present (incomeSources, spendingBuckets, childcareProviders) | | |
| Data integrity validator runs after pull | | |

### F. Cloud Snapshot Delta Preview (NAV-04)

| Check | Result |
|-------|--------|
| "Preview before syncing" shows delta (added/removed/changed) | |
| First sync shows full summary (no previous snapshot) | |
| No-change sync shows "no changes" message | |

### G. Legacy Import (INTEGRITY-02)

| Check | Result |
|-------|--------|
| Import v2 Legacy button visible in Cloud settings | |
| Import v2 fixture: correct field mapping | |
| Skip-on-conflict behavior: existing records not overwritten | |
| Import summary report shown | |

### H. Banking Calendar (PLAN-03, TECH-02, TECH-03)

| Check | Result |
|-------|--------|
| UK bank holiday cache populated (GOV.UK or hardcoded) | |
| Recurring expense with "next working day" adjustment shifts correctly | |
| Next 6 months of UK bank holidays handled | |

---

## PWA / Mobile Native Checks

### I. PWA Install & Auth (MOB-07, SYNC-01)

| Check | Device | Result | Evidence |
|-------|--------|--------|----------|
| Android Chrome PWA install prompt appears | Android | | screenshot/video |
| App installs as standalone PWA | Android | | screenshot |
| Magic link email → opens installed PWA | Android | | screenshot |
| Auth completes in PWA mode | Android | | screenshot |
| iOS Safari "Add to Home Screen" works | iPhone | | screenshot |
| iOS magic link behavior (guidance shown) | iPhone | | |

### J. Offline Mode

| Check | Result | Evidence |
|-------|--------|----------|
| Install as PWA | | |
| Disable network | | |
| Reload app | | |
| App loads from cache | | |
| Cached data displayed | | screenshot/DevTools |
| No network errors shown to user | | |

---

## Quality Metrics

### K. Lighthouse Mobile

Run Lighthouse on `http://localhost:4173` with mobile device emulation.

| Category | Score | Pass (>=90)? |
|----------|-------|-------------|
| Performance | | |
| Accessibility | | |
| Best Practices | | |
| SEO | | |

Report file path: `____________________`

### L. Accessibility (axe)

| Check | Result |
|-------|--------|
| Critical violations count | |
| All critical violations = 0 | Pass / FAIL |
| Serious violations count | |

### M. Console Errors

| Route | Errors | Notes |
|-------|--------|-------|
| App load (Dashboard) | 0 / errors: | |
| Expenses tab | 0 / errors: | |
| Income tab | 0 / errors: | |
| Debts tab | 0 / errors: | |
| Childcare tab | 0 / errors: | |
| Cloud sync modal | 0 / errors: | |

---

## Sign-off Summary

After completing all checks, fill in this summary and update 39-SIGNOFF.md:

```
Tester: [name]
Date: [date]
Environment: [browser/OS version, device model]

checkpoint_p0_coverage: [PASS / BLOCKED]
  Blocked gates (if any): [list]

checkpoint_p1_coverage_or_deferral: [PASS / DEFERRED-WITH-NOTE]
  Deferred P1 items: TECH-04 (ui/childcare.js, ui/cloud-sync.js, db/repository.js) — recorded in STATE.md

Release decision: [APPROVED / BLOCKED]
  Blocker reason (if BLOCKED): [reason]
```
