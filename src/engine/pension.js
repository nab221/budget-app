/**
 * pension.js — pension annual allowance for defined-benefit members
 * (REFACTOR-SPEC amendment 2026-09-15 (k)).
 *
 * Pure module: integer PENCE in, integer pence out. No DB access, no clock.
 *
 * HMRC measures a defined-benefit scheme's use of the annual allowance by the
 * PENSION INPUT AMOUNT: 16 × (closing pension − opening pension × (1 + CPI)),
 * CPI being the September figure before the tax year starts. Both household
 * schemes are career-average with no lump sum, so a year's closing pension is
 * opening × (1 + CPI + real revaluation) + pensionable earnings ÷ accrual.
 *
 * The user enters one ANCHOR (accrued pension at a statement date); the engine
 * rolls it forward year by year. An entered figure (Pension Savings Statement
 * or the owner's own reconstruction) always beats the estimate.
 *
 * Documented simplifications: post-April-2022 revaluation timing only (no
 * estimates before 2022-23); a prior year over its own allowance contributes
 * zero carry-forward; the high-income taper is a warning, not a computation.
 */

import { TAX_YEAR_TABLES, taxYearForDate, shiftTaxYear } from './tax.js';

export const SCHEMES = {
  'nhs-2015': { label: 'NHS 2015', accrualDenominator: 54, realRevaluation: 0.015 },
  'lgps-2014': { label: 'LGPS 2014', accrualDenominator: 49, realRevaluation: 0 },
};

/**
 * September CPI, keyed by the tax year it uprates (the September BEFORE it
 * starts). Add a row after each September figure is published — a missing
 * year switches the estimate off rather than guessing.
 */
export const SEPTEMBER_CPI = {
  '2019-20': 0.024,
  '2020-21': 0.017,
  '2021-22': 0.005,
  '2022-23': 0.031,
  '2023-24': 0.101,
  '2024-25': 0.067,
  '2025-26': 0.017,
  '2026-27': 0.038,
};

export const PIA_FACTOR = 16;
export const RELIEF_AT_SOURCE_GROSS_UP = 1.25;
export const TAPER_THRESHOLD_INCOME_PENCE = 20_000_000; // £200,000
export const PRE_2023_ALLOWANCE_PENCE = 4_000_000; // £40,000 up to 2022-23
export const FIRST_ESTIMATE_YEAR = '2022-23';
export const CARRY_FORWARD_YEARS = 3;

/** The September CPI for a tax year, or null when not seeded (no fallback). */
export function cpiForYear(label) {
  const v = SEPTEMBER_CPI[label];
  return typeof v === 'number' ? v : null;
}

const NEWEST_TABLE_YEAR = Object.keys(TAX_YEAR_TABLES).sort().at(-1);

/**
 * The annual allowance for a tax year: £40,000 before 2023-24, the tax table
 * from then on (falling back to the newest table beyond its seeded years).
 * `fromTable` means "the allowance for this year is known" — true for every
 * label up to and including the newest seeded tax-table year, false only for
 * later, unknown years — which is what the fallback banner and the `*`
 * marker report.
 * @returns {{ allowancePence: number, fromTable: boolean }}
 */
export function annualAllowanceForYear(label) {
  const key = String(label);
  if (key < '2023-24') return { allowancePence: PRE_2023_ALLOWANCE_PENCE, fromTable: true };
  const seeded = TAX_YEAR_TABLES[key] ?? TAX_YEAR_TABLES[NEWEST_TABLE_YEAR];
  return { allowancePence: seeded.pensionAnnualAllowancePence, fromTable: key <= NEWEST_TABLE_YEAR };
}

/**
 * The tax year an anchor OPENS: a statement figure is the value at the end of
 * the tax year containing its date (31 March 2026 → end of 2025-26 → opens
 * 2026-27).
 */
export function anchorOpeningYear(isoDate) {
  return shiftTaxYear(taxYearForDate(isoDate), 1);
}

const pence = (v) => Math.max(0, Math.round(Number(v) || 0));

function schemeOf(key) {
  const scheme = SCHEMES[key];
  if (!scheme) throw new Error(`Unknown pension scheme: "${key}"`);
  return scheme;
}

/**
 * One year's pension input amount from its opening pension, computed in full
 * (revaluation and accrual on one side, CPI uprating on the other) and rounded
 * once at the end.
 * @returns {{ closingPence: number, upratedOpeningPence: number, piaPence: number }}
 */
export function estimatePia({ scheme, openingPence, cpi, earningsPence }) {
  const s = schemeOf(scheme);
  const opening = pence(openingPence);
  const earnings = pence(earningsPence);
  const rate = Number(cpi) || 0;
  const closingExact = opening * (1 + rate + s.realRevaluation) + earnings / s.accrualDenominator;
  const upratedExact = opening * (1 + rate);
  return {
    closingPence: Math.round(closingExact),
    upratedOpeningPence: Math.round(upratedExact),
    piaPence: Math.max(0, Math.round(PIA_FACTOR * (closingExact - upratedExact))),
  };
}

/**
 * Roll a statement anchor forward to the opening pension of `targetYear`,
 * one tax year at a time: closing = opening × (1 + CPI + real) + earnings ÷
 * accrual, rounded once per year. Null when the target is before the
 * anchor's opening year, before 2022-23 (pre-2022 revaluation timing is not
 * modelled), or any CPI on the way is missing.
 * @returns {{ openingPence: number, chain: Array<{ taxYear, openingPence, closingPence, cpi }> } | null}
 */
export function rollForward({
  scheme,
  anchorPence,
  anchorOpeningYear: fromYear,
  targetYear,
  cpiByYear = SEPTEMBER_CPI,
  earningsByYear = {},
}) {
  if (!SCHEMES[scheme]) return null;
  if (String(fromYear) < FIRST_ESTIMATE_YEAR || String(targetYear) < String(fromYear)) return null;
  let opening = pence(anchorPence);
  const chain = [];
  let year = fromYear;
  while (year < targetYear) {
    const cpi = cpiByYear[year];
    if (typeof cpi !== 'number') return null;
    const { closingPence } = estimatePia({ scheme, openingPence: opening, cpi, earningsPence: earningsByYear[year] || 0 });
    chain.push({ taxYear: year, openingPence: opening, closingPence, cpi });
    opening = closingPence;
    year = shiftTaxYear(year, 1);
  }
  return { openingPence: opening, chain };
}

/** The window's labels, oldest first: taxYear − 3 … taxYear. */
export function windowYears(taxYear) {
  const out = [];
  for (let i = CARRY_FORWARD_YEARS; i >= 0; i -= 1) out.push(shiftTaxYear(taxYear, -i));
  return out;
}

/**
 * The viewed tax year plus the three before it: per year the allowance, the
 * pension input amount in force (entered beats estimate), grossed-up
 * personal/SIPP contributions, used and unused; then the carry-forward,
 * SIPP headroom (gross and the net payment), and the over/chargeable verdict.
 *
 * A scheme member's year with neither an entered figure nor an estimate is
 * unknown — it contributes ZERO carry-forward (conservative). A person with no
 * scheme is complete on SIPP data alone, so their unused is allowance − SIPP.
 * A prior year over its own allowance contributes zero; nothing is chased
 * further back.
 */
export function buildPensionYear({
  taxYear,
  scheme = null,
  anchor = null,
  rows = [],
  earningsByYear = {},
  sippGrossByYear = {},
  cpiByYear = SEPTEMBER_CPI,
}) {
  const rowByYear = new Map((rows || []).map((r) => [r.taxYear, r]));
  const cpiMissing = [];
  const canEstimate = !!(scheme && SCHEMES[scheme] && anchor && anchor.openingYear && anchor.openingYear >= FIRST_ESTIMATE_YEAR);

  const years = windowYears(taxYear).map((label) => {
    const { allowancePence, fromTable } = annualAllowanceForYear(label);
    const row = rowByYear.get(label) || null;
    const earningsPence = pence(earningsByYear[label]);
    const earningsSource = row && row.pensionableEarningsPence != null ? 'override' : 'timeline';

    let estimate = null;
    if (canEstimate && label >= anchor.openingYear && label >= FIRST_ESTIMATE_YEAR) {
      const rolled = rollForward({
        scheme,
        anchorPence: anchor.pence,
        anchorOpeningYear: anchor.openingYear,
        targetYear: label,
        cpiByYear,
        earningsByYear,
      });
      const cpi = cpiByYear[label];
      if (rolled && typeof cpi === 'number') {
        const est = estimatePia({ scheme, openingPence: rolled.openingPence, cpi, earningsPence });
        estimate = { openingPence: rolled.openingPence, cpi, ...est, earningsPence, earningsSource };
      } else {
        cpiMissing.push(label);
      }
    }

    const entered = row && row.piaPence != null ? pence(row.piaPence) : null;
    const piaPence = entered != null ? entered : estimate ? estimate.piaPence : null;
    const piaSource = entered != null ? 'entered' : estimate ? 'estimate' : 'none';
    const sippGrossPence = pence(sippGrossByYear[label]);
    const usedPence = (piaPence || 0) + sippGrossPence;
    const unknown = !!scheme && piaSource === 'none';
    return {
      taxYear: label,
      allowancePence,
      allowanceFromTable: fromTable,
      piaPence,
      piaSource,
      estimate,
      sippGrossPence,
      usedPence,
      unusedPence: unknown ? 0 : Math.max(0, allowancePence - usedPence),
      carriedPence: 0,
    };
  });

  const current = years[years.length - 1];
  const prior = years.slice(0, -1);
  const priorUnused = prior.reduce((sum, y) => sum + y.unusedPence, 0);
  // The current year's excess eats prior unused allowance oldest first.
  let remaining = Math.max(0, current.usedPence - current.allowancePence);
  for (const y of prior) {
    y.carriedPence = Math.min(remaining, y.unusedPence);
    remaining -= y.carriedPence;
  }
  const carryForwardPence = prior.reduce((sum, y) => sum + (y.unusedPence - y.carriedPence), 0);
  const totalAvailablePence = current.allowancePence + priorUnused;
  const headroomGrossPence = Math.max(0, totalAvailablePence - current.usedPence);
  return {
    taxYear,
    scheme,
    years,
    current,
    carryForwardPence,
    totalAvailablePence,
    headroomGrossPence,
    headroomNetPence: Math.round(headroomGrossPence / RELIEF_AT_SOURCE_GROSS_UP),
    over: remaining > 0,
    chargeablePence: remaining,
    cpiMissing,
  };
}
