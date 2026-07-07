/**
 * cashflow.js — parked analytics engine (spec §6).
 *
 * These are the pure computational cores of the deferred 90-day forecast
 * (Phase 6). They deliberately take all their data as parameters — the old
 * versions read directly from `db/schema.js` + `db/repository.js` and cached
 * UK bank holidays in localStorage, all of which were removed in the v4
 * refactor. Phase 6 will wire these to the new BudgetAppV4 repositories.
 *
 * Nothing here is imported by the v4.0 UI.
 */
import { advanceNextDate } from './recurrence.js';

/**
 * Median of an array of numbers. Pure.
 * @param {number[]} values
 * @returns {number}
 */
export function calculateMedian(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Normalise a holiday collection to a Set of YYYY-MM-DD strings.
 * @param {Set<string>|string[]|undefined} holidays
 * @returns {Set<string>}
 */
function toHolidaySet(holidays) {
  if (holidays instanceof Set) return holidays;
  if (Array.isArray(holidays)) return new Set(holidays);
  return new Set();
}

/**
 * Next UK working day on/after dateStr, given an injected holiday set. Pure.
 * Weekends (Sat/Sun) and any date in `holidays` are skipped.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Set<string>} holidays
 * @returns {string} YYYY-MM-DD
 */
function nextWorkingDay(dateStr, holidays) {
  const current = new Date(`${dateStr}T00:00:00Z`);
  for (let guard = 0; guard < 3660; guard++) {
    const iso = current.toISOString().split('T')[0];
    const day = current.getUTCDay(); // 0 = Sun, 6 = Sat
    if (day !== 0 && day !== 6 && !holidays.has(iso)) return iso;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return current.toISOString().split('T')[0];
}

/**
 * Project a recurrent item's occurrences over [startDate, endDate] onto their
 * working-day-adjusted effective dates. Pure (uses injected holiday set).
 * @param {Object} item - { nextDate, frequency?, cycleTotal?, cycleCurrent? }
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {Set<string>} holidays
 * @returns {Array<{date: string, item: Object}>}
 */
function projectRecurrentOccurrences(item, startDate, endDate, holidays) {
  if (!item.nextDate) return [];

  const occurrences = [];

  if (!item.frequency) {
    if (item.nextDate >= startDate && item.nextDate <= endDate) {
      occurrences.push({ date: nextWorkingDay(item.nextDate, holidays), item });
    }
    return occurrences;
  }

  let currentDate = item.nextDate;
  let currentCycle = item.cycleCurrent || 0;
  const maxIterations = 1000;
  let iterations = 0;

  while (currentDate && currentDate <= endDate && iterations < maxIterations) {
    iterations++;
    if (item.cycleTotal > 0 && currentCycle >= item.cycleTotal) break;

    if (currentDate >= startDate) {
      occurrences.push({
        date: nextWorkingDay(currentDate, holidays),
        item: { ...item, cycleCurrent: currentCycle },
      });
    }

    const { nextDate } = advanceNextDate({ nextDate: currentDate, frequency: item.frequency });
    if (!nextDate || nextDate === currentDate) break;
    currentDate = nextDate;
    currentCycle++;
  }

  return occurrences;
}

/**
 * Daily balance forecast over a horizon. Pure — all data injected.
 *
 * @param {string} startDate - YYYY-MM-DD (first forecast day)
 * @param {number} [horizonDays=45]
 * @param {Object} [data]
 * @param {number} [data.openingBalancePence=0] - Balance the day before startDate.
 * @param {Array<{date, amount}>} [data.income=[]]
 * @param {Array<{date, amount}>} [data.expectedIncome=[]]
 * @param {Array<{date, amount, status}>} [data.oneOffExpenses=[]]
 * @param {Array<{nextDate, frequency?, amount, status?, isDebtPayment?, cycleTotal?, cycleCurrent?}>} [data.recurrentExpenses=[]]
 * @param {Set<string>|string[]} [data.holidays] - UK bank holidays (YYYY-MM-DD).
 * @returns {Array<{date, openingBalance, closingBalance, incomeTotal, expenseTotal, hasDebtPayment}>}
 */
export function calculateForecast(startDate, horizonDays = 45, data = {}) {
  const {
    openingBalancePence = 0,
    income = [],
    expectedIncome = [],
    oneOffExpenses = [],
    recurrentExpenses = [],
    holidays,
  } = data;
  const holidaySet = toHolidaySet(holidays);

  const currentDay = new Date(`${startDate}T00:00:00Z`);
  const endDate = new Date(currentDay);
  endDate.setUTCDate(endDate.getUTCDate() + horizonDays - 1);
  const endDateStr = endDate.toISOString().split('T')[0];

  const activeRecurrent = recurrentExpenses.filter((item) => {
    if (item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal) return false;
    if (item.status === 'paid') return false;
    return true;
  });

  const recurrentProjections = [];
  for (const item of activeRecurrent) {
    recurrentProjections.push(...projectRecurrentOccurrences(item, startDate, endDateStr, holidaySet));
  }

  const incomeByDate = new Map();
  const expenseByDate = new Map();
  const debtPaymentDates = new Set();

  const addIncome = (list) => list.forEach((inc) => {
    incomeByDate.set(inc.date, (incomeByDate.get(inc.date) || 0) + (inc.amount || 0));
  });
  addIncome(income);
  addIncome(expectedIncome);

  oneOffExpenses.forEach((exp) => {
    if (exp.status === 'paid') return;
    expenseByDate.set(exp.date, (expenseByDate.get(exp.date) || 0) + (exp.amount || 0));
  });

  recurrentProjections.forEach(({ date, item }) => {
    expenseByDate.set(date, (expenseByDate.get(date) || 0) + (item.amount || 0));
    if (item.isDebtPayment) debtPaymentDates.add(date);
  });

  const snapshots = [];
  let currentBalance = openingBalancePence;

  for (let i = 0; i < horizonDays; i++) {
    const dateStr = currentDay.toISOString().split('T')[0];
    const dayIncome = incomeByDate.get(dateStr) || 0;
    const dayExpense = expenseByDate.get(dateStr) || 0;
    const openingBalance = currentBalance;
    currentBalance = openingBalance + dayIncome - dayExpense;

    snapshots.push({
      date: dateStr,
      openingBalance,
      closingBalance: currentBalance,
      incomeTotal: dayIncome,
      expenseTotal: dayExpense,
      hasDebtPayment: debtPaymentDates.has(dateStr),
    });

    currentDay.setUTCDate(currentDay.getUTCDate() + 1);
  }

  return snapshots;
}

/**
 * Predict expected income for the next 3 months from historical income.
 * Pure — takes the income history and an injectable "now".
 *
 * @param {Array<{source, amount, date, categoryId}>} incomeRecords - amounts in pence.
 * @param {Date} [now=new Date()]
 * @returns {Array<{source, amount, date, categoryId, status}>} amounts in pounds.
 */
export function generateExpectedIncomePredictions(incomeRecords = [], now = new Date()) {
  const today = now;
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(today.getMonth() - 3);
  const threeMonthsAgoStr = threeMonthsAgo.toISOString().slice(0, 10);

  const history = incomeRecords.filter((inc) => inc.date >= threeMonthsAgoStr);
  if (history.length === 0) return [];

  const groups = history.reduce((acc, inc) => {
    (acc[inc.source] = acc[inc.source] || []).push(inc);
    return acc;
  }, {});

  const predictions = [];

  for (const [source, records] of Object.entries(groups)) {
    const amounts = records.map((r) => r.amount);
    const days = records.map((r) => parseInt(r.date.split('-')[2], 10));

    const medianAmount = calculateMedian(amounts);
    const medianDay = Math.round(calculateMedian(days));
    const categoryId = records[0].categoryId;

    for (let i = 1; i <= 3; i++) {
      let predYear = today.getFullYear();
      let predMonth = today.getMonth() + i;
      while (predMonth > 11) {
        predMonth -= 12;
        predYear += 1;
      }

      const lastDayOfMonth = new Date(predYear, predMonth + 1, 0).getDate();
      const actualDay = Math.min(medianDay, lastDayOfMonth);
      const dateStr = `${predYear}-${String(predMonth + 1).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;

      predictions.push({
        source,
        amount: medianAmount / 100,
        date: dateStr,
        categoryId,
        status: 'predicted',
      });
    }
  }

  return predictions;
}
