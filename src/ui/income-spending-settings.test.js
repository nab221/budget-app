// @vitest-environment jsdom

/**
 * income-spending-settings.test.js
 *
 * Phase 33: Tests for the incomeSpendingSettings UI module.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock repository
// ---------------------------------------------------------------------------
const mockSources = [];
const mockBuckets = [];

vi.mock('../db/repository.js', () => ({
  incomeSourceRepository: {
    getAll: vi.fn(async () => [...mockSources]),
    get: vi.fn(async (id) => mockSources.find(s => s.id === id) ?? null),
    add: vi.fn(async (data) => { const id = mockSources.length + 1; mockSources.push({ id, ...data }); return id; }),
    update: vi.fn(async (id, data) => { const idx = mockSources.findIndex(s => s.id === id); if (idx !== -1) mockSources[idx] = { ...mockSources[idx], ...data }; return 1; }),
    delete: vi.fn(async (id) => { const idx = mockSources.findIndex(s => s.id === id); if (idx !== -1) mockSources.splice(idx, 1); }),
    validateAndAdd: vi.fn(async (data) => { const id = mockSources.length + 1; mockSources.push({ id, ...data }); return id; }),
    validateAndUpdate: vi.fn(async (id, data) => { const idx = mockSources.findIndex(s => s.id === id); if (idx !== -1) mockSources[idx] = { ...mockSources[idx], ...data }; return 1; }),
  },
  spendingBucketRepository: {
    getAll: vi.fn(async () => [...mockBuckets]),
    get: vi.fn(async (id) => mockBuckets.find(b => b.id === id) ?? null),
    add: vi.fn(async (data) => { const id = mockBuckets.length + 1; mockBuckets.push({ id, ...data }); return id; }),
    update: vi.fn(async (id, data) => { const idx = mockBuckets.findIndex(b => b.id === id); if (idx !== -1) mockBuckets[idx] = { ...mockBuckets[idx], ...data }; return 1; }),
    delete: vi.fn(async (id) => { const idx = mockBuckets.findIndex(b => b.id === id); if (idx !== -1) mockBuckets.splice(idx, 1); }),
    seedDefaults: vi.fn(async () => true),
    count: vi.fn(async () => mockBuckets.length),
  },
}));

// ---------------------------------------------------------------------------
// Mock income.js helpers
// ---------------------------------------------------------------------------
vi.mock('../utils/income.js', () => ({
  getNextIncomeEvent: vi.fn((source, _fromDate) => {
    if (!source.isActive) return null;
    return {
      sourceId: source.id,
      sourceName: source.name,
      amount: source.monthlyAmount,
      nominalDate: '2026-03-25',
      adjustedDate: '2026-03-25'
    };
  })
}));

// ---------------------------------------------------------------------------
// Mock haptics and notifications
// ---------------------------------------------------------------------------
vi.mock('../utils/haptics.js', () => ({ triggerHaptic: vi.fn() }));
vi.mock('./notifications.js', () => ({
  notificationUI: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Import subject under test
// ---------------------------------------------------------------------------
const { incomeSpendingSettings } = await import('./income-spending-settings.js');

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function setupDOM() {
  document.body.innerHTML = `<div id="${incomeSpendingSettings.CONTAINER_ID}"></div>`;
}

function getContainer() {
  return document.getElementById(incomeSpendingSettings.CONTAINER_ID);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('incomeSpendingSettings', () => {
  beforeEach(() => {
    setupDOM();
    mockSources.splice(0);
    mockBuckets.splice(0);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('render', () => {
    it('renders the "Income Sources" heading', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().innerHTML).toContain('Income Sources');
    });

    it('renders the "Spending Buckets" heading', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().innerHTML).toContain('Spending Buckets');
    });

    it('renders the "+ Add Source" button', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().querySelector('#addIncomeSourceBtn')).not.toBeNull();
    });

    it('renders the "+ Add Bucket" button', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().querySelector('#addSpendingBucketBtn')).not.toBeNull();
    });

    it('renders empty state message when no income sources exist', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().innerHTML).toContain('No income sources');
    });

    it('renders empty state message when no spending buckets exist', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().innerHTML).toContain('No spending buckets');
    });

    it('renders all income source rows', async () => {
      mockSources.push(
        { id: 1, name: 'Salary', monthlyAmount: 350000, payDateRule: 'nth-of-month', payDateDay: 25, isActive: true, displayOrder: 0 },
        { id: 2, name: 'Freelance', monthlyAmount: 50000, payDateRule: 'last-day', payDateDay: null, isActive: true, displayOrder: 1 }
      );
      await incomeSpendingSettings.render();
      const rows = getContainer().querySelectorAll('[data-source-id]');
      expect(rows.length).toBe(2);
    });

    it('renders projected payday for each source row', async () => {
      mockSources.push({ id: 1, name: 'Salary', monthlyAmount: 350000, payDateRule: 'nth-of-month', payDateDay: 25, isActive: true, displayOrder: 0 });
      await incomeSpendingSettings.render();
      const html = getContainer().innerHTML;
      // formatDate('2026-03-25') -> '25 Mar 2026'
      expect(html).toContain('Mar 2026');
    });

    it('renders 3+ income sources without any cap warning', async () => {
      for (let i = 1; i <= 4; i++) {
        mockSources.push({ id: i, name: `Source ${i}`, monthlyAmount: 10000, payDateRule: 'last-day', payDateDay: null, isActive: true, displayOrder: i - 1 });
      }
      await incomeSpendingSettings.render();
      const rows = getContainer().querySelectorAll('[data-source-id]');
      expect(rows.length).toBe(4);
      expect(getContainer().innerHTML).not.toContain('maximum');
      expect(getContainer().innerHTML).not.toContain('limit');
    });

    it('renders all spending bucket rows', async () => {
      mockBuckets.push(
        { id: 1, name: 'Groceries', monthlyAmount: 30000, icon: null, displayOrder: 0 },
        { id: 2, name: 'Transport', monthlyAmount: 10000, icon: null, displayOrder: 1 }
      );
      await incomeSpendingSettings.render();
      const rows = getContainer().querySelectorAll('[data-bucket-id]');
      expect(rows.length).toBe(2);
    });
  });

  describe('add income source button', () => {
    it('shows the income source form on click', async () => {
      await incomeSpendingSettings.render();
      const addBtn = getContainer().querySelector('#addIncomeSourceBtn');
      addBtn.click();
      expect(getContainer().querySelector('#incomeSourceForm')).not.toBeNull();
    });

    it('removes the form when the add button is clicked a second time (toggle)', async () => {
      await incomeSpendingSettings.render();
      const addBtn = getContainer().querySelector('#addIncomeSourceBtn');
      addBtn.click();
      addBtn.click();
      expect(getContainer().querySelector('#incomeSourceForm')).toBeNull();
    });
  });

  describe('add spending bucket button', () => {
    it('shows the spending bucket form on click', async () => {
      await incomeSpendingSettings.render();
      const addBtn = getContainer().querySelector('#addSpendingBucketBtn');
      addBtn.click();
      expect(getContainer().querySelector('#spendingBucketForm')).not.toBeNull();
    });
  });

  describe('income source form', () => {
    async function openForm() {
      await incomeSpendingSettings.render();
      getContainer().querySelector('#addIncomeSourceBtn').click();
    }

    it('shows payDateDay field when rule is nth-of-month', async () => {
      await openForm();
      const dayWrapper = getContainer().querySelector('#isf-day-wrapper');
      expect(dayWrapper.style.visibility).not.toBe('hidden');
    });

    it('cancel button removes the form', async () => {
      await openForm();
      getContainer().querySelector('#isf-cancel').click();
      expect(getContainer().querySelector('#incomeSourceForm')).toBeNull();
    });

    it('shows error when name is empty on save', async () => {
      await openForm();
      const form = getContainer().querySelector('#incomeSourceForm');
      form.querySelector('#isf-name').value = '';
      getContainer().querySelector('#isf-save').click();
      // After attempted save with no name, error should show
      expect(getContainer().querySelector('#isf-error').textContent).toContain('required');
    });
  });

  describe('spending bucket form', () => {
    async function openForm() {
      await incomeSpendingSettings.render();
      getContainer().querySelector('#addSpendingBucketBtn').click();
    }

    it('cancel button removes the form', async () => {
      await openForm();
      getContainer().querySelector('#sbf-cancel').click();
      expect(getContainer().querySelector('#spendingBucketForm')).toBeNull();
    });

    it('shows error when name is empty on save', async () => {
      await openForm();
      const form = getContainer().querySelector('#spendingBucketForm');
      form.querySelector('#sbf-name').value = '';
      getContainer().querySelector('#sbf-save').click();
      expect(getContainer().querySelector('#sbf-error').textContent).toContain('required');
    });
  });

  describe('init', () => {
    it('calls spendingBucketRepository.seedDefaults()', async () => {
      const { spendingBucketRepository } = await import('../db/repository.js');
      await incomeSpendingSettings.init();
      expect(spendingBucketRepository.seedDefaults).toHaveBeenCalled();
    });
  });

  describe('CONTAINER_ID', () => {
    it('exports the expected container id', () => {
      expect(incomeSpendingSettings.CONTAINER_ID).toBe('incomeSpendingSettingsContainer');
    });
  });
});
