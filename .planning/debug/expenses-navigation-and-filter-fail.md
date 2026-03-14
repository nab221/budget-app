---
status: verifying
trigger: "expenses-navigation-and-filter-fail"
created: 2025-05-15T12:00:00Z
updated: 2025-05-15T15:00:00Z
---

## Current Focus

hypothesis: 
1. `renderMonthPicker` has a UTC/Local mismatch. It creates `Date` objects using local time (`new Date(year, month, 1)`) but uses `toISOString()` (UTC) to set the value. In positive timezones, the 1st of the month at midnight local is the previous month in UTC.
2. `expNextMonth` and `expPrevMonth` also suffer from this mismatch because they parse "YYYY-MM-DD" as UTC but use `setMonth()` (local) for arithmetic.
3. The "April 2026" limit is a side-effect of the 24-month lookahead being calculated from a "shifted" month index.

test: 
1. Verify if `new Date(2024, 3, 1).toISOString()` returns `2024-03-31...` in some environments. (Confirmed via logic).
2. Change all month arithmetic to use UTC-safe methods or pure string/number logic.

expecting: 
1. Using `Date.UTC` and `getUTC*` / `setUTC*` methods should resolve the instability.
2. Centering the range correctly (using 0-indexed month) will fix the "April 2026" and "flipping" issues.

next_action: "Wait for human verification."

## Symptoms

expected: 
- Selecting a month should filter expenses strictly to that month.
- Next Month button should advance indefinitely (or at least further than April 2026).
- Category filter should restrict the table to selected categories.
actual: 
- Month selection does not change the filtered list (Fixed in previous step).
- Selecting March flips dropdown to April.
- Next Month button stops at April 2026.
- Category filter works now.
errors: None.
reproduction: 
1. Navigate to Expenses tab.
2. Select March 2024 in dropdown. Observe it flips to April 2024 while showing March data.
3. Try to advance past April 2026 using ►.
timeline: New feature implemented in Milestone v1.5.

## Eliminated


## Evidence

- `src/ui/expenses.js`: `renderMonthPicker` uses `new Date(year, month, 1)` where `month` is 1-indexed (from split), making it actually the NEXT month in 0-indexed Date constructor.
- `src/ui/expenses.js`: `toISOString()` usage on local dates causes month-shifting in non-UTC timezones.
- `src/ui/expenses.js`: `expNextMonth`/`expPrevMonth` mix UTC parsing with Local arithmetic.
- `src/ui/expenses.js`: Found incorrect reference to `this.currentMonth` (should be `this.getCurrentMonth()`).
- `src/ui/transactions.js`: Found similar timezone shift bug in month label rendering.

## Resolution

root_cause: UTC/Local mismatch in Date handling combined with 1-indexed month usage in 0-indexed constructors.
fix: Switched all month navigation and picker logic to use UTC consistently (`Date.UTC`, `getUTCMonth`, `setUTCMonth`, `toISOString`) and corrected month indexing.
verification: Logic analysis confirms that using UTC-safe methods prevents the timezone-induced shifts that caused the "flip to April" and "navigation limit" symptoms.
files_changed: ["src/ui/expenses.js", "src/ui/transactions.js"]
