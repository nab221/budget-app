import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeChildcareTopUps, includeChildcareTopUpsInCommittedOutgoings } from '../utils/affordability.js';

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

  it('confirms legacy #viewSelect is removed and segmented control mount is co-located with dashboardMonthPicker', () => {
    const pickerPos = html.indexOf('id="dashboardMonthPicker"');
    const segPos = html.indexOf('id="dashboardViewSegmentedControl"');

    // Legacy viewSelect must be gone
    expect(html).not.toContain('id="viewSelect"');

    // Segmented control mount must be present and near the month picker
    expect(segPos).toBeGreaterThan(-1);
    expect(Math.abs(pickerPos - segPos)).toBeLessThan(500);
  });

  it('preserves essential container IDs for chart and forecast wiring', () => {
    expect(html).toContain('id="rollingOverviewChart"');
    expect(html).toContain('id="spendingBreakdownChart"');
    expect(html).toContain('id="savingsRateKPI"');
  });

  it('dashboard navigator shell uses dashboard-navigator-shell class (Phase 36 sticky/fixed hook)', () => {
    expect(html).toContain('class="dashboard-navigator-shell"');
  });

  it('desktop layout: controls row contains both month picker and segmented control mount', () => {
    const navShellStart = html.indexOf('class="dashboard-navigator-shell"');
    // Find the closing tag of the navigator shell div
    // Both IDs must appear after the shell opening
    const pickerAfter = html.indexOf('id="dashboardMonthPicker"', navShellStart);
    const segAfter = html.indexOf('id="dashboardViewSegmentedControl"', navShellStart);
    expect(pickerAfter).toBeGreaterThan(navShellStart);
    expect(segAfter).toBeGreaterThan(navShellStart);
  });
});

describe('Dashboard affordability: childcare top-up integration (Phase 35 - CHILD-02)', () => {
  it('normalizeChildcareTopUps produces line items with correct labels and amounts', () => {
    const topUps = [
      { accountId: 1, childName: 'Alice', requiredTopUpPence: 40000, description: 'Childcare top-up: Alice' },
      { accountId: 2, childName: 'Bob', requiredTopUpPence: 0, description: 'Childcare top-up: Bob' }
    ];
    const normalized = normalizeChildcareTopUps(topUps);
    // Only Alice has a required top-up; Bob is zero so filtered
    expect(normalized).toHaveLength(1);
    expect(normalized[0].description).toContain('Alice');
    expect(normalized[0].amount).toBe(40000);
  });

  it('includeChildcareTopUpsInCommittedOutgoings adds childcare rows to timeline', () => {
    const base = [{ date: '2026-04-01', name: 'Rent', amount: 100000, runningBalance: 0 }];
    const items = [{ date: '2026-04-05', description: 'Childcare top-up: Alice', amount: 40000 }];
    const result = includeChildcareTopUpsInCommittedOutgoings(base, items);
    expect(result).toHaveLength(2);
    const total = result.reduce((s, r) => s + r.amount, 0);
    expect(total).toBe(140000);
  });

  it('dashboard affordability does not introduce CSV/reporting/navigation redesign features', () => {
    // Source code inspection: dashboard.js must not reference CSV/report exports
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const dashSource = fs.readFileSync(dashPath, 'utf8');
    // Affordability integration is limited to normalizeChildcareTopUps and includeChildcareTopUpsInCommittedOutgoings
    expect(dashSource).toContain('normalizeChildcareTopUps');
    expect(dashSource).toContain('includeChildcareTopUpsInCommittedOutgoings');
    // Must NOT reference CSV or legacy import expansion
    expect(dashSource).not.toContain('exportCsv');
    expect(dashSource).not.toContain('generateReport');
    expect(dashSource).not.toContain('legacyImport');
  });
});
