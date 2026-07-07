import { formatGBP } from '../../engine/currency.js';

/**
 * Turn a plan's recommendation + projection into the directive copy shown on
 * the dashboard's centrepiece card (spec §4.1). Pure and unit-tested; all money
 * is integer pence.
 *
 * Returns `{ tone, title, detail }`:
 *   tone 'needs-balance' — no balance anchor set yet.
 *   tone 'spare'         — spare money and a target debt to pay it onto.
 *   tone 'debt-free'     — spare money but no debts left.
 *   tone 'no-spare'      — projected to finish at/below the safety buffer.
 *
 * @param {object} plan - output of buildPlan.
 * @returns {{ tone: string, title: string, detail: string }}
 */
export function recommendationCopy(plan) {
  const rec = plan?.recommendation ?? {};

  if (plan?.needsBalance || rec.needsBalance) {
    return {
      tone: 'needs-balance',
      title: 'Set your current balance',
      detail: 'Enter your bank balance above so we can work out how much is safe to pay extra.',
    };
  }

  const safeExtra = plan?.safeExtraPence ?? 0;

  if (safeExtra > 0) {
    if (rec.debtName) {
      return {
        tone: 'spare',
        title: `Safe to pay extra: ${formatGBP(safeExtra)}`,
        detail: `Pay it onto ${rec.debtName}.`,
      };
    }
    return {
      tone: 'debt-free',
      title: `${formatGBP(safeExtra)} of breathing room`,
      detail: 'No debts to pay — nice work. Keep it as a cushion or savings.',
    };
  }

  // No spare money this period.
  const projectedEnd = plan?.projectedEndBalancePence ?? 0;
  const buffer = plan?.safetyBufferPence ?? 0;
  const shortfall = buffer - projectedEnd;
  const detail =
    shortfall > 0
      ? `Projected to end ${formatGBP(shortfall)} below your safety buffer of ${formatGBP(buffer)}.`
      : 'Projected to finish right at your safety buffer, with nothing to spare.';
  return {
    tone: 'no-spare',
    title: 'No spare money this period',
    detail,
  };
}

export default recommendationCopy;
