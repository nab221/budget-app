/**
 * mileage.js — HMRC business-mileage (AMAP) engine.
 *
 * Pure module: no DB access, no clock, no React. Miles in, integer PENCE out.
 *
 * ── What this computes ─────────────────────────────────────────────────────
 * HMRC's **Approved Mileage Allowance Payments** are the amount an employer
 * can reimburse for business mileage in your own vehicle, free of tax:
 *
 *   Car or van   45p / mile for the first 10,000 business miles in the tax
 *                year, then 25p / mile
 *   Motorcycle   24p / mile (flat, no threshold)
 *   Bicycle      20p / mile (flat, no threshold)
 *
 * If the employer pays **less** than AMAP (or nothing), the shortfall is
 * *Mileage Allowance Relief* — claimable from HMRC, and worth the shortfall ×
 * your marginal rate of income tax. If the employer pays **more**, the excess
 * is taxable pay. Each kind of vehicle is worked out separately and netted
 * over the whole tax year, which is what `buildMileageYear` does.
 *
 * ── Precision ──────────────────────────────────────────────────────────────
 * Miles are held internally as integer **tenths of a mile** so the running
 * cumulative total that decides the 10,000-mile band never drifts on floats.
 * A trip's value is rounded to the penny once, at the trip; the year total is
 * the sum of those rounded trip values, so the ledger always adds up to the
 * headline figure (it can differ from rounding the year in one go by a penny
 * or two — the ledger adding up matters more).
 *
 * ── Documented simplifications (spec "simpler option" rule) ────────────────
 * - The 10,000-mile threshold is tracked per tax year across all car/van
 *   trips. HMRC counts it per employment; a single user with one job — the
 *   only case this app models — is unaffected.
 * - No passenger payments (5p/mile per colleague). They are tax-free only if
 *   the employer actually pays them; no relief is claimable when they don't,
 *   so tracking them would show a claim that cannot be made.
 * - No company-car advisory fuel rates, no NI (AMAP and the NI equivalent
 *   share the 45p rate but NI has no 10,000-mile step, and this app does no
 *   NI maths anywhere).
 */

// ---------------------------------------------------------------------------
// Rate tables
// ---------------------------------------------------------------------------

/** Vehicle kinds, in the order the UI offers them. */
export const VEHICLE_KINDS = ['car', 'motorcycle', 'bicycle'];

export const VEHICLE_LABELS = {
  car: 'Car or van',
  motorcycle: 'Motorcycle',
  bicycle: 'Bicycle',
};

/**
 * Per-tax-year AMAP rates, keyed by label ("2026-27") — the `TAX_YEAR_TABLES`
 * pattern from `tax.js`, so a rate change lands as a new entry rather than an
 * edit. `thresholdMiles: null` means one flat rate for every mile.
 *
 * The 45p / 25p / 24p / 20p rates have been unchanged for years; revisit after
 * each Budget.
 */
export const AMAP_TABLES = {
  '2025-26': {
    car: { thresholdMiles: 10000, firstRatePence: 45, afterRatePence: 25 },
    motorcycle: { thresholdMiles: null, firstRatePence: 24, afterRatePence: 24 },
    bicycle: { thresholdMiles: null, firstRatePence: 20, afterRatePence: 20 },
  },
  '2026-27': {
    car: { thresholdMiles: 10000, firstRatePence: 45, afterRatePence: 25 },
    motorcycle: { thresholdMiles: null, firstRatePence: 24, afterRatePence: 24 },
    bicycle: { thresholdMiles: null, firstRatePence: 20, afterRatePence: 20 },
  },
};

const KNOWN_AMAP_YEARS = Object.keys(AMAP_TABLES).sort();

/**
 * The AMAP table for a tax year, clamping to the nearest known table for years
 * outside the seeded range (mirrors `taxYearTable`).
 *
 * @param {string} label - e.g. "2026-27".
 * @returns {{ table: object, tableYear: string }} `tableYear` is the label of
 *   the table actually used, so the UI can flag a fallback.
 */
export function amapTable(label) {
  if (AMAP_TABLES[label]) return { table: AMAP_TABLES[label], tableYear: label };
  const oldest = KNOWN_AMAP_YEARS[0];
  const newest = KNOWN_AMAP_YEARS[KNOWN_AMAP_YEARS.length - 1];
  const tableYear = String(label) < oldest ? oldest : newest;
  return { table: AMAP_TABLES[tableYear], tableYear };
}

/** The rate entry for a vehicle kind, falling back to car/van for anything unknown. */
export function rateForVehicle(table, vehicle) {
  return table[vehicle] || table.car;
}

// ---------------------------------------------------------------------------
// Miles ↔ tenths
// ---------------------------------------------------------------------------

/** Miles (a user-entered decimal) → integer tenths of a mile, never negative. */
export function toTenths(miles) {
  const n = typeof miles === 'string' ? Number.parseFloat(miles) : miles;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 10));
}

/** Integer tenths of a mile → miles as a number (e.g. 124 → 12.4). */
export function fromTenths(tenths) {
  return (tenths || 0) / 10;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/**
 * Price one slice of mileage against the two-band AMAP rate, given how many
 * miles of the same vehicle kind are already claimed earlier in the tax year.
 *
 * @param {{ thresholdMiles: number|null, firstRatePence: number, afterRatePence: number }} rate
 * @param {number} beforeTenths - cumulative tenths already claimed this year.
 * @param {number} tenths - tenths of a mile in this slice.
 * @returns {{ pence: number, firstTenths: number, afterTenths: number }}
 *   `firstTenths` is the part at the higher (pre-threshold) rate.
 */
export function priceMiles(rate, beforeTenths, tenths) {
  const slice = Math.max(0, tenths || 0);
  const thresholdTenths = rate.thresholdMiles == null ? null : rate.thresholdMiles * 10;

  const firstTenths =
    thresholdTenths == null
      ? slice
      : Math.max(0, Math.min(slice, thresholdTenths - Math.max(0, beforeTenths || 0)));
  const afterTenths = slice - firstTenths;

  // Integer maths throughout: tenths × pence-per-mile / 10, rounded once.
  const pence = Math.round(
    (firstTenths * rate.firstRatePence + afterTenths * rate.afterRatePence) / 10
  );
  return { pence, firstTenths, afterTenths };
}

// ---------------------------------------------------------------------------
// The tax-year build
// ---------------------------------------------------------------------------

/** Trips in claim order: by date, then by id so a same-day pair is stable. */
function inClaimOrder(trips) {
  return [...trips].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

function emptyVehicleTotal(vehicle, rate) {
  return {
    vehicle,
    rate,
    tenths: 0,
    firstBandTenths: 0,
    afterBandTenths: 0,
    tripCount: 0,
    allowancePence: 0,
    reimbursedPence: 0,
    // Netted over the year, per vehicle kind — filled in at the end.
    shortfallPence: 0,
    excessPence: 0,
  };
}

/**
 * Walk a tax year's trips in date order and work out what can be claimed.
 *
 * Nothing here is persisted: the Mileage screen recomputes this on every read,
 * per the "never persist computed rows" rule.
 *
 * @param {object} args
 * @param {Array<{ id?: number, date: string, vehicle: string, miles: number,
 *   purpose?: string, reimbursedPence?: number }>} args.trips - integer pence
 *   for `reimbursedPence` (what the employer actually paid for the trip).
 * @param {object} args.table - an `AMAP_TABLES` entry.
 * @returns {{ trips: Array<object>, byVehicle: Array<object>, totals: object }}
 *   `trips` is claim-ordered and carries the per-trip band split and value;
 *   `byVehicle` has one entry per vehicle kind actually used, netted over the
 *   year; `totals` sums those.
 */
export function buildMileageYear({ trips = [], table }) {
  const ordered = inClaimOrder(trips);
  const byVehicle = new Map();
  // Running cumulative tenths per vehicle kind — what decides the 10,000 band.
  const cumulative = new Map();

  const priced = ordered.map((trip) => {
    const vehicle = VEHICLE_KINDS.includes(trip.vehicle) ? trip.vehicle : 'car';
    const rate = rateForVehicle(table, vehicle);
    const tenths = toTenths(trip.miles);
    const beforeTenths = cumulative.get(vehicle) || 0;

    const { pence, firstTenths, afterTenths } = priceMiles(rate, beforeTenths, tenths);
    const reimbursedPence = Math.max(0, Math.round(trip.reimbursedPence || 0));

    cumulative.set(vehicle, beforeTenths + tenths);

    if (!byVehicle.has(vehicle)) byVehicle.set(vehicle, emptyVehicleTotal(vehicle, rate));
    const agg = byVehicle.get(vehicle);
    agg.tenths += tenths;
    agg.firstBandTenths += firstTenths;
    agg.afterBandTenths += afterTenths;
    agg.tripCount += 1;
    agg.allowancePence += pence;
    agg.reimbursedPence += reimbursedPence;

    return {
      ...trip,
      vehicle,
      miles: fromTenths(tenths),
      milesBefore: fromTenths(beforeTenths),
      milesAfter: fromTenths(beforeTenths + tenths),
      firstBandMiles: fromTenths(firstTenths),
      afterBandMiles: fromTenths(afterTenths),
      // True when this single trip straddles the 10,000-mile line.
      crossesThreshold: firstTenths > 0 && afterTenths > 0,
      allowancePence: pence,
      reimbursedPence,
      // Informational only — the claim itself nets over the year (below).
      shortfallPence: Math.max(0, pence - reimbursedPence),
    };
  });

  // Net each vehicle kind over the whole year: that is how the claim works.
  const vehicles = VEHICLE_KINDS.filter((v) => byVehicle.has(v)).map((v) => {
    const agg = byVehicle.get(v);
    const net = agg.allowancePence - agg.reimbursedPence;
    const threshold = agg.rate.thresholdMiles;
    return {
      ...agg,
      miles: fromTenths(agg.tenths),
      firstBandMiles: fromTenths(agg.firstBandTenths),
      afterBandMiles: fromTenths(agg.afterBandTenths),
      shortfallPence: Math.max(0, net),
      excessPence: Math.max(0, -net),
      // Miles still available at the higher rate (null when there is no band).
      milesToThreshold: threshold == null ? null : Math.max(0, threshold - fromTenths(agg.tenths)),
      thresholdMiles: threshold,
      overThreshold: threshold != null && fromTenths(agg.tenths) > threshold,
    };
  });

  const sum = (key) => vehicles.reduce((acc, v) => acc + v[key], 0);
  const totals = {
    tripCount: priced.length,
    miles: fromTenths(vehicles.reduce((acc, v) => acc + v.tenths, 0)),
    allowancePence: sum('allowancePence'),
    reimbursedPence: sum('reimbursedPence'),
    // Summed from the per-vehicle nets, so a car shortfall is never cancelled
    // out by an over-payment on the motorbike (HMRC keeps them separate).
    shortfallPence: sum('shortfallPence'),
    excessPence: sum('excessPence'),
  };

  return { trips: priced, byVehicle: vehicles, totals };
}

// ---------------------------------------------------------------------------
// What the claim is worth
// ---------------------------------------------------------------------------

/** The marginal rates a claim can be worth, for the UI's picker. */
export const MARGINAL_RATES = [
  { rate: 0.2, label: 'Basic rate (20%)' },
  { rate: 0.4, label: 'Higher rate (40%)' },
  { rate: 0.45, label: 'Additional rate (45%)' },
];

/**
 * Tax relief a shortfall is worth: the shortfall is deducted from taxable
 * income, so it is worth the shortfall × marginal rate as a tax refund.
 *
 * @param {number} shortfallPence - integer pence.
 * @param {number} marginalRate - 0.2 / 0.4 / 0.45.
 * @returns {number} integer pence.
 */
export function computeRelief(shortfallPence, marginalRate) {
  return Math.round(Math.max(0, shortfallPence || 0) * (marginalRate || 0));
}

/**
 * Whether the year's claim can go in through a P87 or needs Self Assessment.
 * HMRC's threshold is £2,500 of employment expenses in a tax year.
 */
export const P87_LIMIT_PENCE = 250000;

export function claimRoute(shortfallPence) {
  return (shortfallPence || 0) > P87_LIMIT_PENCE ? 'self-assessment' : 'p87';
}

export default buildMileageYear;
