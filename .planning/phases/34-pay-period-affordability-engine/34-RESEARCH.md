# Phase 34: Pay-Period Affordability Engine - Research

**Researched:** 2026-03-15
**Domain:** Dashboard pay-period affordability, Dexie schema evolution, affordability calculation plumbing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Build a pay-period affordability view in Dashboard based on: current balance snapshot, committed outgoings, spending buckets, and merged income events from Phase 33.
- Pay-period boundary must come from income-event timeline (collection-based), not a singular payDay or salary field.
- Recurring bills come from recurrentExpenses; one-off bills come from oneOffExpenses; spending buckets are prorated into the period.
- Deficit and safety-buffer warnings are required.
- For loan/mortgage payments, show principal and interest split in the pay-period view using amortisation schedule data.
- Cloud sync must include whichever store holds affordability settings and latest balance snapshot.

### Claude's Discretion
- Exact persistence location for safetyBuffer and balance-entry metadata (existing snapshot stores vs new settings/preferences store).
- Exact UI insertion details under existing dashboard summary cards while preserving current navigation behavior.
- Internal helper implementation details for pay-period list construction and summary derivation.

### Deferred Ideas (OUT OF SCOPE)
- Childcare provider modeling and childcare top-up feature work (belongs to later phases).
- Navigator redesign / segmented control redesign work (Phase 36).
- Any singular global payDay/payFrequency settings model.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | Current balance entry (manual amount + date snapshot) | Existing daily and monthly balance snapshot stores already exist; adjustBalance flow exists; no mandatory new snapshot table required for base implementation. |
| PLAN-02 | Pay-period affordability view and safe extra-payment guidance | Dashboard render path and app render pipeline identified; pay-period module API can compose opening balance + period bills + prorated buckets + buffer checks. |
| PLAN-05 | Pay-period navigator | Current dashboard already has month/view state pattern (_selectedMonth, _selectedView) and renderDashboard-driven navigator updates to integrate with safely. |

Note: PLAN-03 and PLAN-04 are intentionally out of scope for this phase and are covered by adjacent phases; this research document focuses on PLAN-01, PLAN-02, and PLAN-05 only.
</phase_requirements>

## Key Findings

1. **What is the exact Dexie version Phase 34 must bump FROM?**
- Live code is currently on `db.version(19)` as the latest schema declaration.
- Upstream Phase 33 contract states it will bump schema to v20.
- Therefore Phase 34 must plan to bump **from v20 to v21**.

2. **Does recurrentExpenses use dayOfMonth/dayOfWeek? Does oneOffExpenses use a date field?**
- recurrentExpenses does **not** use `dayOfMonth` / `dayOfWeek` fields in schema.
- recurrentExpenses query and filtering patterns are date-string based, primarily `nextDate` (with fallback to `date` in some logic).
- oneOffExpenses uses `date` as the primary date field and month/year filters are based on `date`.

3. **Does any balance-snapshot store already exist?**
- Yes.
- `balanceSnapshots` exists (monthly snapshots keyed by `month`).
- `dailyBalanceSnapshots` exists (daily snapshots keyed by `date`).
- A current-balance helper already reads `dailyBalanceSnapshots` (`getCurrentBalance`).

4. **Does safetyBuffer exist in settings/preferences stores?**
- No `safetyBuffer` field is currently present in code-level schema/repository.
- No explicit `settings` or `userPreferences` store currently exists in schema.

5. **What is current _selectedView/view-switching pattern in dashboard.js?**
- Dashboard state uses module-scoped `_selectedMonth` and `_selectedView`.
- `_selectedView` defaults to `current`; UI `#viewSelect` change updates `_selectedView` then calls `renderDashboard()`.
- `renderDashboard()` maps `current -> month` for repository calls.
- Month navigation is managed by `renderMonthNavigator()` and rerenders dashboard on prev/next/select changes.
- Integration risk: changing this flow can break existing month navigation and summary period behavior.

6. **Does calculateAmortisationSchedule already exist? Return shape for interest/principal split?**
- Yes, `calculateAmortisationSchedule(...)` already exists.
- It returns:
  - `schedule`: array of `{ month, interestPence, principalPence, balancePence, paymentDate }`
  - `projectedPayoffDate`
  - `remainingTermMonths`
  - `totalInterestRemaining`
- This is sufficient to render the required principal + interest split lines in pay-period UI.

7. **Is there a renderTasks async render pipeline in app.js?**
- Yes.
- `window.app.renderAll()` builds a `renderTasks` array based on active tab and awaits `Promise.all(renderTasks)`.
- Dashboard panel currently plugs into this via `renderDashboard()` task.

8. **Is balanceSnapshots (or similar) new for Phase 34?**
- No. Balance snapshot stores already exist (`balanceSnapshots`, `dailyBalanceSnapshots`).
- Phase 34 likely needs either:
  - reuse existing snapshot flow for PLAN-01, and only add a new preferences/settings store for `safetyBuffer`, or
  - extend existing persisted entity if preferred.
- A brand-new balance snapshot table is not required by current baseline.

9. **Cloud-sync registration pattern (generic vs allowlist)?**
- `src/utils/supabase-sync.js` push uses generic `db.tables.map(...)` snapshot serialization.
- Current pattern is generic and does not require per-store allowlisting for new Dexie stores.
- `src/ui/cloud-sync.js` is UI/control flow; snapshot table registration logic lives in `src/utils/supabase-sync.js`.

10. **Banking-calendar adjustedPaymentDate signature confirmation**
- Existing signature is `adjustedPaymentDate(nominalDate, adjustment)` where `adjustment` is `'none' | 'next-working-day'`.
- It does **not** accept `(date, bankHolidays)`.
- It returns a Date object.

## Assumptions to Carry Into Planning

- Phase 34 starts after Phase 33 schema migration, so schema base for this phase is v20 and must be bumped to v21.
- Pay-period boundaries must be driven by Phase 33 income-event collection helpers, never by a singular payDay field.
- recurring expense inclusion should rely on existing date semantics (`nextDate`/`date`) rather than introducing `dayOfMonth`/`dayOfWeek` dependency in current stores.
- one-off expense inclusion should use `oneOffExpenses.date` within inclusive period bounds.
- Existing balance snapshot infrastructure is sufficient for opening-balance retrieval and persistence patterns; new balance snapshot store is unnecessary.
- `safetyBuffer` is net-new persistence and must be explicitly introduced.
- Dashboard integration must preserve current `_selectedView` + month navigator behavior.
- Principal/interest display for loan/mortgage rows should consume `calculateAmortisationSchedule().schedule[*].interestPence/principalPence` and avoid duplicate amortisation logic.

## Anti-Patterns to Avoid

- Hardcoding a single upcoming income event or singular payDay source.
- Breaking existing dashboard month navigation by replacing `_selectedMonth`/`_selectedView` behavior instead of integrating alongside it.
- Adding day-of-week/day-of-month schema coupling to recurrentExpenses in Phase 34 logic when current data model is date-based.
- Re-implementing amortisation math in pay-period module instead of using `calculateAmortisationSchedule` output.
- Adding a dedicated balance snapshot store when equivalent stores already exist.
- Introducing sync allowlists for affordability data if generic `db.tables` snapshot behavior already covers new stores.
- Mixing nominal and adjusted dates without explicit rules (income events arrive pre-adjusted; bills may need adjustment in-period).

## Phase 34 Module API

Based on 34-CONTEXT and current codebase, these signatures are valid and should be kept with one refinement note on date normalization:

```js
export function getPayPeriodBounds(incomeEvents, referenceDate)
// -> { start: Date, end: Date, nextIncomeEvent: object | null }

export function getBillsInPayPeriod(allRecurring, allOneOff, spendingBuckets, start, end, bankingCalendar)
// -> Array<{ date: Date, name: string, amount: number, isAdjusted: boolean, debtId?: string }>
// sorted by date ascending

export function calculatePayPeriodSummary(openingBalance, bills, safetyBuffer = 20000)
// -> { rows: Array<{ ...bill, runningBalance }>, closingBalance, isDeficit, isBelowBuffer }
```

Refinement guidance:
- `getPayPeriodBounds` should treat `incomeEvents` as already adjusted-date-sorted input from Phase 33 and choose first event with adjustedDate >= referenceDate.
- `getBillsInPayPeriod` should normalize all candidate dates to Date objects and treat window bounds as inclusive.
- `calculatePayPeriodSummary` should remain pure and deterministic (no DB calls), enabling high branch-coverage tests.

## Files to Change

- `src/utils/pay-period.js`
  - New core affordability module for period bounds, bill extraction, and summary math.

- `src/utils/pay-period.test.js`
  - New high-coverage tests for bounds logic, inclusion/exclusion, prorating, and deficit/buffer thresholds.

- `src/db/schema.js`
  - Bump from v20 (post-Phase-33 baseline) to v21 and persist affordability preferences (at minimum `safetyBuffer`) in an explicit store/field.

- `src/db/repository.js`
  - Add repository helpers for safety-buffer persistence and any explicit balance-entry retrieval path needed by PLAN-01 UX flow.

- `src/ui/dashboard.js`
  - Render pay-period section under existing dashboard cards and integrate with existing navigator/view state safely.

- `src/app.js`
  - Only if needed to ensure dashboard refresh wiring picks up new pay-period controls/interactions consistently with existing renderTasks flow.

- `src/utils/supabase-sync.js`
  - Update only if schema introduces a persistence path not covered by generic table snapshot behavior (currently generic path already covers all Dexie tables).

- `src/ui/cloud-sync.js`
  - No mandatory registration changes expected for table snapshot inclusion; touch only if UI messaging/state must reflect new affordability preference sync behavior.

## Confidence Notes

- **Schema/version findings:** HIGH (directly verified in current `src/db/schema.js` and upstream Phase 33 plan/context contract).
- **Dashboard integration findings:** HIGH (directly verified in current `src/ui/dashboard.js` and `src/app.js`).
- **Amortisation split findings:** HIGH (directly verified in `src/utils/finance.js`).
- **Future Phase 33 artifact presence in current tree:** MEDIUM for implementation details (artifacts are not yet present in current workspace, so Phase 34 planning relies on documented upstream contract).
