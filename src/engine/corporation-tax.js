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

// ---------------------------------------------------------------------------
// The tax, and its inverse
// ---------------------------------------------------------------------------

/** Integer pence from any input: rounds, and turns negative or junk into 0. */
const clampPence = (v) => Math.max(0, Math.round(Number(v) || 0));

/**
 * The CT rate on the NEXT pound of profit at a given profit level: 19% below
 * the lower limit, the marginal-relief rate (main + fraction = 26.5%) from
 * the lower limit up to but not including the upper limit, the main rate
 * from there. Used for "what does one more pound cost" wording.
 */
export function marginalRateAt(profitPence, table) {
  const profit = clampPence(profitPence);
  if (profit < table.lowerLimitPence) return table.smallRate;
  if (profit < table.upperLimitPence) return table.mainRate + table.marginalReliefFraction;
  return table.mainRate;
}

/**
 * Corporation tax on a full-year profit.
 *
 * In the marginal band HMRC's formula is: main rate on the whole profit, less
 * marginal relief of `fraction × (upper limit − profit)`. Rounded to the
 * penny at the end of each term, never mid-way.
 *
 * @param {number} profitPence - integer pence; negative or junk → 0.
 * @param {object} table - a `CT_TABLES` entry.
 * @returns {{ taxPence: number, reliefPence: number,
 *             band: 'small'|'marginal'|'main', marginalRate: number,
 *             effectiveRate: number }}
 *   `band` follows HMRC's wording (£50,000 "or less" is small; £250,000 "or
 *   more" is main); `marginalRate` is the rate on the next pound, so at
 *   exactly £50,000 it is already 26.5%.
 */
export function corporationTax(profitPence, table) {
  const profit = clampPence(profitPence);
  const { smallRate, mainRate, lowerLimitPence, upperLimitPence, marginalReliefFraction } = table;

  let band;
  let taxPence;
  let reliefPence = 0;
  if (profit <= lowerLimitPence) {
    band = 'small';
    taxPence = Math.round(profit * smallRate);
  } else if (profit >= upperLimitPence) {
    band = 'main';
    taxPence = Math.round(profit * mainRate);
  } else {
    band = 'marginal';
    reliefPence = Math.round((upperLimitPence - profit) * marginalReliefFraction);
    taxPence = Math.round(profit * mainRate) - reliefPence;
  }

  return {
    taxPence,
    reliefPence,
    band,
    marginalRate: marginalRateAt(profit, table),
    effectiveRate: profit > 0 ? taxPence / profit : 0,
  };
}

/**
 * The smallest integer profit whose after-CT amount is at least `netPence`
 * — i.e. the profit a company must earn to pay that much out as dividends.
 *
 * Closed form per band (net = profit − CT):
 *   small     net = (1 − small) × P                    → P = net / (1 − small)
 *   marginal  net = (1 − main − f) × P + f × upper     → P = (net − f × upper) / (1 − main − f)
 *   main      net = (1 − main) × P                     → P = net / (1 − main)
 * then nudged by a few pence so the rounded tax satisfies the inequality
 * exactly — the ledger total, the CT, and the profit must reconcile to the
 * penny on screen. The profit can leave up to a penny MORE than the net.
 *
 * @param {number} netPence - integer pence of dividends; negative or junk → 0.
 * @returns {number} integer pence of profit.
 */
export function profitForNetDividends(netPence, table) {
  const net = clampPence(netPence);
  if (net === 0) return 0;
  const { smallRate, mainRate, lowerLimitPence, upperLimitPence, marginalReliefFraction: f } = table;
  const netAt = (p) => p - corporationTax(p, table).taxPence;

  let guess;
  if (net <= netAt(lowerLimitPence)) guess = net / (1 - smallRate);
  else if (net < netAt(upperLimitPence)) guess = (net - f * upperLimitPence) / (1 - mainRate - f);
  else guess = net / (1 - mainRate);

  // Start a couple of pence below the real-valued solution and walk up to the
  // first integer profit that works. Rounding moves the answer by at most a
  // penny or two, so this loop runs a handful of times; the cap is a guard.
  let profit = Math.max(0, Math.floor(guess) - 2);
  for (let i = 0; i < 20 && netAt(profit) < net; i += 1) profit += 1;
  return profit;
}

/**
 * Pence of CT per pound of DIVIDEND at a given rate on profit. £1 of dividend
 * needs £1 / (1 − rate) of profit, of which rate / (1 − rate) is CT:
 * 23.5p at 19%, 36.1p at 26.5%, 33.3p at 25%. This is the number the "keep
 * 20%" rule of thumb gets wrong in the marginal band.
 */
export function setAsidePerPound(rate) {
  return rate / (1 - rate);
}

// ---------------------------------------------------------------------------
// The company-year build
// ---------------------------------------------------------------------------

/**
 * Everything the headline needs from one number: the year's dividends.
 *
 * @param {number} dividendPence - integer pence drawn so far.
 * @param {object} table - a `CT_TABLES` entry.
 * @returns {{ dividendPence, profitPence, ctPence, effectiveRate, band,
 *   marginalRate, averageSetAsidePerPound, marginalSetAsidePerPound,
 *   headroomProfitPence, headroomDividendPence }}
 *   `headroom*` are how much more profit / how many more pounds of dividend
 *   fit under the £50k line (zero once past it). `averageSetAsidePerPound` is
 *   CT ÷ dividends for the year so far; with nothing drawn it reads as the
 *   marginal figure so the screen never shows a meaningless 0.
 */
export function companyTotals(dividendPence, table) {
  const dividends = clampPence(dividendPence);
  const profitPence = profitForNetDividends(dividends, table);
  const ct = corporationTax(profitPence, table);
  const marginalSetAsidePerPound = setAsidePerPound(ct.marginalRate);
  const headroomProfitPence = Math.max(0, table.lowerLimitPence - profitPence);
  return {
    dividendPence: dividends,
    profitPence,
    ctPence: ct.taxPence,
    effectiveRate: ct.effectiveRate,
    band: ct.band,
    marginalRate: ct.marginalRate,
    averageSetAsidePerPound: dividends > 0 ? ct.taxPence / dividends : marginalSetAsidePerPound,
    marginalSetAsidePerPound,
    headroomProfitPence,
    headroomDividendPence: Math.round(headroomProfitPence * (1 - table.smallRate)),
  };
}

/** Events newest first: by date, then by id so a same-day pair is stable. */
function newestFirst(events) {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.id ?? 0) - (a.id ?? 0);
  });
}

/**
 * Pool a company year's dividend events (both people draw from the same
 * company) and work out the profit and CT they imply.
 *
 * Nothing here is persisted: the Company screen recomputes this on every
 * read, per the "never persist computed rows" rule.
 *
 * @param {object} args
 * @param {Array<{ id?: number, personId: number, date: string, kind: string,
 *   note?: string, amountPence: number }>} [args.dividendEvents] - integer
 *   pence; anything whose `kind` is not `'dividend'` is ignored, so a caller
 *   may pass a year's whole event list.
 * @param {Array<{ id: number, name: string }>} [args.people] - names the
 *   events and orders the per-person split.
 * @param {object} args.table - a `CT_TABLES` entry.
 * @returns {{ events: Array<object>, perPerson: Array<object> } & ReturnType<typeof companyTotals>}
 */
export function buildCompanyYear({ dividendEvents = [], people = [], table }) {
  const nameOf = new Map(people.map((p) => [p.id, p.name]));

  const events = newestFirst(
    dividendEvents
      .filter((e) => e.kind === 'dividend')
      .map((e) => ({
        ...e,
        amountPence: clampPence(e.amountPence),
        personName: nameOf.get(e.personId) ?? null,
      }))
  );

  const byPerson = new Map(people.map((p) => [p.id, 0]));
  let dividendPence = 0;
  for (const e of events) {
    dividendPence += e.amountPence;
    byPerson.set(e.personId, (byPerson.get(e.personId) || 0) + e.amountPence);
  }

  // People in the order given, then any personId the events mention that is
  // not in the list (should not happen — deleting a person cascades to their
  // events — but the total must still add up if it does).
  const perPerson = [...byPerson.entries()].map(([personId, pence]) => ({
    personId,
    name: nameOf.get(personId) ?? null,
    dividendPence: pence,
    share: dividendPence > 0 ? pence / dividendPence : 0,
  }));

  return { events, perPerson, ...companyTotals(dividendPence, table) };
}

/**
 * "If I draw £X more": the company picture before and after.
 *
 * @param {object} args
 * @param {number} args.dividendPence - integer pence drawn so far this year.
 * @param {number} args.extraDividendPence - the proposed draw; junk → 0.
 * @param {object} args.table - a `CT_TABLES` entry.
 * @returns {{ before: object, after: object, extraDividendPence: number,
 *   extraCtPence: number, extraProfitPence: number, rateOnExtraProfit: number,
 *   setAsidePerPound: number, crossesLowerLimit: boolean,
 *   crossesUpperLimit: boolean }}
 *   `rateOnExtraProfit` is blended when the draw straddles a band edge;
 *   `setAsidePerPound` is CT per £1 of THIS draw.
 */
export function previewDraw({ dividendPence, extraDividendPence, table }) {
  const extra = clampPence(extraDividendPence);
  const before = companyTotals(dividendPence, table);
  const after = companyTotals(before.dividendPence + extra, table);
  const extraCtPence = after.ctPence - before.ctPence;
  const extraProfitPence = after.profitPence - before.profitPence;
  return {
    before,
    after,
    extraDividendPence: extra,
    extraCtPence,
    extraProfitPence,
    rateOnExtraProfit: extraProfitPence > 0 ? extraCtPence / extraProfitPence : after.marginalRate,
    setAsidePerPound: extra > 0 ? extraCtPence / extra : after.marginalSetAsidePerPound,
    // A year sitting exactly ON the £50k line already prices its next pound
    // at the marginal rate, so a draw from there crosses too; £250k is the
    // main band from the limit itself.
    crossesLowerLimit:
      before.profitPence <= table.lowerLimitPence && after.profitPence > table.lowerLimitPence,
    crossesUpperLimit:
      before.profitPence < table.upperLimitPence && after.profitPence >= table.upperLimitPence,
  };
}
