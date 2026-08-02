import Dexie from 'dexie';

/**
 * BudgetAppV4 — Dexie (IndexedDB) database, schema version 1.
 *
 * Designed fresh per REFACTOR-SPEC §5. The old `BudgetConsoleDB` (23 migrations)
 * is left untouched.
 *
 * All money fields are integer **pence** at rest. All dates are ISO
 * `yyyy-MM-dd` strings. Pounds only ever exist at the API boundary (see
 * `repositories.js`).
 *
 * Store index strings follow spec §5 (`*` marks an indexed field). The primary
 * key of every table except `settings` is an auto-incrementing `id`; `settings`
 * is a `key`-keyed value store.
 *
 * ── Version history ────────────────────────────────────────────────────────
 * v1 — the fresh spec §5 schema.
 * v2 — additive only (owner testing feedback, 2026-07-07): a nullable `debtId`
 *      field on `transactions`, indexed so debt-payment confirmations can be
 *      looked up per pay period (derived debt-payment rows in Recurring Bills).
 *      No stores added/removed and no data reshaped, so Dexie upgrades live v1
 *      databases in place — existing rows (which simply have no `debtId`) are
 *      preserved untouched.
 * v3 — additive only (Income phase, spec amendment 2026-07-07 (b)): two new
 *      stores, `people` and `incomeEvents`, for the two-person tax-year
 *      tracker. Existing stores untouched, so live v1/v2 databases upgrade in
 *      place with no upgrade function.
 * v4 — additive only (dashboard plan §7, owner-approved 2026-07-08): a
 *      `balanceUpdates` store logging each debt balance update (manual, edit,
 *      or statement PDF) so the payoff chart can show actual-vs-plan. This is
 *      USER-ENTERED data — the record of balances the owner typed in — not a
 *      computed/projection row, so the "never persist computed rows" rule is
 *      untouched. New store only — no upgrade function.
 * v5 — additive + migration (income redesign, spec amendment 2026-07-12 (c)):
 *      `salaryPeriods` (dated salary rates — a raise / LTFT / new contract is
 *      a new row) and `payslips` (one per person-month, actual figures). The
 *      upgrade copies each person's existing annual salary/sacrifice into an
 *      always-in-force initial period so live data behaves identically; the
 *      old per-person annual fields stop being written but stay in place (and
 *      `incomeData.js` still falls back to them for a person with no periods,
 *      which covers pre-v5 backup restores too).
 *
 * Still v5 (payrolled BIK, spec amendment 2026-07-12 (d)): non-indexed fields
 * `bikAnnualPence` on `salaryPeriods` and `bikPence` on `payslips`. Dexie only
 * declares indexes, so adding un-indexed fields needs no version bump; rows
 * without them read back as £0 through the repositories.
 *
 * Still v5 (tax codes, spec amendment 2026-07-12 (f)): non-indexed `taxCode`
 * string on `people`; rows without it read back as '' (standard allowance).
 *
 * Still v5 (taxable-pay-first payslips, spec amendment 2026-07-12 (g)):
 * non-indexed `taxablePence` on `payslips`. Deliberately NO default: rows
 * without it (pre-(g)) keep computing gross − pension + BIK at read time.
 *
 * v6 — additive only (mileage claim tracker, spec amendment 2026-08-02 (h)):
 *      one new store, `mileageTrips`, logging each business trip so the
 *      tax-year AMAP claim (45p/25p) can be computed at read time. These are
 *      USER-ENTERED rows — the trips actually driven — so the "never persist
 *      computed rows" rule is untouched (the band split and claim value are
 *      never stored). New store only, so live v1–v5 databases upgrade in place
 *      with no upgrade function.
 * v7 — additive only (multiple employers, spec amendment 2026-08-02 (h)):
 *      an `employers` store and a nullable, indexed `employerId` on
 *      `mileageTrips`. HMRC works the 10,000-mile AMAP threshold out per
 *      EMPLOYMENT, so a trip has to know which job it was for. Existing trips
 *      simply have no `employerId` and read back as one unnamed employment,
 *      which is exactly how they behaved before — so no upgrade function.
 */

export const SCHEMA_VERSION = 7;

export const db = new Dexie('BudgetAppV4');

// v1 — original spec §5 schema. Declared so existing v1 databases have a defined
// prior version to upgrade FROM (Dexie requires the full version chain).
db.version(1).stores({
  settings: '&key',
  categories: '++id, name, kind',
  incomeSources: '++id, payDateRule',
  recurringBills: '++id, categoryId, nextDueDate',
  transactions: '++id, date, kind, categoryId, source, importHash',
  debts: '++id, debtType',
  children: '++id',
  categoryMappings: '++id, descriptionKey',
});

// v2 — additive: index `debtId` on transactions. Only the changed store needs
// restating; Dexie carries the rest forward. Purely additive index changes need
// no upgrade function — Dexie re-indexes existing rows automatically.
db.version(2).stores({
  transactions: '++id, date, kind, categoryId, source, importHash, debtId',
});

// v3 — additive: the Income phase's `people` + `incomeEvents` stores
// (spec amendment 2026-07-07 (b)). New stores only — no upgrade function.
db.version(3).stores({
  people: '++id',
  incomeEvents: '++id, personId, date, kind',
});

// v4 — additive: the `balanceUpdates` log (dashboard plan §7). New store only.
db.version(4).stores({
  balanceUpdates: '++id, debtId, date',
});

// v5 — additive: `salaryPeriods` + `payslips` (income redesign, amendment (c)).
// `&[personId+month]` makes a payslip unique per person-month at the DB level.
// The upgrade seeds an initial period from each person's annual fields so a
// live database keeps computing the same figures the moment it opens.
db.version(5)
  .stores({
    salaryPeriods: '++id, personId, effectiveFrom',
    payslips: '++id, personId, month, &[personId+month]',
  })
  .upgrade(async (tx) => {
    const people = await tx.table('people').toArray();
    for (const p of people) {
      const salary = p.annualSalaryPence || 0;
      const sacrifice = p.salarySacrificePence || 0;
      if (salary > 0 || sacrifice > 0) {
        await tx.table('salaryPeriods').add({
          personId: p.id,
          effectiveFrom: '1900-01-01', // in force from the beginning of time
          annualSalaryPence: salary,
          salarySacrificePence: sacrifice,
          workplacePensionAnnualPence: 0,
          note: '',
        });
      }
    }
  });

// v6 — additive: the `mileageTrips` store (amendment 2026-08-02 (h)). `date` is
// indexed so a tax year reads as one range query. New store only.
db.version(6).stores({
  mileageTrips: '++id, date, vehicle',
});

// v7 — additive: the `employers` store, and the `employerId` index on
// `mileageTrips` so a claim group reads without a table scan. Purely additive
// index changes need no upgrade function — Dexie re-indexes existing rows, and
// rows with no `employerId` are simply absent from that index.
db.version(7).stores({
  employers: '++id, name',
  mileageTrips: '++id, date, vehicle, employerId',
});

// The ordered list of table names — the single source of truth for backup /
// wipe operations so a new table never gets silently missed.
export const TABLE_NAMES = [
  'settings',
  'categories',
  'incomeSources',
  'recurringBills',
  'transactions',
  'debts',
  'children',
  'categoryMappings',
  'people',
  'incomeEvents',
  'balanceUpdates',
  'salaryPeriods',
  'payslips',
  'mileageTrips',
  'employers',
];

// Another tab upgraded the schema: close this connection and reload so the
// page picks up the new version (mirrors the old app's behaviour).
db.on('versionchange', () => {
  db.close();
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload();
  }
});

// This connection is holding an upgrade back (another tab still open).
db.on('blocked', () => {
  // No `alert()` / DOM — just warn. The user closing the other tab unblocks it.
  console.warn(
    '[BudgetAppV4] A database upgrade is blocked. Close other tabs of this app to continue.'
  );
});

export default db;
