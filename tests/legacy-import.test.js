/**
 * Tests for legacy v2 import pipeline
 *
 * Covers: shape detection, validation, mapping, conflict-safe default (skip on collision)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  detectLegacyShape,
  validateLegacyData,
  parseLegacyBackup,
  mapLegacyToCurrent,
  importLegacyData,
  runLegacyImport,
} from '../src/utils/legacy-import.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeV2Payload(overrides = {}) {
  return {
    version: 1,
    encrypted: false,
    schema_version: 4, // v2 app capped at schema v4
    data: {
      categories: [
        { id: 1, name: 'Groceries', group: 'expenses' },
        { id: 2, name: 'Salary', group: 'income' },
      ],
      fixedSpends: [
        { id: 10, categoryId: 1, label: 'Rent', amount: 80000, status: 'pending', date: '2024-01-01' },
      ],
      variableSpends: [
        { id: 20, categoryId: 1, note: 'Coffee', amount: 350, date: '2024-01-05' },
      ],
      income: [
        { id: 30, categoryId: 2, source: 'Work', amount: 200000, date: '2024-01-31' },
      ],
      debts: [
        { id: 40, name: 'Credit Card', type: 'credit-card', apr: '4.9%', currentBalance: 50000 },
      ],
      subscriptions: [
        { id: 50, name: 'Netflix', amount: 1500, categoryId: 1, frequency: 'monthly', nextDate: '2024-02-01' },
      ],
      assets: [],
      statements: [],
    },
    ...overrides,
  };
}

function makeCurrentPayload() {
  return {
    version: 1,
    encrypted: false,
    schema_version: 23, // current v3 schema
    data: {
      categories: [],
      recurrentExpenses: [],
      oneOffExpenses: [],
      income: [],
      debts: [],
      assets: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Test 1: detection, validation, and mapping
// ---------------------------------------------------------------------------
describe('detectLegacyShape', () => {
  it('returns true for v2 payload with fixedSpends', () => {
    const payload = makeV2Payload();
    expect(detectLegacyShape(payload)).toBe(true);
  });

  it('returns true for v2 payload with variableSpends', () => {
    const payload = makeV2Payload();
    delete payload.data.fixedSpends;
    expect(detectLegacyShape(payload)).toBe(true);
  });

  it('returns true for v2 payload with subscriptions', () => {
    const payload = makeV2Payload();
    delete payload.data.fixedSpends;
    delete payload.data.variableSpends;
    expect(detectLegacyShape(payload)).toBe(true);
  });

  it('returns false for current-schema payload (has recurrentExpenses)', () => {
    const payload = makeCurrentPayload();
    expect(detectLegacyShape(payload)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(detectLegacyShape(null)).toBe(false);
    expect(detectLegacyShape(undefined)).toBe(false);
  });
});

describe('validateLegacyData', () => {
  it('accepts a well-formed v2 payload', () => {
    const result = validateLegacyData(makeV2Payload());
    expect(result.valid).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('rejects null with a reason', () => {
    const result = validateLegacyData(null);
    expect(result.valid).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('rejects payload with no data property', () => {
    const result = validateLegacyData({ version: 1 });
    expect(result.valid).toBe(false);
    expect(result.reasons.some(r => /data/i.test(r))).toBe(true);
  });

  it('rejects current-shape payload (not legacy)', () => {
    const result = validateLegacyData(makeCurrentPayload());
    expect(result.valid).toBe(false);
    expect(result.reasons.some(r => /legacy|v2|fixedSpends|variableSpends|subscriptions/i.test(r))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 2: APR normalisation
// ---------------------------------------------------------------------------
describe('mapLegacyToCurrent — debt APR normalisation', () => {
  it('converts string "4.9%" APR to numeric 4.9', () => {
    const payload = makeV2Payload();
    const mapped = mapLegacyToCurrent(payload.data);
    const debt = mapped.debts.find(d => d.name === 'Credit Card');
    expect(debt).toBeDefined();
    expect(typeof debt.apr).toBe('number');
    expect(debt.apr).toBeCloseTo(4.9);
  });

  it('keeps numeric APR values unchanged', () => {
    const payload = makeV2Payload();
    payload.data.debts[0].apr = 19.9;
    const mapped = mapLegacyToCurrent(payload.data);
    const debt = mapped.debts[0];
    expect(typeof debt.apr).toBe('number');
    expect(debt.apr).toBeCloseTo(19.9);
  });

  it('normalises "0%" to 0', () => {
    const payload = makeV2Payload();
    payload.data.debts[0].apr = '0%';
    const mapped = mapLegacyToCurrent(payload.data);
    expect(mapped.debts[0].apr).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 1b: mapping — fixedSpends and variableSpends
// ---------------------------------------------------------------------------
describe('mapLegacyToCurrent — table renaming', () => {
  it('maps fixedSpends to recurrentExpenses', () => {
    const payload = makeV2Payload();
    const mapped = mapLegacyToCurrent(payload.data);
    expect(mapped.recurrentExpenses).toBeDefined();
    expect(mapped.recurrentExpenses.some(r => r.label === 'Rent')).toBe(true);
    expect(mapped.fixedSpends).toBeUndefined();
  });

  it('maps variableSpends to oneOffExpenses', () => {
    const payload = makeV2Payload();
    const mapped = mapLegacyToCurrent(payload.data);
    expect(mapped.oneOffExpenses).toBeDefined();
    expect(mapped.oneOffExpenses.some(r => r.note === 'Coffee')).toBe(true);
    expect(mapped.variableSpends).toBeUndefined();
  });

  it('maps subscriptions into recurrentExpenses with frequency', () => {
    const payload = makeV2Payload();
    const mapped = mapLegacyToCurrent(payload.data);
    const sub = mapped.recurrentExpenses.find(r => r.label === 'Netflix');
    expect(sub).toBeDefined();
    expect(sub.frequency).toBe('monthly');
    expect(mapped.subscriptions).toBeUndefined();
  });

  it('preserves income records unchanged', () => {
    const payload = makeV2Payload();
    const mapped = mapLegacyToCurrent(payload.data);
    expect(mapped.income).toHaveLength(1);
    expect(mapped.income[0].source).toBe('Work');
  });
});

// ---------------------------------------------------------------------------
// Test 3: conflict-safe default (skip on id collision)
// ---------------------------------------------------------------------------
describe('importLegacyData — no-overwrite default', () => {
  it('skips records that already exist by id in the store', async () => {
    const mapped = {
      recurrentExpenses: [{ id: 10, label: 'Rent', amount: 80000, categoryId: 1, date: '2024-01-01' }],
      oneOffExpenses: [],
      income: [],
      debts: [],
      categories: [{ id: 1, name: 'Groceries', group: 'expenses' }],
      assets: [],
      statements: [],
    };

    // Simulate existing store with id=10 already present
    const fakeStore = {
      recurrentExpenses: [{ id: 10, label: 'OldRent', amount: 90000 }],
      oneOffExpenses: [],
      income: [],
      debts: [],
      categories: [{ id: 1, name: 'Groceries', group: 'expenses' }],
      assets: [],
      statements: [],
    };

    const result = await importLegacyData(mapped, { existingData: fakeStore, conflictPolicy: 'skip' });

    expect(result.imported).toBe(0); // record was skipped
    expect(result.skipped).toBe(1);  // 1 conflict skipped
    expect(result.conflicts).toBe(1);
  });

  it('uses skip as the default conflict policy (no explicit option needed)', async () => {
    const mapped = {
      recurrentExpenses: [{ id: 5, label: 'Gym', amount: 3000, categoryId: 1, date: '2024-01-10' }],
      oneOffExpenses: [],
      income: [],
      debts: [],
      categories: [{ id: 1, name: 'Fitness', group: 'expenses' }],
      assets: [],
      statements: [],
    };

    const fakeStore = {
      recurrentExpenses: [{ id: 5, label: 'AlreadyGym', amount: 3000 }],
      oneOffExpenses: [],
      income: [],
      debts: [],
      categories: [],
      assets: [],
      statements: [],
    };

    // No conflictPolicy provided — default must be skip
    const result = await importLegacyData(mapped, { existingData: fakeStore });
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
  });

  it('reports correct imported count for non-conflicting records', async () => {
    const mapped = {
      recurrentExpenses: [{ id: 99, label: 'NewItem', amount: 5000, categoryId: 2, date: '2024-02-01' }],
      oneOffExpenses: [],
      income: [],
      debts: [],
      categories: [],
      assets: [],
      statements: [],
    };

    const fakeStore = {
      recurrentExpenses: [], // no conflicts
      oneOffExpenses: [],
      income: [],
      debts: [],
      categories: [],
      assets: [],
      statements: [],
    };

    const result = await importLegacyData(mapped, { existingData: fakeStore });
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 4: invalid payload rejected before any write
// ---------------------------------------------------------------------------
describe('runLegacyImport — rejects unrecognised payloads', () => {
  it('throws with incompatibility reasons for a non-legacy payload', async () => {
    const payload = makeCurrentPayload();
    await expect(runLegacyImport(payload, {})).rejects.toThrow(/not a legacy|incompatible|unrecognised/i);
  });

  it('throws for null payload', async () => {
    await expect(runLegacyImport(null, {})).rejects.toThrow();
  });

  it('throws for payload with no data', async () => {
    await expect(runLegacyImport({ version: 1, encrypted: false }, {})).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test 1c: parseLegacyBackup wires detection + validation
// ---------------------------------------------------------------------------
describe('parseLegacyBackup', () => {
  it('returns { valid: true, data } for a recognised v2 payload', () => {
    const payload = makeV2Payload();
    const result = parseLegacyBackup(payload);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('returns { valid: false, reasons } for a current-schema payload', () => {
    const payload = makeCurrentPayload();
    const result = parseLegacyBackup(payload);
    expect(result.valid).toBe(false);
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns { valid: false, reasons } for null', () => {
    const result = parseLegacyBackup(null);
    expect(result.valid).toBe(false);
  });
});
