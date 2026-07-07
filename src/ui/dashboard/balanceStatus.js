import { differenceInCalendarDays, parseISO } from 'date-fns';

/** Balance is "stale" (worth a nudge) when it was last set more than 7 days ago. */
export const STALE_BALANCE_DAYS = 7;

/**
 * How many whole days ago the balance was last updated, or null if never/unparseable.
 * @param {string|null} balanceAsOf - ISO date string.
 * @param {Date} [now=new Date()]
 * @returns {number|null}
 */
export function balanceAgeDays(balanceAsOf, now = new Date()) {
  if (!balanceAsOf) return null;
  let asOf;
  try {
    asOf = parseISO(balanceAsOf);
  } catch {
    return null;
  }
  if (Number.isNaN(asOf.getTime())) return null;
  return differenceInCalendarDays(now, asOf);
}

/**
 * Whether to show the stale-balance hint.
 * @param {string|null} balanceAsOf
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
export function isBalanceStale(balanceAsOf, now = new Date()) {
  const age = balanceAgeDays(balanceAsOf, now);
  return age != null && age > STALE_BALANCE_DAYS;
}

export default isBalanceStale;
