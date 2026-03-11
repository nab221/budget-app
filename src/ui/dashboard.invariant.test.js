import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('dashboard layout invariants (Phase 17)', () => {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  it('maintains the correct vertical order for invariant/variant separation', () => {
    const rollingPos = html.indexOf('id="rollingOverviewChartContainer"');
    const incomeHeatmapPos = html.indexOf('id="incomeHeatmapSection"');
    const spendingHeatmapPos = html.indexOf('id="spendingHeatmapSection"');
    const pickerPos = html.indexOf('id="dashboardMonthPicker"');
    const gridPos = html.indexOf('id="summaryGrid"');

    // All must exist
    expect(rollingPos).toBeGreaterThan(-1);
    expect(incomeHeatmapPos).toBeGreaterThan(-1);
    expect(spendingHeatmapPos).toBeGreaterThan(-1);
    expect(pickerPos).toBeGreaterThan(-1);
    expect(gridPos).toBeGreaterThan(-1);

    // Verify order: Rolling -> Income Heatmap -> Spending Heatmap -> Month Picker -> KPI Grid
    expect(rollingPos).toBeLessThan(incomeHeatmapPos);
    expect(incomeHeatmapPos).toBeLessThan(spendingHeatmapPos);
    expect(spendingHeatmapPos).toBeLessThan(pickerPos);
    expect(pickerPos).toBeLessThan(gridPos);
  });

  it('ensures viewSelect is co-located with dashboardMonthPicker', () => {
    const pickerPos = html.indexOf('id="dashboardMonthPicker"');
    const viewSelectPos = html.indexOf('id="viewSelect"');
    
    expect(viewSelectPos).toBeGreaterThan(-1);
    // They should be very close to each other (in the same flex container)
    expect(Math.abs(pickerPos - viewSelectPos)).toBeLessThan(500);
  });

  it('preserves essential container IDs for chart and forecast wiring', () => {
    expect(html).toContain('id="rollingOverviewChart"');
    expect(html).toContain('id="spendingBreakdownChart"');
    expect(html).toContain('id="savingsRateKPI"');
  });
});
