/**
 * Converts a pounds string or number to integer pence.
 * Handles common user input formats and avoids floating point errors.
 * 
 * @param {string|number} pounds - The amount in pounds (e.g., "12.34" or 12.34).
 * @returns {number} - The amount in integer pence.
 */
export function toPence(pounds) {
  if (pounds === null || pounds === undefined || pounds === '') return 0;
  
  // Convert string to float if needed
  const val = typeof pounds === 'string' ? parseFloat(pounds.replace(/[^\d.-]/g, '')) : pounds;
  
  if (isNaN(val)) return 0;
  
  // Round to nearest integer to avoid float errors (e.g., 0.1 + 0.2)
  return Math.round(val * 100);
}

/**
 * Converts integer pence back to a float (pounds).
 * 
 * @param {number} pence - The amount in integer pence.
 * @returns {number} - The amount in pounds.
 */
export function fromPence(pence) {
  if (pence === null || pence === undefined || isNaN(pence)) return 0;
  return pence / 100;
}

/**
 * Formats integer pence as a GBP currency string.
 * Uses Intl.NumberFormat for locale-aware formatting.
 * 
 * @param {number} pence - The amount in integer pence.
 * @returns {string} - The formatted currency string (e.g., "£1,234.56").
 */
export function formatGBP(pence) {
  const amount = fromPence(pence);
  
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Formats integer pence as a short GBP string (e.g., £10.5k).
 * Uses compact notation for large values.
 * 
 * @param {number} pence - The amount in integer pence.
 * @returns {string} - The short formatted currency string.
 */
export function formatGBPShort(pence) {
  const amount = fromPence(pence);
  
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(amount);
}
