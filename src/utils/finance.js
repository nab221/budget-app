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

/**
 * Simulates a debt payoff strategy over time.
 * 
 * @param {Array} debts - Array of debt objects { id, name, currentBalance, apr }
 * @param {string} strategy - 'avalanche', 'snowball', or 'min'
 * @param {number} extraPaymentPence - Monthly extra payment available above minimums
 * @returns {Object} - { totalInterest, monthsToClear, resultsByDebt }
 */
export function simulatePayoff(debts, strategy, extraPaymentPence = 0) {
  // Clone debts to avoid modifying original objects and initialize tracking
  const currentDebts = debts.map(d => ({ 
    ...d, 
    balance: d.currentBalance, 
    totalInterest: 0, 
    monthsToClear: 0,
    isCleared: d.currentBalance <= 0
  }));

  let months = 0;
  let totalInterestAccumulated = 0;
  const maxMonths = 600; // 50 years limit to prevent infinite loops

  // Calculate the fixed total monthly budget: sum of initial minimums + extraPayment
  const initialMinimums = currentDebts.map(d => calcMinPayment(d.balance, d.apr));
  const totalMonthlyBudget = initialMinimums.reduce((a, b) => a + b, 0) + extraPaymentPence;

  while (currentDebts.some(d => d.balance > 0) && months < maxMonths) {
    months++;

    // 1. Sort debts by strategy for extra payment priority
    if (strategy === 'avalanche') {
      currentDebts.sort((a, b) => b.apr - a.apr || b.balance - a.balance);
    } else if (strategy === 'snowball') {
      currentDebts.sort((a, b) => a.balance - b.balance || b.apr - a.apr);
    }

    let monthlyAvailable = totalMonthlyBudget;
    const payments = new Map();

    // 2. Pay minimums first to all uncleared debts
    // (If the debt's balance is lower than the minimum, pay only the balance)
    for (const debt of currentDebts) {
      if (debt.balance <= 0) {
        payments.set(debt.id, 0);
        continue;
      }
      const min = calcMinPayment(debt.balance, debt.apr);
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
      if (debt.balance <= 0) continue;

      const payment = payments.get(debt.id) || 0;
      debt.balance -= payment;
      
      if (debt.balance > 0) {
        // Apply monthly interest
        const monthlyInterest = Math.round((debt.balance * (debt.apr / 100)) / 12);
        debt.balance += monthlyInterest;
        debt.totalInterest += monthlyInterest;
        totalInterestAccumulated += monthlyInterest;
      }

      if (debt.balance <= 0) {
        debt.balance = 0;
        if (!debt.isCleared) {
          debt.monthsToClear = months;
          debt.isCleared = true;
        }
      }
    }
  }

  return {
    totalInterest: totalInterestAccumulated,
    monthsToClear: months,
    resultsByDebt: currentDebts.map(d => ({
      id: d.id,
      name: d.name,
      totalInterest: d.totalInterest,
      monthsToClear: d.isCleared ? d.monthsToClear : Infinity
    }))
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
