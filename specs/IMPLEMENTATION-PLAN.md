# Budget App v4 — Implementation Plan

Companion to `specs/REFACTOR-SPEC.md` (read that first — it is the contract; this file is
the build order). Written for the implementing agent.

Work on branch `claude/budget-app-refactor-imeo8u` (or a branch the owner designates).
Each phase should end with `npm test` and `npm run build` green and a commit. Phases 1–5
produce the shippable v4.0; phase 6 is the deferred analytics work.

---

## Phase 0 — Clear the ground

1. Delete: `.planning/`, `PHASE-*-VERIFICATION.md`, `test-output.txt`, `test-purify.cjs`,
   `test-syntax.cjs`, `test-security.js`, `print_lines.cjs`, `dexie.min.js` (root copy —
   the npm package is the real dependency), `docs/superpowers/`.
2. Delete dropped source per the spec §6 fate table: all of `src/ui/`, `src/db/`
   (old schema/repository kept temporarily as reference until Phase 2 replaces them, then
   deleted), `supabase-sync`, `sync-manager`, `opfs-store`, `snapshot-diff`,
   `legacy-import`, `storage`, `gestures`, `haptics`, `security`, `data-integrity`
   (+ their tests), `src/__mocks__/virtual-pwa-register.js`.
3. Move keepers to `src/engine/` with their tests: `finance`, `pay-period`,
   `affordability`, `banking-calendar`, `recurrence`, `currency`, `filtering`, `income`,
   `childcare`, `cashflow` (parked), `pdf-parser`, `string-similarity` wrapper.
4. `package.json`: remove `@supabase/supabase-js`, `vite-plugin-pwa`, `dompurify`
   (unless Phase 5 proves it needed); add `react`, `react-dom`,
   `@vitejs/plugin-react`. Strip PWA config from `vite.config.js`; keep the GitHub Pages
   `base` if present. Update `.github/workflows/deploy.yml` only if paths change.
5. Replace `index.html` with a minimal React mount. Stub `src/main.jsx` rendering an
   empty app shell with the four tabs + settings as placeholder routes (plain
   conditional rendering is fine — no router dependency needed).
6. Gate: engine tests pass from their new location; build is green; dev server shows the
   empty shell.

## Phase 1 — Data layer

1. `src/db/schema.js`: Dexie `BudgetAppV4`, version 1, tables exactly as spec §5.
2. `src/db/repositories.js`: thin per-table repositories using the old
   `createBaseRepository` pence-conversion pattern (pounds in/out at the API edge,
   pence at rest). A `settings` helper with typed getters/defaults (safety buffer
   default £200; everyday spend default £0; strategy default `avalanche`).
3. Seed default categories on first run (income: Salary, Other; spending: Groceries,
   Utilities, Housing, Transport, Eating Out, Kids, Debt Payment, Other).
4. `src/db/backup.js`: export/import per spec §5 envelope; import = validate → wipe →
   bulk insert → reload. Track `lastExportAt` in settings.
5. A small React data hook (`useLiveData` or similar) that re-renders on a `db:mutated`
   custom event dispatched by the repositories (port of the old `triggerSync` pattern,
   minus all the sync).
6. Tests: repository pence round-trips, settings defaults, backup round-trip, refusal of
   newer-format backups.

## Phase 2 — Setup screens (Money In & Out planned side, Debts, Settings)

Build the CRUD screens first so the engine screens have data to work with:

1. **Settings tab:** categories CRUD (block deleting in-use categories), safety buffer,
   everyday spending allowance, theme + privacy blur, backup export/import, wipe-all.
2. **Income sources** section: CRUD per spec §4.2; validate `payDateDay` 1–28 for
   `nth-of-month`.
3. **Recurring bills** section: CRUD per spec §4.2.
4. **Debts tab:** card list, type-specific forms, computed min payment
   (`finance.calcMinPayment`) with override, utilisation bar, quick **Update balance**
   flow.
5. Tests: form validation logic and min-payment display selection (computed vs override).

## Phase 3 — The engine screens (Dashboard pay-period + payoff)

The heart of the app:

1. `src/engine/plan.js` (new, tested): assembles a pay period from live data —
   income events from `incomeSources` (banking-calendar adjusted), bill instances from
   `recurringBills` (computed, not persisted), debt minimums/fixed payments from `debts`
   with `paymentDayOfMonth`, childcare required deposits, prorated everyday-spend
   allowance. Output feeds both the dashboard table and the recommendation.
2. Recommendation: `safeExtra = max(0, projectedEndBalance − safetyBuffer)`; target debt
   = first debt under the persisted strategy ordering (reuse the avalanche/snowball
   ordering already in `finance.js`). Render as the directive card (spec §4.1).
3. Dashboard: balance strip, pay-period panel with prev/next navigation, warning
   banners, this-month summary table.
4. **Payoff tab:** strategy comparison, extra input (default = current safeExtra),
   balance-transfer modeler, consolidated schedule — all straight from `finance.js`.
   Persist strategy + extra in `settings` (not localStorage).
5. Tests: `plan.js` period assembly (month boundaries, working-day shifts, multiple
   income sources defining period edges), recommendation edge cases (negative spare,
   no debts, promo cards).

## Phase 4 — Transactions (actual side) + bill confirmation

1. Transactions list: month navigator, unified income/spend table, add/edit/delete,
   search, category filter.
2. Bill confirmation: from the dashboard pay-period table or the bills list, "mark paid"
   creates a `transactions` row (`source: 'bill'`, `billId`) and advances the bill's
   `nextDueDate` via `recurrence` date math. Unmarking deletes the row and rolls the
   date back.
3. This-month dashboard panel now reads real transactions.
4. Tests: confirm/unconfirm round-trip, nextDueDate advancement across frequencies.

## Phase 5 — PDF import + childcare

1. **PDF import** (spec §4.6): port the bank-statement path of `pdf-parser.js`; delete
   credit-card parsing. Preview table → category suggestions via `categoryMappings` +
   `string-similarity` → duplicate detection via `importHash` (date+amount+normalised
   description) → insert with `source: 'import'`. Save confirmed mappings back.
2. **Childcare tab** (spec §4.5): per-child cards, required-deposit calculation reusing
   the top-up/cap math from `src/engine/childcare.js`; wire the deposit into `plan.js`.
3. Tests: importHash stability/dedup, childcare deposit incl. quarterly cap and the
   disabled-child cap.

## Phase 7 — Income: two-person tax-year tracker (amendment 2026-07-07 (b))

Branch `claude/multi-person-income-tracking-4t5xmg`. Spec: REFACTOR-SPEC amendment
2026-07-07 (b). Independent of Phase 6.

1. **Engine** `src/engine/tax.js` (pure, no DB): tax-year helpers
   (`taxYearForDate`, boundaries, prev/next), per-year constants (2025-26, 2026-27;
   later dates fall back to the latest table), and `computePersonTax(...)` — personal
   allowance taper, non-dividend bands, dividend stacking with the £500 allowance,
   adjusted net income, PAYE-vs-dividend split, headroom to £50,270 and to £100k ANI.
   Everything in integer pence.
2. **Data layer**: Dexie v3 adds `people` + `incomeEvents` (additive; no upgrade
   function needed). Repos with pence conversion + kind validation; `TABLE_NAMES`
   gains both tables (backup/wipe follow automatically).
3. **UI**: `Income` tab (second in the tab bar): tax-year navigator, person cards,
   person form, dividend-draw / salary-adjustment dialog, event list. Reuse
   `CurrencyInput`, `ConfirmDialog`, `EmptyState`, card/form styles.
4. Tests: tax-year boundary maths (5/6 April), band + taper + dividend cases checked
   against hand-worked HMRC examples, headroom edge cases, schema v3 upgrade keeps
   existing rows, repo round-trips, a render test of the person card with events.
5. Gate: `npm test` + `npm run build` green; browser verification of the full flow
   (add two people → add dividends → figures and warnings move correctly).

## Phase 6 — Deferred analytics (separate, later milestone)

Not part of v4.0 sign-off. When the owner asks: spending-by-category chart,
income/spending heatmaps, 90-day forecast line (wire the parked `cashflow.js`),
payoff projection chart. `chart.js` is already a dependency.

---

## Verification (required before calling v4.0 done)

Create `docs/VERIFICATION.md` with this checklist and complete it manually (the old
project's retrospective flags skipped manual verification as its biggest failure):

- [ ] Fresh browser profile: first run seeds categories, all tabs render empty states.
- [ ] Enter 2 income sources, 5 bills, 2 credit cards (one with 0% promo), 1 loan,
      1 child; dashboard pay period shows all committed items on working-day-adjusted
      dates and a sane recommendation.
- [ ] Recommendation flips to the correct next debt when strategy is switched.
- [ ] Import a real bank PDF statement; categories suggested; re-importing the same file
      inserts zero duplicates.
- [ ] Backup export → wipe all → import restores everything.
- [ ] Works in both **Safari** and **Chrome** on macOS (IndexedDB, PDF import, download
      of backup file).
- [ ] `npm test` and `npm run build` green; no console errors on any tab.

## Guardrails

- Never persist computed/projection rows; compute at read time (spec §5).
- Pence integers at rest; pounds only at the UI boundary.
- No `innerHTML` / `window.*` handlers / inline event attributes.
- If a behaviour question isn't answered by the spec, prefer the simpler option and note
  it in the PR description rather than importing complexity from the old `src/ui/` code.
