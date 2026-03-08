import { describe, expect, it } from 'vitest';
import {
  FORECAST_30_DAY_INDEX,
  FORECAST_90_DAY_INDEX,
  pickInvariantForecastKpis
} from '../../src/ui/dashboard-kpis.js';

describe('dashboard invariant KPI mapping', () => {
  it('maps running, +30d, and +90d balances from snapshot indices', () => {
    const snapshots = Array.from({ length: 90 }, (_, i) => ({
      closingBalance: (i + 1) * 1000
    }));

    const result = pickInvariantForecastKpis(snapshots);

    expect(result.runningBalance).toBe(1000);
    expect(result.nextMonthForecast).toBe((FORECAST_30_DAY_INDEX + 1) * 1000);
    expect(result.threeMonthForecast).toBe((FORECAST_90_DAY_INDEX + 1) * 1000);
  });

  it('returns safe fallbacks when snapshots are missing or short', () => {
    expect(pickInvariantForecastKpis(null)).toEqual({
      runningBalance: 0,
      nextMonthForecast: null,
      threeMonthForecast: null
    });

    const shortResult = pickInvariantForecastKpis([{ closingBalance: 2500 }]);
    expect(shortResult).toEqual({
      runningBalance: 2500,
      nextMonthForecast: null,
      threeMonthForecast: null
    });
  });
});
