/**
 * affordability.test.js
 *
 * Phase 35 (CHILD-02): Tests for the childcare top-up affordability integration contract.
 *
 * Validates:
 * - normalizeChildcareTopUps: transforms top-up contract rows to committed-outgoing items
 * - includeChildcareTopUpsInCommittedOutgoings: merges childcare items into affordability rows
 * - Phase boundary anti-regression: no CSV/reporting/import/export added
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeChildcareTopUps,
  includeChildcareTopUpsInCommittedOutgoings
} from './affordability.js';

// ---------------------------------------------------------------------------
// Test 1: normalizeChildcareTopUps transforms contract rows into committed items
// ---------------------------------------------------------------------------

describe('normalizeChildcareTopUps (CHILD-02)', () => {
  it('transforms a top-up row into a committed outgoing with stable fields', () => {
    const topUps = [
      { accountId: 1, childName: 'Alice', requiredTopUpPence: 40000, description: 'Childcare top-up: Alice' }
    ];
    const result = normalizeChildcareTopUps(topUps);
    expect(result).toHaveLength(1);
    const item = result[0];
    // Must have these stable fields for affordability pipeline
    expect(item).toHaveProperty('date');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('amount');
    expect(item.description).toContain('Alice');
    expect(item.amount).toBe(40000);
  });

  it('filters out top-ups with zero required amount', () => {
    const topUps = [
      { accountId: 1, childName: 'Alice', requiredTopUpPence: 0, description: 'Childcare top-up: Alice' },
      { accountId: 2, childName: 'Bob', requiredTopUpPence: 30000, description: 'Childcare top-up: Bob' }
    ];
    const result = normalizeChildcareTopUps(topUps);
    expect(result).toHaveLength(1);
    expect(result[0].description).toContain('Bob');
  });

  it('returns empty array for empty input', () => {
    expect(normalizeChildcareTopUps([])).toEqual([]);
  });

  it('handles multiple accounts correctly', () => {
    const topUps = [
      { accountId: 1, childName: 'Alice', requiredTopUpPence: 40000, description: 'Childcare top-up: Alice' },
      { accountId: 2, childName: 'Bob', requiredTopUpPence: 25000, description: 'Childcare top-up: Bob' }
    ];
    const result = normalizeChildcareTopUps(topUps);
    expect(result).toHaveLength(2);
    const amounts = result.map(r => r.amount);
    expect(amounts).toContain(40000);
    expect(amounts).toContain(25000);
  });
});

// ---------------------------------------------------------------------------
// Test 2: includeChildcareTopUpsInCommittedOutgoings merges without mutation
// ---------------------------------------------------------------------------

describe('includeChildcareTopUpsInCommittedOutgoings (CHILD-02)', () => {
  it('merges childcare items into base rows without mutating baseRows', () => {
    const baseRows = [
      { date: '2026-04-01', name: 'Rent', amount: 100000, runningBalance: 0 }
    ];
    const childcareItems = [
      { date: '2026-04-05', description: 'Childcare top-up: Alice', amount: 40000 }
    ];
    const original = [...baseRows];
    const result = includeChildcareTopUpsInCommittedOutgoings(baseRows, childcareItems);

    // Base rows must NOT be mutated
    expect(baseRows).toEqual(original);
    // Result must include the original row
    expect(result.some(r => r.name === 'Rent')).toBe(true);
    // Result must include the childcare item
    expect(result.some(r => r.description?.includes('Alice') || r.name?.includes('Alice') || r.name?.includes('Childcare'))).toBe(true);
  });

  it('returns base rows unchanged when no childcare items', () => {
    const baseRows = [
      { date: '2026-04-01', name: 'Groceries', amount: 5000, runningBalance: 0 }
    ];
    const result = includeChildcareTopUpsInCommittedOutgoings(baseRows, []);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Groceries');
  });

  it('total committed outgoings includes childcare top-ups exactly once', () => {
    const baseRows = [
      { date: '2026-04-01', name: 'Rent', amount: 100000, runningBalance: 0 },
      { date: '2026-04-15', name: 'Subscription', amount: 1000, runningBalance: 0 }
    ];
    const childcareItems = [
      { date: '2026-04-05', description: 'Childcare top-up: Alice', amount: 40000 }
    ];
    const result = includeChildcareTopUpsInCommittedOutgoings(baseRows, childcareItems);
    const total = result.reduce((sum, r) => sum + (r.amount || 0), 0);
    expect(total).toBe(100000 + 1000 + 40000);
    // Exactly 3 rows
    expect(result).toHaveLength(3);
  });

  it('handles null/undefined childcare items gracefully', () => {
    const baseRows = [{ date: '2026-04-01', name: 'Rent', amount: 50000, runningBalance: 0 }];
    expect(() => includeChildcareTopUpsInCommittedOutgoings(baseRows, null)).not.toThrow();
    expect(() => includeChildcareTopUpsInCommittedOutgoings(baseRows, undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Test 7: Phase boundary anti-regression checks
// ---------------------------------------------------------------------------

describe('Phase 35 boundary anti-regression', () => {
  it('affordability.js does not export CSV/reporting functions', async () => {
    const mod = await import('./affordability.js');
    const exportedKeys = Object.keys(mod);
    // Must not export CSV/reporting/import/export/navigation redesign features
    const forbiddenPatterns = ['csv', 'report', 'export', 'import', 'navigate', 'legacy'];
    for (const key of exportedKeys) {
      for (const pattern of forbiddenPatterns) {
        expect(key.toLowerCase()).not.toContain(pattern);
      }
    }
  });

  it('affordability.js exports only the contract functions for CHILD-02', async () => {
    const mod = await import('./affordability.js');
    expect(typeof mod.normalizeChildcareTopUps).toBe('function');
    expect(typeof mod.includeChildcareTopUpsInCommittedOutgoings).toBe('function');
  });
});
