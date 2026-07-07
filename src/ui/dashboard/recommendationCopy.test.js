import { describe, it, expect } from 'vitest';
import { recommendationCopy } from './recommendationCopy.js';

describe('recommendationCopy', () => {
  it('prompts to set a balance in the needsBalance state', () => {
    const copy = recommendationCopy({ needsBalance: true, recommendation: { needsBalance: true } });
    expect(copy.tone).toBe('needs-balance');
    expect(copy.title).toMatch(/set your current balance/i);
  });

  it('gives a directive "pay it onto <debt>" message when there is spare money', () => {
    const copy = recommendationCopy({
      needsBalance: false,
      safeExtraPence: 12345,
      projectedEndBalancePence: 32345,
      safetyBufferPence: 20000,
      recommendation: { hasSpare: true, debtName: 'Barclaycard', safeExtraPence: 12345 },
    });
    expect(copy.tone).toBe('spare');
    expect(copy.title).toContain('£123.45');
    expect(copy.detail).toContain('Barclaycard');
  });

  it('celebrates being debt-free when there is spare but no debts', () => {
    const copy = recommendationCopy({
      needsBalance: false,
      safeExtraPence: 50000,
      recommendation: { hasSpare: true, debtName: null, hasDebts: false },
    });
    expect(copy.tone).toBe('debt-free');
    expect(copy.detail).toMatch(/no debts/i);
  });

  it('states the shortfall plainly when there is no spare money', () => {
    const copy = recommendationCopy({
      needsBalance: false,
      safeExtraPence: 0,
      projectedEndBalancePence: 5000,
      safetyBufferPence: 20000,
      recommendation: { hasSpare: false, debtName: 'Visa' },
    });
    expect(copy.tone).toBe('no-spare');
    expect(copy.title).toMatch(/no spare money/i);
    // 20000 - 5000 = 15000 → £150.00 below buffer.
    expect(copy.detail).toContain('£150.00');
  });
});
