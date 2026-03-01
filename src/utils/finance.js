import { addMonths, parseISO, isBefore, format } from 'date-fns';

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
 * @param {string|Date} referenceDate - The date to check against promo period (optional).
 * @param {string} promoEndDate - ISO date string for promo expiration (optional).
 * @returns {number} - The minimum payment in integer pence.
 */
export function calcMinPayment(balancePence, aprPercent, feesPence = 0, referenceDate = null, promoEndDate = null) {
  if (balancePence <= 0) return 0;

  const fivePoundsPence = 500;
  
  let effectiveApr = aprPercent;
  if (referenceDate && promoEndDate) {
    const ref = typeof referenceDate === 'string' ? parseISO(referenceDate) : referenceDate;
    const promo = parseISO(promoEndDate);
    if (isBefore(ref, promo)) {
      effectiveApr = 0;
    }
  }

  // 1% of balance + interest (approximate monthly) + fees
  const monthlyInterest = (balancePence * (effectiveApr / 100)) / 12;
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

/**
 * Simulates a debt payoff strategy over time.
 * 
 * @param {Array} debts - Array of debt objects { id, name, currentBalance, apr, promoEndDate, postPromoApr }
 * @param {string} strategy - 'avalanche', 'snowball', or 'min'
 * @param {number} extraPaymentPence - Monthly extra payment available above minimums
 * @param {string|Date} startDate - When the simulation starts (default today)
 * @returns {Object} - { totalInterest, monthsToClear, resultsByDebt, history }
 */
export function simulatePayoff(debts, strategy, extraPaymentPence = 0, startDate = new Date()) {
  // Clone debts to avoid modifying original objects and initialize tracking
  const currentDebts = debts.map(d => ({ 
    ...d, 
    balance: d.currentBalance, 
    totalInterest: 0, 
    monthsToClear: 0,
    isCleared: d.currentBalance <= 0,
    hadPromoLastMonth: false // Used to detect Rate Jump
  }));

  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;

  let months = 0;
  let totalInterestAccumulated = 0;
  let totalPrincipalPaidAccumulated = 0;
  const maxMonths = 600; // 50 years limit to prevent infinite loops
  const history = [];

  // Calculate the fixed total monthly budget: sum of initial minimums + extraPayment
  const initialMinimumsTotal = currentDebts.reduce((sum, d) => {
    return sum + calcMinPayment(d.balance, d.apr, 0, start, d.promoEndDate);
  }, 0);
  const totalMonthlyBudget = initialMinimumsTotal + extraPaymentPence;

  // Initialize hadPromoLastMonth by checking the month BEFORE start
  currentDebts.forEach(d => {
    d.hadPromoLastMonth = d.promoEndDate && isBefore(addMonths(start, -1), parseISO(d.promoEndDate));
  });

  while (currentDebts.some(d => d.balance > 0) && months < maxMonths) {
    months++;
    const currentMonthDate = addMonths(start, months - 1); // Simulation starts at month 1
    
    const snapshot = {
      month: months,
      date: format(currentMonthDate, 'MMM yyyy'),
      totalInterestCharged: 0,
      totalPrincipalPaid: 0,
      payments: [], // { debtId, amount, interestCharged, principalPaid, isRateJump }
      totalRemainingBalance: 0
    };

    // 1. Calculate effective APRs and sort debts by strategy
    // Tie-breaker: Smallest Balance
    currentDebts.forEach(debt => {
      const isPromoActive = debt.promoEndDate && isBefore(currentMonthDate, parseISO(debt.promoEndDate));
      debt.effectiveApr = isPromoActive ? 0 : (debt.postPromoApr !== undefined ? debt.postPromoApr : debt.apr);
      
      // Detect rate jump (if promo was active last month, but not this month)
      debt.isRateJump = !isPromoActive && debt.hadPromoLastMonth;
      debt.hadPromoLastMonth = isPromoActive;
    });

    if (strategy === 'avalanche') {
      currentDebts.sort((a, b) => b.effectiveApr - a.effectiveApr || a.balance - b.balance);
    } else if (strategy === 'snowball') {
      currentDebts.sort((a, b) => a.balance - b.balance || b.effectiveApr - a.effectiveApr);
    }

    let monthlyAvailable = totalMonthlyBudget;
    const payments = new Map();

    // 2. Pay minimums first to all uncleared debts
    for (const debt of currentDebts) {
      if (debt.balance <= 0) {
        payments.set(debt.id, 0);
        continue;
      }
      const min = calcMinPayment(debt.balance, debt.effectiveApr);
      const payment = Math.min(debt.balance, min);
      payments.set(debt.id, payment);
      monthlyAvailable -= payment;
    }

    // 3. Apply remaining extra funds to priority debt (if any)
    if (strategy !== 'min' && monthlyAvailable > 0) {
      for (const debt of currentDebts) {
        if (debt.balance > payments.get(debt.id)) {
          const extraToThisDebt = Math.min(debt.balance - payments.get(debt.id), monthlyAvailable);
          payments.set(debt.id, (payments.get(debt.id) || 0) + extraToThisDebt);
          monthlyAvailable -= extraToThisDebt;
          if (monthlyAvailable <= 0) break;
        }
      }
    }

    // 4. Update balances and apply interest
    for (const debt of currentDebts) {
      const payment = payments.get(debt.id) || 0;
      const initialBalance = debt.balance;
      
      debt.balance -= payment;
      let interestCharged = 0;
      
      if (debt.balance > 0) {
        interestCharged = Math.round((debt.balance * (debt.effectiveApr / 100)) / 12);
        debt.balance += interestCharged;
        debt.totalInterest += interestCharged;
        totalInterestAccumulated += interestCharged;
      }

      if (debt.balance <= 0) {
        debt.balance = 0;
        if (!debt.isCleared) {
          debt.monthsToClear = months;
          debt.isCleared = true;
        }
      }

      const principalPaid = Math.max(0, initialBalance - debt.balance + interestCharged);
      totalPrincipalPaidAccumulated += principalPaid;

      snapshot.payments.push({
        debtId: debt.id,
        debtName: debt.name,
        amount: payment,
        interestCharged,
        principalPaid,
        isRateJump: debt.isRateJump
      });
      snapshot.totalInterestCharged += interestCharged;
      snapshot.totalPrincipalPaid += principalPaid;
      snapshot.totalRemainingBalance += debt.balance;
    }

    history.push(snapshot);
  }

  return {
    totalInterest: totalInterestAccumulated,
    monthsToClear: months,
    resultsByDebt: currentDebts.map(d => ({
      id: d.id,
      name: d.name,
      totalInterest: d.totalInterest,
      monthsToClear: d.isCleared ? d.monthsToClear : Infinity
    })),
    history
  };
}

/**
 * Models a balance transfer and compares it to the current situation.
 * 
 * @param {Object} debt - The current debt object
 * @param {number} promoMonths - Duration of 0% interest in months
 * @param {number} feePercent - Transfer fee percentage (e.g., 3.0)
 * @returns {Object} - { transferFeePence, recommendedMonthlyPayment, totalCostBT, totalCostCurrent }
 */
export function modelBalanceTransfer(debt, promoMonths, feePercent) {
  const transferFeePence = Math.round(debt.currentBalance * (feePercent / 100));
  const recommendedMonthlyPayment = Math.ceil((debt.currentBalance + transferFeePence) / promoMonths);
  
  const totalCostBT = transferFeePence;
  
  // Simulate current payoff with minimum payments only to get total interest cost
  const currentPayoff = simulatePayoff([debt], 'min', 0);
  const totalCostCurrent = currentPayoff.totalInterest;
  
  return {
    transferFeePence,
    recommendedMonthlyPayment,
    totalCostBT,
    totalCostCurrent
  };
}
