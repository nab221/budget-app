/**
 * Financial utility functions for UK debt and asset tracking.
 */

/**
 * Calculates the estimated minimum monthly payment for a UK credit card.
 * Rule: max(1% balance + interest, 2.25% balance, £5 floor)
 * 
 * @param {number} balancePence - The current balance in integer pence.
 * @param {number} aprPercent - The annual percentage rate (e.g., 19.9).
 * @param {number} feesPence - Any monthly fees in integer pence (default 0).
 * @returns {number} - The minimum payment in integer pence.
 */
export function calcMinPayment(balancePence, aprPercent, feesPence = 0) {
  if (balancePence <= 0) return 0;

  const fivePoundsPence = 500;
  
  // 1% of balance + interest (approximate monthly) + fees
  const monthlyInterest = (balancePence * (aprPercent / 100)) / 12;
  const opt1 = Math.round((balancePence * 0.01) + monthlyInterest + feesPence);
  
  // 2.25% of balance + fees
  const opt2 = Math.round((balancePence * 0.0225) + feesPence);
  
  // Return the maximum of the options, with a £5 floor
  return Math.max(opt1, opt2, fivePoundsPence);
}

/**
 * Calculates credit utilization as a percentage.
 * 
 * @param {number} balancePence - The current balance in integer pence.
 * @param {number} limitPence - The credit limit in integer pence.
 * @returns {number} - The utilization percentage (0-100).
 */
export function calcUtilization(balancePence, limitPence) {
  if (!limitPence || limitPence <= 0) return 0;
  return (balancePence / limitPence) * 100;
}
