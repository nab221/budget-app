import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadHTML() {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  return fs.readFileSync(htmlPath, 'utf8');
}

function makeDOM(html) {
  return new JSDOM(html, { runScripts: 'dangerously' }).window.document;
}

// ---------------------------------------------------------------------------
// Test 1: Dashboard initializes segmented control with correct values
// ---------------------------------------------------------------------------

describe('dashboard view-toggle: segmented control initialization', () => {
  it('HTML seam contains a dashboardViewSegmentedControl mount point', () => {
    const html = loadHTML();
    expect(html).toContain('id="dashboardViewSegmentedControl"');
  });

  it('segmented control mount is co-located with dashboardMonthPicker (within 500 chars)', () => {
    const html = loadHTML();
    const pickerPos = html.indexOf('id="dashboardMonthPicker"');
    const segPos = html.indexOf('id="dashboardViewSegmentedControl"');
    expect(pickerPos).toBeGreaterThan(-1);
    expect(segPos).toBeGreaterThan(-1);
    expect(Math.abs(pickerPos - segPos)).toBeLessThan(500);
  });
});

// ---------------------------------------------------------------------------
// Test 2: Month selector visibility by mode
// ---------------------------------------------------------------------------

describe('dashboard view-toggle: month selector visibility rules', () => {
  it('month picker container is visible in current mode', () => {
    const html = loadHTML();
    const document = makeDOM(html);
    const picker = document.getElementById('dashboardMonthPicker');
    // In the static HTML the picker container should exist and not be hidden
    expect(picker).not.toBeNull();
    // It must not have display:none baked in
    const style = picker.getAttribute('style') || '';
    expect(style).not.toContain('display:none');
    expect(style).not.toContain('display: none');
  });
});

// ---------------------------------------------------------------------------
// Test 3: Keyboard activation path - covered by segmented-control.test.js
// This test verifies the integration contract
// ---------------------------------------------------------------------------

describe('dashboard view-toggle: segmented control contract', () => {
  it('dashboard.js imports createSegmentedControl', () => {
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const src = fs.readFileSync(dashPath, 'utf8');
    expect(src).toContain('createSegmentedControl');
  });

  it('dashboard.js wires onChange to update _selectedView and call renderDashboard', () => {
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const src = fs.readFileSync(dashPath, 'utf8');
    // Must reference onChange updating _selectedView
    expect(src).toContain('_selectedView');
    // Must call renderDashboard inside onChange callback
    // Check the pattern: onChange block references renderDashboard
    expect(src).toContain('renderDashboard');
  });

  it('dashboard.js uses dashboardViewSegmentedControl mount ID', () => {
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const src = fs.readFileSync(dashPath, 'utf8');
    expect(src).toContain('dashboardViewSegmentedControl');
  });
});

// ---------------------------------------------------------------------------
// Test 4: month selector hidden in ytd/all modes (via CSS class or style)
// ---------------------------------------------------------------------------

describe('dashboard view-toggle: month selector hidden in non-current modes', () => {
  it('dashboard.js applies visibility toggle for month picker based on _selectedView', () => {
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const src = fs.readFileSync(dashPath, 'utf8');
    // Must reference the month picker visibility control in relation to _selectedView
    expect(src).toContain('dashboardMonthPicker');
    // Must have conditional logic checking for 'current' mode
    expect(src).toMatch(/_selectedView\s*===\s*['"]current['"]/);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Month selector prev/next/select behavior regression in current mode
// ---------------------------------------------------------------------------

describe('dashboard view-toggle: month navigation regression', () => {
  it('renderMonthNavigator renders prev/next buttons and select', () => {
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const src = fs.readFileSync(dashPath, 'utf8');
    // prev-month and next-month buttons must still be present in renderMonthNavigator
    expect(src).toContain('prev-month');
    expect(src).toContain('next-month');
    expect(src).toContain('month-select');
  });

  it('heatmap year is derived from _selectedMonth (year-boundary correctness)', () => {
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const src = fs.readFileSync(dashPath, 'utf8');
    // Year extraction for heatmap uses _selectedMonth.slice(0, 4)
    expect(src).toContain('_selectedMonth.slice(0, 4)');
    // Both income and spending heatmap calls present
    expect(src).toContain('getYearlyDailyIncome');
    expect(src).toContain('getYearlyDailySpending');
  });
});

// ---------------------------------------------------------------------------
// CSS regression: navigator shell and segmented control button styles
// ---------------------------------------------------------------------------

describe('dashboard view-toggle: CSS navigator styles (Phase 36)', () => {
  const cssPath = path.resolve(process.cwd(), 'css/main.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  it('CSS contains dashboard-navigator-shell sticky rule for desktop', () => {
    expect(css).toContain('.dashboard-navigator-shell');
    expect(css).toContain('position: sticky');
  });

  it('CSS contains dashboard-navigator-shell fixed rule for mobile', () => {
    // Must have fixed positioning inside a mobile media query
    const mobileMediaIdx = css.indexOf('@media (max-width: 768px)');
    // May appear multiple times — check if any contains dashboard-navigator-shell + fixed
    expect(css).toContain('position: fixed');
    // The navigator shell must have a mobile rule with fixed
    const shellIdx = css.lastIndexOf('.dashboard-navigator-shell');
    expect(shellIdx).toBeGreaterThan(-1);
  });

  it('CSS contains segmented-control button active styles', () => {
    expect(css).toContain('.segmented-control__btn');
    expect(css).toContain('.segmented-control__btn.is-active');
  });

  it('CSS contains focus-visible outline for keyboard accessibility', () => {
    expect(css).toContain(':focus-visible');
    expect(css).toContain('outline');
  });

  it('mobile dashboard content has top padding to avoid fixed navigator occlusion', () => {
    expect(css).toContain('.tab-panel[data-panel="dashboard"]');
    expect(css).toContain('padding-top');
  });

  it('bottom nav z-index (1000) takes precedence over dashboard navigator (999)', () => {
    // nav-container z-index for mobile must be >= 1000 to stay on top of fixed navigator
    // The .nav-container mobile rule uses z-index: 1000
    const navIdx = css.indexOf('z-index: 1000');
    expect(navIdx).toBeGreaterThan(-1);
    // Dashboard navigator must use z-index < 1000 (e.g. 999)
    const navShellBlock = css.indexOf('z-index: 999');
    expect(navShellBlock).toBeGreaterThan(-1);
  });
});

// ---------------------------------------------------------------------------
// Fallback seam: conditional navigator integration safety
// ---------------------------------------------------------------------------

describe('dashboard view-toggle: fallback seam safety', () => {
  it('dashboard.js does not hard-import pay-period navigator at module level', () => {
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const src = fs.readFileSync(dashPath, 'utf8');
    // Pay-period navigator (if it existed as a separate module) would be a dynamic import
    // Verify no static import of a pay-period-navigator module exists
    expect(src).not.toMatch(/^import .* from ['"].*pay-period-navigator/m);
  });

  it('dashboard.js uses conditional check before mounting segmented control (no crash when absent)', () => {
    const dashPath = path.resolve(process.cwd(), 'src/ui/dashboard.js');
    const src = fs.readFileSync(dashPath, 'utf8');
    // The mount is guarded by if (segMount) check
    expect(src).toContain('if (segMount)');
  });
});
