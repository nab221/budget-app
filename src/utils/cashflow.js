import { 
  bankHolidayRepository, 
  incomeRepository, 
  recurrentExpenseRepository, 
  oneOffExpenseRepository, 
  expectedIncomeRepository,
  balanceSnapshotRepository,
  dailyBalanceRepository
} from '../db/repository.js';

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
 * @param {number} horizonDays - Number of days to forecast (default 90)
 * @returns {Promise<Array>} List of daily snapshots
 */
export async function calculateForecast(startDate, horizonDays = 90) {
  // Use UTC to avoid timezone shifts during day increments
  let currentDay = new Date(`${startDate}T00:00:00Z`);

  // 1. Fetch all relevant data for the horizon
  const [
    incomeList,
    recurrentList,
    oneOffList,
    expectedIncomeList,
    latestDaily,
    latestMonthly
  ] = await Promise.all([
    incomeRepository.getAll(),
    recurrentExpenseRepository.getAll(),
    oneOffExpenseRepository.getAll(),
    expectedIncomeRepository.getAll(),
    dailyBalanceRepository.getLatestSnapshot(),
    balanceSnapshotRepository.getLatestSnapshot()
  ]);

  // 2. Determine initial opening balance
  let currentBalance = 0;
  if (latestDaily && latestDaily.date < startDate) {
    currentBalance = latestDaily.closingBalance;
  } else if (latestMonthly) {
    // Fallback to monthly if no daily or daily is stale
    currentBalance = latestMonthly.closingBalance;
  }

  const snapshots = [];

  // Pre-calculate effective dates for recurrent expenses to avoid repeated nextWorkingDay calls
  const recurrentWithEffective = await Promise.all(recurrentList.map(async (item) => {
    if (!item.nextDate) return { ...item, effectiveDate: null };
    const effectiveDate = await nextWorkingDay(item.nextDate, true);
    return { ...item, effectiveDate };
  }));

  for (let i = 0; i < horizonDays; i++) {
    const dateStr = currentDay.toISOString().split('T')[0];
    
    // Sum income for today
    const dayIncome = incomeList
      .filter(inc => inc.date === dateStr)
      .reduce((sum, inc) => sum + inc.amount, 0) +
      expectedIncomeList
      .filter(inc => inc.date === dateStr)
      .reduce((sum, inc) => sum + inc.amount, 0);

    // Sum expenses for today
    const dayOneOff = oneOffList
      .filter(exp => exp.date === dateStr)
      .reduce((sum, exp) => sum + exp.amount, 0);

    const dayRecurrent = recurrentWithEffective
      .filter(exp => exp.effectiveDate === dateStr)
      .reduce((sum, exp) => sum + exp.amount, 0);

    const totalExpenses = dayOneOff + dayRecurrent;
    const openingBalance = currentBalance;
    currentBalance = openingBalance + dayIncome - totalExpenses;

    snapshots.push({
      date: dateStr,
      openingBalance,
      closingBalance: currentBalance,
      incomeTotal: dayIncome,
      expenseTotal: totalExpenses
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
        amount: medianAmount,
        date: dateStr,
        categoryId,
        status: 'predicted'
      });
    }
  }

  return predictions;
}
