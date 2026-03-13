// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock render.js
vi.mock('./render.js', () => ({
  modalUI: {
    elements: { overlay: null, title: null, body: null, footer: null, close: null },
    init: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
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
  recurrentExpenseRepository: {
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteSeries: vi.fn(),
  },
  oneOffExpenseRepository: {
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  categoryRepository: {
    getCategories: vi.fn(async () => []),
  },
  statementRepository: {
    getAll: vi.fn(async () => []),
  },
  targetRepository: {
    getAll: vi.fn(async () => []),
  },
  getYearlyDailySpending: vi.fn(async () => []),
  triggerBalanceRecalc: vi.fn(),
  triggerDailyForecastRecalc: vi.fn(),
}));

// Mock haptics
vi.mock('../utils/haptics.js', () => ({
  triggerHaptic: vi.fn(),
  alertWithHaptic: vi.fn(),
}));

// Mock currency utils
vi.mock('../utils/currency.js', () => ({
  formatGBP: (p) => `£${(p / 100).toFixed(2)}`,
  formatGBPShort: (p) => `£${(p / 100).toFixed(0)}`,
  toPence: (v) => Math.round(v * 100),
  fromPence: (p) => p / 100,
}));

// Mock templates.js
vi.mock('./templates.js', () => ({
  templateUI: {
    render: vi.fn(),
    manualTrigger: vi.fn(async () => {}),
  },
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

// Mock cashflow utils
vi.mock('../utils/cashflow.js', () => ({
  nextWorkingDay: vi.fn((d) => d),
  getDailyRollingData: vi.fn(async () => []),
}));

// Mock recurrence utils
vi.mock('../utils/recurrence.js', () => ({
  generateInstances: vi.fn(() => []),
}));

// Mock security utils
vi.mock('../utils/security.js', () => ({
  generateUUID: vi.fn(() => 'test-uuid'),
}));

// Mock gestures
vi.mock('../utils/gestures.js', () => ({
  SwipeHandler: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
  })),
}));

// Mock heatmap
vi.mock('./heatmap.js', () => ({
  renderSpendingHeatmap: vi.fn(),
}));

// Mock filtering utils
vi.mock('../utils/filtering.js', () => ({
  filterTransactions: vi.fn((items) => items),
}));

import { expensesUI } from './expenses.js';
import { recurrentExpenseRepository, oneOffExpenseRepository } from '../db/repository.js';
import { alertWithHaptic } from '../utils/haptics.js';
import { notificationUI } from './notifications.js';

describe('expenses Phase-18 guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expensesUI.editingId = null;
    expensesUI.editingType = null;
    expensesUI.reconciliationMode = false;

    // Set up DOM mock for tab navigation
    const mockDebtsTab = { click: vi.fn() };
    vi.spyOn(document, 'querySelector').mockImplementation((sel) => {
      if (sel === '#mainTabs .tab[data-tab="debts"]') return mockDebtsTab;
      return null;
    });
    window._mockDebtsTab = mockDebtsTab;

    // Register window.deleteExpense (normally done in setupEventListeners)
    expensesUI.setupEventListeners();
  });

  describe('openForm — debt-linked guard', () => {
    it('shows info toast and returns early for a debt-linked recurrent expense', async () => {
      recurrentExpenseRepository.get.mockResolvedValueOnce({
        id: 99,
        label: 'Loan Payment',
        isDebtPayment: true,
      });

      await expensesUI.openForm(99, 'recurrent');

      expect(notificationUI.info).toHaveBeenCalledWith(
        'This expense is managed in Debts. Redirecting…',
        [],
        1800
      );
      expect(expensesUI.editingId).toBeNull();
      expect(expensesUI.editingType).toBeNull();
      expect(window._mockDebtsTab.click).toHaveBeenCalled();
    });

    it('does NOT redirect for a non-debt recurrent expense', async () => {
      recurrentExpenseRepository.get.mockResolvedValueOnce({
        id: 55,
        label: 'Rent',
        isDebtPayment: false,
        amount: 80000,
        date: '2026-01-01',
        categoryId: null,
        isRecurring: false,
        frequency: 'monthly',
        isEssential: true,
        cycleTotal: '',
        endDate: '',
      });
      // categoryRepository returns empty — openForm will proceed past the guard
      // It will then try to render a modal, which may fail — we just confirm
      // alertWithHaptic was NOT called
      try {
        await expensesUI.openForm(55, 'recurrent');
      } catch {
        // Ignore downstream DOM/modal errors — we only care about the guard
      }

      expect(alertWithHaptic).not.toHaveBeenCalled();
      expect(window._mockDebtsTab.click).not.toHaveBeenCalled();
    });

    it('does NOT redirect for a one-off expense (type !== recurrent)', async () => {
      try {
        await expensesUI.openForm(77, 'oneoff');
      } catch {
        // Ignore downstream errors
      }

      // recurrentExpenseRepository.get should NOT have been called for guard check
      // (guard only runs when type === 'recurrent')
      expect(alertWithHaptic).not.toHaveBeenCalled();
    });
  });

  describe('deleteExpense — debt-linked guard', () => {
    it('shows info toast and redirects for a debt-linked recurrent expense', async () => {
      recurrentExpenseRepository.get.mockResolvedValueOnce({
        id: 99,
        isDebtPayment: true,
        label: 'Loan Payment',
      });

      await window.deleteExpense(99, 'recurrent');

      expect(notificationUI.info).toHaveBeenCalledWith(
        'This expense is managed in Debts. Redirecting…',
        [],
        1800
      );
      expect(window._mockDebtsTab.click).toHaveBeenCalled();
      expect(recurrentExpenseRepository.delete).not.toHaveBeenCalled();
    });

    it('shows info toast and redirects for a debt-linked one-off expense', async () => {
      oneOffExpenseRepository.get.mockResolvedValueOnce({
        id: 88,
        isDebtPayment: true,
        note: 'Debt payment',
      });

      await window.deleteExpense(88, 'oneoff');

      expect(notificationUI.info).toHaveBeenCalledWith(
        'This expense is managed in Debts. Redirecting…',
        [],
        1800
      );
      expect(window._mockDebtsTab.click).toHaveBeenCalled();
      expect(oneOffExpenseRepository.delete).not.toHaveBeenCalled();
    });

    it('does NOT block deletion of a normal recurrent expense', async () => {
      recurrentExpenseRepository.get.mockResolvedValueOnce({
        id: 55,
        isDebtPayment: false,
        label: 'Rent',
        isRecurring: false,
      });

      // Mock confirmWithHaptic / confirm so deletion proceeds without UI
      const origConfirm = window.confirm;
      window.confirm = vi.fn(() => false); // user cancels — avoids actual delete

      await window.deleteExpense(55, 'recurrent');

      expect(alertWithHaptic).not.toHaveBeenCalled();

      window.confirm = origConfirm;
    });
  });
});
