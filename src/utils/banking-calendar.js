/**
 * Banking Calendar Utility — synchronous, pure-function module.
 *
 * Provides UK banking-day logic for England & Wales.
 * NO DB access. NO async dependency chains.
 * Uses localStorage as a cache, with a static hardcoded fallback.
 *
 * Cache keys (distinct from cashflow.js which uses 'bank-holidays-cache'):
 *   CACHE_KEY      = 'uk_bank_holidays_cache'       — JSON array of YYYY-MM-DD strings
 *   CACHE_DATE_KEY = 'uk_bank_holidays_cache_date'  — ISO date string of last refresh
 *
 * Anti-patterns avoided:
 *   - NEVER use getDay() — always getUTCDay() for timezone safety
 *   - NEVER JSON.stringify(new Set(...)) — always Array.from(set) first
 *   - NEVER block startup — refreshBankHolidaysCache is async/fire-and-forget
 *   - NEVER mutate stored date fields in recurrence — only predictedPaymentDate
 */

const CACHE_KEY = 'uk_bank_holidays_cache';
const CACHE_DATE_KEY = 'uk_bank_holidays_cache_date';
const CACHE_EXPIRY_DAYS = 365; // eslint-disable-line no-unused-vars

/**
 * Static fallback — England & Wales bank holidays 2025–2027.
 * 2027 dates are best estimates from GOV.UK pattern; the Settings refresh button
 * corrects them when API data becomes available.
 */
const STATIC_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', // New Year's Day
  '2025-04-18', // Good Friday
  '2025-04-21', // Easter Monday
  '2025-05-05', // Early May bank holiday
  '2025-05-26', // Spring bank holiday
  '2025-08-25', // Summer bank holiday
  '2025-12-25', // Christmas Day
  '2025-12-26', // Boxing Day
  // 2026
  '2026-01-01', // New Year's Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-05-04', // Early May bank holiday
  '2026-05-25', // Spring bank holiday
  '2026-08-31', // Summer bank holiday
  '2026-12-25', // Christmas Day
  '2026-12-28', // Boxing Day (substitute — 27 Dec falls on Sun, 26 Dec falls on Sat)
  // 2027 — best estimate; refreshed via Settings when GOV.UK publishes confirmed dates
  '2027-01-01', // New Year's Day
  '2027-04-02', // Good Friday
  '2027-04-05', // Easter Monday
  '2027-05-03', // Early May bank holiday
  '2027-05-31', // Spring bank holiday
  '2027-08-30', // Summer bank holiday
  '2027-12-27', // Christmas Day (substitute)
  '2027-12-28', // Boxing Day (substitute)
]);

/**
 * The maximum year covered by the static holiday set.
 * Used by the maxCachedYear guard.
 * @type {number}
 */
const STATIC_MAX_YEAR = 2027;

/**
 * Load the current holiday set.
 * Returns from localStorage cache if available and parseable, otherwise static fallback.
 * @returns {Set<string>} Set of YYYY-MM-DD holiday strings
 */
function loadBankHolidays() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return new Set(parsed);
      }
    }
  } catch (_e) {
    // Corrupt cache — fall back silently
  }
  return STATIC_HOLIDAYS;
}

/**
 * Convert a Date object or YYYY-MM-DD string to a YYYY-MM-DD UTC string.
 * Always uses UTC methods to avoid local timezone shifting.
 * @param {Date|string} date
 * @returns {string} YYYY-MM-DD
 */
function _toUTCDateStr(date) {
  if (typeof date === 'string') {
    // Validate it's a date-only string already
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Fallback: parse and convert
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }
  // Date object — use UTC methods to avoid DST offsets
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Check if a date is a UK bank holiday (England & Wales).
 * Uses localStorage cache when available, static fallback otherwise.
 *
 * Emits console.warn when called with a year beyond the cached range and
 * returns false (weekend-only logic must be applied by the caller if needed).
 *
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {boolean}
 */
export function isUKBankHoliday(date) {
  const dateStr = _toUTCDateStr(date);
  const year = parseInt(dateStr.split('-')[0], 10);

  const holidays = loadBankHolidays();

  // maxCachedYear guard — compute max year from loaded set
  const years = Array.from(holidays)
    .map(d => parseInt(d.split('-')[0], 10))
    .filter(Number.isFinite);
  const maxYear = years.length ? Math.max(...years) : STATIC_MAX_YEAR;

  if (year > maxYear) {
    console.warn(
      `[banking-calendar] Bank holiday data not available for year ${year} (max cached: ${maxYear}). Using weekend-only logic.`
    );
    // Return false for holiday check; isWorkingDay will still check weekends via getUTCDay()
    return false;
  }

  return holidays.has(dateStr);
}

/**
 * Check if a date is a working day (Mon–Fri, not a UK bank holiday).
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {boolean}
 */
export function isWorkingDay(date) {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date;
  const dayOfWeek = d.getUTCDay(); // 0 = Sun, 6 = Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return !isUKBankHoliday(d);
}

/**
 * Return the next working day on or after the given date.
 * If the input is already a working day, returns the same date.
 *
 * Uses UTC date arithmetic — never getDay(). Includes a 14-iteration safety
 * guard to prevent infinite loops on corrupted holiday data.
 *
 * @param {Date|string} date - Date object or YYYY-MM-DD string
 * @returns {Date} UTC midnight Date on the next (or same) working day
 */
export function nextWorkingDay(date) {
  let d = typeof date === 'string'
    ? new Date(`${date}T00:00:00Z`)
    : new Date(date.getTime()); // clone to avoid mutation

  let iterations = 0;
  const MAX_ITERATIONS = 14;

  while (!isWorkingDay(d)) {
    if (iterations >= MAX_ITERATIONS) {
      console.warn(
        `[banking-calendar] nextWorkingDay exceeded ${MAX_ITERATIONS} iterations — possible corrupt holiday data. Returning current date.`
      );
      break;
    }
    d.setUTCDate(d.getUTCDate() + 1);
    iterations++;
  }

  return d;
}

/**
 * Return the adjusted payment date based on the adjustment strategy.
 *
 * @param {Date|string} nominalDate - The nominal (unadjusted) payment date
 * @param {'none'|'next-working-day'} adjustment - Adjustment strategy
 * @returns {Date} Adjusted date (or same date if adjustment is 'none')
 */
export function adjustedPaymentDate(nominalDate, adjustment) {
  if (adjustment !== 'next-working-day') {
    // Normalize to Date object and return
    return typeof nominalDate === 'string'
      ? new Date(`${nominalDate}T00:00:00Z`)
      : nominalDate;
  }
  return nextWorkingDay(nominalDate);
}

/**
 * Fetch the GOV.UK bank holidays API and refresh the localStorage cache.
 *
 * Parses the `england-and-wales` division events and stores the date array
 * under CACHE_KEY. Stores today's date under CACHE_DATE_KEY.
 *
 * On any failure: logs a console.warn and leaves localStorage unchanged.
 * This function should always be called fire-and-forget (without await) on app startup.
 *
 * @returns {Promise<{success: boolean, count?: number, error?: string}>}
 */
export async function refreshBankHolidaysCache() {
  try {
    const response = await fetch('https://www.gov.uk/bank-holidays.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const dates = data['england-and-wales'].events.map(e => e.date);
    localStorage.setItem(CACHE_KEY, JSON.stringify(dates));
    localStorage.setItem(CACHE_DATE_KEY, new Date().toISOString().split('T')[0]);
    return { success: true, count: dates.length };
  } catch (err) {
    console.warn('[banking-calendar] Failed to refresh bank holidays cache:', err);
    // Fall back to static data — no further action needed
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * The maximum year covered by the bundled static holiday fallback.
 * Exported for informational use only (e.g. Settings panel).
 * @type {number}
 */
export const staticMaxYear = STATIC_MAX_YEAR;
