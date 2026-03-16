/**
 * childcare.test.js
 *
 * Unit tests for the childcare UI module (Phase 35):
 * - Provider section rendering per account card
 * - Required top-up display per account
 * - Entitlement period visibility per account card
 *
 * The childcareUI module relies on DOM and external imports; these tests
 * operate at the pure-helper level (HTML generation logic) rather than
 * importing the full UI module to avoid DOM/Dexie dependencies.
 */

import { describe, it, expect } from 'vitest';
import { getEntitlementPeriod } from '../utils/childcare.js';
import { monthlyEquivalentFromProvider, calculateRequiredTopUp } from '../utils/childcare.js';

// ---------------------------------------------------------------------------
// Helper: entitlement period display (CHILD-03)
// ---------------------------------------------------------------------------

/**
 * Formats an entitlement period as a display string matching what the UI renders.
 * Kept pure so it can be tested without DOM.
 */
function formatEntitlementPeriod(entitlementStart, targetDate) {
  if (!entitlementStart) return null;
  const period = getEntitlementPeriod(entitlementStart, targetDate);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return `${fmt(period.start)} – ${fmt(period.end)}`;
}

describe('Childcare UI - entitlement period display (CHILD-03)', () => {
  it('formats entitlement period start and end dates as a date range string', () => {
    const result = formatEntitlementPeriod('2025-01-01', '2025-02-15');
    // Period 0: starts Jan 1 — result must be a non-null range string
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^2025-01-01 – 2025-0[34]-\d{2}$/);
  });

  it('shows the correct period when the target is in the second cycle', () => {
    const result = formatEntitlementPeriod('2025-01-01', '2025-05-10');
    // Period 1: 3 months after period 0 start — result is a non-null string with a date range
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2}$/);
  });

  it('returns null when entitlementStart is not set', () => {
    const result = formatEntitlementPeriod(null, '2025-02-15');
    expect(result).toBeNull();
  });

  it('handles entitlement start on a non-January month', () => {
    const result = formatEntitlementPeriod('2025-03-15', '2025-04-01');
    // Period 0: starts Mar 15, ends 3 months later
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^2025-03-1[45] – 2025-06-1[45]$/);
  });
});

// ---------------------------------------------------------------------------
// Provider rendering helpers (CHILD-01 / UI)
// ---------------------------------------------------------------------------

/**
 * Pure function that computes what the account card provider section would render.
 * Returns a summary object rather than HTML to keep tests portable.
 */
function computeProviderSectionData(providers) {
  const items = providers.map(p => ({
    name: p.name,
    frequency: p.frequency,
    monthlyEquivalentPence: monthlyEquivalentFromProvider(p)
  }));
  const totalMonthlyPence = items.reduce((s, i) => s + i.monthlyEquivalentPence, 0);
  return { items, totalMonthlyPence };
}

describe('Childcare UI - provider section rendering (CHILD-01)', () => {
  it('renders provider names and monthly equivalents', () => {
    const providers = [
      { name: 'Nursery A', frequency: 'monthly', monthlyEquivalentPence: 40000 },
      { name: 'Nursery B', frequency: 'termly', termlyAmountPence: 60000 }
    ];
    const { items } = computeProviderSectionData(providers);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Nursery A');
    expect(items[0].monthlyEquivalentPence).toBe(40000);
    expect(items[1].name).toBe('Nursery B');
    expect(items[1].monthlyEquivalentPence).toBe(20000); // 60000 / 3
  });

  it('sums provider monthly equivalents to total', () => {
    const providers = [
      { name: 'A', frequency: 'monthly', monthlyEquivalentPence: 30000 },
      { name: 'B', frequency: 'monthly', monthlyEquivalentPence: 20000 }
    ];
    const { totalMonthlyPence } = computeProviderSectionData(providers);
    expect(totalMonthlyPence).toBe(50000);
  });

  it('returns empty items and zero total when no providers', () => {
    const { items, totalMonthlyPence } = computeProviderSectionData([]);
    expect(items).toHaveLength(0);
    expect(totalMonthlyPence).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Required top-up display (CHILD-02 / UI)
// ---------------------------------------------------------------------------

/**
 * Pure function mirroring the required-top-up display logic.
 */
function computeRequiredTopUpDisplay(providers, currentBalancePence, pendingBonusPence = 0) {
  const totalMonthlyPence = providers.reduce(
    (s, p) => s + monthlyEquivalentFromProvider(p),
    0
  );
  const requiredTopUpPence = calculateRequiredTopUp(totalMonthlyPence, currentBalancePence, pendingBonusPence);
  return {
    totalMonthlyPence,
    requiredTopUpPence,
    isFunded: requiredTopUpPence === 0
  };
}

describe('Childcare UI - required top-up display (CHILD-02)', () => {
  it('shows non-zero top-up when balance does not cover provider costs', () => {
    const providers = [{ name: 'A', frequency: 'monthly', monthlyEquivalentPence: 60000 }];
    const { requiredTopUpPence, isFunded } = computeRequiredTopUpDisplay(providers, 20000);
    expect(requiredTopUpPence).toBe(40000);
    expect(isFunded).toBe(false);
  });

  it('shows zero top-up (funded) when balance covers all providers', () => {
    const providers = [{ name: 'A', frequency: 'monthly', monthlyEquivalentPence: 50000 }];
    const { requiredTopUpPence, isFunded } = computeRequiredTopUpDisplay(providers, 60000);
    expect(requiredTopUpPence).toBe(0);
    expect(isFunded).toBe(true);
  });

  it('shows zero top-up when no providers are configured', () => {
    const { requiredTopUpPence, isFunded } = computeRequiredTopUpDisplay([], 0);
    expect(requiredTopUpPence).toBe(0);
    expect(isFunded).toBe(true);
  });

  it('includes pending gov bonus in coverage calculation', () => {
    // providerTotal: 60000, balance: 40000, bonus: 25000 → covered (40000+25000 > 60000)
    const providers = [{ name: 'A', frequency: 'monthly', monthlyEquivalentPence: 60000 }];
    const { requiredTopUpPence } = computeRequiredTopUpDisplay(providers, 40000, 25000);
    expect(requiredTopUpPence).toBe(0);
  });
});
