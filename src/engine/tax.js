/**
 * tax.js — UK income-tax engine for the two-person tax-year tracker
 * (REFACTOR-SPEC amendment 2026-07-07 (b)).
 *
 * Pure module: integer PENCE in, integer pence out. No DB access, no clock —
 * callers pass dates in. rUK (non-Scottish) bands only.
 *
 * Modelled per the spec:
 * - Non-dividend income (salary − salary sacrifice + adjustments + BIK + other)
 *   is taxed first through the bands after the personal allowance; dividends
 *   stack on top. The dividend allowance is taxed at 0% but consumes band space.
 * - Personal allowance tapers £1 per £2 of adjusted net income over £100,000.
 * - Adjusted net income = all income (incl. dividends) − personal pension
 *   contributions. Salary sacrifice never reaches the salary figure at all.
 * - Documented simplifications: no NI, no student loans, no savings-interest
 *   allowances, pension contributions do not extend the basic-rate band,
 *   tax codes not modelled.
 */

// ---------------------------------------------------------------------------
// Tax-year constants
// ---------------------------------------------------------------------------

/**
 * Per-year tables, keyed by label ("2026-27"). A requested year newer than the
 * newest entry falls back to the newest (older than the oldest → the oldest) —
 * revisit after each Budget.
 */
export const TAX_YEAR_TABLES = {
  '2025-26': {
    personalAllowancePence: 1257000, // £12,570
    basicBandPence: 3770000, // £37,700 of taxable income at the basic rate
    higherRateThresholdPence: 5027000, // £50,270 total income (PA + basic band)
    additionalRateThresholdPence: 12514000, // £125,140 total income
    taperThresholdPence: 10000000, // £100,000 adjusted net income
    incomeRates: { basic: 0.2, higher: 0.4, additional: 0.45 },
    dividendAllowancePence: 50000, // £500
    dividendRates: { basic: 0.0875, higher: 0.3375, additional: 0.3935 },
  },
  '2026-27': {
    personalAllowancePence: 1257000,
    basicBandPence: 3770000,
    higherRateThresholdPence: 5027000,
    additionalRateThresholdPence: 12514000,
    taperThresholdPence: 10000000,
    incomeRates: { basic: 0.2, higher: 0.4, additional: 0.45 },
    dividendAllowancePence: 50000,
    // April 2026 increases: ordinary 8.75 → 10.75%, upper 33.75 → 35.75%.
    dividendRates: { basic: 0.1075, higher: 0.3575, additional: 0.3935 },
  },
};

const KNOWN_YEARS = Object.keys(TAX_YEAR_TABLES).sort();

// ---------------------------------------------------------------------------
// Tax-year calendar helpers (6 April – 5 April)
// ---------------------------------------------------------------------------

/** "2026-27" for a start year of 2026. */
function labelForStartYear(startYear) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Start year (e.g. 2026) parsed from a "2026-27" label. */
export function startYearOf(label) {
  const y = Number(String(label).slice(0, 4));
  if (!Number.isInteger(y)) throw new Error(`Bad tax-year label: "${label}"`);
  return y;
}

/**
 * The tax year containing an ISO `yyyy-MM-dd` date.
 * @returns {string} label, e.g. "2026-27" for any date in 6 Apr 2026 – 5 Apr 2027.
 */
export function taxYearForDate(isoDate) {
  const s = String(isoDate);
  const year = Number(s.slice(0, 4));
  if (!Number.isInteger(year)) throw new Error(`Bad ISO date: "${isoDate}"`);
  const startYear = s >= `${year}-04-06` ? year : year - 1;
  return labelForStartYear(startYear);
}

/**
 * Inclusive date bounds of a tax year.
 * @returns {{ startDate: string, endDate: string }} e.g. 2026-04-06 … 2027-04-05.
 */
export function taxYearBounds(label) {
  const y = startYearOf(label);
  return { startDate: `${y}-04-06`, endDate: `${y + 1}-04-05` };
}

/** The label `delta` years away ("2026-27", −1 → "2025-26"). */
export function shiftTaxYear(label, delta) {
  return labelForStartYear(startYearOf(label) + delta);
}

/**
 * The rate table for a tax year, clamping to the nearest known table for
 * years outside the seeded range.
 * @returns {{ table: object, tableYear: string }} `tableYear` is the label of
 *   the table actually used, so the UI can flag a fallback.
 */
export function taxYearTable(label) {
  if (TAX_YEAR_TABLES[label]) return { table: TAX_YEAR_TABLES[label], tableYear: label };
  const oldest = KNOWN_YEARS[0];
  const newest = KNOWN_YEARS[KNOWN_YEARS.length - 1];
  const tableYear = String(label) < oldest ? oldest : newest;
  return { table: TAX_YEAR_TABLES[tableYear], tableYear };
}

// ---------------------------------------------------------------------------
// Person-year assembly
// ---------------------------------------------------------------------------

/**
 * Fold a person record + their income events (already filtered to one tax
 * year) into the pence inputs `computePersonTax` wants. Annual figures
 * (salary, sacrifice, BIK, other, pension) are assumed for the full year;
 * dividends and salary adjustments count only as actually entered — dividends
 * are discretionary, which is the point of the tool.
 *
 * @param {{ annualSalaryPence?: number, salarySacrificePence?: number,
 *           pensionAnnualPence?: number, benefitsInKindPence?: number,
 *           otherIncomePence?: number }} person - integer pence.
 * @param {Array<{ kind: 'dividend'|'salary-adjustment', amountPence: number }>} events
 * @param {number|null} [salaryOverridePence] - the year's taxable salary as
 *   already assembled by the monthly timeline (salaryTimeline.js). When given,
 *   it replaces the annual − sacrifice figure (sacrifice and workplace pension
 *   are already inside the monthly numbers); legacy adjustments still add on.
 * @returns {{ nonDividendPence, dividendPence, pensionPence,
 *             dividendTotalPence, adjustmentTotalPence, salaryPence }}
 */
export function buildPersonYearInput(person, events, salaryOverridePence = null) {
  const p = (v) => Math.round(Number(v) || 0);
  let dividendTotalPence = 0;
  let adjustmentTotalPence = 0;
  for (const ev of events || []) {
    if (ev.kind === 'dividend') dividendTotalPence += p(ev.amountPence);
    else if (ev.kind === 'salary-adjustment') adjustmentTotalPence += p(ev.amountPence);
  }
  // Sacrificed pay never reaches the payslip; a negative result means the
  // sacrifice exceeds pay — clamp, it cannot create negative income.
  const salaryPence = Math.max(
    0,
    (salaryOverridePence != null
      ? p(salaryOverridePence)
      : p(person.annualSalaryPence) - p(person.salarySacrificePence)) + adjustmentTotalPence
  );
  return {
    salaryPence,
    dividendTotalPence,
    adjustmentTotalPence,
    nonDividendPence: salaryPence + p(person.benefitsInKindPence) + p(person.otherIncomePence),
    dividendPence: Math.max(0, dividendTotalPence),
    pensionPence: Math.max(0, p(person.pensionAnnualPence)),
  };
}

// ---------------------------------------------------------------------------
// The tax computation
// ---------------------------------------------------------------------------

/** Overlap of [a, b) with [lo, hi), never negative. */
function overlap(a, b, lo, hi) {
  return Math.max(0, Math.min(b, hi) - Math.max(a, lo));
}

/**
 * Compute a person's income tax for one tax year.
 *
 * @param {{ nonDividendPence: number, dividendPence: number, pensionPence: number }} input
 *   integer pence: non-dividend income (salary after sacrifice + adjustments +
 *   BIK + other), dividends, and personal pension contributions.
 * @param {object} table - a TAX_YEAR_TABLES entry.
 * @returns {object} pence figures — see fields below.
 */
export function computePersonTax(input, table) {
  const nonDividend = Math.max(0, Math.round(input.nonDividendPence || 0));
  const dividends = Math.max(0, Math.round(input.dividendPence || 0));
  const pension = Math.max(0, Math.round(input.pensionPence || 0));

  const grossIncomePence = nonDividend + dividends;
  const adjustedNetIncomePence = Math.max(0, grossIncomePence - pension);

  // Personal allowance taper: −£1 for every full £2 of ANI over £100k.
  const taperExcess = Math.max(0, adjustedNetIncomePence - table.taperThresholdPence);
  const personalAllowancePence = Math.max(
    0,
    table.personalAllowancePence - Math.floor(taperExcess / 2)
  );

  // Allowance goes against non-dividend income first (dividend rates are lower).
  const paOnNonDividend = Math.min(personalAllowancePence, nonDividend);
  const paOnDividends = personalAllowancePence - paOnNonDividend;
  const ndTaxable = nonDividend - paOnNonDividend;
  const divTaxable = Math.max(0, dividends - paOnDividends);

  // Band edges in taxable-income space. The additional rate bites above
  // £125,140 of TOTAL income; with the allowance already subtracted that is
  // (threshold − allowance) of taxable income. The allowance is always £0 by
  // £125,140, so the edge never drops below the basic edge in practice.
  const basicEdge = table.basicBandPence;
  const higherEdge = Math.max(
    basicEdge,
    table.additionalRateThresholdPence - personalAllowancePence
  );

  const ir = table.incomeRates;
  const nonDividendTaxPence =
    Math.round(overlap(0, ndTaxable, 0, basicEdge) * ir.basic) +
    Math.round(overlap(0, ndTaxable, basicEdge, higherEdge) * ir.higher) +
    Math.round(Math.max(0, ndTaxable - higherEdge) * ir.additional);

  // Dividends stack on top of non-dividend taxable income. The dividend
  // allowance sits at the bottom of the stack: 0% tax, but band space used.
  const allowanceUsed = Math.min(table.dividendAllowancePence, divTaxable);
  const divStart = ndTaxable + allowanceUsed;
  const divEnd = ndTaxable + divTaxable;
  const dr = table.dividendRates;
  const dividendTaxPence =
    Math.round(overlap(divStart, divEnd, 0, basicEdge) * dr.basic) +
    Math.round(overlap(divStart, divEnd, basicEdge, higherEdge) * dr.higher) +
    Math.round(Math.max(0, divEnd - Math.max(divStart, higherEdge)) * dr.additional);

  return {
    grossIncomePence,
    adjustedNetIncomePence,
    personalAllowancePence,
    // ≈ what PAYE deducts from salary automatically.
    nonDividendTaxPence,
    // The EXTRA bill dividends create, settled later via Self Assessment.
    dividendTaxPence,
    totalTaxPence: nonDividendTaxPence + dividendTaxPence,
    // How much more could be drawn before the 40% band / the £100k line.
    // Extra dividends raise gross income and ANI 1:1, so these read directly
    // as "≈ £X more dividends before …".
    headroomToHigherRatePence: Math.max(
      0,
      table.higherRateThresholdPence - grossIncomePence
    ),
    headroomTo100kPence: Math.max(0, table.taperThresholdPence - adjustedNetIncomePence),
    overHigherRate: grossIncomePence > table.higherRateThresholdPence,
    over100k: adjustedNetIncomePence > table.taperThresholdPence,
  };
}
