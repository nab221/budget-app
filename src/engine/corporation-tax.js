/**
 * corporation-tax.js — UK corporation tax (CT) on a small company's profit,
 * driven backwards from the dividends drawn (spec amendment 2026-09-12 (j)).
 *
 * Pure module: integer PENCE in, integer pence out. No DB access, no clock —
 * callers pass dates in.
 *
 * ── The rules modelled (Financial Year 2023 onward) ────────────────────────
 *   Profit ≤ £50,000            19% small profits rate
 *   Profit ≥ £250,000           25% main rate
 *   Between                     25% less marginal relief of
 *                               3/200 × (£250,000 − profit)
 *                               → an effective 26.5% on each pound in the band
 *
 * CT is assessed on the company's ACCOUNTING PERIOD. The owner's company year
 * ends 31 March, so a company year is 1 April – 31 March and sits inside
 * exactly one HMRC financial year: no apportionment across two rate tables.
 * A company year is labelled by its FY — "FY2026" is 1 Apr 2026 – 31 Mar 2027.
 *
 * ── Dividends define profit ─────────────────────────────────────────────────
 * A dividend can only be paid out of profit AFTER CT. The owner records what
 * was drawn; this module inverts the CT formula to find the smallest profit
 * that leaves that much net, and therefore the CT that has to be set aside.
 *
 * ── Documented simplifications (spec "simpler option" rule) ────────────────
 * - Profit = dividends + CT. No retained reserves, losses, salaries or
 *   expenses — they are netted off before the profit this module sees.
 * - One company, no associated companies (limits are not divided).
 * - A full 12-month period (limits are not pro-rated).
 */

// ---------------------------------------------------------------------------
// Rate tables
// ---------------------------------------------------------------------------

/**
 * Per-financial-year CT rules, keyed by label ("FY2026") — the
 * `TAX_YEAR_TABLES` pattern from `tax.js`, so a Budget change lands as a new
 * entry rather than an edit. Every year from FY2023 (when the 25% main rate
 * and marginal relief returned) is seeded explicitly; the fallback only
 * handles years outside the seeded range.
 */
const FY2023_RULES = {
  smallRate: 0.19,
  mainRate: 0.25,
  lowerLimitPence: 5_000_000, // £50,000
  upperLimitPence: 25_000_000, // £250,000
  marginalReliefFraction: 3 / 200,
};

export const CT_TABLES = {
  FY2023: { ...FY2023_RULES },
  FY2024: { ...FY2023_RULES },
  FY2025: { ...FY2023_RULES },
  FY2026: { ...FY2023_RULES },
};

const KNOWN_FYS = Object.keys(CT_TABLES).sort();

// ---------------------------------------------------------------------------
// Financial-year calendar helpers (1 April – 31 March)
// ---------------------------------------------------------------------------

/** "FY2026" for a start year of 2026. */
function labelForStartYear(startYear) {
  return `FY${startYear}`;
}

/** Start year (e.g. 2026) parsed from an "FY2026" label. */
export function fyStartYear(label) {
  const m = /^FY(\d{4})$/.exec(String(label));
  if (!m) throw new Error(`Bad financial-year label: "${label}"`);
  return Number(m[1]);
}

/**
 * The financial year containing an ISO `yyyy-MM-dd` date.
 * @returns {string} e.g. "FY2026" for any date 1 Apr 2026 – 31 Mar 2027.
 */
export function financialYearForDate(isoDate) {
  const s = String(isoDate);
  const year = Number(s.slice(0, 4));
  if (!Number.isInteger(year)) throw new Error(`Bad ISO date: "${isoDate}"`);
  const startYear = s >= `${year}-04-01` ? year : year - 1;
  return labelForStartYear(startYear);
}

/**
 * Inclusive date bounds of a financial year.
 * @returns {{ startDate: string, endDate: string }} e.g. 2026-04-01 … 2027-03-31.
 */
export function financialYearBounds(label) {
  const y = fyStartYear(label);
  return { startDate: `${y}-04-01`, endDate: `${y + 1}-03-31` };
}

/** The label `delta` years away ("FY2026", −1 → "FY2025"). */
export function shiftFinancialYear(label, delta) {
  return labelForStartYear(fyStartYear(label) + delta);
}

/**
 * The CT rules for a financial year, clamping to the nearest known table for
 * years outside the seeded range (mirrors `taxYearTable`).
 * @returns {{ table: object, tableYear: string }} `tableYear` is the label of
 *   the table actually used, so the UI can flag a fallback.
 */
export function financialYearTable(label) {
  if (CT_TABLES[label]) return { table: CT_TABLES[label], tableYear: label };
  const oldest = KNOWN_FYS[0];
  const newest = KNOWN_FYS[KNOWN_FYS.length - 1];
  const tableYear = String(label) < oldest ? oldest : newest;
  return { table: CT_TABLES[tableYear], tableYear };
}

/**
 * When the year's CT is due: 9 months and 1 day after the 31 March year-end,
 * i.e. 1 January of the following calendar year.
 * @returns {string} ISO date.
 */
export function ctPaymentDate(label) {
  return `${fyStartYear(label) + 2}-01-01`;
}
