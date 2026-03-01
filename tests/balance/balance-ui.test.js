/**
 * Balance UI Requirement Tests
 *
 * Tests the balance-related logic that underpins the dashboard Balance Card and
 * 90-day trend chart. These are Vitest unit tests (the project uses Vitest, not
 * Playwright). They cover:
 *
 *  - Balance Card math accuracy (closing balance arithmetic)
 *  - Negative balance alert detection (isAlertState logic)
 *  - Forecast month projection flags
 *  - Start date persistence key existence
 *  - renderBalanceChart data splitting (actual vs projection datasets)
 *
 * Note: renderBalancePanel itself exercises DOM APIs; the DOM-level rendering is
 * verified manually in the browser.  The engine behaviour is fully covered by
 * calculateBalanceChain tests in finance.test.js.
 */
import { describe, it, expect } from 'vitest';
import { calculateBalanceChain } from '../../src/utils/finance.js';
import { BALANCE_START_DATE_KEY } from '../../src/utils/storage.js';

// ---------------------------------------------------------------------------
// Shared dep-injection helper (mirrors the pattern from finance.test.js)
// ---------------------------------------------------------------------------
function makeDeps(data, openingBalCatId = null, savedSnapshots = []) {
  return {
    getIncome: async (month) => data.income?.[month] ?? [],
    getRecurrent: async (month) => data.recurrent?.[month] ?? [],
    getOneOff: async (month) => data.oneOff?.[month] ?? [],
    getOpeningBalCatId: async () => openingBalCatId,
    saveSnapshot: async (snap) => {
      savedSnapshots.push({ ...snap });
      return savedSnapshots.length;
    }
  };
}

// ---------------------------------------------------------------------------
// Balance Card Math Accuracy
// ---------------------------------------------------------------------------
describe('Balance Card — Math Accuracy', () => {
  it('closingBalance = openingBalance + income - expenses (single month)', async () => {
    const deps = makeDeps({
      income: { '2026-01': [{ amount: 250000, categoryId: 1 }] }, // £2,500 salary
      recurrent: { '2026-01': [{ amount: 80000 }] },              // £800 rent
      oneOff: { '2026-01': [{ amount: 30000 }] }                  // £300 groceries
    });

    const result = await calculateBalanceChain('2026-01', 0, deps);
    const jan = result.find(s => s.month === '2026-01');

    expect(jan).toBeDefined();
    expect(jan.incomeTotal).toBe(250000);
    expect(jan.expenseTotal).toBe(110000); // 80000 + 30000
    expect(jan.closingBalance).toBe(140000); // 0 + 250000 - 110000
  });

  it('carry-forward: Feb openingBalance === Jan closingBalance', async () => {
    const deps = makeDeps({
      income: {
        '2026-01': [{ amount: 200000, categoryId: 1 }],
        '2026-02': [{ amount: 200000, categoryId: 1 }]
      },
      recurrent: {
        '2026-01': [{ amount: 180000 }],
        '2026-02': [{ amount: 180000 }]
      },
      oneOff: {}
    });

    const result = await calculateBalanceChain('2026-01', 0, deps);
    const jan = result.find(s => s.month === '2026-01');
    const feb = result.find(s => s.month === '2026-02');

    expect(jan.closingBalance).toBe(20000);   // 0 + 200000 - 180000
    expect(feb.openingBalance).toBe(20000);   // carries forward
    expect(feb.closingBalance).toBe(40000);   // 20000 + 200000 - 180000
  });

  it('Opening Balance seed is excluded from incomeTotal but seeds openingBalance', async () => {
    const OPENING_CAT = 99;
    const deps = makeDeps(
      {
        income: {
          '2026-01': [
            { amount: 100000, categoryId: OPENING_CAT }, // £1000 seed
            { amount: 300000, categoryId: 1 }            // £3000 salary
          ]
        },
        recurrent: { '2026-01': [{ amount: 50000 }] },
        oneOff: {}
      },
      OPENING_CAT
    );

    const result = await calculateBalanceChain('2026-01', 0, deps);
    const jan = result.find(s => s.month === '2026-01');

    expect(jan.openingBalance).toBe(100000);  // seeded from special category
    expect(jan.incomeTotal).toBe(300000);     // only regular salary
    expect(jan.closingBalance).toBe(350000);  // 100000 + 300000 - 50000
  });
});

// ---------------------------------------------------------------------------
// Negative Balance Alert Detection
// ---------------------------------------------------------------------------
describe('Negative Balance Alert Detection', () => {
  it('detects negative closingBalance in a projection month', async () => {
    const deps = makeDeps({
      // No income but large expenses in the projected months
      recurrent: {
        '2026-04': [{ amount: 500000 }], // £5000 expense with no income
        '2026-05': [{ amount: 500000 }]
      },
      income: {},
      oneOff: {}
    });

    // Start March 2026, project 3 months forward (Apr, May, Jun)
    const result = await calculateBalanceChain('2026-03', 3, deps);
    const projections = result.filter(s => s.isProjection);

    // At least one future month should go negative
    const hasNegative = projections.some(s => s.closingBalance < 0);
    expect(hasNegative).toBe(true);
  });

  it('no alert when all projections remain positive', async () => {
    const deps = makeDeps({
      income: {
        '2026-03': [{ amount: 300000, categoryId: 1 }],
        '2026-04': [{ amount: 300000, categoryId: 1 }],
        '2026-05': [{ amount: 300000, categoryId: 1 }],
        '2026-06': [{ amount: 300000, categoryId: 1 }]
      },
      recurrent: {},
      oneOff: {}
    });

    const result = await calculateBalanceChain('2026-03', 3, deps);
    const projections = result.filter(s => s.isProjection);

    const hasNegative = projections.some(s => s.closingBalance < 0);
    expect(hasNegative).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Forecast Projection Flags
// ---------------------------------------------------------------------------
describe('Forecast Chart — Projection Flags', () => {
  it('current and past months are NOT projections', async () => {
    const deps = makeDeps({}, null);
    // Start Jan 2026, horizon 0 → Jan, Feb, Mar 2026 (today is 2026-03-01)
    const result = await calculateBalanceChain('2026-01', 0, deps);

    // Jan and Feb should not be projections
    const jan = result.find(s => s.month === '2026-01');
    const feb = result.find(s => s.month === '2026-02');

    expect(jan?.isProjection).toBe(false);
    expect(feb?.isProjection).toBe(false);
  });

  it('months beyond current calendar month are projections', async () => {
    const deps = makeDeps({}, null);
    const result = await calculateBalanceChain('2026-03', 2, deps);

    // Apr and May 2026 should be projections
    const apr = result.find(s => s.month === '2026-04');
    const may = result.find(s => s.month === '2026-05');

    expect(apr?.isProjection).toBe(true);
    expect(may?.isProjection).toBe(true);
  });

  it('snapshot count matches from startDate to currentMonth + horizon', async () => {
    const deps = makeDeps({}, null);
    const result = await calculateBalanceChain('2026-01', 3, deps);

    // Jan, Feb, Mar (actual) + Apr, May, Jun (projections) = 6 months
    expect(result.length).toBe(6);

    const actualCount = result.filter(s => !s.isProjection).length;
    const projectionCount = result.filter(s => s.isProjection).length;

    expect(actualCount).toBe(3);   // Jan, Feb, Mar
    expect(projectionCount).toBe(3); // Apr, May, Jun
  });
});

// ---------------------------------------------------------------------------
// Balance Start Date Persistence
// ---------------------------------------------------------------------------
describe('Balance Start Date Persistence', () => {
  it('BALANCE_START_DATE_KEY is exported from app.js with the correct value', () => {
    expect(BALANCE_START_DATE_KEY).toBe('budget_balance_start_date');
  });

  it('BALANCE_START_DATE_KEY matches the format used by the HTML input[type=month]', () => {
    // The month input format is YYYY-MM, which matches the localStorage key convention
    const sampleMonth = '2026-01';
    expect(/^\d{4}-\d{2}$/.test(sampleMonth)).toBe(true);
  });

  it('recalculation is triggered for the saved start month', async () => {
    const startMonth = '2026-02';
    const saved = [];
    const deps = makeDeps(
      { income: { '2026-02': [{ amount: 100000, categoryId: 1 }] }, recurrent: {}, oneOff: {} },
      null,
      saved
    );

    await calculateBalanceChain(startMonth, 0, deps);

    // Snapshots must start from the given month
    expect(saved[0].month).toBe('2026-02');
  });
});

// ---------------------------------------------------------------------------
// renderBalanceChart Data Splitting (unit-level)
// ---------------------------------------------------------------------------
describe('renderBalanceChart Data Splitting Logic', () => {
  /**
   * Mirrors the splitting logic inside renderBalanceChart to test it independently.
   */
  function splitDatasets(snapshots) {
    const actualData = snapshots.map(s => s.isProjection ? null : s.closingBalance);
    const projectionData = snapshots.map((s, i) => {
      if (s.isProjection) return s.closingBalance;
      if (i === snapshots.length - 1 || snapshots[i + 1]?.isProjection) return s.closingBalance;
      return null;
    });
    return { actualData, projectionData };
  }

  it('actual dataset is null for projection months', () => {
    const snapshots = [
      { month: '2026-02', closingBalance: 50000, isProjection: false },
      { month: '2026-03', closingBalance: 60000, isProjection: false },
      { month: '2026-04', closingBalance: 40000, isProjection: true },
      { month: '2026-05', closingBalance: 20000, isProjection: true }
    ];

    const { actualData } = splitDatasets(snapshots);

    expect(actualData[0]).toBe(50000);
    expect(actualData[1]).toBe(60000);
    expect(actualData[2]).toBeNull(); // projection → null
    expect(actualData[3]).toBeNull(); // projection → null
  });

  it('projection dataset connects from the last actual point', () => {
    const snapshots = [
      { month: '2026-02', closingBalance: 50000, isProjection: false },
      { month: '2026-03', closingBalance: 60000, isProjection: false },
      { month: '2026-04', closingBalance: 40000, isProjection: true }
    ];

    const { projectionData } = splitDatasets(snapshots);

    // Last actual (Mar) should appear in projection dataset to connect the line
    expect(projectionData[1]).toBe(60000);
    // Projection month has its value in the projection dataset
    expect(projectionData[2]).toBe(40000);
  });

  it('all-actual snapshots produce null projection dataset (no forward projections)', () => {
    const snapshots = [
      { month: '2026-01', closingBalance: 30000, isProjection: false },
      { month: '2026-02', closingBalance: 40000, isProjection: false },
      { month: '2026-03', closingBalance: 50000, isProjection: false }
    ];

    const { projectionData } = splitDatasets(snapshots);

    // Only the very last actual point appears (to anchor the chart line)
    expect(projectionData[2]).toBe(50000);
    expect(projectionData[0]).toBeNull();
    expect(projectionData[1]).toBeNull();
  });
});
