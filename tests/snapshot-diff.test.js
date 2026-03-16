/**
 * tests/snapshot-diff.test.js
 *
 * Phase 37: Unit tests for src/utils/snapshot-diff.js.
 * Covers computeSnapshotDiff, isFirstSyncFallback, formatDiffSummary,
 * and canonicalizeRecordForDiff.
 *
 * All helpers are pure / read-only — no Dexie interaction occurs here.
 */

import { describe, it, expect } from 'vitest';
import {
  computeSnapshotDiff,
  isFirstSyncFallback,
  formatDiffSummary,
  canonicalizeRecordForDiff,
} from '../src/utils/snapshot-diff.js';

// ---------------------------------------------------------------------------
// canonicalizeRecordForDiff
// ---------------------------------------------------------------------------
describe('canonicalizeRecordForDiff', () => {
  it('serialises an object deterministically regardless of key insertion order', () => {
    const a = { id: 1, amount: 100, note: 'foo', date: '2025-01-01' };
    const b = { date: '2025-01-01', note: 'foo', id: 1, amount: 100 };
    expect(canonicalizeRecordForDiff(a)).toBe(canonicalizeRecordForDiff(b));
  });

  it('excludes the id field from the canonical string', () => {
    const r = { id: 42, amount: 500, note: 'bar' };
    const canonical = canonicalizeRecordForDiff(r);
    expect(canonical).not.toContain('"id"');
    expect(canonical).not.toContain('42');
  });

  it('returns consistent output for identical content with different id values', () => {
    const r1 = { id: 1, amount: 200 };
    const r2 = { id: 99, amount: 200 };
    expect(canonicalizeRecordForDiff(r1)).toBe(canonicalizeRecordForDiff(r2));
  });

  it('returns different output for records with different content', () => {
    const r1 = { id: 1, amount: 100 };
    const r2 = { id: 1, amount: 200 };
    expect(canonicalizeRecordForDiff(r1)).not.toBe(canonicalizeRecordForDiff(r2));
  });
});

// ---------------------------------------------------------------------------
// computeSnapshotDiff — Test 1: key-order stability (same content = 0 updated)
// ---------------------------------------------------------------------------
describe('computeSnapshotDiff — key-order stability', () => {
  it('produces zero updated count when records share the same content but different key order', () => {
    const current = {
      income: [
        { id: 1, amount: 500, date: '2025-01-01', note: 'salary' },
      ],
    };
    const incoming = {
      income: [
        { date: '2025-01-01', note: 'salary', id: 1, amount: 500 },
      ],
    };
    const diff = computeSnapshotDiff(current, incoming);
    expect(diff.income).toEqual({ added: 0, deleted: 0, updated: 0 });
  });
});

// ---------------------------------------------------------------------------
// computeSnapshotDiff — Test 2: added and deleted counts
// ---------------------------------------------------------------------------
describe('computeSnapshotDiff — added and deleted', () => {
  it('increments added for incoming-only ids', () => {
    const current = {
      income: [{ id: 1, amount: 100 }],
    };
    const incoming = {
      income: [{ id: 1, amount: 100 }, { id: 2, amount: 200 }],
    };
    const diff = computeSnapshotDiff(current, incoming);
    expect(diff.income.added).toBe(1);
    expect(diff.income.deleted).toBe(0);
    expect(diff.income.updated).toBe(0);
  });

  it('increments deleted for local-only ids', () => {
    const current = {
      income: [{ id: 1, amount: 100 }, { id: 3, amount: 300 }],
    };
    const incoming = {
      income: [{ id: 1, amount: 100 }],
    };
    const diff = computeSnapshotDiff(current, incoming);
    expect(diff.income.deleted).toBe(1);
    expect(diff.income.added).toBe(0);
    expect(diff.income.updated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSnapshotDiff — Test 3: updated count
// ---------------------------------------------------------------------------
describe('computeSnapshotDiff — updated', () => {
  it('increments updated when the same id has different content', () => {
    const current = {
      income: [{ id: 1, amount: 100 }],
    };
    const incoming = {
      income: [{ id: 1, amount: 999 }],
    };
    const diff = computeSnapshotDiff(current, incoming);
    expect(diff.income.updated).toBe(1);
    expect(diff.income.added).toBe(0);
    expect(diff.income.deleted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeSnapshotDiff — Test 4: whole-store added / deleted
// ---------------------------------------------------------------------------
describe('computeSnapshotDiff — whole-store presence', () => {
  it('treats a store present only in incoming as all added', () => {
    const current = {};
    const incoming = {
      newStore: [{ id: 1, name: 'foo' }, { id: 2, name: 'bar' }],
    };
    const diff = computeSnapshotDiff(current, incoming);
    expect(diff.newStore.added).toBe(2);
    expect(diff.newStore.deleted).toBe(0);
    expect(diff.newStore.updated).toBe(0);
  });

  it('treats a store present only in current as all deleted', () => {
    const current = {
      oldStore: [{ id: 1, name: 'foo' }],
    };
    const incoming = {};
    const diff = computeSnapshotDiff(current, incoming);
    expect(diff.oldStore.deleted).toBe(1);
    expect(diff.oldStore.added).toBe(0);
    expect(diff.oldStore.updated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isFirstSyncFallback — Test 5: first-sync detection
// ---------------------------------------------------------------------------
describe('isFirstSyncFallback', () => {
  it('returns true when all monitored local stores are empty', () => {
    const currentStoreMap = {
      income: [],
      fixedSpends: [],
      variableSpends: [],
    };
    expect(isFirstSyncFallback(currentStoreMap)).toBe(true);
  });

  it('returns false when at least one store has rows', () => {
    const currentStoreMap = {
      income: [{ id: 1, amount: 100 }],
      fixedSpends: [],
    };
    expect(isFirstSyncFallback(currentStoreMap)).toBe(false);
  });

  it('returns true for an empty object (no stores at all)', () => {
    expect(isFirstSyncFallback({})).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatDiffSummary
// ---------------------------------------------------------------------------
describe('formatDiffSummary', () => {
  it('returns empty array when all store diffs are zero', () => {
    const diffMap = {
      income: { added: 0, deleted: 0, updated: 0 },
    };
    expect(formatDiffSummary(diffMap)).toEqual([]);
  });

  it('includes lines only for stores with at least one non-zero counter', () => {
    const diffMap = {
      income: { added: 2, deleted: 0, updated: 1 },
      debts: { added: 0, deleted: 0, updated: 0 },
      fixedSpends: { added: 0, deleted: 1, updated: 0 },
    };
    const lines = formatDiffSummary(diffMap);
    expect(lines.length).toBe(2);
    const stores = lines.map((l) => l.store);
    expect(stores).toContain('income');
    expect(stores).toContain('fixedSpends');
    expect(stores).not.toContain('debts');
  });

  it('each line has store, added, deleted, updated fields', () => {
    const diffMap = {
      income: { added: 3, deleted: 1, updated: 0 },
    };
    const [line] = formatDiffSummary(diffMap);
    expect(line).toHaveProperty('store', 'income');
    expect(line).toHaveProperty('added', 3);
    expect(line).toHaveProperty('deleted', 1);
    expect(line).toHaveProperty('updated', 0);
  });
});

// ---------------------------------------------------------------------------
// computeSnapshotDiff — multi-store and mixed scenarios
// ---------------------------------------------------------------------------
describe('computeSnapshotDiff — multi-store', () => {
  it('handles multiple stores independently in a single call', () => {
    const current = {
      income: [{ id: 1, amount: 100 }],
      debts: [{ id: 10, balance: 5000 }],
    };
    const incoming = {
      income: [{ id: 1, amount: 200 }, { id: 2, amount: 300 }],
      debts: [{ id: 10, balance: 5000 }],
    };
    const diff = computeSnapshotDiff(current, incoming);
    // income: 1 updated + 1 added
    expect(diff.income.updated).toBe(1);
    expect(diff.income.added).toBe(1);
    expect(diff.income.deleted).toBe(0);
    // debts: unchanged
    expect(diff.debts).toEqual({ added: 0, deleted: 0, updated: 0 });
  });

  it('does not mutate input objects during computation', () => {
    const current = { income: [{ id: 1, amount: 100 }] };
    const incoming = { income: [{ id: 1, amount: 200 }] };
    const currentSnapshot = JSON.stringify(current);
    const incomingSnapshot = JSON.stringify(incoming);
    computeSnapshotDiff(current, incoming);
    expect(JSON.stringify(current)).toBe(currentSnapshot);
    expect(JSON.stringify(incoming)).toBe(incomingSnapshot);
  });
});
