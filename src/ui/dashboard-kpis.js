export const FORECAST_30_DAY_INDEX = 29;
export const FORECAST_90_DAY_INDEX = 89;

/**
 * Rebase forecast snapshots so day-0 closing matches a canonical balance.
 * This keeps relative day-to-day deltas intact while aligning baselines.
 */
export function rebaseForecastSnapshots(snapshots, expectedFirstClosingBalance) {
  const list = Array.isArray(snapshots) ? snapshots : [];
  if (list.length === 0 || !Number.isFinite(expectedFirstClosingBalance)) return list;

  const firstClosing = Number(list[0]?.closingBalance);
  if (!Number.isFinite(firstClosing)) return list;

  const delta = expectedFirstClosingBalance - firstClosing;
  if (delta === 0) return list;

  return list.map(s => ({
    ...s,
    openingBalance: Number.isFinite(s.openingBalance) ? s.openingBalance + delta : s.openingBalance,
    closingBalance: Number.isFinite(s.closingBalance) ? s.closingBalance + delta : s.closingBalance
  }));
}

export function pickInvariantForecastKpis(snapshots) {
  const list = Array.isArray(snapshots) ? snapshots : [];
  return {
    runningBalance: list[0]?.closingBalance ?? 0,
    nextMonthForecast: list[FORECAST_30_DAY_INDEX]?.closingBalance ?? null,
    threeMonthForecast: list[FORECAST_90_DAY_INDEX]?.closingBalance ?? null
  };
}
