// @vitest-environment jsdom

/**
 * income-spending-settings.test.js
 *
 * Phase 33 / post-Plan-39.1-03: Tests for the incomeSpendingSettings UI module.
 *
 * Income Sources CRUD has been moved to the dedicated Pay Sources tab (Plan 39.1-03).
 * This file tests only the Spending Buckets functionality that remains in Settings.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock repository
// ---------------------------------------------------------------------------
const mockBuckets = [];

vi.mock('../db/repository.js', () => ({
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
    mockBuckets.splice(0);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('render', () => {
    it('renders the "Spending Buckets" heading', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().innerHTML).toContain('Spending Buckets');
    });

    it('does NOT render income sources section (moved to Pay Sources tab)', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().innerHTML).not.toContain('Income Sources');
      expect(getContainer().querySelector('#addIncomeSourceBtn')).toBeNull();
      expect(getContainer().querySelectorAll('.js-edit-source').length).toBe(0);
    });

    it('renders the "+ Add Bucket" button', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().querySelector('#addSpendingBucketBtn')).not.toBeNull();
    });

    it('renders empty state message when no spending buckets exist', async () => {
      await incomeSpendingSettings.render();
      expect(getContainer().innerHTML).toContain('No spending buckets');
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

  describe('add spending bucket button', () => {
    it('shows the spending bucket form on click', async () => {
      await incomeSpendingSettings.render();
      const addBtn = getContainer().querySelector('#addSpendingBucketBtn');
      addBtn.click();
      expect(getContainer().querySelector('#spendingBucketForm')).not.toBeNull();
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
