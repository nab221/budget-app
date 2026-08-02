# Mileage claim tracker — design

**Date:** 2026-08-02
**Status:** implemented
**Spec:** amends `REFACTOR-SPEC.md` (amendment 2026-08-02 (h)); schema v6 + v7

## 1. Purpose

Keep a running record of business mileage across a tax year and show, at any
point, what can be claimed back from HMRC.

The owner's understanding — *"I can claim up to 10k as 45p, then it reduces"* —
is right, and is the rule this screen exists to make visible. HMRC's **Approved
Mileage Allowance Payments** (AMAP) are:

| Vehicle | Rate |
|---|---|
| Car or van | **45p** a mile for the first **10,000** business miles in the tax year, then **25p** |
| Motorcycle | 24p a mile (flat) |
| Bicycle | 20p a mile (flat) |

Two things follow that a plain mile count doesn't tell you:

- **The 10,000 line is per tax year and resets on 6 April.** Where you are
  against it decides what the *next* mile is worth, so it needs to be visible
  while the year is running, not worked out in April.
- **It is also per employment.** Drive for two jobs and each gets its own
  10,000 miles at 45p, and each is netted against its own employer's
  reimbursement.
- **What you claim is the shortfall, not the whole approved amount.** If the
  employer already reimburses (say 25p a mile), only the gap between AMAP and
  what they paid is claimable — as *Mileage Allowance Relief*, a deduction from
  taxable income. So it is worth the shortfall × your marginal rate, not the
  shortfall itself. If the employer pays *more* than AMAP, the excess is
  taxable pay instead.

## 2. Screen

A new top-level **Mileage** tab, alongside Childcare. Tax-year navigation
(‹ / ›  / Today) mirrors the Income tab exactly.

**Summary panel** (only once there is a trip):

- KPI row — business miles · approved amount · paid by employer · **claim from
  HMRC**, with "≈ £X back at 40%" underneath the claim.
- A band meter per car/van showing how much of the 10,000 miles at 45p is used
  and how many are left, flipping to a "past 10,000 — further miles are worth
  25p" state once crossed.
- A warning banner when the employer over-paid (taxable excess, not a claim).
- A P87 / Self Assessment hint at the £2,500 line.
- A per-vehicle breakdown table: miles, the split across the two rates, the
  approved amount, what was paid, and the claim.
- Two inline controls: the employer's pence-per-mile rate, and the marginal tax
  rate the refund is valued at.

**Trip ledger** — trips grouped by month, oldest first (the order the claim is
worked out in, so the running band position reads top to bottom). A trip that
straddles the 10,000-mile line is tagged with its split. Edit / delete per row.

**Trip form** — date, miles, vehicle, purpose, and what the employer paid. With
an employer rate set, the reimbursement auto-fills from the miles as they are
typed, until the user edits it by hand.

## 3. Data model (schema v6, additive)

One new store. Nothing computed is persisted — the band split, the running
position, the claim, and the relief are all derived at read time.

```text
mileageTrips: '++id, date, vehicle, employerId'
employers:    '++id, name'
```

`mileageTrips`:

| Field | Type | Notes |
|---|---|---|
| `date` | ISO `yyyy-MM-dd` | indexed; a tax year is one range query. Required on add — an undefined date silently drops out of that index |
| `miles` | number | positive, stored to one decimal place. Required on add |
| `vehicle` | `'car' \| 'motorcycle' \| 'bicycle'` | indexed |
| `employerId` | integer or `null` | indexed. `null` = no employer recorded, which is its own claim group |
| `purpose` | string | why the journey was business travel |
| `reimbursedPence` | integer pence at rest, **pounds at the repo edge** | what the employer paid for this trip. Follows the repository money convention: `add`/`update` take pounds and `toPence` them on the way in; `get`/`getAll` hand pounds back |

`employers`:

| Field | Type | Notes |
|---|---|---|
| `name` | string | indexed; required |
| `ratePencePerMile` | integer pence **per mile** | a rate, not an amount — deliberately *not* a `*Pence` repo field, so it is stored verbatim with no pounds translation |

Two settings, both defaulted in `SETTINGS_DEFAULTS`:

- `mileageEmployerRatePence` — pence **per mile** (a rate, not an amount, so
  deliberately no `Pounds` bridge). Default 0.
- `mileageMarginalRate` — 0.2 / 0.4 / 0.45. Default 0.4.

`mileageTrips` is appended to `TABLE_NAMES`, so backup, restore, and wipe pick
it up with no further change.

## 4. Engine (`src/engine/mileage.js`)

Pure, tested, no DB or clock. Rates live in `AMAP_TABLES`, keyed by tax-year
label with a nearest-known-year fallback — the `TAX_YEAR_TABLES` pattern from
`tax.js`, so a Budget change lands as a new entry rather than an edit.

`buildMileageYear({ trips, table })` walks the year's trips in **date order**
(id breaks a same-day tie), keeps a running cumulative total **per vehicle
kind**, prices each trip against the band it actually falls in, and nets each
vehicle's year total against what the employer paid.

### Decisions

- **Miles are held as integer tenths of a mile internally.** Money is integer
  pence per the hard rules; miles aren't money, but the cumulative total is what
  decides the 45p/25p split, so it gets the same treatment — float drift over a
  few hundred trips could tip a trip into the wrong band. The form rounds input
  to the tenth on save, so what is stored and what is claimed are identical.
- **A trip's value is rounded to the penny at the trip; the year total is the
  sum of those.** Rounding the year in one go could differ by a penny or two,
  but then the ledger wouldn't add up to the headline — and it is the ledger the
  owner would check against.
- **The claim group is employment × vehicle kind.** HMRC works each pairing out
  on its own, so an over-payment on the bike — or at another job — can never
  quietly cancel a car shortfall. `totals.shortfallPence` and
  `totals.excessPence` can both be non-zero at once.
- **Employers are optional.** With none recorded, every trip is one unnamed
  employment and the employer labels, the extra table column, and the
  allowance explainer all stay hidden — the single-job screen is unchanged.
  Deleting an employer *unassigns* its trips rather than deleting them: the
  journeys still happened.
- **Marginal rate is a picker, not derived from the Income tab.** The Income
  engine already computes a full per-person tax position, but reaching into it
  would mean picking a person, deciding whether the mileage belongs to them, and
  coupling two screens. The simpler option, per the spec rule — revisit if the
  owner wants the two linked.
- **Associated employments are not modelled.** Each employer here gets its own
  10,000 miles. HMRC makes jobs with the same employer, or within one group of
  companies, share a single allowance — record those as one employer. The
  screen says so when more than one is in play.

### Non-goals

- **Passenger payments** (5p/mile per colleague). They are tax-free only if the
  employer actually pays them, and no relief is claimable when they don't —
  tracking them would display a claim that can't be made.
- **Company-car advisory fuel rates.** A different scheme entirely; this screen
  is for using your own vehicle.
- **NI.** The NI mileage equivalent shares the 45p rate but has no 10,000-mile
  step, and the app does no NI maths anywhere (spec §Non-goals).
- **Filing.** No P87 generation, no HMRC submission — the £2,500 line is
  surfaced as a hint only, in keeping with "no HMRC filing or export".

## 5. Files

| File | Role |
|---|---|
| `src/engine/mileage.js` | AMAP rates, band pricing, per-group year build, relief (+ `mileage.test.js`, 39 tests) |
| `src/db/schema.js` | v6 — the `mileageTrips` store; v7 — `employers` + `employerId` |
| `src/db/repositories.js` | `mileageTripsRepo`, `employersRepo` + validation |
| `src/db/settings.js` | fallback employer rate + marginal rate |
| `src/db/mileageData.js` | pounds → pence adapter (+ `mileageData.test.js`, 19 tests) |
| `src/ui/Mileage.jsx` | the tab |
| `src/ui/mileage/MileageSummary.jsx` | KPIs, band meter, breakdown, rate controls |
| `src/ui/mileage/TripList.jsx` | month-grouped ledger |
| `src/ui/mileage/TripForm.jsx` | add / edit a trip |
| `src/ui/mileage/EmployerList.jsx`, `EmployerForm.jsx` | manage employments and their rates |
| `src/ui/mileage/format.js` | mile / rate / employer display helpers shared by the screens |
| `src/ui/mileage/mileageRender.test.jsx` | tab integration test, 9 tests |
