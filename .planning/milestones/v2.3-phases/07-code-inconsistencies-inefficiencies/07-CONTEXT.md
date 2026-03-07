# Phase 7: Code Inconsistencies & Inefficiencies - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit and fix bugs, logic divergences, and dead code accumulated across Phases 1–6 before milestone close. No new features. The measurable exit condition: the Rolling Overview chart and the 45-day forecast table show the same closing balance for the same date.

</domain>

<decisions>
## Implementation Decisions

### Scope & Priority
- Bugs first, dead code cleanup second
- Multi-file changes are acceptable if they fix a real bug — not just for structural improvement
- No new abstractions; fix bugs in place using existing patterns
- Exit condition: chart (getDailyRollingData) and 45-day table (calculateForecast) produce identical balance numbers for the same date

### Balance Engine Unification
- Extract a shared daily balance-walking core function that both getDailyRollingData and calculateForecast call
- Keep getDailyRollingData and calculateForecast as the public API (two thin wrappers)
- Extract the opening balance lookup (dailyBalanceSnapshots → balanceSnapshots fallback) into a shared helper used by both wrappers — this is the likely root of divergence
- _calculateDailyMetrics is already shared; the unification work is above it (the balance accumulation loop and opening balance fetch)

### Dead Code Removal
- Delete barForecastPlugin from charts.js — bars were removed in Phase 6, the plugin never fires
- Delete BarController from Chart.register() if it becomes unused after plugin removal
- Delete the binning parameter from getDailyRollingData (nothing passes it)
- Delete aggregateRollingOverview from cashflow.js — the binning hookup is gone, the income/expense object format ({y, daily, isForecast}) is unused
- Audit getRollingFinancialData for import sites; delete it if nothing calls it

### Recurrent Expense Filter — Root Cause Fix
- When an expense is marked 'paid' (via markAllAsPaid() or recordPayment()), advance its nextDate to the next occurrence based on frequency
- This advancement logic lives in a cashflow utility as a pure function (e.g. advanceNextDate(item) → newDate)
- Frequencies to support: all values present in the DB schema (weekly, monthly, quarterly, annual, and any others found during audit)
- cycleCurrent only increments during advancement if item.isDebtPayment === true AND cycleTotal is defined — regular bills/subscriptions do not have a meaningful cycle endpoint
- After the root cause fix is in place, add status === 'paid' filter to getDailyRollingData to match calculateForecast

### Claude's Discretion
- Exact name and signature of the shared balance-walking core function
- Whether to extract a separate openingBalanceLookup helper or inline the unified logic
- Order of operations within the recurrence-advancement utility
- Whether any other minor inconsistencies found during implementation are worth fixing in this phase (apply judgment: fix if trivial and correctness-related, defer otherwise)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_calculateDailyMetrics(dateStr, datasets)` in cashflow.js: already shared between both balance paths — the daily income/expense calculation is unified; only the balance accumulation loop and opening balance fetch diverge
- `nextWorkingDay()` in cashflow.js: used by both paths for recurrent expense date resolution

### Established Patterns
- Repository methods in repository.js call triggerSync() after mutations — any new payment-advancement logic should follow this pattern
- toPence/fromPence conversions happen at repository boundary — balance/amount values inside cashflow.js are in pence
- getDailyRollingData queries DB directly (db.income, db.recurrentExpenses, etc.) while calculateForecast uses repository abstractions (incomeRepository, recurrentExpenseRepository) — unification should reconcile this

### Integration Points
- dashboard.js:renderDashboard() calls getDailyRollingData() (chart) and calculateForecast() (via renderForecastTable) — both must produce consistent closing balances
- Any payment-marking UI (expenses.js, transactions.js) that calls markAllAsPaid() or recordPayment() will need to trigger the new recurrence-advancement utility
- After dead code removal, charts.js Chart.register() call should only include components actually used

</code_context>

<specifics>
## Specific Ideas

- The recurrence-advancement semantic: "paid" means "already happened, don't count again." Once nextDate advances past the payment date, paid items naturally fall outside historical query windows — the status filter then becomes a correctness guard rather than the primary mechanism.
- The unification should not change the output shape of getDailyRollingData or calculateForecast — callers (dashboard.js, renderForecastTable) must work without modification.

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-code-inconsistencies-inefficiencies*
*Context gathered: 2026-03-07*
