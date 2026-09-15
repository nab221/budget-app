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
 * rolls it forward year by year, and BACKWARDS through the statement's
 * per-year "pension earned" for the years before it. An entered figure
 * (Pension Savings Statement or the owner's own reconstruction) always beats
 * the estimate.
 *
 * Documented simplifications: post-April-2022 revaluation timing only (no
 * estimates before 2022-23); a prior year over its own allowance contributes
 * zero carry-forward; the high-income taper is a warning, not a computation.
 */

import { TAX_YEAR_TABLES, taxYearTable, taxYearForDate, shiftTaxYear } from './tax.js';

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

/**
 * The annual allowance for a tax year: £40,000 before 2023-24, the tax table
 * from then on. A label before the seeded range takes the OLDEST table (via
 * `taxYearTable`, so a future Budget row can never rewrite the £60,000
 * history that carry-forward relies on); a label with no seeded row of its
 * own otherwise falls back to the newest table, read live so a table added
 * later is picked up immediately — nothing is cached at module load.
 * `fromTable` means "the allowance for this year is known precisely": true
 * for a label with its own seeded row, or one that clamps down to the oldest
 * table (a defined historical fact); false whenever the newest table's
 * figure is only a best-available guess — which is what the fallback banner
 * and the `*` marker report.
 * @returns {{ allowancePence: number, fromTable: boolean }}
 */
export function annualAllowanceForYear(label) {
  const key = String(label);
  if (key < '2023-24') return { allowancePence: PRE_2023_ALLOWANCE_PENCE, fromTable: true };
  const known = Object.keys(TAX_YEAR_TABLES).sort();
  const oldest = known[0];
  if (key < oldest) {
    const { table } = taxYearTable(key);
    return { allowancePence: table.pensionAnnualAllowancePence, fromTable: true };
  }
  if (TAX_YEAR_TABLES[key]) {
    return { allowancePence: TAX_YEAR_TABLES[key].pensionAnnualAllowancePence, fromTable: true };
  }
  const newest = known[known.length - 1];
  return { allowancePence: TAX_YEAR_TABLES[newest].pensionAnnualAllowancePence, fromTable: false };
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

/** `map[label]` when it is a number, else null ("not entered"). */
const numberOrNull = (map, label) => (typeof map?.[label] === 'number' ? map[label] : null);

/**
 * One year's pension input amount from its opening pension, computed in full
 * (revaluation and accrual on one side, CPI uprating on the other) and rounded
 * once at the end. The accrual is the statement's "pension earned" when
 * `earnedPence` is a number, else pensionable earnings ÷ the scheme's accrual.
 * @returns {{ closingPence: number, upratedOpeningPence: number, piaPence: number }}
 */
export function estimatePia({ scheme, openingPence, cpi, earningsPence, earnedPence = null }) {
  const s = schemeOf(scheme);
  const opening = pence(openingPence);
  const rate = Number(cpi) || 0;
  const accrualExact = typeof earnedPence === 'number' ? pence(earnedPence) : pence(earningsPence) / s.accrualDenominator;
  const closingExact = opening * (1 + rate + s.realRevaluation) + accrualExact;
  const upratedExact = opening * (1 + rate);
  return {
    closingPence: Math.round(closingExact),
    upratedOpeningPence: Math.round(upratedExact),
    piaPence: Math.max(0, Math.round(PIA_FACTOR * (closingExact - upratedExact))),
  };
}

/**
 * Roll a statement anchor forward to the opening pension of `targetYear`,
 * one tax year at a time: closing = opening × (1 + CPI + real) + accrual
 * (the year's pension earned when known, else earnings ÷ denominator),
 * rounded once per year. Null when the target is before the
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
  earnedByYear = {},
}) {
  if (!SCHEMES[scheme]) return null;
  if (String(fromYear) < FIRST_ESTIMATE_YEAR || String(targetYear) < String(fromYear)) return null;
  let opening = pence(anchorPence);
  const chain = [];
  let year = fromYear;
  while (year < targetYear) {
    const cpi = cpiByYear[year];
    if (typeof cpi !== 'number') return null;
    const { closingPence } = estimatePia({
      scheme,
      openingPence: opening,
      cpi,
      earningsPence: earningsByYear[year] || 0,
      earnedPence: numberOrNull(earnedByYear, year),
    });
    chain.push({ taxYear: year, openingPence: opening, closingPence, cpi });
    opening = closingPence;
    year = shiftTaxYear(year, 1);
  }
  return { openingPence: opening, chain };
}

/**
 * One BACKWARD step: from a year's closing pension and the statement's
 * "pension earned", the opening pension and that year's input amount, in
 * full and rounded once. opening = (closing − earned) ÷ (1 + CPI + real),
 * clamped at zero; PIA = 16 × (closing − opening × (1 + CPI)).
 * @returns {{ openingPence: number, upratedOpeningPence: number, piaPence: number }}
 */
export function estimatePiaFromClosing({ scheme, closingPence, cpi, earnedPence }) {
  const s = schemeOf(scheme);
  const closing = pence(closingPence);
  const rate = Number(cpi) || 0;
  const openingExact = Math.max(0, (closing - pence(earnedPence)) / (1 + rate + s.realRevaluation));
  const upratedExact = openingExact * (1 + rate);
  return {
    openingPence: Math.round(openingExact),
    upratedOpeningPence: Math.round(upratedExact),
    piaPence: Math.max(0, Math.round(PIA_FACTOR * (closing - upratedExact))),
  };
}

/**
 * Roll a statement anchor BACKWARDS to `targetYear`. The anchor is the
 * closing pension of the year before its opening year; each step back needs
 * that year's "pension earned" and CPI, and its opening becomes the previous
 * year's closing (rounded once per year). Null when the target is before
 * 2022-23, at or after the anchor's opening year (forward territory), or any
 * year on the way lacks a pension-earned figure or a CPI. `chain` is newest
 * first — the order it was computed — and its last entry is `targetYear`.
 * @returns {{ openingPence: number, closingPence: number, chain: Array<{ taxYear, openingPence, closingPence, upratedOpeningPence, piaPence, cpi, earnedPence }> } | null}
 */
export function rollBackward({
  scheme,
  anchorPence,
  anchorOpeningYear: fromYear,
  targetYear,
  cpiByYear = SEPTEMBER_CPI,
  earnedByYear = {},
}) {
  if (!SCHEMES[scheme]) return null;
  if (String(targetYear) < FIRST_ESTIMATE_YEAR || String(targetYear) >= String(fromYear)) return null;
  let closing = pence(anchorPence);
  const chain = [];
  let year = shiftTaxYear(fromYear, -1);
  while (year >= targetYear) {
    const cpi = cpiByYear[year];
    const earnedPence = numberOrNull(earnedByYear, year);
    if (typeof cpi !== 'number' || earnedPence == null) return null;
    const step = estimatePiaFromClosing({ scheme, closingPence: closing, cpi, earnedPence });
    chain.push({ taxYear: year, closingPence: closing, cpi, earnedPence, ...step });
    if (year === targetYear) return { openingPence: step.openingPence, closingPence: closing, chain };
    closing = step.openingPence;
    year = shiftTaxYear(year, -1);
  }
  return null;
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
 * Years from the anchor's opening year onward are rolled FORWARD from it;
 * years before it are rolled BACKWARD through the statement's per-year
 * "pension earned" (`earnedByYear`) — a gap in those rows stops the chain and
 * leaves the earlier years unknown (source 'none').
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
  earnedByYear = {},
  sippGrossByYear = {},
  cpiByYear = SEPTEMBER_CPI,
}) {
  const rowByYear = new Map((rows || []).map((r) => [r.taxYear, r]));
  const cpiMissing = [];
  const canEstimate = !!(scheme && SCHEMES[scheme] && anchor && anchor.openingYear && anchor.openingYear >= FIRST_ESTIMATE_YEAR);
  const anchorArgs = canEstimate ? { scheme, anchorPence: anchor.pence, anchorOpeningYear: anchor.openingYear, cpiByYear } : null;

  /** True when any CPI from `from` to `to` inclusive is missing. */
  const cpiGapBetween = (from, to) => {
    for (let y = from; y <= to; y = shiftTaxYear(y, 1)) if (typeof cpiByYear[y] !== 'number') return true;
    return false;
  };

  const years = windowYears(taxYear).map((label) => {
    const { allowancePence, fromTable } = annualAllowanceForYear(label);
    const row = rowByYear.get(label) || null;
    const earningsPence = pence(earningsByYear[label]);
    const earningsSource = row && row.pensionableEarningsPence != null ? 'override' : 'timeline';
    const earnedEntered = numberOrNull(earnedByYear, label);

    let estimate = null;
    if (canEstimate && label >= FIRST_ESTIMATE_YEAR) {
      if (label >= anchor.openingYear) {
        const rolled = rollForward({ ...anchorArgs, targetYear: label, earningsByYear, earnedByYear });
        const cpi = cpiByYear[label];
        if (rolled && typeof cpi === 'number') {
          const est = estimatePia({ scheme, openingPence: rolled.openingPence, cpi, earningsPence, earnedPence: earnedEntered });
          estimate = {
            openingPence: rolled.openingPence,
            cpi,
            ...est,
            earningsPence,
            earningsSource,
            earnedPence: earnedEntered != null ? earnedEntered : Math.round(earningsPence / SCHEMES[scheme].accrualDenominator),
            earnedSource: earnedEntered != null ? 'statement' : 'earnings',
          };
        } else {
          cpiMissing.push(label);
        }
      } else {
        const rolled = rollBackward({ ...anchorArgs, targetYear: label, earnedByYear });
        if (rolled) {
          const step = rolled.chain[rolled.chain.length - 1];
          estimate = {
            openingPence: step.openingPence,
            cpi: step.cpi,
            closingPence: step.closingPence,
            upratedOpeningPence: step.upratedOpeningPence,
            piaPence: step.piaPence,
            earningsPence,
            earningsSource,
            earnedPence: step.earnedPence,
            earnedSource: 'statement',
          };
        } else if (cpiGapBetween(label, shiftTaxYear(anchor.openingYear, -1))) {
          cpiMissing.push(label);
        }
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
