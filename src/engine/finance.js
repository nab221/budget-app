import { addMonths, parseISO, isBefore, format, startOfMonth, setDate, getDaysInMonth } from 'date-fns';
import { adjustedPaymentDate } from './banking-calendar.js';

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
 * Order debts by a payoff strategy at a single reference date.
 *
 * This is the ordering half of `simulatePayoff` extracted for reuse (the
 * dashboard recommendation needs "which debt gets the extra money" without
 * running a full simulation). It mirrors `simulatePayoff`'s per-month sort:
 *   - avalanche: highest effective APR first, tie-break smallest balance
 *   - snowball:  smallest balance first, tie-break highest effective APR
 * A debt inside its 0% promo window has an effective APR of 0; after the promo
 * the `postPromoApr` (falling back to `apr`) applies.
 *
 * All monetary values are integer **pence**. Accepts either `currentBalance`
 * (the finance-module convention) or `balance` on each debt.
 *
 * @param {Array<{ id, name, currentBalance?, balance?, apr, promoEndDate?, postPromoApr? }>} debts
 * @param {'avalanche'|'snowball'} strategy
 * @param {string|Date} [referenceDate=new Date()]
 * @returns {Array} debts sorted by priority (highest priority first), each
 *   annotated with a computed `effectiveApr`.
 */
export function orderDebtsByStrategy(debts, strategy, referenceDate = new Date()) {
  const ref = typeof referenceDate === 'string' ? parseISO(referenceDate) : referenceDate;
  const annotated = (debts || []).map((d) => {
    const balance = d.balance ?? d.currentBalance ?? 0;
    const isPromoActive = d.promoEndDate && isBefore(ref, parseISO(d.promoEndDate));
    const effectiveApr = isPromoActive
      ? 0
      : (d.postPromoApr !== undefined && d.postPromoApr !== null ? d.postPromoApr : d.apr);
    return { ...d, balance, effectiveApr };
  });

  if (strategy === 'snowball') {
    annotated.sort((a, b) => a.balance - b.balance || b.effectiveApr - a.effectiveApr);
  } else {
    // avalanche (default)
    annotated.sort((a, b) => b.effectiveApr - a.effectiveApr || a.balance - b.balance);
  }
  return annotated;
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
      // Treat null the same as undefined: a blank post-promo APR falls back to
      // the card's standard APR. (`?? debt.apr` on a null postPromoApr would
      // otherwise leave effectiveApr null → null/100 → 0% interest — the bug.)
      debt.effectiveApr = isPromoActive
        ? 0
        : (debt.postPromoApr != null ? debt.postPromoApr : debt.apr);
      
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
        remainingBalance: debt.balance,
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
 * Returns true if the recurrent item has an occurrence falling within targetMonthStr.
 * Advances from item.nextDate by frequency steps to check if any cycle lands in the target month.
 *
 * Guards:
 * - Finished cycles (cycleCurrent >= cycleTotal) return false
 * - Items with no date return false
 * - Unknown frequencies default to monthly (1-step advance)
 *
 * @param {Object} item - Recurrent expense with nextDate (YYYY-MM-DD) and frequency
 * @param {string} targetMonthStr - YYYY-MM
 * @returns {boolean}
 */
function recurrentFallsInMonth(item, targetMonthStr) {
  if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;
  const nextDate = item.nextDate || item.date;
  if (!nextDate) return false;
  const itemMonthStr = nextDate.slice(0, 7); // YYYY-MM
  if (itemMonthStr === targetMonthStr) return true;
  if (itemMonthStr > targetMonthStr) return false;

  const freq = item.frequency || 'monthly';
  const stepMonths = freq === 'quarterly' ? 3 : freq === 'annual' ? 12 : 1;
  let cursor = parseISO(`${itemMonthStr}-01`);
  const target = parseISO(`${targetMonthStr}-01`);

  while (isBefore(cursor, target)) {
    cursor = addMonths(cursor, stepMonths);
  }
  return format(cursor, 'yyyy-MM') === targetMonthStr;
}

/**
 * Calculates the rolling monthly balance chain from a start date.
 *
 * Algorithm per month:
 *   openingBalance = previous month's closingBalance (or 0 for the first month)
 *   incomeTotal    = sum of all income records dated in that month
 *   expenseTotal   = sum of recurrent (by nextDate) + one-off (by date) expenses in that month
 *   closingBalance = openingBalance + incomeTotal - expenseTotal
 *
 * The "Opening Balance" income category (group = 'system') is treated as the
 * initial account balance for the very first month: if such a record exists in
 * the income table for the startDate month it seeds openingBalance for that
 * month (and is excluded from incomeTotal so it isn't double-counted).
 *
 * Snapshots are saved (upserted) via balanceSnapshotRepository after each month.
 *
 * The opening balance is supplied by the caller via `deps.getInitialOpeningBalance`
 * (defaulting to 0). There is no localStorage fallback — callers pass the anchor
 * balance in explicitly (spec §6).
 *
 * @param {string} startDate - YYYY-MM-DD or YYYY-MM string for the first month.
 * @param {number} [horizonMonths=3] - How many months beyond the current calendar month to project.
 * @param {Object} [deps] - Data accessors (injected by the repository layer or tests).
 *   @param {Function} deps.getIncome          - (monthStr) => Promise<Array<{amount,categoryId}>>
 *   @param {Function} deps.getRecurrent       - (monthStr) => Promise<Array<{amount}>>
 *   @param {Function} deps.getOneOff          - (monthStr) => Promise<Array<{amount}>>
 *   @param {Function} deps.getOpeningBalCatId - () => Promise<number|null>
 *   @param {Function} deps.getInitialOpeningBalance - () => Promise<number> (opening balance in pence; default 0)
 *   @param {Function} deps.saveSnapshot       - (snapshot) => Promise<number>
 * @param {Date} [now=new Date()] - Injectable "today" for deterministic projection flags.
 * @returns {Promise<Array<{month, openingBalance, incomeTotal, expenseTotal, closingBalance}>>}
 */
export async function calculateBalanceChain(startDate, horizonMonths = 3, deps = {}, now = new Date()) {
  const {
    getIncome = async () => [],
    getRecurrent = async () => [],
    getOneOff = async () => [],
    getOpeningBalCatId = async () => null,
    getInitialOpeningBalance = async () => 0,
    saveSnapshot = async () => {},
  } = deps || {};

  // Resolve month string from a YYYY-MM-DD or YYYY-MM input
  const startMonthStr = String(startDate).slice(0, 7); // "YYYY-MM"

  // Determine the final month to compute (current calendar month + horizon)
  const today = now;
  const currentMonthStr = format(today, 'yyyy-MM');
  const endDate = addMonths(startOfMonth(today), horizonMonths);
  const endMonthStr = format(endDate, 'yyyy-MM');

  // Build ordered list of months to process
  const months = [];
  let cursor = parseISO(`${startMonthStr}-01`);
  const endISO = parseISO(`${endMonthStr}-01`);
  while (!isBefore(endISO, cursor)) {
    months.push(format(cursor, 'yyyy-MM'));
    cursor = addMonths(cursor, 1);
  }

  // Fetch the "Opening Balance" category id and initial injection once
  const [openingBalCatId, initialInjection] = await Promise.all([
    getOpeningBalCatId(),
    getInitialOpeningBalance()
  ]);

  const snapshots = [];
  let runningOpeningBalance = initialInjection;

  for (const monthStr of months) {
    const incomeRecords = await getIncome(monthStr);

    // Separate "Opening Balance" system entries from regular income
    let openingBalanceEntry = 0;
    const regularIncome = [];
    for (const record of incomeRecords) {
      if (openingBalCatId !== null && record.categoryId === openingBalCatId) {
        openingBalanceEntry += record.amount || 0;
      } else {
        regularIncome.push(record);
      }
    }

    // For the very first month, seed the opening balance from the special category entry
    const openingBalance =
      monthStr === startMonthStr ? openingBalanceEntry + runningOpeningBalance : runningOpeningBalance;

    const incomeTotal = regularIncome.reduce((sum, r) => sum + (r.amount || 0), 0);

    const [recurrentRecords, oneOffRecords] = await Promise.all([
      getRecurrent(monthStr),
      getOneOff(monthStr)
    ]);

    const expenseTotal =
      recurrentRecords.reduce((sum, r) => sum + (r.amount || 0), 0) +
      oneOffRecords.reduce((sum, r) => sum + (r.amount || 0), 0);

    const closingBalance = openingBalance + incomeTotal - expenseTotal;

    const snapshot = {
      month: monthStr,
      openingBalance,
      incomeTotal,
      expenseTotal,
      closingBalance,
      isProjection: monthStr > currentMonthStr
    };

    await saveSnapshot(snapshot);
    snapshots.push(snapshot);

    // Carry the closing balance forward as the opening balance for the next month
    runningOpeningBalance = closingBalance;
  }

  return snapshots;
}

/**
 * Simulates a loan or mortgage payoff with overpayments.
 * Supports term-reduction (payment stays same, term shortens) 
 * and payment-reduction (term stays same, payment drops).
 * 
 * @param {Array} debts - Array of loan/mortgage objects
 * @param {string} strategy - 'term-reduction' or 'payment-reduction'
 * @param {number} extraMonthlyPence - Total extra payment available for all loans
 * @returns {Object} - { totalInterest, monthsToClear, resultsByDebt, history }
 */
export function simulateLoanPayoff(debts, strategy, extraMonthlyPence = 0, startDate = new Date()) {
  const currentDebts = debts.map(d => ({
    ...d,
    balance: d.currentBalance,
    payment: d.fixedMonthlyPayment || 0,
    totalInterest: 0,
    totalFees: 0,
    monthsToClear: 0,
    isCleared: d.currentBalance <= 0,
    annualOverpaymentTotal: 0, // Reset every 12 months for ERC allowance
    monthsSinceAllowanceReset: 0
  }));

  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  let months = 0;
  let totalInterestAccumulated = 0;
  let totalFeesAccumulated = 0;
  const maxMonths = 600;
  const history = [];

  while (currentDebts.some(d => d.balance > 0) && months < maxMonths) {
    months++;
    const currentMonthDate = addMonths(start, months - 1);
    
    const snapshot = {
      month: months,
      date: format(currentMonthDate, 'MMM yyyy'),
      totalInterestCharged: 0,
      totalFeesCharged: 0,
      totalPrincipalPaid: 0,
      payments: [],
      totalRemainingBalance: 0
    };

    // Distribute extra payment across active loans (highest rate first)
    currentDebts.sort((a, b) => (b.interestRate || 0) - (a.interestRate || 0));
    let monthlyAvailableExtra = extraMonthlyPence;

    for (const debt of currentDebts) {
      if (debt.balance <= 0) continue;

      const initialBalance = debt.balance;

      // 1. Reset ERC allowance every 12 months (simplified to simulation start anniversary)
      if (debt.monthsSinceAllowanceReset >= 12) {
        debt.annualOverpaymentTotal = 0;
        debt.monthsSinceAllowanceReset = 0;
      }
      debt.monthsSinceAllowanceReset++;

      // 2. Standard monthly interest
      const interestCharged = Math.round((debt.balance * ((debt.interestRate || 0) / 100)) / 12);
      
      // 3. Base scheduled payment
      // Interest-only loans pay only the interest unless overpaying
      let scheduledPayment = debt.isInterestOnly 
        ? Math.min(debt.balance + interestCharged, interestCharged)
        : Math.min(debt.balance + interestCharged, debt.payment);
      
      // 4. Extra payment (overpayment)
      let overpayment = 0;
      if (debt.earlyRepaymentAllowed && monthlyAvailableExtra > 0) {
        overpayment = Math.min(debt.balance + interestCharged - scheduledPayment, monthlyAvailableExtra);
        monthlyAvailableExtra -= overpayment;
      }

      // 5. Calculate ERC if overpayment exceeds 10% annual allowance (standard UK rule)
      let fee = 0;
      if (overpayment > 0 && debt.earlyRepaymentFee > 0) {
        const allowance = Math.round(debt.originalPrincipal * 0.1);
        const remainingAllowance = Math.max(0, allowance - debt.annualOverpaymentTotal);
        
        if (overpayment > remainingAllowance) {
          const taxableAmount = overpayment - remainingAllowance;
          if (debt.earlyRepaymentFeeIsPercent) {
            fee = Math.round(taxableAmount * (debt.earlyRepaymentFee / 100));
          } else {
            // Flat fee per overpayment (rare but supported)
            fee = debt.earlyRepaymentFee;
          }
        }
        debt.annualOverpaymentTotal += overpayment;
      }

      const totalPaid = scheduledPayment + overpayment;
      // ERC Fee reduces the effective principal reduction by increasing the balance
      debt.balance = Math.max(0, debt.balance + interestCharged + fee - totalPaid);
      const principalPaid = initialBalance - debt.balance;
      
      debt.totalInterest += interestCharged;
      debt.totalFees += fee;
      
      totalInterestAccumulated += interestCharged;
      totalFeesAccumulated += fee;

      // 6. Strategy: Payment Reduction (recalculate payment for next month)
      if (strategy === 'payment-reduction' && debt.balance > 0 && overpayment > 0) {
        // Find remaining term in months
        const remainingMonths = (debt.termMonths || 300) - months;
        if (remainingMonths > 0) {
          const r = (debt.interestRate || 0) / 100 / 12;
          if (r > 0) {
            debt.payment = Math.round(debt.balance * (r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1));
          } else {
            debt.payment = Math.round(debt.balance / remainingMonths);
          }
        }
      }

      if (debt.balance <= 0 && !debt.isCleared) {
        debt.monthsToClear = months;
        debt.isCleared = true;
      }

      snapshot.payments.push({
        debtId: debt.id,
        debtName: debt.name,
        amount: totalPaid,
        interestCharged,
        feeCharged: fee,
        principalPaid,
        remainingBalance: debt.balance
      });
      snapshot.totalInterestCharged += interestCharged;
      snapshot.totalFeesCharged += fee;
      snapshot.totalPrincipalPaid += principalPaid;
      snapshot.totalRemainingBalance += debt.balance;
    }

    history.push(snapshot);
  }

  return {
    totalInterest: totalInterestAccumulated,
    totalFees: totalFeesAccumulated,
    monthsToClear: months,
    resultsByDebt: currentDebts.map(d => ({
      id: d.id,
      name: d.name,
      totalInterest: d.totalInterest,
      totalFees: d.totalFees,
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

/**
 * Calculates a month-by-month amortisation schedule for a loan or mortgage.
 *
 * All monetary values are integer pence throughout.
 * The annualInterestRate must be passed as a decimal (e.g. 0.049 for 4.9%).
 *
 * @param {object} params
 * @param {number} params.outstandingBalance   - integer pence (> 0)
 * @param {number} params.annualInterestRate   - decimal, e.g. 0.049 for 4.9%
 * @param {number} params.monthlyPayment       - integer pence
 * @param {number} [params.paymentDayOfMonth]  - int 1-28, defaults to 1
 * @param {string} [params.paymentAdjustment]  - 'none' | 'next-working-day', defaults to 'none'
 * @param {Date|string} [params.startDate]     - ISO date or Date, defaults to today
 * @returns {{
 *   schedule: Array<{
 *     month: number,
 *     interestPence: number,
 *     principalPence: number,
 *     balancePence: number,
 *     paymentDate: string   // ISO YYYY-MM-DD
 *   }>,
 *   projectedPayoffDate: string,    // 'MMM yyyy' format
 *   remainingTermMonths: number,
 *   totalInterestRemaining: number  // integer pence
 * }}
 */
export function calculateAmortisationSchedule({
  outstandingBalance,
  annualInterestRate,
  monthlyPayment,
  paymentDayOfMonth = 1,
  paymentAdjustment = 'none',
  startDate = new Date()
}) {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const maxMonths = 600;

  // Guard: payment must cover first month's interest
  const firstMonthInterest = Math.round(outstandingBalance * annualInterestRate / 12);
  if (firstMonthInterest >= monthlyPayment) {
    throw new Error('Monthly payment does not cover interest — loan will never be repaid');
  }

  const schedule = [];
  let balance = outstandingBalance;
  let month = 0;

  while (balance > 0) {
    month++;

    if (month > maxMonths) {
      throw new Error('Loan term exceeds 50 years — check parameters');
    }

    const interestPence = Math.round(balance * annualInterestRate / 12);

    // On the final month, payment may be less than full monthlyPayment
    const actualPayment = Math.min(monthlyPayment, balance + interestPence);
    const principalPence = actualPayment - interestPence;
    const newBalance = balance - principalPence;

    // Clamp to 0 to avoid floating-point creep
    const balancePence = newBalance <= 0 ? 0 : newBalance;

    // Compute nominal payment date: start + month months, day-of-month clamped to month length
    const targetMonthDate = addMonths(start, month);
    const clampedPaymentDay = Math.min(Math.max(paymentDayOfMonth, 1), getDaysInMonth(targetMonthDate));
    const nominalDate = setDate(targetMonthDate, clampedPaymentDay);

    // Apply payment adjustment if requested
    const adjustedDate =
      paymentAdjustment === 'next-working-day'
        ? adjustedPaymentDate(nominalDate, 'next-working-day')
        : nominalDate;

    const paymentDate = format(adjustedDate, 'yyyy-MM-dd');

    schedule.push({ month, interestPence, principalPence, balancePence, paymentDate });

    balance = balancePence;
  }

  const totalInterestRemaining = schedule.reduce((sum, e) => sum + e.interestPence, 0);
  const remainingTermMonths = schedule.length;
  const lastEntry = schedule[schedule.length - 1];
  const projectedPayoffDate = format(parseISO(lastEntry.paymentDate), 'MMM yyyy');

  return {
    schedule,
    projectedPayoffDate,
    remainingTermMonths,
    totalInterestRemaining
  };
}
