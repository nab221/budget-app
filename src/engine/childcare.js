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
 * TFC government top-up quarterly caps (in pence). The government adds at most
 * £500 of top-up per 3-month entitlement period per child (£1,000 for a child
 * who qualifies for the disabled rate).
 */
export const TFC_QUARTERLY_CAP_PENCE = 50000; // £500
export const TFC_QUARTERLY_CAP_DISABLED_PENCE = 100000; // £1,000

/**
 * Compute the required monthly parent deposit so that
 *   deposit + 25%-government-top-up  covers the provider cost, after first
 * spending down the current Tax-Free Childcare account balance.
 *
 * This is the pure math behind the Childcare tab's per-child card (spec §4.5).
 * Everything is integer **pence**; nothing is persisted (computed at read time).
 *
 * ── Semantics ──────────────────────────────────────────────────────────────
 * gap        = max(0, providerCost − balance)          (what still needs funding)
 * Uncapped, every £4 the parent deposits attracts £1 of government top-up, so
 * the parent only needs to fund 80% of the gap: deposit = gap × 0.8, top-up =
 * gap × 0.2, and deposit + top-up === gap.
 *
 * ── Cap semantics (steady-state MONTHLY figure) ────────────────────────────
 * The government cap is a QUARTERLY limit (£500, or £1,000 disabled) but this
 * function returns a single steady-state MONTHLY deposit. Spreading the quarter
 * evenly, the most top-up a single month can attract is `floor(cap / 3)` —
 * £166.66 standard, £333.33 disabled. Applying the full quarterly cap per month
 * would triple-count the allowance and understate the deposit (the original
 * bug). The optional `quarterlyTopUpUsedPence` still narrows the remaining
 * quarterly capacity (kept for future per-quarter accounting); the binding cap
 * for the month is the smaller of that remaining quarterly capacity and the
 * even monthly share.
 *
 * When that cap binds, the government contributes only `remainingCap`; the
 * parent funds the rest of the gap pound-for-pound, so `deposit = gap − topUp`
 * still holds. The most the top-up can add is `remainingCap` (reached when the
 * parent deposits `remainingCap × 4`), together covering `remainingCap × 5` of
 * the gap — anything beyond that is the `uncoveredByTopUp` remainder surfaced
 * plainly to the user.
 *
 * @param {object} args
 * @param {number} args.providerCostPence      - monthly provider cost (pence).
 * @param {number} args.balancePence           - current TFC account balance (pence).
 * @param {boolean} [args.isDisabled=false]    - child qualifies for the disabled cap.
 * @param {number} [args.quarterlyTopUpUsedPence=0] - top-up already claimed this quarter.
 * @returns {{ gapPence:number, depositPence:number, topUpPence:number,
 *   capBound:boolean, uncoveredByTopUpPence:number, remainingCapPence:number,
 *   monthlyCapPence:number }}
 */
export function computeRequiredDeposit({
  providerCostPence,
  balancePence,
  isDisabled = false,
  quarterlyTopUpUsedPence = 0,
} = {}) {
  const capForChild = isDisabled ? TFC_QUARTERLY_CAP_DISABLED_PENCE : TFC_QUARTERLY_CAP_PENCE;
  // Even monthly share of the quarterly cap — the true per-month top-up ceiling.
  const monthlyCapPence = Math.floor(capForChild / 3);
  const remainingQuarterlyCap = Math.max(0, capForChild - Math.max(0, quarterlyTopUpUsedPence || 0));
  // The month can never attract more than its even share, nor more than what is
  // left in the quarter.
  const remainingCap = Math.min(monthlyCapPence, remainingQuarterlyCap);

  const { gap, suggestedDeposit } = calculateFundingGap(
    Math.max(0, providerCostPence || 0),
    Math.max(0, balancePence || 0)
  );
  // Ideal top-up to cover the whole gap: gap − 80%-deposit == 20% of the gap.
  const uncappedTopUp = gap - suggestedDeposit;

  const topUpPence = Math.min(uncappedTopUp, remainingCap);
  const depositPence = gap - topUpPence;

  const uncoveredByTopUpPence = Math.max(0, gap - remainingCap * 5);

  return {
    gapPence: gap,
    depositPence,
    topUpPence,
    capBound: uncoveredByTopUpPence > 0,
    uncoveredByTopUpPence,
    remainingCapPence: remainingCap,
    monthlyCapPence,
  };
}

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
 * Compute the monthly-equivalent amount for a single childcare provider.
 *
 * Providers can be configured as monthly (fixed monthly cost) or termly
 * (a one-off termly cost that is divided across 3 months).
 *
 * @param {Object} provider - Provider record.
 * @param {string} provider.frequency - 'monthly' or 'termly'.
 * @param {number} [provider.monthlyEquivalentPence] - Used when frequency='monthly'.
 * @param {number} [provider.termlyAmountPence] - Used when frequency='termly'.
 * @returns {number} Monthly-equivalent cost in pence (integer, floored).
 */
export function monthlyEquivalentFromProvider(provider) {
  if (!provider) return 0;
  if (provider.frequency === 'termly') {
    return Math.floor((provider.termlyAmountPence || 0) / 3);
  }
  // Default: monthly
  return provider.monthlyEquivalentPence || 0;
}

/**
 * Calculate the required childcare top-up for a single account this period.
 *
 * Formula: max(0, providerMonthlyEquivalentTotal - currentBalancePence - pendingGovernmentBonusPence)
 *
 * The result is floored at zero — the required top-up is never negative.
 *
 * @param {number} providerMonthlyEquivalentTotalPence - Sum of monthly-equivalent costs across all providers.
 * @param {number} currentBalancePence - Current TFC account balance in pence.
 * @param {number} pendingGovernmentBonusPence - Pending government bonus (not yet credited) in pence.
 * @returns {number} Required top-up amount in pence.
 */
export function calculateRequiredTopUp(providerMonthlyEquivalentTotalPence, currentBalancePence, pendingGovernmentBonusPence) {
  const needed = providerMonthlyEquivalentTotalPence - currentBalancePence - (pendingGovernmentBonusPence || 0);
  return Math.max(0, needed);
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
