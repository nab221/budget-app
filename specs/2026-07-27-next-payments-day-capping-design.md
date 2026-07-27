# Next payments: whole-day capping and conditional day totals

**Date:** 2026-07-27
**Supersedes:** parts of `2026-07-24-payment-daily-totals-design.md` (the grand
total, and the always-on day total)

## Problem

The "Next payments" panel caps its list at 8 *payments*
(`upcomingPayments(data, from, 8)`), and `upcomingPayments` ends in
`.slice(0, count)`. The cap therefore lands mid-day: a day with four payments can
have two of them trimmed off the bottom of the list.

Two things follow from that:

1. **The last day's total is wrong.** `PaymentDayGroup` sums the rows it was
   given, so a truncated day reports the sum of the payments that survived the
   slice rather than the day's real total. Observed on 3 August.
2. **The grand total is meaningless.** It sums "the first 8 payments", which is
   not a quantity the user has any use for — it is neither a day, a week, nor a
   month.

Separately, the day header reads as a different kind of row from the
`label · amount` rows beneath it, which makes the list feel inconsistent. On a
day with a single payment the header's total is also a verbatim repeat of the
amount one line below it.

## Design

### Cap by whole days, in the engine

Replace `upcomingPayments(data, fromStr, count = 8)` with:

```js
upcomingPaymentDays(data, fromStr, dayCount = 5)
  // -> [{ date: '2026-08-03', rows: [{ label, amountPence, isAdjusted }, ...] }, ...]
```

Same 14-month expansion horizon as before, so annual expenses still surface.
Instead of slicing the flat occurrence list, group the occurrences by date and
slice to `dayCount` **whole** days. A day is present in full or not at all, which
makes each day's total correct by construction.

Days without payments are skipped rather than rendered empty, so a quiet stretch
does not consume the budget of five days.

This moves `groupByDate` out of `Dashboard.jsx` and into the engine. It is pure
date logic over pure data, it belongs beside the rest of the engine, and it is
directly testable there. The dashboard should not flatten and then reassemble.

`upcomingPayments` is removed rather than left as an unused export — the
dashboard is its only caller.

### Show a day total only when it says something new

`PaymentDayGroup` renders `day-group__total` only when `rows.length > 1`. A
single-payment day emits its date alone and lets the amount sit on its own row.

The rule is self-explaining: if a total is present, that day has more than one
payment, and the number is worth reading.

`PaymentDayGroup` is shared with the payment calendar's selected-day detail, so
this applies there too. That is intended — the calendar's totals were never
wrong, but the single-payment redundancy is identical, and the two views should
read the same way.

### Drop the grand total

Remove the `<p className="upcoming-list__grand">` block from `Dashboard.jsx` and
the corresponding CSS, which becomes dead.

### Styling

Demote `.day-group__total` to `var(--muted)` at normal weight, matching
`.day-group__date`. The header then reads as a label for the group rather than a
row competing with the bold payment amounts below it.

## Files

- `src/engine/spending.js` — `upcomingPaymentDays` replaces `upcomingPayments`
- `src/engine/spending.test.js` — rewrite the `upcomingPayments` describe block
- `src/ui/Dashboard.jsx` — drop local `groupByDate` and the grand total; map over
  the engine's groups
- `src/ui/dashboard/PaymentDayGroup.jsx` — conditional total
- `src/styles.css` — demote `.day-group__total`; delete `.upcoming-list__grand`
- `src/ui/dashboard/dashboardRender.test.jsx` — rewrite the three assertions at
  lines 174–185

## Tests

Engine:

- A capped list never cuts a day mid-way: given a day with four payments at the
  cap boundary, that day appears with all four rows or does not appear at all.
- Empty stretches are skipped — a data set whose only expense is annual still
  yields that expense's day.
- `dayCount` bounds the number of groups, not the number of payments.

Render:

- A single-payment day emits no `.day-group__total`.
- A multi-payment day emits one, carrying the true sum of all that day's rows.
- The "Next payments" panel contains no grand total.
- The calendar's selected-day detail follows the same single-payment rule.

## Non-goals

No schema change, nothing persisted, no new dependencies. `dayCount` stays a
constant in `Dashboard.jsx`; it is not user-configurable.
