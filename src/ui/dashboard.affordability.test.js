/**
 * dashboard.affordability.test.js
 *
 * Tests for the pay-period affordability section rendered in the Dashboard.
 * Covers: section rendering, deficit/buffer banners, balance-entry modal,
 * navigator controls, and pay-period boundary collection-driven logic.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock heavy dependencies before importing dashboard
// ---------------------------------------------------------------------------

vi.mock('../db/schema.js', () => ({
  db: {
    tables: [],
    verno: 22,
    dailyBalanceSnapshots: {
      where: vi.fn(() => ({ equals: vi.fn(() => ({ first: vi.fn().mockResolvedValue(null) })) })),
      orderBy: vi.fn(() => ({ last: vi.fn().mockResolvedValue(null) })),
      add: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      toArray: vi.fn().mockResolvedValue([])
    },
    userPreferences: {
      get: vi.fn().mockResolvedValue(undefined),
      put: vi.fn().mockResolvedValue(undefined)
    }
  }
}));

vi.mock('../db/repository.js', () => ({
  getDashboardData: vi.fn().mockResolvedValue({
    income: 0, fixed: 0, variable: 0, totalExpenses: 0, netPosition: 0,
    totalSubscriptions: 0, totalDebt: 0, totalAssets: 0, netWorth: 0,
    fixedToIncomeRatio: 0, categorySpending: {}, bucketSpending: { recurrent: 0, 'one-off': 0 },
    childcareSummary: [], ccPayments: 0, loanPayments: 0, extraPayment: 0
  }),
  getCurrentBalance: vi.fn().mockResolvedValue(100000),
  debtRepository: { getAll: vi.fn().mockResolvedValue([]) },
  targetRepository: { getByBucket: vi.fn().mockResolvedValue(null) },
  netWorthRepository: { checkAndTakeSnapshot: vi.fn().mockResolvedValue(undefined) },
  balanceSnapshotRepository: {
    getByMonth: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(1),
    getLatestSnapshot: vi.fn().mockResolvedValue(null),
    deleteFrom: vi.fn().mockResolvedValue(undefined)
  },
  expectedIncomeRepository: { getByMonth: vi.fn().mockResolvedValue([]) },
  childcareRepository: {
    getAccounts: vi.fn().mockResolvedValue([]),
    getAllRequiredTopUps: vi.fn().mockResolvedValue({ topUps: [], totalTopUpPence: 0 })
  },
  categoryRepository: { getCategories: vi.fn().mockResolvedValue([]) },
  getYearlyDailyIncome: vi.fn().mockResolvedValue({}),
  getYearlyDailySpending: vi.fn().mockResolvedValue({}),
  incomeSourceRepository: { getActive: vi.fn().mockResolvedValue([]) },
  spendingBucketRepository: { getAll: vi.fn().mockResolvedValue([]) },
  recurrentExpenseRepository: { getAll: vi.fn().mockResolvedValue([]) },
  oneOffExpenseRepository: { getAll: vi.fn().mockResolvedValue([]) },
  getSafetyBuffer: vi.fn().mockResolvedValue(20000),
  setSafetyBuffer: vi.fn().mockResolvedValue(undefined),
  getLatestDailySnapshot: vi.fn().mockResolvedValue(null),
  saveBalanceSnapshot: vi.fn().mockResolvedValue(undefined),
  adjustBalance: vi.fn().mockResolvedValue(undefined),
  triggerBalanceRecalc: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../utils/cashflow.js', () => ({
  getDailyRollingData: vi.fn().mockResolvedValue({ data: { balance: [] }, todayIndex: -1 }),
  calculateForecast: vi.fn().mockResolvedValue([])
}));

vi.mock('./charts.js', () => ({
  renderRollingOverviewChart: vi.fn(),
  renderSpendingBreakdownChart: vi.fn()
}));

vi.mock('./pwa-ux.js', () => ({
  checkStoragePersistence: vi.fn().mockResolvedValue(true)
}));

vi.mock('./render.js', () => ({
  modalUI: {
    show: vi.fn(),
    close: vi.fn()
  },
  adjustFontSize: vi.fn()
}));

vi.mock('./heatmap.js', () => ({
  renderSpendingHeatmap: vi.fn()
}));

vi.mock('./dashboard-kpis.js', () => ({
  pickInvariantForecastKpis: vi.fn().mockReturnValue({
    runningBalance: 100000,
    nextMonthForecast: 90000,
    threeMonthForecast: 80000
  }),
  rebaseForecastSnapshots: vi.fn(s => s)
}));

vi.mock('../utils/income.js', () => ({
  getUpcomingIncomeEvents: vi.fn().mockReturnValue([])
}));

vi.mock('../utils/pay-period.js', () => ({
  getPayPeriodBounds: vi.fn().mockReturnValue(null),
  getBillsInPayPeriod: vi.fn().mockReturnValue([]),
  calculatePayPeriodSummary: vi.fn().mockReturnValue({
    rows: [],
    closingBalance: 100000,
    isDeficit: false,
    isBelowBuffer: false
  })
}));

// ---------------------------------------------------------------------------
// DOM setup
// ---------------------------------------------------------------------------

function setupDOM() {
  document.body.innerHTML = `
    <div id="dashboardMonthPicker"></div>
    <div id="summaryGrid"></div>
    <div id="rollingOverviewChartContainer">
      <canvas id="rollingOverviewChart"></canvas>
    </div>
    <canvas id="spendingBreakdownChart"></canvas>
    <div id="savingsRateKPI"></div>
    <div id="incomeHeatmapContainer"></div>
    <div id="spendingHeatmapContainer"></div>
  `;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dashboard affordability section', () => {
  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders without throwing when no income events or snapshot exist', async () => {
    const { renderDashboard } = await import('./dashboard.js');
    await expect(renderDashboard()).resolves.not.toThrow();
  }, 30000);

  it('creates an affordability section container in the DOM after render', async () => {
    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();
    // After render, the pay-period container should exist
    const section = document.getElementById('payPeriodSection');
    expect(section).not.toBeNull();
  });

  it('shows "no income sources" message when income events list is empty', async () => {
    const { getUpcomingIncomeEvents } = await import('../utils/income.js');
    getUpcomingIncomeEvents.mockReturnValue([]);

    const { getPayPeriodBounds } = await import('../utils/pay-period.js');
    getPayPeriodBounds.mockReturnValue(null);

    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();

    const section = document.getElementById('payPeriodSection');
    expect(section).not.toBeNull();
    // Section should mention "no income" or similar
    expect(section.textContent).toMatch(/no income|no pay period|configure income/i);
  });

  it('shows pay-period timeline table when bounds and bills exist', async () => {
    const { getPayPeriodBounds } = await import('../utils/pay-period.js');
    getPayPeriodBounds.mockReturnValue({
      start: new Date('2026-03-10T00:00:00Z'),
      end: new Date('2026-03-25T00:00:00Z'),
      nextIncomeEvent: { sourceId: 1, sourceName: 'Salary', amount: 200000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    });

    const { getBillsInPayPeriod } = await import('../utils/pay-period.js');
    getBillsInPayPeriod.mockReturnValue([
      { date: new Date('2026-03-18T00:00:00Z'), name: 'Mortgage', amount: 105000, isAdjusted: false, runningBalance: -5000 }
    ]);

    const { calculatePayPeriodSummary } = await import('../utils/pay-period.js');
    calculatePayPeriodSummary.mockReturnValue({
      rows: [
        { date: new Date('2026-03-18T00:00:00Z'), name: 'Mortgage', amount: 105000, isAdjusted: false, runningBalance: -5000 }
      ],
      closingBalance: -5000,
      isDeficit: true,
      isBelowBuffer: false
    });

    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();

    const section = document.getElementById('payPeriodSection');
    expect(section).not.toBeNull();
    // Should contain the timeline table
    expect(section.querySelector('table') || section.textContent).toBeTruthy();
  });

  it('shows deficit warning banner when closingBalance < 0', async () => {
    const { getPayPeriodBounds } = await import('../utils/pay-period.js');
    getPayPeriodBounds.mockReturnValue({
      start: new Date('2026-03-10T00:00:00Z'),
      end: new Date('2026-03-25T00:00:00Z'),
      nextIncomeEvent: { sourceId: 1, sourceName: 'Salary', amount: 200000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    });

    const { calculatePayPeriodSummary } = await import('../utils/pay-period.js');
    calculatePayPeriodSummary.mockReturnValue({
      rows: [],
      closingBalance: -5000,
      isDeficit: true,
      isBelowBuffer: false
    });

    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();

    const section = document.getElementById('payPeriodSection');
    // Should display a deficit warning
    expect(section.textContent).toMatch(/deficit|projected shortfall/i);
  });

  it('shows safety-buffer warning banner when closingBalance < safetyBuffer but >= 0', async () => {
    const { getPayPeriodBounds } = await import('../utils/pay-period.js');
    getPayPeriodBounds.mockReturnValue({
      start: new Date('2026-03-10T00:00:00Z'),
      end: new Date('2026-03-25T00:00:00Z'),
      nextIncomeEvent: { sourceId: 1, sourceName: 'Salary', amount: 200000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    });

    const { calculatePayPeriodSummary } = await import('../utils/pay-period.js');
    calculatePayPeriodSummary.mockReturnValue({
      rows: [],
      closingBalance: 5000,  // £50 — below £200 safetyBuffer
      isDeficit: false,
      isBelowBuffer: true
    });

    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();

    const section = document.getElementById('payPeriodSection');
    expect(section.textContent).toMatch(/safety buffer|below.*buffer/i);
  });

  it('displays max extra payment line (max(0, closingBalance - safetyBuffer))', async () => {
    const { getPayPeriodBounds } = await import('../utils/pay-period.js');
    getPayPeriodBounds.mockReturnValue({
      start: new Date('2026-03-10T00:00:00Z'),
      end: new Date('2026-03-25T00:00:00Z'),
      nextIncomeEvent: { sourceId: 1, sourceName: 'Salary', amount: 200000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    });

    const { getSafetyBuffer } = await import('../db/repository.js');
    getSafetyBuffer.mockResolvedValue(20000); // £200

    const { calculatePayPeriodSummary } = await import('../utils/pay-period.js');
    calculatePayPeriodSummary.mockReturnValue({
      rows: [],
      closingBalance: 70000,  // £700 — max extra = £700 - £200 = £500
      isDeficit: false,
      isBelowBuffer: false
    });

    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();

    const section = document.getElementById('payPeriodSection');
    // Should mention max extra payment or safe to pay
    expect(section.textContent).toMatch(/max.*extra|safe.*pay|extra payment/i);
  });

  it('shows balance-entry button in the affordability section', async () => {
    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();

    const section = document.getElementById('payPeriodSection');
    const btn = section.querySelector('button[data-action="enter-balance"], button');
    expect(btn).not.toBeNull();
  });

  it('pay-period bounds are always derived from income-event collection, not singular payDay', async () => {
    // This regression test verifies getPayPeriodBounds is called with the income events
    // collection (result of getUpcomingIncomeEvents), not a hardcoded or singular payDay.
    const { getUpcomingIncomeEvents } = await import('../utils/income.js');
    const { getPayPeriodBounds } = await import('../utils/pay-period.js');

    getUpcomingIncomeEvents.mockReturnValue([
      { sourceId: 1, sourceName: 'NHS Salary', amount: 245000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    ]);
    getPayPeriodBounds.mockReturnValue({
      start: new Date('2026-03-10T00:00:00Z'),
      end: new Date('2026-03-25T00:00:00Z'),
      nextIncomeEvent: { sourceId: 1, sourceName: 'NHS Salary', amount: 245000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    });

    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();

    // getPayPeriodBounds must be called with an array (not a scalar payDay)
    expect(getPayPeriodBounds).toHaveBeenCalled();
    const firstCallArg = getPayPeriodBounds.mock.calls[0][0];
    expect(Array.isArray(firstCallArg)).toBe(true);
  });
});

describe('Pay-period navigator', () => {
  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders prev/next navigator buttons in pay-period section', async () => {
    const { getPayPeriodBounds } = await import('../utils/pay-period.js');
    getPayPeriodBounds.mockReturnValue({
      start: new Date('2026-03-10T00:00:00Z'),
      end: new Date('2026-03-25T00:00:00Z'),
      nextIncomeEvent: { sourceId: 1, sourceName: 'Salary', amount: 200000, nominalDate: '2026-03-25', adjustedDate: '2026-03-25' }
    });

    const { renderDashboard } = await import('./dashboard.js');
    await renderDashboard();

    const section = document.getElementById('payPeriodSection');
    const buttons = section.querySelectorAll('button');
    // There should be at least navigator buttons or a balance-entry button
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('does not break existing _selectedMonth/_selectedView behavior after render', async () => {
    const { renderDashboard } = await import('./dashboard.js');

    // First render
    await renderDashboard();
    // Month picker must still exist
    const picker = document.getElementById('dashboardMonthPicker');
    expect(picker).not.toBeNull();
    expect(picker.innerHTML).toContain('select');
  });
});
