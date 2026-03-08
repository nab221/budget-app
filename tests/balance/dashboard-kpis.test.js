import { describe, expect, it } from 'vitest';
import {
  FORECAST_30_DAY_INDEX,
  FORECAST_90_DAY_INDEX,
  pickInvariantForecastKpis,
  rebaseForecastSnapshots
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

  it('rebaseForecastSnapshots aligns day-0 closing while preserving deltas', () => {
    const snapshots = [
      { date: '2026-03-08', openingBalance: 1000, closingBalance: 1100 },
      { date: '2026-03-09', openingBalance: 1100, closingBalance: 950 },
      { date: '2026-03-10', openingBalance: 950, closingBalance: 1200 }
    ];

    const rebased = rebaseForecastSnapshots(snapshots, 2100);

    expect(rebased[0].closingBalance).toBe(2100);
    expect(rebased[0].openingBalance).toBe(2000);
    expect(rebased[1].closingBalance - rebased[0].closingBalance).toBe(
      snapshots[1].closingBalance - snapshots[0].closingBalance
    );
    expect(rebased[2].closingBalance - rebased[1].closingBalance).toBe(
      snapshots[2].closingBalance - snapshots[1].closingBalance
    );
  });

  it('rebaseForecastSnapshots is a no-op for invalid baseline', () => {
    const snapshots = [{ closingBalance: 1000 }];
    expect(rebaseForecastSnapshots(snapshots, Number.NaN)).toBe(snapshots);
  });
});
