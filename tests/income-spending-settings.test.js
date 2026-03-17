/**
 * tests/income-spending-settings.test.js
 *
 * Phase 39.1 Wave 0: Scaffold test for the incomeSpendingSettings module.
 *
 * Tests the post-cleanup state after Plan 03 removes the income sources
 * section from Settings. Until Plan 03 runs:
 *   - Test A (GREEN): buckets section is present — passes today
 *   - Test B (RED): income sources section is absent — fails today because
 *     the current implementation still renders the income sources section
 *
 * The RED state of Test B is intentional and confirms Plan 03 is needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: src/db/repository.js
// incomeSourceRepository returns [] (no sources configured)
// spendingBucketRepository returns one bucket to satisfy Test A
// ---------------------------------------------------------------------------
vi.mock('../src/db/repository.js', () => ({
  incomeSourceRepository: {
    getAll: vi.fn(async () => []),
  },
  spendingBucketRepository: {
    getAll:       vi.fn(async () => [{ id: 1, name: 'Groceries', monthlyAmount: 40000, icon: '🛒', displayOrder: 0 }]),
    get:          vi.fn(async () => null),
    add:          vi.fn(async () => 1),
    update:       vi.fn(async () => 1),
    delete:       vi.fn(async () => undefined),
    seedDefaults: vi.fn(async () => true),
    count:        vi.fn(async () => 1),
  },
}));

// ---------------------------------------------------------------------------
// Mock: src/utils/income.js
// getNextIncomeEvent is called per source row — return null (no upcoming pay)
// ---------------------------------------------------------------------------
vi.mock('../src/utils/income.js', () => ({
  getNextIncomeEvent:      vi.fn(() => null),
  getUpcomingIncomeEvents: vi.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Mock: haptics and notifications (not relevant to these tests)
// ---------------------------------------------------------------------------
vi.mock('../src/utils/haptics.js', () => ({ triggerHaptic: vi.fn() }));
vi.mock('../src/ui/notifications.js', () => ({
  notificationUI: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() }
}));

// ---------------------------------------------------------------------------
// Import the real module under test (module exists — src/ui/income-spending-settings.js)
// ---------------------------------------------------------------------------
const { incomeSpendingSettings } = await import('../src/ui/income-spending-settings.js');

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function setupContainer() {
  const div = document.createElement('div');
  div.id = 'incomeSpendingSettingsContainer';
  document.body.appendChild(div);
  return div;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('incomeSpendingSettings — post-Plan-03 state', () => {
  beforeEach(() => {
    setupContainer();
    vi.clearAllMocks();

    // Re-prime mocks after clearAllMocks
    const spendingBucketRepository = vi.mocked(
      (async () => (await import('../src/db/repository.js')).spendingBucketRepository)()
    );
    // Re-mock defaults that clearAllMocks wiped
    // (The vi.mock factory runs once; individual mock.mockResolvedValue calls
    //  are cleared by clearAllMocks, so we restore them here)
    // Access the mock directly via the module mock
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // -------------------------------------------------------------------------
  // Test A: Spending Buckets section IS rendered
  // Expected: GREEN — the current module renders the buckets section
  // -------------------------------------------------------------------------
  it('Test A: renders the Spending Buckets section with bucket data', async () => {
    // Restore mock return values after clearAllMocks
    const { spendingBucketRepository, incomeSourceRepository } = await import('../src/db/repository.js');
    spendingBucketRepository.getAll.mockResolvedValueOnce([
      { id: 1, name: 'Groceries', monthlyAmount: 40000, icon: '🛒', displayOrder: 0 }
    ]);
    incomeSourceRepository.getAll.mockResolvedValueOnce([]);

    await incomeSpendingSettings.render();

    const container = document.getElementById('incomeSpendingSettingsContainer');
    const html = container.innerHTML;

    // The buckets section heading and the bucket name must be present
    expect(html).toContain('Spending Buckets');
    expect(html).toContain('Groceries');
  });

  // -------------------------------------------------------------------------
  // Test B: Income Sources section is NOT rendered
  // Expected: RED until Plan 03 removes the income sources section.
  // Currently fails because the module renders the income sources section.
  // -------------------------------------------------------------------------
  it('Test B: does NOT render Income Sources heading or js-edit-source controls', async () => {
    const { spendingBucketRepository, incomeSourceRepository } = await import('../src/db/repository.js');
    spendingBucketRepository.getAll.mockResolvedValueOnce([
      { id: 1, name: 'Groceries', monthlyAmount: 40000, icon: '🛒', displayOrder: 0 }
    ]);
    incomeSourceRepository.getAll.mockResolvedValueOnce([]);

    await incomeSpendingSettings.render();

    const container = document.getElementById('incomeSpendingSettingsContainer');
    const html = container.innerHTML;

    // After Plan 03, neither the heading nor CRUD buttons should appear
    expect(html).not.toContain('Income Sources');
    expect(container.querySelectorAll('.js-edit-source').length).toBe(0);
  });
});
