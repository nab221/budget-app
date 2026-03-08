export const FORECAST_30_DAY_INDEX = 29;
export const FORECAST_90_DAY_INDEX = 89;

export function pickInvariantForecastKpis(snapshots) {
  const list = Array.isArray(snapshots) ? snapshots : [];
  return {
    runningBalance: list[0]?.closingBalance ?? 0,
    nextMonthForecast: list[FORECAST_30_DAY_INDEX]?.closingBalance ?? null,
    threeMonthForecast: list[FORECAST_90_DAY_INDEX]?.closingBalance ?? null
  };
}
