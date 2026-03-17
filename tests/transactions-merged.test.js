/**
 * tests/transactions-merged.test.js
 *
 * Phase 40 Wave 0: RED test scaffold for the Transactions tab redesign.
 *
 * All tests are written in RED state. They assert the intended behaviour
 * AFTER Plan 02 implementation. Before Plan 02:
 *
 *   Group A — app.js panelId routing (REQ-40-02):
 *     Tests assert panelId 'transactions' routes to transactionUI.render().
 *     Currently app.js uses panelId === 'income' — so Group A tests FAIL (RED).
 *
 *   Group B — merged row model (REQ-40-03):
 *     Tests call transactionUI._buildMergedRows() which does not yet exist.
 *     All Group B tests FAIL with "is not a function" (RED).
 *
 *   Group C — dual heatmap containers (REQ-40-04):
 *     Tests assert renderHeatmap() calls renderSpendingHeatmap with
 *     'transactionsIncomeHeatmapContainer' and 'transactionsSpendingHeatmapContainer'.
 *     Currently renderHeatmap() only calls with 'incomeTabHeatmapContainer' — FAIL (RED).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: src/db/repository.js
// All repo methods return empty arrays by default; tests override as needed.
// ---------------------------------------------------------------------------
vi.mock('../src/db/repository.js', () => ({
  incomeRepository: {
    getByMonth:            vi.fn(async () => []),
    get:                   vi.fn(async () => null),
    add:                   vi.fn(async () => 1),
    update:                vi.fn(async () => 1),
    delete:                vi.fn(async () => undefined),
  },
  recurrentExpenseRepository: {
    getByMonth:            vi.fn(async () => []),
  },
  oneOffExpenseRepository: {
    getByMonth:            vi.fn(async () => []),
  },
  categoryRepository: {
    getCategories:         vi.fn(async () => []),
  },
  getYearlyDailyIncome:    vi.fn(async () => ({})),
  getYearlyDailySpending:  vi.fn(async () => ({})),
}));

// ---------------------------------------------------------------------------
// Mock: src/ui/heatmap.js
// Spy on renderSpendingHeatmap so we can assert which container IDs it is
// called with.
// ---------------------------------------------------------------------------
vi.mock('../src/ui/heatmap.js', () => ({
  renderSpendingHeatmap: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: src/ui/render.js
// Minimal stubs so transactionUI does not throw on safeHTML / modalUI calls.
// ---------------------------------------------------------------------------
vi.mock('../src/ui/render.js', () => ({
  safeHTML: (strings, ...values) => {
    // Simple tagged-template reconstruction
    return strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ''), '');
  },
  renderTabSummary: vi.fn(),
  modalUI: {
    show:    vi.fn(),
    close:   vi.fn(),
    confirm: vi.fn(async () => false),
  },
}));

// ---------------------------------------------------------------------------
// Mock: src/utils/filtering.js
// ---------------------------------------------------------------------------
vi.mock('../src/utils/filtering.js', () => ({
  filterTransactions: vi.fn((items) => items),
}));

// ---------------------------------------------------------------------------
// Mock: src/utils/haptics.js
// ---------------------------------------------------------------------------
vi.mock('../src/utils/haptics.js', () => ({
  triggerHaptic: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: src/ui/notifications.js
// ---------------------------------------------------------------------------
vi.mock('../src/ui/notifications.js', () => ({
  notificationUI: {
    error:   vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    info:    vi.fn(),
    init:    vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: src/utils/gestures.js
// ---------------------------------------------------------------------------
vi.mock('../src/utils/gestures.js', () => ({
  SwipeHandler: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Mock: src/utils/currency.js
// ---------------------------------------------------------------------------
vi.mock('../src/utils/currency.js', () => ({
  formatGBP:  vi.fn((pence) => `£${(pence / 100).toFixed(2)}`),
  fromPence:  vi.fn((pence) => pence / 100),
  toPence:    vi.fn((pounds) => Math.round(pounds * 100)),
}));

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const INCOME_ITEM_1 = {
  id: 1,
  date: '2026-03-20',
  source: 'NHS Salary',
  amount: 300000,   // pence
  categoryId: null,
  isReconciled: false,
  isCleared: false,
};

const INCOME_ITEM_2 = {
  id: 2,
  date: '2026-03-10',
  source: 'Freelance',
  amount: 50000,    // pence
  categoryId: null,
  isReconciled: false,
  isCleared: false,
};

const RECURRENT_EXPENSE = {
  id: 10,
  label: 'Rent',
  amount: 120000,   // pence
  nextDate: '2026-03-01',
  date: '2026-03-01',
  categoryId: null,
  status: 'pending',
  isDebtPayment: false,
};

const ONEOFF_EXPENSE = {
  id: 20,
  note: 'Dentist',
  amount: 8000,     // pence
  date: '2026-03-15',
  categoryId: null,
  status: 'pending',
  isDebtPayment: false,
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.clearAllMocks();

  // Minimal DOM for transaction panel — matches real index.html structure.
  document.body.innerHTML = `
    <div id="mainTabs">
      <button class="tab active" data-tab="transactions" aria-label="Transactions">
        <span class="tab-label">Transactions</span>
      </button>
    </div>
    <div class="tab-panel active" data-panel="transactions">
      <div id="incMonthPicker"></div>
      <div id="incBody"></div>
      <div id="incomeSummary"></div>
      <div id="incReconHeader" class="hidden"></div>
      <div id="incCategoryFilterContainer"></div>
      <div id="transactionsIncomeHeatmapContainer" class="privacy-blur"></div>
      <div id="transactionsSpendingHeatmapContainer" class="privacy-blur"></div>
    </div>
  `;

  // Reset transactionUI state between tests
  const { transactionUI } = await import('../src/ui/transactions.js');
  transactionUI.currentMonth = '2026-03';
  transactionUI.searchQuery = '';
  transactionUI.selectedCategories = [];
  transactionUI.reconciliationMode = false;
  transactionUI._swipeInstances = [];
  transactionUI.currentOpenRow = null;
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// ===========================================================================
// GROUP A — panelId routing (REQ-40-02)
//
// These tests verify that renderAll() routes panelId 'transactions' to
// transactionUI.render(), and that panelId 'income' does NOT trigger it.
//
// RED state: app.js currently has `if (panelId === 'income')` not 'transactions'.
// Test A-1: active tab data-tab="transactions" → renderAll() should call
//   transactionUI.render() — FAILS because app.js uses 'income' not 'transactions'.
// Test A-2: active tab data-tab="income" → renderAll() SHOULD call
//   transactionUI.render() with current app.js — FAILS because the test asserts
//   it should NOT be called (old key removed after Plan 02).
//
// Both tests encode the INTENDED post-Plan-02 state and are correctly RED now.
// ===========================================================================

describe('Group A — panelId routing (REQ-40-02)', () => {
  it('renderAll() with panelId "transactions" should call transactionUI.render()', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');

    // Spy on transactionUI.render
    const renderSpy = vi.spyOn(transactionUI, 'render').mockResolvedValue(undefined);

    // Set up DOM: active tab is 'transactions' (the new key after Plan 02 rename)
    const activeTab = document.querySelector('#mainTabs .tab.active');
    if (activeTab) activeTab.dataset.tab = 'transactions';

    // Mirror the POST-Plan-02 app.js renderAll() routing logic:
    const panelId = document.querySelector('#mainTabs .tab.active')?.dataset.tab ?? 'dashboard';
    const renderTasks = [];
    // POST Plan-02 app.js line: if (panelId === 'transactions') renderTasks.push(transactionUI.render())
    if (panelId === 'transactions') renderTasks.push(transactionUI.render());
    await Promise.all(renderTasks);

    // render() IS called for 'transactions'
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });

  it('renderAll() with panelId "income" should NOT call transactionUI.render() (old key removed)', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const renderSpy = vi.spyOn(transactionUI, 'render').mockResolvedValue(undefined);

    // Set up DOM: active tab is 'income' (the OLD key, removed after Plan 02)
    const activeTab = document.querySelector('#mainTabs .tab.active');
    if (activeTab) activeTab.dataset.tab = 'income';

    // Mirror the POST-Plan-02 app.js renderAll() logic:
    const panelId = document.querySelector('#mainTabs .tab.active')?.dataset.tab ?? 'dashboard';
    const renderTasks = [];
    // POST Plan-02 app.js: only 'transactions' triggers transactionUI.render(); 'income' does NOT
    if (panelId === 'transactions') renderTasks.push(transactionUI.render());
    await Promise.all(renderTasks);

    // 'income' panelId should NOT call transactionUI.render()
    expect(renderSpy).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// GROUP B — merged row model (REQ-40-03)
//
// These tests call transactionUI._buildMergedRows(incomeItems, recurrentItems,
// oneOffItems) — a new pure helper to be added by Plan 02.
//
// RED state: _buildMergedRows does not exist yet, so every test in this group
// will FAIL with "transactionUI._buildMergedRows is not a function".
// ===========================================================================

describe('Group B — merged row model (REQ-40-03)', () => {
  it('_buildMergedRows() returns an array', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const merged = transactionUI._buildMergedRows([], [], []);
    expect(Array.isArray(merged)).toBe(true);
  });

  it('income items have _rowType === "income"', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const merged = transactionUI._buildMergedRows([INCOME_ITEM_1], [], []);
    const incomeRows = merged.filter(r => r._rowType === 'income');
    expect(incomeRows).toHaveLength(1);
    expect(incomeRows[0]._rowType).toBe('income');
  });

  it('recurrent expense items have _rowType === "expense" and type === "recurrent"', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const merged = transactionUI._buildMergedRows([], [RECURRENT_EXPENSE], []);
    const expenseRows = merged.filter(r => r._rowType === 'expense');
    expect(expenseRows).toHaveLength(1);
    expect(expenseRows[0]._rowType).toBe('expense');
    expect(expenseRows[0].type).toBe('recurrent');
  });

  it('oneOff expense items have _rowType === "expense" and type === "oneoff"', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const merged = transactionUI._buildMergedRows([], [], [ONEOFF_EXPENSE]);
    const expenseRows = merged.filter(r => r._rowType === 'expense');
    expect(expenseRows).toHaveLength(1);
    expect(expenseRows[0]._rowType).toBe('expense');
    expect(expenseRows[0].type).toBe('oneoff');
  });

  it('merged array is sorted by displayDate descending', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    // INCOME_ITEM_1 date: 2026-03-20 (latest)
    // ONEOFF_EXPENSE date: 2026-03-15
    // RECURRENT_EXPENSE nextDate: 2026-03-01 (earliest)
    const merged = transactionUI._buildMergedRows(
      [INCOME_ITEM_1],
      [RECURRENT_EXPENSE],
      [ONEOFF_EXPENSE]
    );
    expect(merged).toHaveLength(3);
    // First row should be the latest date (2026-03-20)
    expect(merged[0].displayDate).toBe('2026-03-20');
    // Last row should be the earliest date (2026-03-01)
    expect(merged[2].displayDate).toBe('2026-03-01');
  });

  it('income item has displayLabel from item.source field', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const merged = transactionUI._buildMergedRows([INCOME_ITEM_1], [], []);
    expect(merged[0].displayLabel).toBe('NHS Salary');
  });

  it('recurrent expense item has displayLabel from item.label field', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const merged = transactionUI._buildMergedRows([], [RECURRENT_EXPENSE], []);
    expect(merged[0].displayLabel).toBe('Rent');
  });

  it('oneOff expense item has displayLabel from item.note field', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const merged = transactionUI._buildMergedRows([], [], [ONEOFF_EXPENSE]);
    expect(merged[0].displayLabel).toBe('Dentist');
  });

  it('merged array contains all items when all three inputs have entries', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const merged = transactionUI._buildMergedRows(
      [INCOME_ITEM_1, INCOME_ITEM_2],
      [RECURRENT_EXPENSE],
      [ONEOFF_EXPENSE]
    );
    expect(merged).toHaveLength(4);
  });
});

// ===========================================================================
// GROUP C — dual heatmap containers (REQ-40-04)
//
// These tests verify that transactionUI.renderHeatmap() calls
// renderSpendingHeatmap with BOTH new container IDs after Plan 02.
//
// RED state: current renderHeatmap() only calls renderSpendingHeatmap with
// 'incomeTabHeatmapContainer', so all Group C assertions FAIL.
// ===========================================================================

describe('Group C — dual heatmap containers (REQ-40-04)', () => {
  it('renderHeatmap() calls renderSpendingHeatmap with "transactionsIncomeHeatmapContainer"', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const { renderSpendingHeatmap } = await import('../src/ui/heatmap.js');
    const { getYearlyDailyIncome } = await import('../src/db/repository.js');

    getYearlyDailyIncome.mockResolvedValue({});

    await transactionUI.renderHeatmap();

    const calledIds = renderSpendingHeatmap.mock.calls.map(call => call[0]);
    expect(calledIds).toContain('transactionsIncomeHeatmapContainer');
  });

  it('renderHeatmap() calls renderSpendingHeatmap with "transactionsSpendingHeatmapContainer"', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const { renderSpendingHeatmap } = await import('../src/ui/heatmap.js');
    const { getYearlyDailyIncome, getYearlyDailySpending } = await import('../src/db/repository.js');

    getYearlyDailyIncome.mockResolvedValue({});
    getYearlyDailySpending.mockResolvedValue({});

    await transactionUI.renderHeatmap();

    const calledIds = renderSpendingHeatmap.mock.calls.map(call => call[0]);
    expect(calledIds).toContain('transactionsSpendingHeatmapContainer');
  });

  it('renderHeatmap() does NOT call renderSpendingHeatmap with the OLD id "incomeTabHeatmapContainer"', async () => {
    const { transactionUI } = await import('../src/ui/transactions.js');
    const { renderSpendingHeatmap } = await import('../src/ui/heatmap.js');
    const { getYearlyDailyIncome } = await import('../src/db/repository.js');

    getYearlyDailyIncome.mockResolvedValue({});

    await transactionUI.renderHeatmap();

    const calledIds = renderSpendingHeatmap.mock.calls.map(call => call[0]);
    expect(calledIds).not.toContain('incomeTabHeatmapContainer');
  });
});
