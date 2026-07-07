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
} from './repositories.js';
import { settings } from './settings.js';
import { toPence } from '../engine/currency.js';

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
    currentBalancePence,
    safetyBufferPence,
    everydaySpendPence,
    payoffStrategy,
  ] = await Promise.all([
    incomeSourcesRepo.getAll(), // pounds at the edge
    recurringBillsRepo.getAll(), // pounds at the edge
    debtsRepo.getAll(), // pounds at the edge
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
    childcareDeposits: [], // Phase 5 wires real deposits; empty stub for now.
  };
}

export default gatherPlanData;
