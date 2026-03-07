import { 
  bankHolidayRepository, 
  incomeRepository, 
  recurrentExpenseRepository, 
  oneOffExpenseRepository, 
  expectedIncomeRepository,
  balanceSnapshotRepository,
  dailyBalanceRepository
} from '../db/repository.js';
import { db } from '../db/schema.js';
import { calcMinPayment } from './finance.js';

const GOV_UK_HOLIDAYS_API = 'https://www.gov.uk/bank-holidays.json';
const CACHE_KEY = 'bank-holidays-cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch UK Bank Holidays from gov.uk API and cache them in localStorage.
 * Only fetches if cache is missing, expired, or forced.
 * @param {boolean} force - If true, ignore cache and fetch fresh data.
 * @returns {Promise<string[]>} List of ISO date strings (YYYY-MM-DD).
 */
export async function fetchHolidays(force = false) {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached && !force) {
    try {
      const { timestamp, dates } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return dates;
      }
    } catch (err) {
      console.warn('[cashflow] Failed to parse bank holiday cache:', err);
    }
  }

  try {
    const response = await fetch(GOV_UK_HOLIDAYS_API);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

    const data = await response.json();
    const dates = data['england-and-wales'].events.map(e => e.date);

    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      dates
    }));

    return dates;
  } catch (err) {
    console.error('[cashflow] Failed to fetch UK bank holidays:', err);

    // Fallback: use expired cache if available
    if (cached) {
      try {
        return JSON.parse(cached).dates;
      } catch (parseErr) {
        return [];
      }
    }
    return [];
  }
}

/**
 * Check if a specific date is a UK bank holiday.
 * Respects manual overrides in the database.
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
export async function isBankHoliday(dateStr) {
  // 1. Check user overrides first
  const override = await bankHolidayRepository.isOverrideActive(dateStr);
  if (override !== null) {
    // If override is present, it explicitly defines if the date is "isOpen" (working day).
    // So if isOpen is true, it is NOT a bank holiday (from our engine's perspective).
    // If isOpen is false, it IS a holiday.
    return !override;
  }

  // 2. Check cached holidays
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return false;

  try {
    const { dates } = JSON.parse(cached);
    return dates.includes(dateStr);
  } catch (err) {
    return false;
  }
}

/**
 * Check if a date is a working day (Mon-Fri and not a bank holiday).
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
export async function isWorkingDay(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0 = Sun, 6 = Sat

  // Weekend
  if (day === 0 || day === 6) {
    // Check if user has explicitly marked this weekend as a working day
    const override = await bankHolidayRepository.isOverrideActive(dateStr);
    return override === true;
  }

  // Weekday - check for bank holiday
  return !(await isBankHoliday(dateStr));
}

/**
 * Find the next working day after (or including) a given date.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {boolean} includeToday - If true, check if today is a working day first.
 * @returns {Promise<string>} YYYY-MM-DD
 */
export async function nextWorkingDay(dateStr, includeToday = false) {
  let current = new Date(`${dateStr}T00:00:00Z`);
  if (!includeToday) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  while (!(await isWorkingDay(current.toISOString().split('T')[0]))) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return current.toISOString().split('T')[0];
}

/**
 * Calculate the daily balance forecast for a set number of days.
 * @param {string} startDate - YYYY-MM-DD
 * @param {number} horizonDays - Number of days to forecast (default 45)
 * @returns {Promise<Array>} List of daily snapshots
 */
export async function calculateForecast(startDate, horizonDays = 45) {
  // Use UTC to avoid timezone shifts during day increments
  let currentDay = new Date(`${startDate}T00:00:00Z`);

  // 1. Fetch all relevant data for the horizon
  const [
    incomeList,
    recurrentList,
    oneOffList,
    expectedIncomeList
  ] = await Promise.all([
    incomeRepository.getAll(),
    recurrentExpenseRepository.getAll(),
    oneOffExpenseRepository.getAll(),
    expectedIncomeRepository.getAll()
  ]);

  // 2. Determine initial opening balance
  let currentBalance = await _resolveOpeningBalance(startDate);

  const snapshots = [];

  // Pre-calculate effective dates for recurrent expenses to avoid repeated nextWorkingDay calls
  const recurrentWithEffective = await Promise.all(recurrentList
    .filter(item => {
      // Skip items where cycleTotal > 0 and cycleCurrent >= cycleTotal (finished)
      if (item.cycleTotal > 0 && item.cycleCurrent >= item.cycleTotal) return false;
      // Skip items where status === 'paid'
      if (item.status === 'paid') return false;
      return true;
    })
    .map(async (item) => {
      if (!item.nextDate) return { ...item, effectiveDate: null };
      const effectiveDate = await nextWorkingDay(item.nextDate, true);
      return { ...item, effectiveDate };
    }));

  const datasets = { incomeList, expectedIncomeList, oneOffList, recurrentWithEffective };

  for (let i = 0; i < horizonDays; i++) {
    const dateStr = currentDay.toISOString().split('T')[0];

    const { dayIncome, dayExpense, hasDebtPayment } = _calculateDailyMetrics(dateStr, datasets);

    const openingBalance = currentBalance;
    currentBalance = openingBalance + dayIncome - dayExpense;

    snapshots.push({
      date: dateStr,
      openingBalance,
      closingBalance: currentBalance,
      incomeTotal: dayIncome,
      expenseTotal: dayExpense,
      hasDebtPayment
    });

    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
  }

  return snapshots;
}

/**
 * Calculate the median value of an array of numbers.
 * @param {number[]} values
 * @returns {number}
 */
function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Automatically generate expected income predictions based on historical patterns.
 * Looks at the last 3 months of income data.
 * @returns {Promise<Array>} List of generated expectedIncome objects (not yet saved)
 */
export async function generateExpectedIncomePredictions() {
  const today = new Date();
  const currentMonthStr = today.toISOString().slice(0, 7);

  // Get history from the last 3 months
  const history = await incomeRepository.getThreeMonthHistory(currentMonthStr);
  if (history.length === 0) return [];

  // Group by source
  const groups = history.reduce((acc, inc) => {
    if (!acc[inc.source]) acc[inc.source] = [];
    acc[inc.source].push(inc);
    return acc;
  }, {});

  const predictions = [];

  for (const [source, records] of Object.entries(groups)) {
    // Only predict if we have at least 2 occurrences? No, 1 is enough if user wants automation.
    // But 3 months is better for stability.

    const amounts = records.map(r => r.amount);
    const days = records.map(r => parseInt(r.date.split('-')[2], 10));

    const medianAmount = calculateMedian(amounts);
    const medianDay = Math.round(calculateMedian(days));
    const categoryId = records[0].categoryId; // Assume same category

    // Generate for next 3 months
    for (let i = 1; i <= 3; i++) {
      let predYear = today.getFullYear();
      let predMonth = today.getMonth() + i;

      // Normalize year/month
      while (predMonth > 11) {
        predMonth -= 12;
        predYear += 1;
      }

      // Check for month length
      const lastDayOfMonth = new Date(predYear, predMonth + 1, 0).getDate();
      const actualDay = Math.min(medianDay, lastDayOfMonth);

      const dateStr = `${predYear}-${String(predMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;  

      predictions.push({
        source,
        amount: medianAmount / 100, // Convert to pounds (repository expects pounds)
        date: dateStr,
        categoryId,
        status: 'predicted'
      });
    }
  }

  return predictions;
}

/**
 * Returns the latest recorded closing balance strictly before anchorDateStr.
 * Priority: dailyBalanceSnapshots → balanceSnapshots → localStorage fallback.
 * @param {string} anchorDateStr - YYYY-MM-DD. Returns balance as of the day BEFORE this date.
 * @returns {Promise<number>} Balance in pence.
 */
async function _resolveOpeningBalance(anchorDateStr) {
  const anchorMonth = anchorDateStr.slice(0, 7);
  const latestDaily = await db.dailyBalanceSnapshots
    .where('date').below(anchorDateStr).reverse().first();
  if (latestDaily) return latestDaily.closingBalance;
  const latestMonthly = await db.balanceSnapshots
    .where('month').below(anchorMonth).reverse().first();
  if (latestMonthly) return latestMonthly.closingBalance;
  return parseInt(localStorage.getItem('budget_balance_opening_amount') || '0', 10);
}

/**
 * Daily Rolling Financial Data Aggregation.
 * Returns daily balance data for a ~13-month window:
 * - 365 days history from the 'anchor' date.
 * - 45 days forecast from the 'anchor' date.
 *
 * @param {string} [targetMonth] - Optional YYYY-MM to center the window.
 * @returns {Promise<Object>} { labels, data: { balance, income, expenses }, todayIndex }
 */
export async function getDailyRollingData(targetMonth) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  let anchorDate;
  if (targetMonth) {
    const [y, m] = targetMonth.split('-').map(Number);
    // Use the middle of the selected month as the anchor for a balanced view
    anchorDate = new Date(Date.UTC(y, m - 1, 15));
  } else {
    anchorDate = today;
  }

  const startDate = new Date(anchorDate);
  startDate.setDate(startDate.getDate() - 365);
  const startDateStr = startDate.toISOString().split('T')[0];

  const endDate = new Date(anchorDate);
  endDate.setDate(endDate.getDate() + 45); // 45-day forecast from anchor
  const endDateStr = endDate.toISOString().split('T')[0];

  // 1. Fetch all data needed
  const [
    incomeList,
    recurrentList,
    oneOffList,
    expectedIncomeList,
    initialBalancePence
  ] = await Promise.all([
    db.income.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.recurrentExpenses.toArray(), 
    db.oneOffExpenses.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.expectedIncome.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    _resolveOpeningBalance(startDateStr)
  ]);

  const labels = [];
  const balance = [];
  const income = [];
  const expenses = [];
  let currentBalance = initialBalancePence;
  let todayIndex = -1;

  let cursor = new Date(startDate);
  let i = 0;

  // Pre-filter recurrent expenses that might fall in this range
  const relevantRecurrent = recurrentList.filter(item => {
    if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;
    if (item.status === 'paid') return false;
    return true;
  });

  // Pre-calculate effective dates for recurrent expenses (projections)
  const recurrentWithEffective = await Promise.all(relevantRecurrent.map(async item => {
    const nextDate = item.nextDate || item.date;
    if (!nextDate) return { ...item, effectiveDate: null };
    
    const effectiveDate = await nextWorkingDay(nextDate, true);
    return { ...item, effectiveDate };
  }));

  const datasets = { incomeList, expectedIncomeList, oneOffList, recurrentWithEffective };

  while (cursor <= endDate) {
    const dStr = cursor.toISOString().split('T')[0];
    labels.push(dStr);
    if (dStr === todayStr) todayIndex = i;

    const { dayIncome, dayExpense } = _calculateDailyMetrics(dStr, datasets);

    currentBalance += (dayIncome - dayExpense);
    balance.push(currentBalance);
    income.push(dayIncome);
    expenses.push(dayExpense);

    cursor.setDate(cursor.getDate() + 1);
    i++;
  }

  return { labels, data: { balance, income, expenses }, todayIndex };
}

/**
 * Internal helper to process daily activity for a given date.
 * Shared between getDailyRollingData and calculateForecast.
 * @private
 */
function _calculateDailyMetrics(dateStr, datasets) {
  const { incomeList, expectedIncomeList, oneOffList, recurrentWithEffective } = datasets;

  const dayIncome = incomeList
    .filter(inc => inc.date === dateStr)
    .reduce((s, r) => s + (r.amount || 0), 0) +
    expectedIncomeList
    .filter(inc => inc.date === dateStr)
    .reduce((s, r) => s + (r.amount || 0), 0);

  const dayOneOff = oneOffList
    .filter(exp => exp.date === dateStr)
    .reduce((s, r) => s + (r.amount || 0), 0);
  
  const dayRecurrentExpenses = recurrentWithEffective
    .filter(item => item.effectiveDate === dateStr);
  
  const dayRecurrentTotal = dayRecurrentExpenses.reduce((s, r) => s + (r.amount || 0), 0);
  const hasDebtPayment = dayRecurrentExpenses.some(exp => exp.isDebtPayment);

  return { 
    dayIncome, 
    dayExpense: dayOneOff + dayRecurrentTotal, 
    hasDebtPayment 
  };
}

/**
 * Spending Trends Aggregation - last 12 months from targetMonth.
 * @param {string} targetMonth - YYYY-MM
 */
export async function getSpendingTrends(targetMonth) {
  const [year, month] = targetMonth.split('-').map(Number);
  const results = [];

  for (let i = -11; i <= 0; i++) {
    const d = new Date(year, month - 1 + i, 1);
    const monthStr = d.toISOString().slice(0, 7);

    const [incList, recurrentList, oneOffList] = await Promise.all([
      db.income.where('date').startsWith(monthStr).toArray(),
      db.recurrentExpenses.where('nextDate').startsWith(monthStr).toArray(),
      db.oneOffExpenses.where('date').startsWith(monthStr).toArray()
    ]);

    results.push({
      month: monthStr,
      income: incList.reduce((sum, r) => sum + (r.amount || 0), 0),
      fixed: recurrentList.reduce((sum, r) => sum + (r.amount || 0), 0),
      variable: oneOffList.reduce((sum, r) => sum + (r.amount || 0), 0)
    });
  }
  return results;
}

