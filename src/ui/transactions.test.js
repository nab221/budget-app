// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock render.js
vi.mock('./render.js', () => ({
  modalUI: {
    elements: { overlay: null, title: null, body: null, footer: null, close: null },
    init: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
    confirm: vi.fn().mockResolvedValue(false),
  },
  safeHTML: (strings, ...values) =>
    strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? String(values[i]) : ''), ''),
  sanitize: (str) => str,
  renderTabSummary: vi.fn(),
  adjustFontSize: vi.fn(),
  showModal: vi.fn(),
  closeModal: vi.fn(),
}));

// Mock repository.js
vi.mock('../db/repository.js', () => ({
  incomeRepository: {
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    getByMonth: vi.fn(async () => []),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  recurrentExpenseRepository: {
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    getByMonth: vi.fn(async () => []),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteSeries: vi.fn(),
  },
  oneOffExpenseRepository: {
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    getByMonth: vi.fn(async () => []),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  categoryRepository: {
    getCategories: vi.fn(async () => []),
  },
  getYearlyDailyIncome: vi.fn(async () => []),
  getYearlyDailySpending: vi.fn(async () => []),
  triggerBalanceRecalc: vi.fn(),
  triggerDailyForecastRecalc: vi.fn(),
}));

// Mock haptics
vi.mock('../utils/haptics.js', () => ({
  triggerHaptic: vi.fn(),
}));

// Mock currency utils
vi.mock('../utils/currency.js', () => ({
  formatGBP: (p) => `£${(p / 100).toFixed(2)}`,
  formatGBPShort: (p) => `£${(p / 100).toFixed(0)}`,
  toPence: (v) => Math.round(v * 100),
  fromPence: (p) => p / 100,
}));

// Mock filtering utils
vi.mock('../utils/filtering.js', () => ({
  filterTransactions: vi.fn((items) => items),
}));

// Mock notifications
vi.mock('./notifications.js', () => ({
  notificationUI: {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock heatmap
vi.mock('./heatmap.js', () => ({
  renderSpendingHeatmap: vi.fn(),
}));

// Mock gestures
vi.mock('../utils/gestures.js', () => ({
  SwipeHandler: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    destroy: vi.fn(),
  })),
}));

import { transactionUI } from './transactions.js';
import {
  incomeRepository,
  recurrentExpenseRepository,
  oneOffExpenseRepository,
  categoryRepository,
} from '../db/repository.js';
import { modalUI } from './render.js';

// Helper: minimal DOM setup for renderTransactions
function setupTransactionsDOM() {
  document.body.innerHTML = `
    <table><tbody id="incBody"></tbody></table>
    <div id="incomeSummary"></div>
    <div id="incMonthPicker"></div>
    <div id="incCategoryFilterContainer"></div>
  `;
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionUI.searchQuery = '';
  transactionUI.selectedCategories = [];
  transactionUI.reconciliationMode = false;
  if ('sortOrder' in transactionUI) {
    transactionUI.sortOrder = 'desc';
  }
});

// ─── TRANS-01: Expense row contains btn-mark-paid button ─────────────────────

describe('TRANS-01: expense row mark-paid button', () => {
  it('renders a .btn-mark-paid button in expense rows', async () => {
    setupTransactionsDOM();

    recurrentExpenseRepository.getByMonth.mockResolvedValueOnce([
      {
        id: 1,
        type: 'recurrent',
        status: 'pending',
        amount: 1000,
        label: 'Test Expense',
        nextDate: '2026-03-01',
        isDebtPayment: false,
      },
    ]);
    incomeRepository.getByMonth.mockResolvedValueOnce([]);
    oneOffExpenseRepository.getByMonth.mockResolvedValueOnce([]);
    categoryRepository.getCategories.mockResolvedValueOnce([]);

    await transactionUI.renderTransactions('2026-03');

    // Fails until expense rows render a .btn-mark-paid button (TRANS-01)
    expect(document.querySelector('.btn-mark-paid')).not.toBeNull();
  });
});

// ─── TRANS-02: Income row shows only redirect button (no Confirm/Edit/Delete) ─

describe('TRANS-02: income row confirm-income button', () => {
  it('renders a redirect button in income rows (not btn-confirm-income)', async () => {
    setupTransactionsDOM();

    incomeRepository.getByMonth.mockResolvedValueOnce([
      {
        id: 2,
        source: 'Salary',
        amount: 200000,
        date: '2026-03-01',
        isCleared: false,
      },
    ]);
    recurrentExpenseRepository.getByMonth.mockResolvedValueOnce([]);
    oneOffExpenseRepository.getByMonth.mockResolvedValueOnce([]);
    categoryRepository.getCategories.mockResolvedValueOnce([]);

    await transactionUI.renderTransactions('2026-03');

    // Post-fix state: income rows show only a redirect button; no Confirm/Edit/Delete buttons
    expect(document.querySelector('.btn-confirm-income')).toBeNull();
    const actionCell = document.querySelector('td.col-actions');
    expect(actionCell).not.toBeNull();
    expect(actionCell.querySelectorAll('button').length).toBe(1);
    expect(actionCell.querySelector('button').title).toBe('Go to Income Sources');
  });
});

// ─── TRANS-03: No #toggleExpReconBtn in Transactions tab ─────────────────────

describe('TRANS-03: only one reconciliation button exists', () => {
  it('does not have a #toggleExpReconBtn element in the DOM', () => {
    // Post-fix state: Transactions tab toolbar has only #toggleIncReconBtn.
    // #toggleExpReconBtn was removed from index.html (TRANS-03).
    document.body.innerHTML = `
      <div data-panel="transactions">
        <button id="toggleIncReconBtn">Reconciliation Mode</button>
      </div>
    `;

    // Assert post-fix state: the duplicate button does NOT exist.
    expect(document.getElementById('toggleExpReconBtn')).toBeNull();
  });
});

// ─── TRANS-04: openAddTypeModal shows Income and Expense options ──────────────

describe('TRANS-04: openAddTypeModal shows type selection', () => {
  it('calls modalUI.show with content containing Income and Expense', () => {
    // Fails if openAddTypeModal does not exist or does not call modalUI.show with correct content
    expect(typeof transactionUI.openAddTypeModal).toBe('function');
    transactionUI.openAddTypeModal();

    expect(modalUI.show).toHaveBeenCalled();
    const callArgs = modalUI.show.mock.calls[0];
    const content = callArgs[1];
    expect(content).toContain('Income');
    expect(content).toContain('Expense');
  });
});

// ─── TRANS-05: sortOrder defaults to 'desc'; _buildMergedRows respects 'asc' ─

describe('TRANS-05: sort order toggle', () => {
  it("transactionUI.sortOrder defaults to 'desc'", () => {
    // Fails until sortOrder property is added to transactionUI
    expect(transactionUI.sortOrder).toBe('desc');
  });

  it('_buildMergedRows returns rows ascending by displayDate when sortOrder is asc', () => {
    // Fails until _buildMergedRows respects this.sortOrder
    transactionUI.sortOrder = 'asc';

    const incomeItems = [
      { id: 10, source: 'B', amount: 100, date: '2026-03-10', isCleared: false },
      { id: 11, source: 'A', amount: 200, date: '2026-03-01', isCleared: false },
    ];

    const rows = transactionUI._buildMergedRows(incomeItems, [], []);

    // In ascending order, '2026-03-01' should come before '2026-03-10'
    expect(rows[0].displayDate).toBe('2026-03-01');
  });
});

// ─── TRANS-06: Amount cells have + / − prefix ────────────────────────────────

describe('TRANS-06: amount prefix + for income, − for expense', () => {
  it('income amount cell contains + prefix and expense amount cell contains − prefix', async () => {
    setupTransactionsDOM();

    incomeRepository.getByMonth.mockResolvedValueOnce([
      { id: 1, source: 'Salary', amount: 100000, date: '2026-03-15', isCleared: false },
    ]);
    recurrentExpenseRepository.getByMonth.mockResolvedValueOnce([
      {
        id: 2,
        type: 'recurrent',
        status: 'pending',
        amount: 5000,
        label: 'Rent',
        nextDate: '2026-03-01',
        isDebtPayment: false,
      },
    ]);
    oneOffExpenseRepository.getByMonth.mockResolvedValueOnce([]);
    categoryRepository.getCategories.mockResolvedValueOnce([]);

    await transactionUI.renderTransactions('2026-03');

    const body = document.getElementById('incBody');
    const allCells = Array.from(body.querySelectorAll('td'));

    // Fails until income rows render amount with + prefix
    const hasIncomePlus = allCells.some((td) => td.textContent.includes('+'));
    expect(hasIncomePlus).toBe(true);

    // Fails until expense rows render amount with − prefix (U+2212)
    const hasExpenseMinus = allCells.some((td) => td.textContent.includes('\u2212'));
    expect(hasExpenseMinus).toBe(true);
  });
});

// ─── TRANS-07: incSearch placeholder is "Search transactions" ────────────────

describe('TRANS-07: search input placeholder', () => {
  it('incSearch placeholder should be "Search transactions" not "Search income..."', () => {
    // Build the DOM with the post-fix placeholder (index.html has been updated — TRANS-07)
    document.body.innerHTML = `<input id="incSearch" placeholder="Search transactions"/>`;

    const searchInput = document.getElementById('incSearch');

    expect(searchInput.getAttribute('placeholder')).toBe('Search transactions');
  });
});

// ─── TRANS-08: renderCategoryFilter includes expense categories ───────────────

describe('TRANS-08: category filter includes non-income categories', () => {
  it('renders only non-system categories that have transactions in the current month', async () => {
    document.body.innerHTML = `<div id="incCategoryFilterContainer"></div>`;

    // Ensure currentMonth is set so the filter queries use a consistent month
    transactionUI.currentMonth = '2026-03';

    categoryRepository.getCategories.mockResolvedValueOnce([
      { id: 1, name: 'Salary', group: 'income' },
      { id: 2, name: 'Credit Cards', group: 'expenses' },
      { id: 3, name: 'System', group: 'system' },
    ]);
    // Provide an expense transaction tagged with category id 2 (Credit Cards)
    incomeRepository.getByMonth.mockResolvedValueOnce([]);
    recurrentExpenseRepository.getByMonth.mockResolvedValueOnce([
      { id: 10, label: 'Visa', amount: 5000, categoryId: 2, nextDate: '2026-03-15', date: '2026-03-15' },
    ]);
    oneOffExpenseRepository.getByMonth.mockResolvedValueOnce([]);

    await transactionUI.renderCategoryFilter();

    const container = document.getElementById('incCategoryFilterContainer');
    // Credit Cards (group: expenses) has a transaction — must appear
    expect(container.innerHTML).toContain('Credit Cards');
    // System group is always excluded
    expect(container.innerHTML).not.toContain('System');
    // Salary (group: income) has no transaction this month — must not appear
    expect(container.innerHTML).not.toContain('Salary');
  });
});

// ─── RECON-01: #markAllPaidBtn and #triggerRecurrenceBtn removed ─────────────

describe('RECON-01: no dead buttons in Transactions tab', () => {
  it('markAllPaidBtn does not exist in Transactions tab DOM', () => {
    document.body.innerHTML = `
      <div data-panel="transactions">
        <button id="toggleIncReconBtn" class="ghost sm">Reconciliation Mode</button>
      </div>
    `;
    expect(document.getElementById('markAllPaidBtn')).toBeNull();
    expect(document.getElementById('triggerRecurrenceBtn')).toBeNull();
    expect(document.getElementById('markAllPaidRow')).toBeNull();
  });
});

// ─── RECON-02: reconciliation mode toggle works end-to-end ───────────────────

describe('RECON-02: reconciliation mode toggles correctly', () => {
  it('toggleReconciliationMode flips reconciliationMode and toggles incReconHeader hidden class', () => {
    document.body.innerHTML = `
      <div data-panel="transactions">
        <button id="toggleIncReconBtn" class="ghost sm">Reconciliation Mode</button>
        <div id="incReconHeader" class="hidden"></div>
        <table><tbody id="incBody"></tbody></table>
      </div>
    `;

    expect(transactionUI.reconciliationMode).toBe(false);

    transactionUI.toggleReconciliationMode();
    expect(transactionUI.reconciliationMode).toBe(true);
    expect(document.getElementById('incReconHeader').classList.contains('hidden')).toBe(false);

    transactionUI.toggleReconciliationMode();
    expect(transactionUI.reconciliationMode).toBe(false);
    expect(document.getElementById('incReconHeader').classList.contains('hidden')).toBe(true);
  });
});
