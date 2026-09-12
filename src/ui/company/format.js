/**
 * Display helpers shared by the Company screens. Rates arrive as fractions
 * (0.265) from the engine; money arrives as pence and goes through <Money>.
 */

/** 0.265 → "26.5%". */
export function formatRate(rate, dp = 1) {
  return `${((rate || 0) * 100).toFixed(dp)}%`;
}

/** 0.3605 → "36.1p" — pence of CT per £1 of dividend. */
export function formatPerPound(rate) {
  return `${((rate || 0) * 100).toFixed(1)}p`;
}

/** The company-year label as shown ("FY2026"); one place to change it. */
export function fyTitle(label) {
  return String(label);
}
