import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('dashboard layout invariants', () => {
  it('places month navigation, view selector, and KPI grid above the rolling chart', () => {
    const htmlPath = path.resolve(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const pickerPos = html.indexOf('id="dashboardMonthPicker"');
    const viewPos = html.indexOf('id="viewSelect"');
    const gridPos = html.indexOf('id="summaryGrid"');
    const rollingPos = html.indexOf('id="rollingOverviewChartContainer"');

    expect(pickerPos).toBeGreaterThan(-1);
    expect(viewPos).toBeGreaterThan(-1);
    expect(gridPos).toBeGreaterThan(-1);
    expect(rollingPos).toBeGreaterThan(-1);
    expect(pickerPos).toBeLessThan(rollingPos);
    expect(viewPos).toBeLessThan(rollingPos);
    expect(gridPos).toBeLessThan(rollingPos);
  });
});
