/**
 * salaryTimeline.js — dated salary rates + monthly payslips for the Income tab
 * (spec amendment 2026-07-12 (c), superseding the fixed-annual-salary model).
 *
 * Pure module: integer PENCE in, integer pence out. No DB access, no clock —
 * callers pass "today" in.
 *
 * The model:
 * - A person's pay is a TIMELINE of salary periods: { effectiveFrom,
 *   annualSalaryPence, salarySacrificePence, workplacePensionAnnualPence,
 *   bikAnnualPence }.
 *   The period in force on a date is the one with the latest effectiveFrom on
 *   or before it. A raise, an LTFT step-down, or a new contract is just a new
 *   dated period; the month a change lands in is pro-rated by day.
 * - A month's projected taxable pay is (salary − sacrifice − workplace
 *   pension + payrolled BIK) / 12 for the period(s) in force. Workplace
 *   pension here is the before-tax (net-pay) deduction that never reaches
 *   taxable pay — distinct from the person's taxed-pay personal pension,
 *   which only reduces adjusted net income (tax.js). Payrolled BIK (amendment
 *   (d)) is a benefit taxed through the payslip — e.g. the car a salary
 *   sacrifice buys: it is not cash, but PAYE adds it to taxable pay every
 *   month. BIK assessed via P11D/tax code instead stays an annual figure on
 *   the person (tax.js) and must NOT be entered here too.
 * - A PAYSLIP for a month overrides the projection with the actual figures.
 *   Since amendment (g) the payslip carries the month's TAXABLE PAY directly
 *   (the figure payslips print) plus the pension contributions and tax
 *   deducted; older rows without `taxablePence` still compute
 *   gross − pension + BIK. Payslips for past/current months are 'actual'; a
 *   payslip on a future month is 'planned' (a pencilled-in bonus or the
 *   like); everything else is 'projected'.
 * - Each month also carries its before-tax workplace PENSION contribution
 *   (payslip actual, else the timeline's expected workplace pension) so the
 *   pension annual-allowance tracker can sum the year.
 * - Documented simplification: a payslip belongs to the tax year of its
 *   calendar month (April payslip → new tax year), and pay months are the 12
 *   calendar months Apr–Mar.
 */

import { startYearOf, parseTaxCode } from './tax.js';

/** The 12 'yyyy-MM' pay months of a tax year, April first. */
export function monthsOfTaxYear(label) {
  const y = startYearOf(label);
  const months = [];
  for (let i = 0; i < 12; i += 1) {
    const m = 4 + i;
    const year = m > 12 ? y + 1 : y;
    const month = m > 12 ? m - 12 : m;
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}

/** Days in a 'yyyy-MM' month (UTC arithmetic, leap-safe). */
function daysInMonth(yyyyMM) {
  const y = Number(yyyyMM.slice(0, 4));
  const m = Number(yyyyMM.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** A period's taxable pay per month. The cash part is clamped ≥ 0 (a
 * sacrifice + pension can't create negative pay); payrolled BIK adds on top
 * regardless — it is taxed even in a nil-cash month. */
function monthlyRateOf(period) {
  const p = (v) => Math.round(Number(v) || 0);
  const cashAnnual =
    p(period.annualSalaryPence) -
    p(period.salarySacrificePence) -
    p(period.workplacePensionAnnualPence);
  return Math.round((Math.max(0, cashAnnual) + p(period.bikAnnualPence)) / 12);
}

/** A period's expected before-tax workplace pension per month. */
function monthlyPensionRateOf(period) {
  return Math.round(Math.max(0, Math.round(Number(period.workplacePensionAnnualPence) || 0)) / 12);
}

/** Periods sorted oldest-first by effectiveFrom (stable for equal dates). */
function sortPeriods(periods) {
  return [...(periods || [])].sort((a, b) =>
    a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : 0
  );
}

/**
 * Day-weighted monthly figure from the timeline: the period in force at the
 * start of the month blended with any changes landing inside it, `rateOf`
 * giving each period's monthly rate. No periods in force → 0.
 */
function dayWeightedMonthPence(periods, yyyyMM, rateOf) {
  const sorted = sortPeriods(periods);
  if (sorted.length === 0) return 0;

  const days = daysInMonth(yyyyMM);
  const monthStart = `${yyyyMM}-01`;

  // The period in force at the start of the month (latest effectiveFrom ≤ start).
  let inForce = null;
  for (const p of sorted) if (p.effectiveFrom <= monthStart) inForce = p;

  // Day-weighted blend across any changes landing inside the month.
  let total = 0;
  let fromDay = 1;
  let current = inForce;
  for (const p of sorted) {
    if (p.effectiveFrom <= monthStart || p.effectiveFrom.slice(0, 7) !== yyyyMM) continue;
    const changeDay = Number(p.effectiveFrom.slice(8, 10));
    if (current) total += rateOf(current) * (changeDay - fromDay);
    current = p;
    fromDay = changeDay;
  }
  if (current) total += rateOf(current) * (days - fromDay + 1);
  return Math.round(total / days);
}

/**
 * Projected taxable pay for one 'yyyy-MM' month from the timeline, pro-rated
 * by day when a period change lands mid-month.
 * @param {Array<object>} periods - pence-domain salary periods.
 * @param {string} yyyyMM
 * @returns {number} pence
 */
export function projectedMonthPence(periods, yyyyMM) {
  return dayWeightedMonthPence(periods, yyyyMM, monthlyRateOf);
}

/**
 * Projected before-tax workplace pension for one 'yyyy-MM' month, pro-rated
 * the same way (amendment (g) — feeds the annual-allowance tracker).
 * @param {Array<object>} periods - pence-domain salary periods.
 * @param {string} yyyyMM
 * @returns {number} pence
 */
export function projectedMonthPensionPence(periods, yyyyMM) {
  return dayWeightedMonthPence(periods, yyyyMM, monthlyPensionRateOf);
}

/**
 * Build the 12 pay-month rows for one person's tax year.
 *
 * @param {object} args
 * @param {Array<object>} args.periods - pence-domain salary periods.
 * @param {Array<object>} args.payslips - pence-domain payslips
 *   ({ month, taxablePence?, pensionPence, taxPaidPence, ... } — pre-(g) rows
 *   carry grossPence/bikPence instead of taxablePence) — any month, only this
 *   tax year's are used.
 * @param {string} args.taxYear - e.g. "2026-27".
 * @param {string} args.todayMonth - 'yyyy-MM' of today (clock stays with caller).
 * @returns {Array<{ month: string, source: 'actual'|'planned'|'projected',
 *   taxablePence: number, pensionPence: number, cumulativePence: number,
 *   payslip: object|null }>}
 */
export function buildMonthlyPay({ periods, payslips, taxYear, todayMonth }) {
  const byMonth = new Map();
  for (const slip of payslips || []) byMonth.set(slip.month, slip);

  let cumulative = 0;
  return monthsOfTaxYear(taxYear).map((month) => {
    const slip = byMonth.get(month) || null;
    let source = 'projected';
    let taxablePence;
    let pensionPence;
    if (slip) {
      source = month <= todayMonth ? 'actual' : 'planned';
      const p = (v) => Math.round(Number(v) || 0);
      taxablePence =
        slip.taxablePence != null
          ? Math.max(0, p(slip.taxablePence))
          : Math.max(0, p(slip.grossPence) - p(slip.pensionPence)) + p(slip.bikPence);
      pensionPence = Math.max(0, p(slip.pensionPence));
    } else {
      taxablePence = projectedMonthPence(periods, month);
      pensionPence = projectedMonthPensionPence(periods, month);
    }
    cumulative += taxablePence;
    return { month, source, taxablePence, pensionPence, cumulativePence: cumulative, payslip: slip };
  });
}

/**
 * Cumulative-basis PAYE sanity check over the entered payslips: PAYE gives
 * 1/12 of the personal allowance and of each band per pay month, so after m
 * months the expected tax on the year-to-date taxable pay uses m/12-scaled
 * bands. Compared against the tax actually deducted per the payslips.
 *
 * Only meaningful when every month up to the latest entered payslip is
 * present (a gap understates YTD pay) — `complete` is false otherwise and the
 * UI should ask for the missing months instead of warning.
 *
 * When the person's PAYE tax code is known (amendment (f)) the check uses
 * the free pay it encodes — a K code adds to taxable pay, BR/D0/D1 tax
 * everything at one rate, NT expects no tax — so an HMRC-adjusted code no
 * longer shows up as a false warning. No/blank/unparseable code falls back
 * to the standard personal allowance.
 *
 * Documented simplifications: no £100k taper beyond what the code encodes,
 * non-dividend income only, rUK bands (S/C codes accepted, rUK rates used),
 * W1/M1 emergency markers treated as cumulative.
 *
 * @param {Array<object>} monthlyRows - from `buildMonthlyPay`.
 * @param {object} table - a TAX_YEAR_TABLES entry.
 * @param {string} [taxCode] - the person's PAYE code, e.g. "1257L", "K475".
 * @returns {{ months: number, taxableYtdPence: number, expectedPence: number,
 *   paidPence: number, diffPence: number, complete: boolean,
 *   taxCode: string|null } | null}
 *   null when no actual payslips are entered. `taxCode` is the normalised
 *   code the expectation used, or null when it fell back to the standard
 *   allowance.
 */
export function expectedPayeYtd(monthlyRows, table, taxCode = null) {
  let lastActual = -1;
  for (let i = 0; i < monthlyRows.length; i += 1) {
    if (monthlyRows[i].source === 'actual') lastActual = i;
  }
  if (lastActual < 0) return null;

  let complete = true;
  let taxableYtdPence = 0;
  let paidPence = 0;
  for (let i = 0; i <= lastActual; i += 1) {
    const row = monthlyRows[i];
    if (row.source !== 'actual') {
      complete = false;
      continue;
    }
    taxableYtdPence += row.taxablePence;
    paidPence += Math.round(Number(row.payslip?.taxPaidPence) || 0);
  }

  const months = lastActual + 1;
  const twelfth = (pence) => Math.round((pence * months) / 12);
  const parsed = parseTaxCode(taxCode);
  const ir = table.incomeRates;

  let expectedPence;
  if (parsed?.flatRate) {
    // BR/D0/D1: one rate on everything, no free pay. NT: no tax at all.
    const rate = parsed.flatRate === 'none' ? 0 : ir[parsed.flatRate];
    expectedPence = Math.round(taxableYtdPence * rate);
  } else {
    // Free pay from the code when known (negative for K codes — pay added),
    // else the standard allowance. The band WIDTHS never move with the code:
    // PAYE fixes them in taxable-pay space from the standard allowance.
    const allowance = twelfth(parsed ? parsed.allowancePence : table.personalAllowancePence);
    const basicEdge = twelfth(table.basicBandPence);
    const higherEdge = Math.max(
      basicEdge,
      twelfth(table.additionalRateThresholdPence - table.personalAllowancePence)
    );
    const taxable = Math.max(0, taxableYtdPence - allowance);
    expectedPence =
      Math.round(Math.min(taxable, basicEdge) * ir.basic) +
      Math.round(Math.max(0, Math.min(taxable, higherEdge) - basicEdge) * ir.higher) +
      Math.round(Math.max(0, taxable - higherEdge) * ir.additional);
  }

  return {
    months,
    taxableYtdPence,
    expectedPence,
    paidPence,
    diffPence: paidPence - expectedPence,
    complete,
    taxCode: parsed ? parsed.code : null,
  };
}
