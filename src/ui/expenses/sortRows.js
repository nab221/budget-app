/**
 * Column sorting for the Expenses tab tables (design 2026-09-12 §3.3). Pure.
 *
 * Empty values (null / undefined / '') sort LAST in both directions, so a loan
 * with no utilisation never floats to the top of a utilisation sort. Numbers
 * compare numerically, everything else by locale-aware string comparison.
 */

const isEmpty = (v) => v == null || v === '';

/** Three-way compare; empties last. */
export function compareValues(a, b) {
  const ea = isEmpty(a);
  const eb = isEmpty(b);
  if (ea && eb) return 0;
  if (ea) return 1;
  if (eb) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-GB', { sensitivity: 'base' });
}

/**
 * @param {Array<object>} rows
 * @param {string} key - row property to sort by
 * @param {'asc'|'desc'} [dir]
 * @returns {Array<object>} a new, stably sorted array
 */
export function sortRows(rows, key, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((x, y) => {
    const a = x[key];
    const b = y[key];
    const ea = isEmpty(a);
    const eb = isEmpty(b);
    // Empties stay last regardless of direction.
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    return compareValues(a, b) * sign;
  });
}

/**
 * Next sort state after clicking a column header: first click ascending,
 * second click flips, a different column starts ascending again.
 * @param {{key: string, dir: 'asc'|'desc'}|null} current
 * @param {string} key
 */
export function toggleSort(current, key) {
  if (current && current.key === key) {
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { key, dir: 'asc' };
}
