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
 * The annual allowance for a tax year: the tax table where seeded, £40,000
 * for years before 2023-24, else the newest table's figure.
 * @returns {{ allowancePence: number, fromTable: boolean }}
 */
export function annualAllowanceForYear(label) {
  const seeded = TAX_YEAR_TABLES[label];
  if (seeded) return { allowancePence: seeded.pensionAnnualAllowancePence, fromTable: true };
  if (String(label) < '2023-24') return { allowancePence: PRE_2023_ALLOWANCE_PENCE, fromTable: false };
  return { allowancePence: taxYearTable(label).table.pensionAnnualAllowancePence, fromTable: false };
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
