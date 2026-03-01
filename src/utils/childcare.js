/**
 * Tax-Free Childcare (TFC) Calculation Utilities
 *
 * Implements the UK government "£8 for every £2" top-up scheme math.
 * Key rule: The government adds 25% of the parent's deposit (up to a quarterly cap).
 * - Standard quarterly cap: £500 (50000 pence) in top-ups per 3-month entitlement period.
 * - Disabled children quarterly cap: £1,000 (100000 pence).
 *
 * All amounts are in integer pence to avoid floating-point errors.
 */

/**
 * Calculate the government top-up for a given deposit amount.
 *
 * The gov pays 25% of the parent's deposit (i.e., "£2 for every £8", since
 * £2 out of a £10 total = 20% of total but 25% of parent's contribution).
 * The top-up is capped by the remaining quarterly capacity.
 *
 * @param {number} depositAmountPence - The parent's deposit amount in pence.
 * @param {number} remainingCapPence - Remaining quarterly top-up capacity in pence.
 * @returns {number} The top-up amount in pence (may be 0 if cap exhausted).
 */
export function calculateTopUp(depositAmountPence, remainingCapPence) {
  if (depositAmountPence <= 0 || remainingCapPence <= 0) return 0;
  const rawTopUp = Math.round(depositAmountPence * 0.25);
  return Math.min(rawTopUp, remainingCapPence);
}

/**
 * Determine the start and end dates of the entitlement period (3-month window)
 * that contains the given targetDate, relative to the account's entitlementStart.
 *
 * TFC entitlement periods are NOT calendar quarters — they roll from the
 * user's personal entitlementStart date in 3-month cycles.
 *
 * @param {string|Date} entitlementStart - The account's entitlement start date (ISO string or Date).
 * @param {string|Date} targetDate - The date to find the period for (ISO string or Date).
 * @returns {{ start: Date, end: Date, periodIndex: number }} The 3-month period boundaries.
 */
export function getEntitlementPeriod(entitlementStart, targetDate) {
  const start = new Date(entitlementStart);
  const target = new Date(targetDate);

  // Calculate how many full months have passed since entitlementStart
  const diffMonths =
    (target.getFullYear() - start.getFullYear()) * 12 +
    (target.getMonth() - start.getMonth());

  // Which 3-month period index does this fall into (0-indexed)
  const periodIndex = Math.floor(diffMonths / 3);

  // Period start: entitlementStart + (periodIndex * 3) months
  const periodStart = new Date(start);
  periodStart.setMonth(start.getMonth() + periodIndex * 3);
  periodStart.setHours(0, 0, 0, 0);

  // Period end: 3 months after period start (exclusive upper bound)
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodStart.getMonth() + 3);
  periodEnd.setHours(0, 0, 0, 0);

  return { start: periodStart, end: periodEnd, periodIndex };
}

/**
 * Calculate the funding gap and suggested user deposit to cover a target monthly spend.
 *
 * The funding gap is how much extra is needed compared to the current account balance.
 * Since every £8 the user deposits gets £2 from the government, the user only needs
 * to deposit 80% of the gap to end up with 100% of the needed funds.
 *
 * @param {number} targetSpendPence - Target monthly childcare spend in pence.
 * @param {number} currentBalancePence - Current account balance in pence.
 * @returns {{ gap: number, suggestedDeposit: number }} gap and suggested deposit (both in pence).
 */
export function calculateFundingGap(targetSpendPence, currentBalancePence) {
  const gap = Math.max(0, targetSpendPence - currentBalancePence);
  // User needs to deposit 80% of gap: gov tops up the other 20% (= 25% of user deposit)
  const suggestedDeposit = Math.round(gap * 0.8);
  return { gap, suggestedDeposit };
}
