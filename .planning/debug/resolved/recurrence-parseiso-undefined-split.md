---
status: resolved
trigger: "App fails to initialize with TypeError: Cannot read properties of undefined (reading 'split') in parseISO, called from advanceNextDate in recurrence.js"
created: 2026-03-07T00:00:00Z
updated: 2026-03-07T00:01:00Z
---

## Current Focus

hypothesis: cashflow.js calls advanceNextDate(currentDate, item.frequency) with the old two-argument signature, but advanceNextDate was refactored to accept a single item object {nextDate, frequency}. So item passed in is a plain string (currentDate), item.nextDate is undefined, and parseISO(undefined) crashes on .split().
test: Read both call site and function signature — confirmed mismatch.
expecting: Fix call site to pass {nextDate: currentDate, frequency: item.frequency} and use return value correctly.
next_action: Apply fix in cashflow.js line 184

## Symptoms

expected: App initializes and dashboard renders normally
actual: App crashes on init with TypeError
errors: |
  TypeError: Cannot read properties of undefined (reading 'split')
      at splitDateString (parseISO.js:105:28)
      at parseISO (parseISO.js:49:23)
      at advanceNextDate (recurrence.js:76:16)
      at _projectRecurrentOccurrences (cashflow.js:184:19)
      at async getDailyRollingData (cashflow.js:448:25)
      at async renderDashboard (dashboard.js:93:56)
      at async initDashboard (dashboard.js:38:3)
      at async init (app.js:187:3)
reproduction: App startup / page load
started: Recent — likely introduced with "Fix: Handle recurrents without frequency and fix Dexie query" commit

## Eliminated

(none — root cause found on first read)

## Evidence

- timestamp: 2026-03-07T00:01:00Z
  checked: recurrence.js advanceNextDate signature (line 75)
  found: "export function advanceNextDate(item)" — expects a single object with item.nextDate and item.frequency
  implication: Function was refactored to accept an object, not two separate arguments

- timestamp: 2026-03-07T00:01:00Z
  checked: cashflow.js _projectRecurrentOccurrences line 184
  found: "currentDate = advanceNextDate(currentDate, item.frequency);" — passes string + string (old 2-arg API)
  implication: advanceNextDate receives a string as `item`, so item.nextDate is undefined; parseISO(undefined) throws

- timestamp: 2026-03-07T00:01:00Z
  checked: advanceNextDate return value (recurrence.js line 86-91)
  found: returns { nextDate, cycleCurrent } object, not a bare string
  implication: Even if argument were fixed, caller must destructure .nextDate from the result

## Resolution

root_cause: |
  cashflow.js line 184 calls advanceNextDate with the old two-argument signature
  advanceNextDate(currentDate, item.frequency) — passing a plain date string as `item`.
  The function was refactored to accept a single object {nextDate, frequency} and returns
  {nextDate, cycleCurrent}. This mismatch means item.nextDate is undefined inside the function,
  causing parseISO(undefined) to crash on .split().

fix: |
  Change cashflow.js line 184 from:
    currentDate = advanceNextDate(currentDate, item.frequency);
  to:
    ({ nextDate: currentDate } = advanceNextDate({ nextDate: currentDate, frequency: item.frequency, cycleCurrent: currentCycle, cycleTotal: item.cycleTotal, isDebtPayment: item.isDebtPayment }));

  But since _projectRecurrentOccurrences already manages currentCycle itself, we only need nextDate:
    currentDate = advanceNextDate({ nextDate: currentDate, frequency: item.frequency }).nextDate;

verification: All 150 tests pass including cashflow and recurrence suites. Fix confirmed correct.
files_changed:
  - src/utils/cashflow.js
