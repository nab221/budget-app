# Payment calendar & Next payments — daily totals

**Date:** 2026-07-24
**Status:** approved

## Problem

Two dashboard lists show individual committed payments but no totals:

1. **Payment calendar** — selecting a day lists that day's payments
   (`PaymentCalendar.jsx`) but shows no **total for the day**.
2. **Next payments** — a flat chronological list of the next 8 payments
   (`Dashboard.jsx`) with no totals at all.

The user wants the day's total shown when a calendar date is selected, and the
same treatment for the Next payments list.

## Decision

For Next payments, show **both** per-day subtotals **and** an overall grand
total (user choice).

Once Next payments is grouped by date, both lists render the identical shape —
a date header carrying that day's total, then the day's payments as
`label · amount`. So extract one shared presentational component rather than
editing each list separately (avoids visual drift, ~25 lines).

## Design

### New component — `src/ui/dashboard/PaymentDayGroup.jsx`
Props: `{ dateStr, rows }` where `rows` are occurrence objects
(`{ label, amountPence, isAdjusted }`).
Renders:
- a head: `formatDay(dateStr)` (left) + the day's **total** (right, summed from
  `rows`), and
- the existing `upcoming-list` of `label · amount` rows (with the `shifted` tag
  for working-day-adjusted dates).

### Payment calendar (`PaymentCalendar.jsx`)
When a day is selected and has payments, render
`<PaymentDayGroup dateStr={selected} rows={selectedRows} />`. The
"Nothing due this day" branch is unchanged.

### Next payments (`Dashboard.jsx`)
Group `upcoming` (already sorted ascending) into consecutive same-date groups,
render one `PaymentDayGroup` per group, then a bold grand-total footer
(`upcoming-list__grand`) summing all listed payments.

### Styling
Add `.day-group`, `.day-group__head`, `.day-group__date`, `.day-group__total`,
and `.upcoming-list__grand` to `styles.css`, reusing existing
`--muted`/`--border`/tabular-nums conventions.

## Constraints honoured
- Money is integer **pence** everywhere; pounds only via `<Money>`.
- Nothing persisted — subtotals/grand total summed live from occurrences at
  read time. No engine changes.

## Tests (`dashboardRender.test.jsx`)
- Selecting a calendar day shows the day's **Total** (e.g. `£30.00` in the
  head) alongside the individual payments.
- Next payments shows per-day subtotals and a grand total equal to the sum of
  the listed payments.

## Non-goals
- No change to which/how many payments are listed (still `upcomingPayments(…,8)`).
- No new engine helpers; grouping is a local UI concern.
