/**
 * Human-readable pay-date rule labels (spec §4.2 income sources).
 */

const ORDINAL_SUFFIX = (n) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

/** e.g. 28 → "28th". */
export function ordinal(n) {
  return `${n}${ORDINAL_SUFFIX(n)}`;
}

/**
 * @param {'nth-of-month'|'last-day'|'last-working-day'} rule
 * @param {number} [day] - day of month for nth-of-month.
 * @returns {string}
 */
export function formatPayRule(rule, day) {
  switch (rule) {
    case 'nth-of-month':
      return day ? `${ordinal(day)} of month` : 'Nth of month';
    case 'last-day':
      return 'Last day of month';
    case 'last-working-day':
      return 'Last working day';
    default:
      return String(rule ?? '');
  }
}

export const PAY_DATE_RULES = [
  { value: 'nth-of-month', label: 'Day of month' },
  { value: 'last-day', label: 'Last day of month' },
  { value: 'last-working-day', label: 'Last working day' },
];
