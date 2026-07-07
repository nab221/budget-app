/**
 * planData.js — thin adapter that gathers the live inputs `plan.js` needs and
 * converts them from the repository POUNDS edge into the PENCE domain the pure
 * engine works in.
 *
 * This is the ONLY place pounds→pence conversion happens for the pay-period
 * plan; `plan.js` itself never sees pounds. Every conversion site is commented.
 */

import {
  incomeSourcesRepo,
  recurringBillsRepo,
  debtsRepo,
  childrenRepo,
} from './repositories.js';
import { settings } from './settings.js';
import { toPence } from '../engine/currency.js';
import { computeRequiredDeposit } from '../engine/childcare.js';

/**
 * Build the pence-domain `childcareDeposits` entries the plan engine expects
 * (one committed monthly deposit per child whose required deposit > 0). The
 * required deposit is COMPUTED at read time from the persisted child record
 * (provider cost + TFC balance + disabled flag) — never stored. Placed monthly
 * on the child's `paymentDayOfMonth` (default 1), working-day adjusted.
 *
 * @param {Array} childrenRaw - children as returned by the repo (pounds at edge).
 * @returns {Array<{label:string, amountPence:number, paymentDayOfMonth:number, adjustToWorkingDay:boolean}>}
 */
export function childcareDepositsFromChildren(childrenRaw) {
  const deposits = [];
  for (const c of childrenRaw || []) {
    const { depositPence } = computeRequiredDeposit({
      providerCostPence: toPence(c.providerMonthlyCostPence), // pounds → pence
      balancePence: toPence(c.tfcBalancePence), // pounds → pence
      isDisabled: !!c.isDisabled,
    });
    if (depositPence <= 0) continue;
    const day = Math.min(Math.max(Number(c.paymentDayOfMonth) || 1, 1), 28);
    deposits.push({
      label: `Childcare — ${c.name}`,
      amountPence: depositPence,
      paymentDayOfMonth: day,
      adjustToWorkingDay: true,
    });
  }
  return deposits;
}

/**
 * Read everything the plan engine needs and return a pence-domain snapshot.
 *
 * @param {Date} [now=new Date()]
 * @returns {Promise<object>} data object accepted by `buildPlan`.
 */
export async function gatherPlanData(now = new Date()) {
  const [
    incomeSourcesRaw,
    billsRaw,
    debtsRaw,
    childrenRaw,
    currentBalancePence,
    safetyBufferPence,
    everydaySpendPence,
    payoffStrategy,
  ] = await Promise.all([
    incomeSourcesRepo.getAll(), // pounds at the edge
    recurringBillsRepo.getAll(), // pounds at the edge
    debtsRepo.getAll(), // pounds at the edge
    childrenRepo.getAll(), // pounds at the edge
    // settings values are stored raw in pence (nullable balance) — no conversion.
    settings.getCurrentBalancePence(),
    settings.getSafetyBufferPence(),
    settings.getEverydaySpendPence(),
    settings.getPayoffStrategy(),
  ]);

  // pounds → pence at this single boundary for each money field.
  const incomeSources = incomeSourcesRaw.map((s) => ({
    id: s.id,
    name: s.name,
    amountPence: toPence(s.amountPence), // pounds → pence
    payDateRule: s.payDateRule,
    payDateDay: s.payDateDay,
    active: s.active,
  }));

  const recurringBills = billsRaw.map((b) => ({
    id: b.id,
    label: b.label,
    amountPence: toPence(b.amountPence), // pounds → pence
    categoryId: b.categoryId,
    frequency: b.frequency,
    nextDueDate: b.nextDueDate,
    adjustToWorkingDay: b.adjustToWorkingDay,
    endDate: b.endDate,
    active: b.active,
  }));

  const debts = debtsRaw.map((d) => ({
    id: d.id,
    name: d.name,
    debtType: d.debtType,
    balancePence: toPence(d.balancePence), // pounds → pence
    balanceAsOf: d.balanceAsOf,
    apr: d.apr,
    creditLimitPence: d.creditLimitPence == null ? null : toPence(d.creditLimitPence), // pounds → pence
    promoEndDate: d.promoEndDate,
    postPromoApr: d.postPromoApr,
    minPaymentOverridePence:
      d.minPaymentOverridePence == null ? null : toPence(d.minPaymentOverridePence), // pounds → pence
    interestRate: d.interestRate,
    fixedMonthlyPaymentPence:
      d.fixedMonthlyPaymentPence == null ? 0 : toPence(d.fixedMonthlyPaymentPence), // pounds → pence
    paymentDayOfMonth: d.paymentDayOfMonth,
  }));

  return {
    now,
    incomeSources,
    recurringBills,
    debts,
    settings: {
      currentBalancePence, // already pence (or null)
      safetyBufferPence, // already pence
      everydaySpendPence, // already pence
      payoffStrategy,
    },
    // One committed deposit per child with a required deposit > 0 (computed at
    // read time from the child record — never persisted).
    childcareDeposits: childcareDepositsFromChildren(childrenRaw),
  };
}

export default gatherPlanData;
