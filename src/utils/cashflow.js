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
import { advanceNextDate } from './recurrence.js';
import { BALANCE_OPENING_AMOUNT_KEY } from './storage.js';

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

// Cache holidays at module level to avoid repeated JSON parsing
let _cachedHolidaySet = null;

async function _getHolidaySet() {
  if (_cachedHolidaySet) return _cachedHolidaySet;
  
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return new Set();
  
  try {
    const { dates } = JSON.parse(cached);
    _cachedHolidaySet = new Set(dates);
    return _cachedHolidaySet;
  } catch (err) {
    return new Set();
  }
}

/**
 * Check if a specific date is a UK bank holiday.
 * Respects manual overrides in the database.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Set<string>} [holidaySet] - Optional pre-parsed holiday set for performance
 * @returns {Promise<boolean>}
 */
export async function isBankHoliday(dateStr, holidaySet = null) {
  // 1. Check user overrides first
  const override = await bankHolidayRepository.isOverrideActive(dateStr);
  if (override !== null) {
    return !override;
  }

  // 2. Check cached holidays
  const holidays = holidaySet || await _getHolidaySet();
  return holidays.has(dateStr);
}

/**
 * Check if a date is a working day (Mon-Fri and not a bank holiday).
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Set<string>} [holidaySet] - Optional pre-parsed holiday set for performance
 * @returns {Promise<boolean>}
 */
export async function isWorkingDay(dateStr, holidaySet = null) {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0 = Sun, 6 = Sat

  // Weekend
  if (day === 0 || day === 6) {
    // Check if user has explicitly marked this weekend as a working day
    const override = await bankHolidayRepository.isOverrideActive(dateStr);
    return override === true;
  }

  // Weekday - check for bank holiday
  return !(await isBankHoliday(dateStr, holidaySet));
}

/**
 * Find the next working day after (or including) a given date.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {boolean} includeToday - If true, check if today is a working day first.
 * @param {Set<string>} [holidaySet] - Optional pre-parsed holiday set for performance
 * @returns {Promise<string>} YYYY-MM-DD
 */
export async function nextWorkingDay(dateStr, includeToday = false, holidaySet = null) {
  const holidays = holidaySet || await _getHolidaySet();
  let current = new Date(`${dateStr}T00:00:00Z`);
  if (!includeToday) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  while (!(await isWorkingDay(current.toISOString().split('T')[0], holidays))) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return current.toISOString().split('T')[0];
}

/**
 * Project recurrent item occurrences over a date range.
 * Generates all instances that would fall within [startDate, endDate].
 * If item has no frequency, returns single occurrence at nextDate (if in range).
 * @param {Object} item - Recurrent expense/income with nextDate, frequency, cycleTotal, cycleCurrent
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {Set<string>} [holidaySet] - Optional pre-parsed holiday set
 * @returns {Promise<Array<{date: string, item: Object}>>} Projected occurrences
 */
async function _projectRecurrentOccurrences(item, startDate, endDate, holidaySet = null) {
  if (!item.nextDate) return [];
  
  const occurrences = [];
  const holidays = holidaySet || await _getHolidaySet();
  
  // If no frequency is set, treat as one-time occurrence
  if (!item.frequency) {
    if (item.nextDate >= startDate && item.nextDate <= endDate) {
      const effectiveDate = await nextWorkingDay(item.nextDate, true, holidays);
      occurrences.push({ date: effectiveDate, item });
    }
    return occurrences;
  }
  
  // Otherwise, project recurring occurrences
  let currentDate = item.nextDate;
  let currentCycle = item.cycleCurrent || 0;
  
  while (currentDate <= endDate) {
    // Check cycle limit
    if (item.cycleTotal > 0 && currentCycle >= item.cycleTotal) break;
    
    if (currentDate >= startDate) {
      const effectiveDate = await nextWorkingDay(currentDate, true, holidays);
      occurrences.push({ date: effectiveDate, item: { ...item, cycleCurrent: currentCycle } });
    }
    
    // Advance to next occurrence
    currentDate = advanceNextDate(currentDate, item.frequency);
    currentCycle++;
  }
  
  return occurrences;
}

/**
 * Calculate the daily balance forecast for a set number of days.
 * @param {string} startDate - YYYY-MM-DD
 * @param {number} horizonDays - Number of days to forecast (default 45)
 * @returns {Promise<Array>} List of daily snapshots
 */
export async function calculateForecast(startDate, horizonDays = 45) {
  let currentDay = new Date(`${startDate}T00:00:00Z`);
  const endDate = new Date(currentDay);
  endDate.setUTCDate(endDate.getUTCDate() + horizonDays - 1);
  const endDateStr = endDate.toISOString().split('T')[0];

  // 1. Fetch all relevant data
  const [
    incomeList,
    recurrentList,
    oneOffList,
    expectedIncomeList,
    holidaySet
  ] = await Promise.all([
    incomeRepository.getAll(),
    recurrentExpenseRepository.getAll(),
    oneOffExpenseRepository.getAll(),
    expectedIncomeRepository.getAll(),
    _getHolidaySet()
  ]);

  // 2. Determine initial opening balance
  let currentBalance = await _resolveOpeningBalance(startDate);

  const snapshots = [];

  // 3. Filter and project recurrent expenses
  const activeRecurrent = recurrentList.filter(item => {
    if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;
    if (item.status === 'paid') return false;
    return true;
  });

  // Project all recurrent occurrences in the forecast window
  const recurrentProjections = [];
  for (const item of activeRecurrent) {
    const projections = await _projectRecurrentOccurrences(item, startDate, endDateStr, holidaySet);
    recurrentProjections.push(...projections);
  }

  // Build date-indexed maps for efficient lookup
  const incomeByDate = new Map();
  const expenseByDate = new Map();
  const debtPaymentDates = new Set();

  incomeList.forEach(inc => {
    if (!incomeByDate.has(inc.date)) incomeByDate.set(inc.date, 0);
    incomeByDate.set(inc.date, incomeByDate.get(inc.date) + (inc.amount || 0));
  });

  expectedIncomeList.forEach(inc => {
    if (!incomeByDate.has(inc.date)) incomeByDate.set(inc.date, 0);
    incomeByDate.set(inc.date, incomeByDate.get(inc.date) + (inc.amount || 0));
  });

  oneOffList.forEach(exp => {
    if (exp.status === 'paid') return;
    if (!expenseByDate.has(exp.date)) expenseByDate.set(exp.date, 0);
    expenseByDate.set(exp.date, expenseByDate.get(exp.date) + (exp.amount || 0));
  });

  recurrentProjections.forEach(({ date, item }) => {
    if (!expenseByDate.has(date)) expenseByDate.set(date, 0);
    expenseByDate.set(date, expenseByDate.get(date) + (item.amount || 0));
    if (item.isDebtPayment) debtPaymentDates.add(date);
  });

  // 4. Generate snapshots
  for (let i = 0; i < horizonDays; i++) {
    const dateStr = currentDay.toISOString().split('T')[0];

    const dayIncome = incomeByDate.get(dateStr) || 0;
    const dayExpense = expenseByDate.get(dateStr) || 0;
    const hasDebtPayment = debtPaymentDates.has(dateStr);

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
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(today.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);

  // Get history from the last 3 months
  // Use above() instead of aboveOrEqual() for Dexie compatibility
  const history = await db.income
    .where('date')
    .above(threeMonthsAgoStr)
    .or('date').equals(threeMonthsAgoStr)
    .toArray();

  if (history.length === 0) return [];

  // Group by source
  const groups = history.reduce((acc, inc) => {
    if (!acc[inc.source]) acc[inc.source] = [];
    acc[inc.source].push(inc);
    return acc;
  }, {});

  const predictions = [];

  for (const [source, records] of Object.entries(groups)) {
    const amounts = records.map(r => r.amount);
    const days = records.map(r => parseInt(r.date.split('-')[2], 10));

    const medianAmount = calculateMedian(amounts);
    const medianDay = Math.round(calculateMedian(days));
    const categoryId = records[0].categoryId;

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
        amount: medianAmount / 100,
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
  return parseInt(localStorage.getItem(BALANCE_OPENING_AMOUNT_KEY) || '0', 10);
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
    anchorDate = new Date(Date.UTC(y, m - 1, 15));
  } else {
    anchorDate = today;
  }

  const startDate = new Date(anchorDate);
  startDate.setDate(startDate.getDate() - 365);
  const startDateStr = startDate.toISOString().split('T')[0];

  const endDate = new Date(anchorDate);
  endDate.setDate(endDate.getDate() + 45);
  const endDateStr = endDate.toISOString().split('T')[0];

  // 1. Fetch all data needed
  const [
    incomeList,
    recurrentList,
    oneOffList,
    expectedIncomeList,
    initialBalancePence,
    holidaySet
  ] = await Promise.all([
    db.income.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.recurrentExpenses.toArray(),
    db.oneOffExpenses.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    db.expectedIncome.where('date').between(startDateStr, endDateStr, true, true).toArray(),
    _resolveOpeningBalance(startDateStr),
    _getHolidaySet()
  ]);

  const labels = [];
  const balance = [];
  const income = [];
  const expenses = [];
  let currentBalance = initialBalancePence;
  let todayIndex = -1;

  // Pre-filter recurrent expenses
  const relevantRecurrent = recurrentList.filter(item => {
    if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;
    if (item.status === 'paid') return false;
    return true;
  });

  // Project all recurrent occurrences
  const recurrentProjections = [];
  for (const item of relevantRecurrent) {
    const projections = await _projectRecurrentOccurrences(item, startDateStr, endDateStr, holidaySet);
    recurrentProjections.push(...projections);
  }

  // Build date-indexed maps
  const incomeByDate = new Map();
  const expenseByDate = new Map();

  incomeList.forEach(inc => {
    if (!incomeByDate.has(inc.date)) incomeByDate.set(inc.date, 0);
    incomeByDate.set(inc.date, incomeByDate.get(inc.date) + (inc.amount || 0));
  });

  expectedIncomeList.forEach(inc => {
    if (!incomeByDate.has(inc.date)) incomeByDate.set(inc.date, 0);
    incomeByDate.set(inc.date, incomeByDate.get(inc.date) + (inc.amount || 0));
  });

  oneOffList.forEach(exp => {
    if (exp.status === 'paid') return;
    if (!expenseByDate.has(exp.date)) expenseByDate.set(exp.date, 0);
    expenseByDate.set(exp.date, expenseByDate.get(exp.date) + (exp.amount || 0));
  });

  recurrentProjections.forEach(({ date, item }) => {
    if (!expenseByDate.has(date)) expenseByDate.set(date, 0);
    expenseByDate.set(date, expenseByDate.get(date) + (item.amount || 0));
  });

  // Generate snapshots
  let cursor = new Date(startDate);
  let i = 0;

  while (cursor <= endDate) {
    const dStr = cursor.toISOString().split('T')[0];
    labels.push(dStr);
    if (dStr === todayStr) todayIndex = i;

    const dayIncome = incomeByDate.get(dStr) || 0;
    const dayExpense = expenseByDate.get(dStr) || 0;

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
 * Spending Trends Aggregation - last 12 months from targetMonth.
 * @param {string} targetMonth - YYYY-MM
 */
export async function getSpendingTrends(targetMonth) {
  const [year, month] = targetMonth.split('-').map(Number);
  const results = [];

  for (let i = -11; i <= 0; i++) {
    const d = new Date(year, month - 1 + i, 1);
    const monthStr = d.toISOString().slice(0, 7);
    const monthStart = `${monthStr}-01`;
    const nextMonth = new Date(d);
    nextMonth.setMonth(d.getMonth() + 1);
    const monthEnd = nextMonth.toISOString().slice(0, 10);

    const [incList, recurrentList, oneOffList] = await Promise.all([
      db.income.where('date').between(monthStart, monthEnd, true, false).toArray(),
      db.recurrentExpenses.toArray(),
      db.oneOffExpenses.where('date').between(monthStart, monthEnd, true, false).toArray()
    ]);

    // Project recurrent expenses for this month
    const recurrentInMonth = [];
    for (const item of recurrentList) {
      if (item.status === 'paid') continue;
      if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) continue;
      const projections = await _projectRecurrentOccurrences(item, monthStart, monthEnd);
      recurrentInMonth.push(...projections.map(p => p.item));
    }

    results.push({
      month: monthStr,
      income: incList.reduce((sum, r) => sum + (r.amount || 0), 0),
      fixed: recurrentInMonth.reduce((sum, r) => sum + (r.amount || 0), 0),
      variable: oneOffList.reduce((sum, r) => sum + (r.amount || 0), 0)
    });
  }
  return results;
}
