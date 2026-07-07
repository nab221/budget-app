import { formatGBP } from '../../engine/currency.js';
import { toPence } from '../../engine/currency.js';

/**
 * Format a pounds value (the currency unit repositories return) as GBP.
 * `formatGBP` works in pence, so convert deliberately at this one edge.
 */
export function formatPounds(pounds) {
  return formatGBP(toPence(pounds ?? 0));
}

/**
 * Render a money value with the `money` class (targeted by the privacy blur).
 * Pass `pounds` for repository values or `pence` for raw engine pence.
 */
export default function Money({ pounds, pence, className = '' }) {
  const text = pence != null ? formatGBP(pence) : formatPounds(pounds);
  const cls = className ? `money ${className}` : 'money';
  return <span className={cls}>{text}</span>;
}
