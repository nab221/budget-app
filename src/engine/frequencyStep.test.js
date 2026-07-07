import { describe, it, expect } from 'vitest';
import { frequencyStepMonths, advanceByFrequency, FREQUENCY_MONTHS } from './plan.js';
import { advanceNextDate } from './recurrence.js';

describe('frequencyStepMonths', () => {
  it('maps the three supported bill frequencies', () => {
    expect(frequencyStepMonths('monthly')).toBe(1);
    expect(frequencyStepMonths('quarterly')).toBe(3);
    expect(frequencyStepMonths('annual')).toBe(12);
  });

  it('falls back to monthly for unknown frequencies', () => {
    expect(frequencyStepMonths('weekly')).toBe(1);
    expect(frequencyStepMonths(undefined)).toBe(1);
  });

  it('exposes the same mapping as the FREQUENCY_MONTHS table', () => {
    expect(FREQUENCY_MONTHS).toEqual({ monthly: 1, quarterly: 3, '6-monthly': 6, annual: 12 });
  });
});

describe('advanceByFrequency', () => {
  it('steps forward one period by default', () => {
    expect(advanceByFrequency('2026-01-15', 'monthly')).toBe('2026-02-15');
    expect(advanceByFrequency('2026-01-15', 'quarterly')).toBe('2026-04-15');
    expect(advanceByFrequency('2026-02-15', 'annual')).toBe('2027-02-15');
  });

  it('steps backward with a negative count (used by unconfirm rollback checks)', () => {
    expect(advanceByFrequency('2026-02-15', 'monthly', -1)).toBe('2026-01-15');
    expect(advanceByFrequency('2027-02-15', 'annual', -1)).toBe('2026-02-15');
  });

  it('treats annual as +12 months, unlike recurrence.advanceNextDate', () => {
    // The engine contract: `annual` means a full year. This is the exact bug
    // the shared helper exists to avoid — recurrence.advanceNextDate keys off
    // `annually` and treats the spec's `annual` as a monthly step.
    expect(advanceByFrequency('2026-02-15', 'annual')).toBe('2027-02-15');
    const legacy = advanceNextDate({ nextDate: '2026-02-15', frequency: 'annual' });
    expect(legacy.nextDate).toBe('2026-03-15'); // demonstrates why we do NOT reuse it
  });
});
