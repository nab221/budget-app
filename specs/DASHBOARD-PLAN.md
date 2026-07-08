# Dashboard v2 — Analytics, Graphs & Reports Plan

**Status:** Proposal for owner review (drafted 2026-07-08)
**Relates to:** `REFACTOR-SPEC.md` §4.1 + Amendment 2026-07-07 ("Dashboard is minimal
pending a later graphics redesign") and `IMPLEMENTATION-PLAN.md` Phase 6 (deferred
analytics). This document *is* that redesign plan.

---

## 1. What the dashboard is for

The dashboard is the one screen the owner opens to *understand* the household's money
without touching anything. Every other tab is for data entry or a specific tool; the
dashboard reads it all back as answers. It should answer, top to bottom, in order of
how often the questions get asked:

1. **"How much is going out?"** — this week / month / year, and the long-run average.
2. **"When does it go out?"** — which days are heavy, what's due next, is a big week
   coming.
3. **"Where does it go?"** — by category, and what each thing really costs per year.
4. **"How is the debt doing?"** — total owed, what the interest costs, when we're
   debt-free, anything about to get more expensive (promo expiries).
5. **"Are we safe on income & tax?"** — the £100k childcare cliff and the 40% band,
   per person, plus the expected tax bill.
6. **"Is anything worth acting on?"** — surfaced automatically as insight cards.

## 2. The honest constraint: this app has a schedule, not a history

Since the expenses-first amendment there is **no transactions ledger** — nothing
records what actually happened. The data is a *commitment schedule*: recurring bills,
debt records, childcare deposits, and income/dividend events. Two consequences:

- **All analytics are forward-looking or normalised**, computed at read time from the
  schedule (which the Hard Rules require anyway). "Spending trend over the last six
  months" is impossible and must not be faked.
- The one genuine time series the owner *creates* is **debt balance updates** (manual
  or from a statement PDF). Today each update overwrites the previous value. §7
  proposes keeping those updates as an append-only log — user-entered data, not a
  computed row — which unlocks the single most motivating chart in the app:
  *actual debt going down vs the plan*. This needs an owner decision.

Everything else in this plan works with the schema exactly as it is.

## 3. Layout

One scrolling page, six zones in the question order above. Desktop-first grid
(2–3 panels per row collapsing to one column on narrow windows). No sub-tabs, no
configuration/drag-drop — fixed order, boring and predictable. The privacy-blur
toggle continues to apply to every money figure, including inside charts.

```
┌──────────────────────────────────────────────────────────────┐
│ Z1  KPI strip: week / month / year · total debt · interest/mo│
│     · debt-free date                                         │
├──────────────────────────────────────────────────────────────┤
│ Z2  Insight cards (0–4, only when something is worth saying) │
├────────────────────────────┬─────────────────────────────────┤
│ Z3  Payment calendar       │  Next payments list (existing)  │
│     (month heatmap)        │  + 12-month outgoings columns   │
├────────────────────────────┼─────────────────────────────────┤
│ Z4  Where it goes: category│  Cost-of-everything table       │
│     bars (monthly ↔ yearly)│  (annualised, sortable)         │
├────────────────────────────┼─────────────────────────────────┤
│ Z5  Debt: payoff projection│  Debt facts: utilisation bars,  │
│     line (plan vs actual*) │  promo countdowns, interest cost│
├────────────────────────────┼─────────────────────────────────┤
│ Z6  Income & tax: per-person threshold meters · dividend     │
│     headroom · estimated bill (links to Income tab)          │
├──────────────────────────────────────────────────────────────┤
│ Z7  Reports: Monthly Money Report (print) · Schedule CSV     │
└──────────────────────────────────────────────────────────────┘
```

\* "actual" only if §7 is approved; otherwise projection-only.

## 4. The panels

### Z1 — KPI strip (stat tiles, no chart)

Extends the existing three "going out" tiles to six:

| Tile | Value | Engine |
|---|---|---|
| This week / month / year | actual occurrences in the calendar window, with the normalised average as the delta line under it ("£214 above your monthly average") | `spending.actualTotalPence` / `normalisedTotalPence` (exists) |
| Total debt | sum of balances, with "as of" staleness hint when the oldest balance update is > 35 days old | `debts` |
| Interest cost / month | estimated monthly interest across all debts at current balances and APRs (promo cards = £0 until `promoEndDate`) | new `insights.monthlyInterestPence` — small, pure |
| Debt-free | "Mar 2029" under the persisted strategy + current extra; the single most motivating number in the app | `finance.simulatePayoff` (exists) |

Tiles are hero-number stat tiles per the dataviz method — no one-bar charts. Each
debt tile deep-links to its zone / the Payoff tab.

### Z2 — Insight cards (the "report engine")

A pure, tested rule engine (`src/engine/insights.js`) that evaluates the live data
and returns 0–n cards, each `{ severity, title, body, link }`. The dashboard shows
the top 4 by severity; nothing renders when there's nothing to say (no "all good!"
filler). Launch rules:

1. **Promo cliff** — "0% on *Barclaycard* ends in 43 days. At 24.9% its minimum
   payment jumps to ≈ £X/month." (fires at 90/30/7 days; severity rises).
2. **Heavy period ahead** — "Week of 15 Sep is your heaviest in the next 3 months:
   £X across N payments." (from occurrence expansion).
3. **£100k / 40% proximity** — "Anderson is ≈ £4,200 of dividends from the £100k
   childcare line." (from `tax.computePersonTax` headroom; fires under a threshold,
   turns danger when crossed — mirrors the Income tab warning).
4. **Subscription creep** — "Your N smallest recurring expenses total £X/year."
   (everything under ~£15/occurrence, annualised — the classic audit prompt).
5. **Strategy check** — "Switching avalanche → your current snowball costs £X more
   interest and Y extra months." (only when the persisted strategy is not the
   cheapest; from two `simulatePayoff` runs).
6. **Stale balances** — "3 debts haven't had a balance update in 60+ days —
   projections drift." (from `balanceAsOf`).
7. **Backup nudge** — existing 14-day export reminder relocates here as a card.

Rules are cheap to add later; each ships with unit tests over hand-built fixtures.

### Z3 — When it goes out

- **Payment calendar** — the current month as a calendar grid, each day shaded by
  that day's committed total (sequential single-hue ramp; magnitude job → heatmap).
  Hovering/clicking a day lists its payments. Prev/next month navigation. Payday
  markers if income sources are re-activated later. Engine: `spending.spendingOccurrences`
  bucketed by date — exists.
- **12-month outgoings columns** — next 12 calendar months as columns, stacked by
  group (bills / debt payments / childcare = 3 fixed categorical hues), so lumpy
  months (annual insurance, quarterly bills) stop being surprises. Engine: existing
  occurrence walkers over 12 monthly windows (new thin helper `monthlySeriesPence`).
- The existing **Next payments** list stays as-is beside the calendar.

### Z4 — Where it goes

- **Category bars** — horizontal sorted bar per category (bills by their category;
  debt minimums as "Debt payments"; childcare as "Childcare"), with a
  monthly ↔ yearly normalised toggle (`PeriodSelector` reused). Single-hue bars,
  direct-labelled with amount and % — identity isn't the job here, magnitude is.
  More than ~8 categories folds the tail into "Other".
- **Cost-of-everything table** — every committed outgoing as a row: label, category,
  frequency, per-occurrence amount, **per-month** and **per-year** normalised cost,
  sortable, default sorted by yearly cost descending. This is the "report" the owner
  reads twice a year to cancel things. Engine: `spending.annualisedBillPence` /
  `annualisedDebtPence` — exist.

### Z5 — Debt analytics

- **Payoff projection line** — projected total-debt balance by month until zero,
  from `simulatePayoff` under the persisted strategy + extra. The chosen strategy
  draws in the accent hue; *minimums-only* draws in de-emphasis gray behind it
  (emphasis form — the gap between the two lines is "what your extra payments buy").
  Direct-labelled debt-free dates on both. If §7 is approved, actual balance-update
  points overlay as dots on the same (single) axis.
- **Debt facts column**: per-card utilisation meters (`calcUtilization`, exists),
  promo countdown chips, and the interest-cost/month figure with its per-debt
  breakdown on hover.
- No strategy pickers or sliders here — analysis on the dashboard, decisions on the
  Payoff tab (one deep link).

### Z6 — Income & tax strip

A compact read-only mirror of the Income tab, one row per person: gross → adjusted
net income, then the two threshold **meters** (£50,270 and £100,000) with headroom
text, and the estimated bill split (PAYE ≈ £X · dividend extra ≈ £Y). Same
`computePersonTax` output the Income tab renders; danger state identical. Hidden
entirely when no people exist.

### Z7 — Reports

Two artefacts, both computed at read time, nothing persisted:

- **Monthly Money Report (print)** — a print-stylesheet view (browser print → PDF,
  no new dependency): the KPI figures, category breakdown, cost-of-everything table,
  active insights, debt summary and payoff headline, income/tax summary. One page if
  possible. This is the "sit down with the wife once a month" artefact.
- **Schedule CSV export** — next 12 months of computed occurrences
  (`date, label, category, group, amountPence, amountPounds`) via a Blob download,
  same pattern as backup export. Lets the owner do any bespoke analysis in Numbers
  without the app growing features.

## 5. Charts: how, concretely

- **Library:** `chart.js` v4 is already a dependency and stays the answer (spec §3).
  One thin wrapper component (`src/ui/components/Chart.jsx`) owns canvas lifecycle,
  theme reactivity, and defaults; panels pass data + options only. The calendar
  heatmap and meters are plain CSS/DOM, not chart.js (they're grids and bars —
  simpler and more accessible as HTML).
- **Design rules (non-negotiable, from the dataviz method):** one y-axis always —
  never dual-axis; sequential single hue for magnitude (heatmap, category bars);
  a fixed ≤ 4-hue categorical order for the stacked columns, never cycled; emphasis
  (accent + gray) for the payoff comparison; status colors reserved for
  danger/warning states (£100k crossed, promo imminent) and always paired with text,
  never color alone; thin marks, recessive grid; direct labels over legends where
  series ≤ 4.
- **Palette:** define the chart palette once in `theme.js` as tokens with light and
  dark values, and validate both modes for CVD separation and contrast before
  merging (the dataviz skill ships a runnable validator; record the passing hexes in
  a code comment). Charts re-render on theme change; privacy blur applies to axis
  ticks, tooltips and direct labels.
- **Accessibility:** every chart panel has a "view as table" affordance (the data is
  already tabular); tooltips on hover for every mark; no information exists only in
  color.

## 6. New engine work (all pure, all tested)

| Module | Contents |
|---|---|
| `src/engine/insights.js` (new) | the rule engine (§Z2): each rule a pure function of `(data, now)` → card or null; `monthlyInterestPence`; heavy-week finder |
| `src/engine/spending.js` (extend) | `monthlySeriesPence(data, fromStr, months)` — 12-month stacked series; `dailyTotalsPence(data, startStr, endStr)` — heatmap buckets. Both thin compositions of the existing walkers |
| `src/engine/finance.js` (reuse) | `simulatePayoff` already returns the month-by-month series; a small adapter maps it to chart points |
| `src/engine/reports.js` (new) | schedule-CSV row builder (pure string assembly, tested for escaping); the print view is a React component, not engine |
| `src/engine/cashflow.js` | **stays parked.** The 90-day balance forecast needs a balance anchor + income cashflow, both dormant post-amendment. Revisit if income sources are reactivated |

## 7. Owner decision needed: keep debt balance updates as a log

**Proposal:** additive schema v4 table `balanceUpdates` (`*id`, `*debtId`, `*date`,
balancePence, source `manual`|`pdf`) — written whenever a balance is updated (the
same action as today; nothing extra to do), joined to `TABLE_NAMES` so backup/wipe
cover it. It is **user-entered data, not a computed row**, so the "never persist
projections" rule is untouched.

- **Unlocks:** actual-vs-plan dots on the payoff chart (Z5) — proof the plan is
  working, which is the emotional core of a debt dashboard; later, a real
  total-debt-over-time line.
- **Against:** the v4 schema deliberately dropped `balanceSnapshots`; this is a
  smaller, write-only cousin, but it is still a second place a balance lives.
- **Recommendation:** yes — one table, one extra `add()` in two existing code paths,
  and the chart it unlocks is the one the owner will actually look at. If declined,
  Z5 ships projection-only and nothing else in this plan changes.

## 8. Build order

Each milestone ends `npm test` + `npm run build` green, verified in Safari + Chrome,
and is independently shippable — the dashboard is never broken in between.

1. **M1 — Numbers first (no chart lib):** Z1 KPI strip, Z4 both panels (CSS bars +
   table), Z2 insights engine with rules 1/4/5/6/7. Highest value density, zero
   chart risk.
2. **M2 — Charts infrastructure + time:** `Chart.jsx` wrapper, validated palette
   tokens, Z3 calendar heatmap + 12-month columns, insight rule 2.
3. **M3 — Debt + tax:** Z5 payoff projection & debt facts, Z6 income/tax strip,
   insight rule 3; `balanceUpdates` log + actual-vs-plan overlay if §7 approved.
4. **M4 — Reports:** print stylesheet + Monthly Money Report view, schedule CSV
   export.

## 9. Non-goals

No historical spend analytics (no data — see §2). No configurable/draggable
dashboard. No new chart dependencies beyond chart.js. No forecast line while income
is dormant (§6). No export formats beyond print-to-PDF and CSV. No insight
notifications outside the app — cards render on the dashboard only.
