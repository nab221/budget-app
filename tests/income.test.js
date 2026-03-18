/**
 * tests/income.test.js
 *
 * Phase 33: Tests for the income projection helpers in src/utils/income.js.
 * Covers getNextIncomeEvent and getUpcomingIncomeEvents — the Phase 34 handoff contract.
 *
 * All dates use YYYY-MM-DD strings. Banking-calendar module is mocked for
 * deterministic test results; specific bank-holiday/weekend tests confirm
 * that the mock is called and the adjusted date flows through correctly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Stub localStorage (not available in Node/Vitest)
// ---------------------------------------------------------------------------
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

// ---------------------------------------------------------------------------
// Mock banking-calendar to make tests deterministic
// ---------------------------------------------------------------------------
const mockNextWorkingDay = vi.fn((date) => {
  // Default: return the same date as a Date object (no-op adjustment)
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(date.getTime());
  return d;
});

vi.mock('../src/utils/banking-calendar.js', () => ({
  adjustedPaymentDate: (nominalDate, adjustment) => {
    if (adjustment !== 'next-working-day') {
      return typeof nominalDate === 'string'
        ? new Date(`${nominalDate}T00:00:00Z`)
        : nominalDate;
    }
    return mockNextWorkingDay(nominalDate);
  },
  nextWorkingDay: (date) => mockNextWorkingDay(date),
  isWorkingDay: vi.fn(() => true)
}));

const { getNextIncomeEvent, getUpcomingIncomeEvents } = await import('../src/utils/income.js');

// Helper to build a YYYY-MM-DD string from a Date object using UTC
function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Source factories
// ---------------------------------------------------------------------------
function nthOfMonthSource(day, overrides = {}) {
  return {
    id: 1,
    name: 'Salary',
    monthlyAmount: 300000,
    payDateRule: 'nth-of-month',
    payDateDay: day,
    isActive: true,
    displayOrder: 0,
    ...overrides
  };
}

function lastDaySource(overrides = {}) {
  return {
    id: 2,
    name: 'Freelance',
    monthlyAmount: 50000,
    payDateRule: 'last-day',
    payDateDay: null,
    isActive: true,
    displayOrder: 1,
    ...overrides
  };
}

function lastWorkingDaySource(overrides = {}) {
  return {
    id: 3,
    name: 'Consulting',
    monthlyAmount: 100000,
    payDateRule: 'last-working-day',
    payDateDay: null,
    isActive: true,
    displayOrder: 2,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// getNextIncomeEvent
// ---------------------------------------------------------------------------
describe('getNextIncomeEvent', () => {
  beforeEach(() => {
    mockNextWorkingDay.mockImplementation((date) => {
      const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(date.getTime());
      return d;
    });
  });

  it('returns an event object with the correct shape', () => {
    const source = nthOfMonthSource(25);
    const result = getNextIncomeEvent(source, '2026-03-01');
    expect(result).toHaveProperty('sourceId');
    expect(result).toHaveProperty('sourceName');
    expect(result).toHaveProperty('amount');
    expect(result).toHaveProperty('nominalDate');
    expect(result).toHaveProperty('adjustedDate');
  });

  it('returns correct sourceId and sourceName', () => {
    const source = nthOfMonthSource(25, { id: 42, name: 'My Job' });
    const result = getNextIncomeEvent(source, '2026-03-01');
    expect(result.sourceId).toBe(42);
    expect(result.sourceName).toBe('My Job');
  });

  it('returns the correct amount from the source', () => {
    const source = nthOfMonthSource(25, { monthlyAmount: 999 });
    const result = getNextIncomeEvent(source, '2026-03-01');
    expect(result.amount).toBe(999);
  });

  describe('nth-of-month rule', () => {
    it('returns the 25th of the current month when fromDate is before the 25th', () => {
      const source = nthOfMonthSource(25);
      const result = getNextIncomeEvent(source, '2026-03-10');
      expect(result.nominalDate).toBe('2026-03-25');
    });

    it('returns the 25th of the next month when fromDate is after the 25th', () => {
      const source = nthOfMonthSource(25);
      const result = getNextIncomeEvent(source, '2026-03-26');
      expect(result.nominalDate).toBe('2026-04-25');
    });

    it('returns the 25th of the next month when fromDate IS the 25th', () => {
      const source = nthOfMonthSource(25);
      const result = getNextIncomeEvent(source, '2026-03-25');
      expect(result.nominalDate).toBe('2026-04-25');
    });

    it('wraps from December to January correctly', () => {
      const source = nthOfMonthSource(15);
      const result = getNextIncomeEvent(source, '2026-12-20');
      expect(result.nominalDate).toBe('2027-01-15');
    });
  });

  describe('last-day rule', () => {
    it('returns the last day of the current month when fromDate is before end of month', () => {
      const source = lastDaySource();
      const result = getNextIncomeEvent(source, '2026-03-10');
      expect(result.nominalDate).toBe('2026-03-31');
    });

    it('returns the last day of next month when fromDate is the last day', () => {
      const source = lastDaySource();
      const result = getNextIncomeEvent(source, '2026-03-31');
      expect(result.nominalDate).toBe('2026-04-30');
    });

    it('returns the last day of April (30 days) correctly', () => {
      const source = lastDaySource();
      const result = getNextIncomeEvent(source, '2026-04-15');
      expect(result.nominalDate).toBe('2026-04-30');
    });

    it('handles February correctly (28 days in non-leap year)', () => {
      const source = lastDaySource();
      const result = getNextIncomeEvent(source, '2026-02-01');
      expect(result.nominalDate).toBe('2026-02-28');
    });
  });

  describe('last-working-day rule', () => {
    it('returns the last day of the current month as nominalDate', () => {
      const source = lastWorkingDaySource();
      const result = getNextIncomeEvent(source, '2026-03-10');
      expect(result.nominalDate).toBe('2026-03-31');
    });

    it('applies banking-calendar adjustment for last-working-day', () => {
      // Mock: last day of March (31st) falls on Tuesday — next working day is same day
      mockNextWorkingDay.mockReturnValueOnce(new Date('2026-03-31T00:00:00Z'));
      const source = lastWorkingDaySource();
      const result = getNextIncomeEvent(source, '2026-03-10');
      expect(result.adjustedDate).toBe('2026-03-31');
    });

    it('adjustedDate advances past a weekend when last day falls on Saturday', () => {
      // Mock banking-calendar: 2026-01-31 is Saturday -> next working day is 2026-02-02
      mockNextWorkingDay.mockImplementation((date) => {
        const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(date.getTime());
        if (toDateStr(d) === '2026-01-31') {
          return new Date('2026-02-02T00:00:00Z');
        }
        return d;
      });
      const source = lastWorkingDaySource({ id: 10, name: 'Consulting' });
      const result = getNextIncomeEvent(source, '2026-01-10');
      expect(result.nominalDate).toBe('2026-01-31');
      expect(result.adjustedDate).toBe('2026-02-02');
    });

    it('adjustedDate advances past a bank holiday', () => {
      // Mock banking-calendar: 2026-12-25 (Christmas) -> 2026-12-29
      mockNextWorkingDay.mockImplementation((date) => {
        const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(date.getTime());
        if (toDateStr(d) === '2026-12-31') {
          return new Date('2026-12-29T00:00:00Z');
        }
        return d;
      });
      const source = lastWorkingDaySource();
      const result = getNextIncomeEvent(source, '2026-12-01');
      expect(result.nominalDate).toBe('2026-12-31');
      expect(result.adjustedDate).toBe('2026-12-29');
    });
  });

  describe('nth-of-month adjustedDate', () => {
    it('nominalDate and adjustedDate are the same when no weekend/holiday', () => {
      const source = nthOfMonthSource(15);
      const result = getNextIncomeEvent(source, '2026-03-01');
      expect(result.nominalDate).toBe('2026-03-15');
      expect(result.adjustedDate).toBe('2026-03-15');
    });

    it('adjustedDate advances past bank holiday on the 25th', () => {
      mockNextWorkingDay.mockImplementation((date) => {
        const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(date.getTime());
        if (toDateStr(d) === '2026-12-25') {
          return new Date('2026-12-29T00:00:00Z');
        }
        return d;
      });
      const source = nthOfMonthSource(25);
      const result = getNextIncomeEvent(source, '2026-12-01');
      expect(result.nominalDate).toBe('2026-12-25');
      expect(result.adjustedDate).toBe('2026-12-29');
    });
  });

  describe('inactive source', () => {
    it('returns null for an inactive source', () => {
      const source = nthOfMonthSource(25, { isActive: false });
      const result = getNextIncomeEvent(source, '2026-03-01');
      expect(result).toBeNull();
    });
  });

  describe('event shape does not use singular payDay', () => {
    it('result has no payDay property', () => {
      const source = nthOfMonthSource(25);
      const result = getNextIncomeEvent(source, '2026-03-01');
      expect(result).not.toHaveProperty('payDay');
    });
  });
});

// ---------------------------------------------------------------------------
// getUpcomingIncomeEvents
// ---------------------------------------------------------------------------
describe('getUpcomingIncomeEvents', () => {
  beforeEach(() => {
    mockNextWorkingDay.mockImplementation((date) => {
      const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : new Date(date.getTime());
      return d;
    });
  });

  it('returns an empty array when sources array is empty', () => {
    const result = getUpcomingIncomeEvents([], '2026-03-01', 5);
    expect(result).toEqual([]);
  });

  it('returns an empty array when all sources are inactive', () => {
    const sources = [
      nthOfMonthSource(25, { isActive: false }),
      lastDaySource({ isActive: false })
    ];
    const result = getUpcomingIncomeEvents(sources, '2026-03-01', 5);
    expect(result).toEqual([]);
  });

  it('returns events sorted by adjustedDate ascending across multiple sources', () => {
    // Source A: pays on 15th of month
    const sourceA = nthOfMonthSource(15, { id: 1, name: 'A', displayOrder: 0 });
    // Source B: pays on last day
    const sourceB = lastDaySource({ id: 2, name: 'B', displayOrder: 1 });
    // Source C: pays on 5th of month
    const sourceC = nthOfMonthSource(5, { id: 3, name: 'C', displayOrder: 2 });

    const result = getUpcomingIncomeEvents([sourceA, sourceB, sourceC], '2026-03-01', 6);
    expect(result.length).toBe(6);

    // Should be sorted ascending by adjustedDate
    for (let i = 1; i < result.length; i++) {
      expect(result[i].adjustedDate >= result[i - 1].adjustedDate).toBe(true);
    }
  });

  it('returns correct number of events when limit is set', () => {
    const sources = [nthOfMonthSource(10), lastDaySource()];
    const result = getUpcomingIncomeEvents(sources, '2026-03-01', 3);
    expect(result.length).toBe(3);
  });

  it('handles 3+ sources correctly (anti-singular-payDay proof)', () => {
    const sources = [
      nthOfMonthSource(5, { id: 1, name: 'Salary' }),
      nthOfMonthSource(15, { id: 2, name: 'Side Gig' }),
      lastWorkingDaySource({ id: 3, name: 'Consulting' })
    ];
    const result = getUpcomingIncomeEvents(sources, '2026-03-01', 6);
    expect(result.length).toBe(6);
    const sourceIds = [...new Set(result.map(e => e.sourceId))];
    expect(sourceIds.length).toBe(3);
  });

  it('ignores inactive sources in collection', () => {
    const sources = [
      nthOfMonthSource(5, { id: 1, isActive: true }),
      nthOfMonthSource(15, { id: 2, isActive: false }),
      lastDaySource({ id: 3, isActive: true })
    ];
    const result = getUpcomingIncomeEvents(sources, '2026-03-01', 4);
    const usedIds = new Set(result.map(e => e.sourceId));
    expect(usedIds.has(2)).toBe(false);
  });

  it('returns events with the correct Phase 34 handoff shape', () => {
    const sources = [nthOfMonthSource(25, { id: 1 })];
    const result = getUpcomingIncomeEvents(sources, '2026-03-01', 1);
    expect(result.length).toBe(1);
    const event = result[0];
    expect(event).toHaveProperty('sourceId');
    expect(event).toHaveProperty('sourceName');
    expect(event).toHaveProperty('amount');
    expect(event).toHaveProperty('nominalDate');
    expect(event).toHaveProperty('adjustedDate');
    expect(event).not.toHaveProperty('payDay');
  });

  it('handles limit=0 gracefully by returning empty array', () => {
    const sources = [nthOfMonthSource(25)];
    const result = getUpcomingIncomeEvents(sources, '2026-03-01', 0);
    expect(result).toEqual([]);
  });

  it('handles undefined limit by defaulting to a reasonable count', () => {
    const sources = [nthOfMonthSource(25)];
    const result = getUpcomingIncomeEvents(sources, '2026-03-01');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
