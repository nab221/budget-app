# Phase 31: Banking Calendar Utility & Recurrence Upgrade - Research

**Researched:** 2026-03-15
**Domain:** UK banking calendar, date computation, Dexie schema migration, Vitest testing
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New module: `src/utils/banking-calendar.js` with public API:
  - `isUKBankHoliday(date)` → boolean (synchronous, no DB)
  - `isWorkingDay(date)` → boolean (synchronous, no DB)
  - `nextWorkingDay(date)` → Date (same day if already working day, else next Mon-Fri non-holiday)
  - `adjustedPaymentDate(nominalDate, adjustment)` → Date, where adjustment is `'none' | 'next-working-day'`
- Internal cache: localStorage key `uk_bank_holidays_cache`, timestamp key `uk_bank_holidays_cache_date`
- Cache expiry: 365 days (check on app load)
- Static fallback: hardcoded holidays for England & Wales, years 2025, 2026, 2027
- Source: GOV.UK API `https://www.gov.uk/bank-holidays.json`, key `england-and-wales`
- Schema field: `paymentAdjustment: 'none' | 'next-working-day'` on recurrentExpenses
- Schema version bump required (currently v18 → v19)
- Migration: default all existing records to `'none'`
- Settings panel: "Refresh bank holidays" button calling `refreshBankHolidaysCache()`
- `maxCachedYear` guard: `console.warn` and fall back to weekend-only when date exceeds cached range
- `refreshBankHolidaysCache()` is async/fire-and-forget on app load; never blocks startup
- Files to change: `banking-calendar.js` (new), `banking-calendar.test.js` (new), `recurrence.js`, `recurrence.test.js`, `schema.js`, `repository.js`

### Claude's Discretion
- None explicitly listed — all decisions are locked in CONTEXT.md

### Deferred Ideas (OUT OF SCOPE)
- Scotland / Northern Ireland bank holidays
- Manual per-date bankHolidayOverrides UI (already in DB but not the focus here)
- Any UI rendering of adjusted dates (consumed by Phase 32 and Phase 34)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TECH-02 | Create `src/utils/banking-calendar.js` with `nextWorkingDay` and `adjustedPaymentDate` functions, backed by GOV.UK API cache | Module design, cache strategy, static fallback data documented in this research |
| TECH-03 | Extend `src/utils/recurrence.js` to support `paymentAdjustment: 'next-working-day'`, delegating to banking-calendar | Recurrence engine integration patterns documented; hook points in `generateInstances` and `advanceNextDate` identified |
| PLAN-03 | All recurring payment dates shift to next working day when they fall on weekend/bank holiday | 2026 bank holiday dates verified; acceptance criteria test cases validated against live GOV.UK API |
</phase_requirements>

---

## Summary

Phase 31 is a **refactoring and extraction phase** with an important pre-existing code complication: `src/utils/cashflow.js` already implements `fetchHolidays`, `isBankHoliday`, `isWorkingDay`, and `nextWorkingDay`. These are async functions that hit the DB (`bankHolidayRepository`) for manual overrides and use `localStorage` for the holiday cache under the key `'bank-holidays-cache'`. The CONTEXT.md specifies a new module `banking-calendar.js` with synchronous versions of these functions using a different cache key (`uk_bank_holidays_cache`). This is not a conflict but a deliberate design separation: the new module is synchronous and pure (no DB access), while the cashflow versions remain async (with DB override support). The planner must be explicit about this co-existence.

The GOV.UK API format is simple and confirmed: `data['england-and-wales'].events` is an array of `{ title, date, notes, bunting }` objects, where `date` is `YYYY-MM-DD`. All 2026 acceptance criteria dates were cross-checked against the live API and are correct. The static fallback list for 2025-2027 must be bundled since the API may not be reachable in offline/PWA mode.

The Dexie schema is currently at version 18. Adding `paymentAdjustment` to `recurrentExpenses` requires a version 19 bump with a migration that sets `paymentAdjustment = 'none'` for all existing records. The `date-fns` library (v4.1.0) is already installed and provides all date arithmetic needed — no new dependencies required.

**Primary recommendation:** Extract banking-calendar logic as a new synchronous module. Keep it purely date-math based (no DB, no async). The cashflow.js async versions with DB override support continue to serve the cashflow forecasting feature separately.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | ^4.1.0 | Date arithmetic (day-of-week, date comparison) | Already in project; `getDay()`, `addDays()` used throughout |
| Dexie | ^4.0.11 | Schema versioning and migration | Already governs all IndexedDB; version bump is the established pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^3.0.7 | Unit tests for new module | All project tests use Vitest; jsdom environment for localStorage |
| GOV.UK Bank Holidays API | External | Live holiday fetch | Called on app load (fire-and-forget) for cache refresh |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static bundled fallback | date-holidays npm package | Package adds ~150KB; GOV.UK data is authoritative; static list covers the 3-year window |
| Synchronous module | Extending async cashflow functions | cashflow.js already has async versions with DB override — synchronous module avoids DB dependency in recurrence engine |

**Installation:** No new dependencies required. All tooling is already in the project.

---

## Architecture Patterns

### Recommended Project Structure
```
src/utils/
├── banking-calendar.js        # NEW — synchronous pure module, no DB
├── banking-calendar.test.js   # NEW — Vitest tests, jsdom environment
├── cashflow.js                # EXISTING — async versions remain, reference new module
├── recurrence.js              # MODIFIED — import adjustedPaymentDate from banking-calendar
└── recurrence.test.js         # MODIFIED — add paymentAdjustment test cases
src/db/
├── schema.js                  # MODIFIED — version 19, paymentAdjustment field
└── repository.js              # MODIFIED — migration default + no structural change needed
index.html                     # MODIFIED — "Refresh bank holidays" button in Settings panel
```

### Pattern 1: Synchronous Banking Calendar Module

**What:** A pure function module that operates on a pre-loaded Set of holiday date strings. No async DB access. Loads from localStorage on first call.

**When to use:** Any code path in the recurrence engine or UI that needs banking-day adjustment at render time without awaiting DB queries.

**Example:**
```javascript
// src/utils/banking-calendar.js
const CACHE_KEY = 'uk_bank_holidays_cache';
const CACHE_DATE_KEY = 'uk_bank_holidays_cache_date';
const CACHE_EXPIRY_DAYS = 365;

// Static fallback — England & Wales bank holidays 2025–2027
const STATIC_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', // New Year's Day
  '2025-04-18', // Good Friday
  '2025-04-21', // Easter Monday
  '2025-05-05', // Early May bank holiday
  '2025-05-26', // Spring bank holiday
  '2025-08-25', // Summer bank holiday
  '2025-12-25', // Christmas Day
  '2025-12-26', // Boxing Day
  // 2026
  '2026-01-01', // New Year's Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-05-04', // Early May bank holiday
  '2026-05-25', // Spring bank holiday
  '2026-08-31', // Summer bank holiday
  '2026-12-25', // Christmas Day
  '2026-12-28', // Boxing Day (substitute)
  // 2027 — to be verified from live API; placeholder year
]);

function loadBankHolidays() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const dates = JSON.parse(raw);
      return new Set(Array.isArray(dates) ? dates : []);
    }
  } catch (e) { /* ignore */ }
  return STATIC_HOLIDAYS;
}

export function isUKBankHoliday(date) {
  const holidays = loadBankHolidays();
  const dateStr = date instanceof Date
    ? date.toISOString().split('T')[0]
    : date;
  return holidays.has(dateStr);
}

export function isWorkingDay(date) {
  const d = date instanceof Date ? date : new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  return !isUKBankHoliday(d);
}

export function nextWorkingDay(date) {
  let d = date instanceof Date ? new Date(date) : new Date(`${date}T00:00:00Z`);
  while (!isWorkingDay(d)) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d;
}

export function adjustedPaymentDate(nominalDate, adjustment) {
  if (adjustment !== 'next-working-day') return nominalDate instanceof Date ? nominalDate : new Date(`${nominalDate}T00:00:00Z`);
  return nextWorkingDay(nominalDate);
}
```

### Pattern 2: Recurrence Engine Integration

**What:** `generateInstances` and `advanceNextDate` accept a `paymentAdjustment` field from the item. When `'next-working-day'`, they call `adjustedPaymentDate` to produce the display date while keeping the nominal (raw) date as the scheduling anchor.

**When to use:** Any monthly/quarterly expense with `paymentAdjustment: 'next-working-day'` set.

**Key insight:** Store `date` (nominal, for scheduling drift prevention) and compute an adjusted display date on the fly. Do NOT mutate the stored `date` field.

**Example hook in `generateInstances`:**
```javascript
// Source: Pattern derived from existing recurrence.js structure
import { adjustedPaymentDate } from './banking-calendar.js';

// After computing nextInstanceDate:
const adjustment = base.paymentAdjustment || 'none';
const adjustedDate = adjustedPaymentDate(nextInstanceDate, adjustment);
const dateStr = format(nextInstanceDate, 'yyyy-MM-dd');           // nominal
const adjustedDateStr = format(adjustedDate, 'yyyy-MM-dd');       // display
const instance = {
  ...base,
  date: dateStr,                           // keeps scheduling anchor
  predictedPaymentDate: adjustedDateStr,   // display/affordability field
  paymentAdjustment: adjustment,
};
```

### Pattern 3: Schema Version Bump (Dexie v19)

**What:** Add `paymentAdjustment` to `recurrentExpenses` index string and upgrade() all existing records to default `'none'`.

**When to use:** Follows every existing schema version pattern in `schema.js`.

```javascript
// db.version(19).stores({ ... recurrentExpenses: '++id, ..., paymentAdjustment', ... })
// .upgrade(async tx => {
//   await tx.table('recurrentExpenses').toCollection().modify(item => {
//     if (item.paymentAdjustment === undefined) item.paymentAdjustment = 'none';
//   });
// });
```

### Pattern 4: Cache Refresh (async, fire-and-forget)

**What:** On app load, check if cache is older than 365 days. If so, fetch GOV.UK API in background. Store parsed dates as a JSON array (not a Set — Sets are not JSON-serializable).

**Storage format in localStorage:**
```javascript
// Key: 'uk_bank_holidays_cache'
// Value: JSON.stringify(['2025-01-01', '2025-04-18', ...])   // plain array of YYYY-MM-DD strings

// Key: 'uk_bank_holidays_cache_date'
// Value: '2026-03-15'   // ISO date string of last refresh
```

Note: The existing `cashflow.js` uses `'bank-holidays-cache'` as its key with format `{ timestamp, dates }`. The new module uses distinct keys (`'uk_bank_holidays_cache'` and `'uk_bank_holidays_cache_date'`) to avoid collision.

**Refresh function:**
```javascript
export async function refreshBankHolidaysCache() {
  try {
    const response = await fetch('https://www.gov.uk/bank-holidays.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const dates = data['england-and-wales'].events.map(e => e.date);
    localStorage.setItem(CACHE_KEY, JSON.stringify(dates));
    localStorage.setItem(CACHE_DATE_KEY, new Date().toISOString().split('T')[0]);
  } catch (err) {
    console.warn('[banking-calendar] Failed to refresh bank holidays cache:', err);
    // Fall back to static data — no further action needed
  }
}
```

### Anti-Patterns to Avoid

- **Storing a Set in localStorage:** `JSON.stringify(new Set(...))` produces `{}`. Always serialize to an array first.
- **Using local `new Date(dateStr)` without UTC anchor:** `new Date('2026-01-01')` is UTC midnight but `getDay()` returns local timezone day. Use `getUTCDay()` consistently.
- **Mutating the `date` field in recurrence:** The nominal date is the scheduling anchor that prevents drift. Only `predictedPaymentDate` should reflect the adjusted date.
- **Blocking app startup on fetch:** `refreshBankHolidaysCache()` must be called without `await` in the startup path.
- **Nesting `nextWorkingDay` infinitely:** Add a safety counter (e.g., max 14 iterations) to avoid infinite loops on corrupted data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic | Custom day-of-week logic | `date-fns` `getDay()` / UTC methods | Already in project; handles month boundaries correctly |
| Holiday data | Scraping another source | GOV.UK API + static bundled fallback | Authoritative; JSON format already verified |
| Schema migration | Manual IndexedDB calls | Dexie version() + upgrade() | Dexie handles multi-tab upgrade coordination |
| Test mocking | Real localStorage in Vitest | Vitest's built-in `localStorage` via jsdom | jsdom provides full localStorage in tests without extra setup |

**Key insight:** The GOV.UK API returns a flat array of dated events — parse with `data['england-and-wales'].events.map(e => e.date)`. No third-party holiday library needed.

---

## Common Pitfalls

### Pitfall 1: Timezone Mismatch in `isWorkingDay`

**What goes wrong:** `new Date('2026-01-01').getDay()` returns `3` (Thursday) in UTC but may return `3` or `2` depending on local timezone offset when running in UK winter (GMT+0) vs summer (GMT+1).

**Why it happens:** JavaScript `Date` constructor with ISO strings treats them as UTC, but `getDay()` returns local time day-of-week.

**How to avoid:** Use `getUTCDay()` consistently throughout banking-calendar.js. All date comparisons use `YYYY-MM-DD` strings; when constructing a Date from a string, use `new Date('${dateStr}T00:00:00Z')`.

**Warning signs:** Tests pass locally (UK timezone) but fail in CI (UTC).

### Pitfall 2: cashflow.js and banking-calendar.js Function Name Collision

**What goes wrong:** `cashflow.js` already exports `isWorkingDay` and `nextWorkingDay`. If `banking-calendar.js` exports functions with the same names, imports in other files may pick up the wrong version.

**Why it happens:** Both modules solving the same problem with different async/sync contracts.

**How to avoid:** The new `banking-calendar.js` functions are synchronous. `cashflow.js` functions are async with DB override support. Any file importing both must use namespace imports or aliases. Document clearly in JSDoc which is which.

**Warning signs:** A call to `banking-calendar.isWorkingDay` erroneously being awaited, or the async cashflow version being used where synchronous behavior is expected.

### Pitfall 3: Cache Miss on First Load (No Network)

**What goes wrong:** Static fallback set is empty or stale → `nextWorkingDay` falls into infinite loop or returns wrong result.

**Why it happens:** `STATIC_HOLIDAYS` is not populated for a year, and cache is empty because network was never available.

**How to avoid:** Bundle complete static data for all three years (2025, 2026, 2027). The `maxCachedYear` guard with `console.warn` is the safety net for dates beyond 2027.

**Warning signs:** `nextWorkingDay` stepping more than 10 days from a Saturday.

### Pitfall 4: recurrence.js `advanceNextDate` Returning Nominal vs Adjusted Date

**What goes wrong:** The affordability engine (Phase 34) uses `nextDate` assuming it is the bank-adjusted date, but `nextDate` is the nominal scheduling anchor.

**Why it happens:** Phase 31 adds `paymentAdjustment` but the display field is `predictedPaymentDate`. If downstream consumers use `nextDate`, they get the unadjusted date.

**How to avoid:** `advanceNextDate` returns nominal `nextDate` only. `predictedPaymentDate` on the item record is the adjusted display date. Document this contract clearly in recurrence.js JSDoc.

### Pitfall 5: Dexie Version Bump with Missing Index

**What goes wrong:** `paymentAdjustment` added to the object but not to the Dexie `stores()` index string → Dexie cannot query/filter on it later.

**Why it happens:** Dexie only indexes fields listed explicitly in the schema string.

**How to avoid:** Add `paymentAdjustment` to the `recurrentExpenses` index string in v19 schema. Example: `'++id, ..., linkedDebtId, paymentAdjustment'`.

---

## Code Examples

Verified from live GOV.UK API (2026-03-15):

### GOV.UK API Response Structure
```javascript
// Source: https://www.gov.uk/bank-holidays.json (verified 2026-03-15)
{
  "england-and-wales": {
    "division": "england-and-wales",
    "events": [
      { "title": "New Year's Day", "date": "2026-01-01", "notes": "", "bunting": true },
      { "title": "Good Friday",    "date": "2026-04-03", "notes": "", "bunting": false },
      { "title": "Easter Monday",  "date": "2026-04-06", "notes": "", "bunting": true },
      // ...
      { "title": "Boxing Day",     "date": "2026-12-28", "notes": "Substitute day", "bunting": true }
    ]
  },
  "scotland": { ... },
  "northern-ireland": { ... }
}
// Parse: data['england-and-wales'].events.map(e => e.date)
```

### Confirmed 2026 England & Wales Bank Holidays
```
2026-01-01  New Year's Day
2026-04-03  Good Friday
2026-04-06  Easter Monday
2026-05-04  Early May bank holiday
2026-05-25  Spring bank holiday
2026-08-31  Summer bank holiday
2026-12-25  Christmas Day
2026-12-28  Boxing Day (Substitute day — 27 Dec falls on Sun, 26 Dec falls on Sat)
```

### Acceptance Criteria Verification
```
nextWorkingDay(2026-01-01) = 2026-01-02  ✓  (1 Jan=Thu=New Year's Day → Fri 2 Jan is working day)
nextWorkingDay(2026-12-25) = 2026-12-29  ✓  (25=Fri=Christmas, 26=Sat, 27=Sun, 28=Mon=Boxing subst → Tue 29)
nextWorkingDay(2026-03-20) = 2026-03-20  ✓  (Friday, no holiday)
nextWorkingDay(2026-03-21) = 2026-03-23  ✓  (Saturday → Monday)
```

### Vitest Test Structure for banking-calendar.test.js
```javascript
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isUKBankHoliday, isWorkingDay, nextWorkingDay, adjustedPaymentDate, refreshBankHolidaysCache } from './banking-calendar.js';

describe('isUKBankHoliday', () => {
  beforeEach(() => localStorage.clear());
  it('returns true for 2026-01-01 (New Year\'s Day) using static fallback', () => {
    expect(isUKBankHoliday(new Date('2026-01-01T00:00:00Z'))).toBe(true);
  });
  it('returns false for 2026-03-20 (normal Friday)', () => {
    expect(isUKBankHoliday(new Date('2026-03-20T00:00:00Z'))).toBe(false);
  });
});

describe('nextWorkingDay', () => {
  it('Saturday 2026-03-21 → Monday 2026-03-23', () => {
    const result = nextWorkingDay(new Date('2026-03-21T00:00:00Z'));
    expect(result.toISOString().split('T')[0]).toBe('2026-03-23');
  });
  it('Christmas 2026-12-25 (Friday+holiday) → 2026-12-29 (Tuesday)', () => {
    const result = nextWorkingDay(new Date('2026-12-25T00:00:00Z'));
    expect(result.toISOString().split('T')[0]).toBe('2026-12-29');
  });
  it('already working day 2026-03-20 (Friday) → same day', () => {
    const result = nextWorkingDay(new Date('2026-03-20T00:00:00Z'));
    expect(result.toISOString().split('T')[0]).toBe('2026-03-20');
  });
});
```

---

## Pre-existing Code — Critical Context for Planner

### What Already Exists in cashflow.js (Lines 15-149)

`src/utils/cashflow.js` exports async versions of the same concepts:

| cashflow.js export | Relationship to banking-calendar.js |
|-------------------|-------------------------------------|
| `fetchHolidays(force)` | Async; uses cache key `'bank-holidays-cache'` (different key!) |
| `isBankHoliday(dateStr, set)` | Async; checks `bankHolidayRepository.isOverrideActive()` first |
| `isWorkingDay(dateStr, set)` | Async; delegates to DB overrides |
| `nextWorkingDay(dateStr, includeToday, set)` | Async; takes string not Date; `includeToday` parameter differs |

**The new banking-calendar.js functions are a synchronous alternative** — they do not replace the cashflow.js versions. The cashflow.js functions remain in use for the cash flow forecasting engine (which needs DB override support). The new synchronous functions serve the recurrence engine (which runs during DB writes and cannot await DB queries safely inside transactions).

### Cache Key Conflict Risk — NONE (different keys)
- `cashflow.js` uses: `localStorage.key = 'bank-holidays-cache'` → format `{ timestamp, dates }`
- `banking-calendar.js` will use: `localStorage.key = 'uk_bank_holidays_cache'` → format `['2025-01-01', ...]`

No conflict. But the "Refresh bank holidays" button in Settings should refresh BOTH caches if the cashflow forecasting relies on the old key. **Planner decision required:** either the Settings button updates both caches, or we accept temporary divergence until each module's own refresh schedule triggers.

### bankHolidayOverrides Table
Already in schema (since v10). It stores manual user overrides (`{ date, isOpen }`). The new banking-calendar.js does NOT consult this table (it is synchronous). The cashflow.js async versions DO consult it. This divergence is intentional per the architecture.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No banking calendar | cashflow.js async functions with DB override | v10 schema | cashflow forecasting aware of holidays |
| No recurrence adjustment | Phase 31: `paymentAdjustment` field | Phase 31 | recurrence engine outputs adjusted payment dates |
| `nextWorkingDay` always looked ahead | New module: same-day if already working | Phase 31 | `adjustedPaymentDate('2026-03-20', 'next-working-day')` returns 2026-03-20, not 2026-03-23 |

**Deprecated/outdated:**
- None — this is net-new functionality layered on existing infrastructure.

---

## Open Questions

1. **Settings button — should it refresh both cache keys?**
   - What we know: `cashflow.js` has its own `fetchHolidays()` with cache key `'bank-holidays-cache'`. The new module uses `'uk_bank_holidays_cache'`.
   - What's unclear: Should the Settings "Refresh bank holidays" button call `refreshBankHolidaysCache()` (new module) only, or also force-refresh the cashflow.js cache?
   - Recommendation: Update both in the Settings handler. Long-term, consolidate to one cache key in a future refactor. For now, call both from the button handler.

2. **2027 static holiday data**
   - What we know: GOV.UK API currently returns 2026 data only for 2026-12. 2027 holidays are not yet published.
   - What's unclear: Are 2027 holidays available in the API today?
   - Recommendation: Bundle what is available. The `maxCachedYear` guard will warn for dates beyond the bundled set. The Settings refresh button solves this as 2027 data becomes available.

3. **Should `nextWorkingDay` in recurrence.js affect the stored `date` or only `predictedPaymentDate`?**
   - What we know: CONTEXT.md says "generate the adjusted date for a monthly expense with `paymentAdjustment: 'next-working-day'`".
   - What's unclear: Whether the acceptance criterion means the `date` or `predictedPaymentDate` field is adjusted.
   - Recommendation: Adjust `predictedPaymentDate` only. Keep `date` as the nominal scheduling anchor. This matches the existing pattern where `predictedPaymentDate` is the display/forecasting field.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.7 |
| Config file | `vite.config.js` (vitest config inline) |
| Quick run command | `npx vitest run src/utils/banking-calendar.test.js src/utils/recurrence.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TECH-02 | `nextWorkingDay(2026-01-01)` = 2026-01-02 | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 |
| TECH-02 | `nextWorkingDay(2026-12-25)` = 2026-12-29 | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 |
| TECH-02 | `nextWorkingDay(2026-03-20)` = 2026-03-20 (same day) | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 |
| TECH-02 | `nextWorkingDay(2026-03-21)` = 2026-03-23 | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 |
| TECH-02 | Static fallback used when localStorage empty | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 |
| TECH-02 | Cache refresh stores parsed dates array | unit | `npx vitest run src/utils/banking-calendar.test.js` | ❌ Wave 0 |
| TECH-03 | `generateInstances` with `paymentAdjustment: 'next-working-day'` produces adjusted `predictedPaymentDate` | unit | `npx vitest run src/utils/recurrence.test.js` | ✅ (extend existing) |
| TECH-03 | Existing items with no `paymentAdjustment` unaffected | unit | `npx vitest run src/utils/recurrence.test.js` | ✅ (extend existing) |
| PLAN-03 | Monthly expense on 2026-01-01 adjusted to 2026-01-02 | unit | `npx vitest run src/utils/recurrence.test.js` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/utils/banking-calendar.test.js src/utils/recurrence.test.js`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green (393+ tests) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/banking-calendar.test.js` — covers TECH-02 (all `isUKBankHoliday`, `isWorkingDay`, `nextWorkingDay`, `adjustedPaymentDate`, `refreshBankHolidaysCache` tests)
- [ ] `src/utils/banking-calendar.js` — the module itself (Wave 0 creates both together)
- [ ] Static fallback data for 2025-2027 must be researched and bundled in Wave 0

---

## Sources

### Primary (HIGH confidence)
- GOV.UK Bank Holidays API — `https://www.gov.uk/bank-holidays.json` — verified API format, confirmed 2026 holiday dates
- `D:/code/github/budget-app/src/utils/cashflow.js` — pre-existing `fetchHolidays`, `isBankHoliday`, `isWorkingDay`, `nextWorkingDay` implementations reviewed in full
- `D:/code/github/budget-app/src/db/schema.js` — current schema at v18, confirmed `bankHolidayOverrides` table exists since v10
- `D:/code/github/budget-app/src/utils/recurrence.js` — reviewed in full; `generateInstances` and `advanceNextDate` hook points identified
- `D:/code/github/budget-app/src/utils/recurrence.test.js` — reviewed in full; mock patterns established

### Secondary (MEDIUM confidence)
- `index.html` Settings panel — "Preferences" section at line 375; confirmed location for "Refresh bank holidays" button insertion
- `package.json` — confirmed date-fns 4.x already installed; no new dependencies needed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing packages, no new dependencies
- Architecture: HIGH — pre-existing cashflow.js code reviewed; GOV.UK API format confirmed; Dexie migration pattern established
- Pitfalls: HIGH — cashflow.js co-existence verified; UTC vs local timezone is a real issue in existing code (cashflow uses `getDay()`, new module should use `getUTCDay()`)

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (stable domain; GOV.UK API format is stable)
