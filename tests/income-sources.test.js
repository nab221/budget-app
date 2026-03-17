/**
 * tests/income-sources.test.js
 *
 * Phase 39.1 Wave 0: Test scaffold for the Income Sources tab UI.
 *
 * All 6 tests are written as RED stubs. They assert the intended behaviour
 * of src/ui/income-sources.js. The real module is currently a no-op stub
 * (src/ui/income-sources.js), so assertions about side effects (calls to
 * repositories, DOM state) all fail — correct RED state before Plan 02.
 *
 * Key contracts under test:
 *   - incomeSourceRepository  (CRUD, raw pence storage)
 *   - incomeRepository.add    (amount in POUNDS — toPence() called internally)
 *   - getUpcomingIncomeEvents (returns amount in PENCE)
 *   - confirmIncome / adjustIncome on the incomeSources UI module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock: src/db/repository.js
// ---------------------------------------------------------------------------
vi.mock('../src/db/repository.js', () => ({
  incomeSourceRepository: {
    getAll:            vi.fn(async () => []),
    getActive:         vi.fn(async () => []),
    get:               vi.fn(async () => null),
    validateAndAdd:    vi.fn(async (data) => 1),
    validateAndUpdate: vi.fn(async (id, data) => 1),
    delete:            vi.fn(async (id) => undefined),
  },
  incomeRepository: {
    add: vi.fn(async (entry) => 1),
  },
}));

// ---------------------------------------------------------------------------
// Mock: src/utils/income.js
// ---------------------------------------------------------------------------
vi.mock('../src/utils/income.js', () => ({
  getUpcomingIncomeEvents: vi.fn(() => []),
  getNextIncomeEvent:      vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------

/** NHS Salary source — monthlyAmount in PENCE */
const SOURCE_1 = {
  id: 1,
  name: 'NHS Salary',
  monthlyAmount: 300000,        // £3,000 stored as pence
  payDateRule: 'last-working-day',
  payDateDay: null,
  isActive: true,
  displayOrder: 0,
};

/** Upcoming income event — amount in PENCE */
const UPCOMING_EVENT = {
  sourceName:   'NHS Salary',
  nominalDate:  '2026-03-31',
  adjustedDate: '2026-03-31',
  amount:       300000,         // £3,000 in pence
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="incomeSourcesContainer"></div>';

  // Prime the mocks with default returns for each test
  const { incomeSourceRepository } = await import('../src/db/repository.js');
  incomeSourceRepository.getActive.mockResolvedValue([SOURCE_1]);
  incomeSourceRepository.get.mockResolvedValue(SOURCE_1);
});

afterEach(() => {
  document.body.innerHTML = '';
});

// ---------------------------------------------------------------------------
// Test 1 — CRUD add
// incomeSourcesUI triggers incomeSourceRepository.validateAndAdd with correct
// pence value and calls render() after success.
// ---------------------------------------------------------------------------
describe('CRUD add', () => {
  it('triggers validateAndAdd with correct pence value and re-renders', async () => {
    const { incomeSources } = await import('../src/ui/income-sources.js');
    const { incomeSourceRepository } = await import('../src/db/repository.js');

    const payload = {
      name: 'NHS Salary',
      monthlyAmount: 300000,       // pence — incomeSourceRepository stores raw
      payDateRule: 'last-working-day',
      payDateDay: null,
      isActive: true,
      displayOrder: 0,
    };

    // The real implementation: when the user submits the add-source form,
    // incomeSources calls validateAndAdd then re-renders.
    await incomeSources.init();
    await incomeSources._handleAddSource(payload);   // method under test

    expect(incomeSourceRepository.validateAndAdd).toHaveBeenCalledWith(
      expect.objectContaining({ monthlyAmount: 300000 })
    );
    // render() is also called after a successful add
    // (this assertion verifies the DOM was refreshed — stub leaves it empty)
    const container = document.getElementById('incomeSourcesContainer');
    expect(container.innerHTML).toContain('NHS Salary');
  });
});

// ---------------------------------------------------------------------------
// Test 2 — CRUD edit
// incomeSourcesUI triggers incomeSourceRepository.validateAndUpdate with
// updated fields when the edit form is saved.
// ---------------------------------------------------------------------------
describe('CRUD edit', () => {
  it('triggers validateAndUpdate with updated fields', async () => {
    const { incomeSources } = await import('../src/ui/income-sources.js');
    const { incomeSourceRepository } = await import('../src/db/repository.js');

    const updatedPayload = {
      ...SOURCE_1,
      name: 'NHS Salary (Updated)',
      monthlyAmount: 320000,
    };

    // The real implementation: when the user saves the edit form,
    // incomeSources calls validateAndUpdate with the source id and new data.
    await incomeSources._handleEditSource(SOURCE_1.id, updatedPayload);

    expect(incomeSourceRepository.validateAndUpdate).toHaveBeenCalledWith(
      SOURCE_1.id,
      expect.objectContaining({ monthlyAmount: 320000, name: 'NHS Salary (Updated)' })
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3 — CRUD delete
// incomeSourcesUI triggers incomeSourceRepository.delete after confirm dialog
// and calls render() afterwards.
// ---------------------------------------------------------------------------
describe('CRUD delete', () => {
  it('triggers delete after confirm and re-renders', async () => {
    const { incomeSources } = await import('../src/ui/income-sources.js');
    const { incomeSourceRepository } = await import('../src/db/repository.js');

    // Stub window.confirm so no browser dialog appears in tests
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

    // The real implementation: clicking the delete button calls confirm(),
    // then repository.delete(id), then re-renders.
    await incomeSources._handleDeleteSource(SOURCE_1.id);

    expect(window.confirm).toHaveBeenCalled();
    expect(incomeSourceRepository.delete).toHaveBeenCalledWith(SOURCE_1.id);

    // After delete, the container should be refreshed (real impl calls render)
    const container = document.getElementById('incomeSourcesContainer');
    // With stub, innerHTML stays empty — confirms RED state
    expect(container.innerHTML).not.toContain('NHS Salary');
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Pending cards (upcoming income events)
// render() calls getUpcomingIncomeEvents with active sources; returns at
// least one pending card element when events exist.
// ---------------------------------------------------------------------------
describe('pending income cards', () => {
  it('render() uses getUpcomingIncomeEvents and produces .income-pending-card elements', async () => {
    const { incomeSources } = await import('../src/ui/income-sources.js');
    const { getUpcomingIncomeEvents } = await import('../src/utils/income.js');

    getUpcomingIncomeEvents.mockReturnValueOnce([UPCOMING_EVENT]);

    await incomeSources.render();

    // The real render() calls getUpcomingIncomeEvents(activeSources, today, limit)
    expect(getUpcomingIncomeEvents).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 1 })]),
      expect.any(String),
      expect.any(Number)
    );

    // And it renders at least one card element for the upcoming event
    const cards = document.querySelectorAll('.income-pending-card');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Test 5 — Confirm income
// confirmIncome() calls incomeRepository.add with amount in POUNDS
// (fromPence conversion applied), date from event.adjustedDate, source from
// event.sourceName.
// ---------------------------------------------------------------------------
describe('confirmIncome', () => {
  it('calls incomeRepository.add with amount in POUNDS (fromPence conversion)', async () => {
    const { incomeSources } = await import('../src/ui/income-sources.js');
    const { incomeRepository } = await import('../src/db/repository.js');

    // UPCOMING_EVENT.amount = 300000 pence = £3,000.00
    await incomeSources.confirmIncome(UPCOMING_EVENT);

    expect(incomeRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({
        amount:  3000.00,           // fromPence(300000) — POUNDS, not pence
        date:    '2026-03-31',      // event.adjustedDate
        source:  'NHS Salary',      // event.sourceName
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Test 6 — Adjust income
// adjustIncome() allows overriding amount; incomeRepository.add receives the
// adjusted amount in pounds (not the original event.amount).
// ---------------------------------------------------------------------------
describe('adjustIncome', () => {
  it('calls incomeRepository.add with the overridden amount in POUNDS', async () => {
    const { incomeSources } = await import('../src/ui/income-sources.js');
    const { incomeRepository } = await import('../src/db/repository.js');

    const overridePounds = 2800.00;   // user has entered a custom amount

    await incomeSources.adjustIncome(UPCOMING_EVENT, overridePounds);

    expect(incomeRepository.add).toHaveBeenCalledWith(
      expect.objectContaining({
        amount:  2800.00,           // override used, not fromPence(300000)
        date:    '2026-03-31',
        source:  'NHS Salary',
      })
    );
  });
});
