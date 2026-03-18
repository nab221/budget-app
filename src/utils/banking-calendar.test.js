// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isUKBankHoliday,
  isWorkingDay,
  nextWorkingDay,
  adjustedPaymentDate,
  refreshBankHolidaysCache,
} from './banking-calendar.js';

const CACHE_KEY = 'uk_bank_holidays_cache';
const CACHE_DATE_KEY = 'uk_bank_holidays_cache_date';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// isUKBankHoliday
// ---------------------------------------------------------------------------
describe('isUKBankHoliday', () => {
  it('returns true for 2026-01-01 (New Year\'s Day) using static fallback', () => {
    expect(isUKBankHoliday(new Date('2026-01-01T00:00:00Z'))).toBe(true);
  });

  it('returns true for 2026-04-03 (Good Friday)', () => {
    expect(isUKBankHoliday(new Date('2026-04-03T00:00:00Z'))).toBe(true);
  });

  it('returns true for 2026-12-28 (Boxing Day substitute)', () => {
    expect(isUKBankHoliday(new Date('2026-12-28T00:00:00Z'))).toBe(true);
  });

  it('returns false for 2026-03-20 (normal Friday)', () => {
    expect(isUKBankHoliday(new Date('2026-03-20T00:00:00Z'))).toBe(false);
  });

  it('accepts YYYY-MM-DD string: "2026-01-01" → true', () => {
    expect(isUKBankHoliday('2026-01-01')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isWorkingDay
// ---------------------------------------------------------------------------
describe('isWorkingDay', () => {
  it('2026-03-20 (Friday, no holiday) → true', () => {
    expect(isWorkingDay('2026-03-20')).toBe(true);
  });

  it('2026-03-21 (Saturday) → false', () => {
    expect(isWorkingDay('2026-03-21')).toBe(false);
  });

  it('2026-03-22 (Sunday) → false', () => {
    expect(isWorkingDay('2026-03-22')).toBe(false);
  });

  it('2026-01-01 (New Year\'s Day) → false', () => {
    expect(isWorkingDay('2026-01-01')).toBe(false);
  });

  it('2026-04-06 (Easter Monday) → false', () => {
    expect(isWorkingDay('2026-04-06')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nextWorkingDay
// ---------------------------------------------------------------------------
describe('nextWorkingDay', () => {
  it('New Year\'s Day 2026-01-01 (Thursday) → 2026-01-02 (Friday)', () => {
    const result = nextWorkingDay(new Date('2026-01-01T00:00:00Z'));
    expect(result.toISOString().split('T')[0]).toBe('2026-01-02');
  });

  it('Christmas 2026-12-25 (Fri+holiday) → 2026-12-29 (Tuesday after cluster)', () => {
    const result = nextWorkingDay(new Date('2026-12-25T00:00:00Z'));
    expect(result.toISOString().split('T')[0]).toBe('2026-12-29');
  });

  it('2026-03-20 (Friday, already working day) → same day returned', () => {
    const result = nextWorkingDay(new Date('2026-03-20T00:00:00Z'));
    expect(result.toISOString().split('T')[0]).toBe('2026-03-20');
  });

  it('2026-03-21 (Saturday) → 2026-03-23 (Monday)', () => {
    const result = nextWorkingDay(new Date('2026-03-21T00:00:00Z'));
    expect(result.toISOString().split('T')[0]).toBe('2026-03-23');
  });

  it('2026-04-03 (Good Friday) → 2026-04-07 (Tuesday after Easter Monday)', () => {
    const result = nextWorkingDay(new Date('2026-04-03T00:00:00Z'));
    expect(result.toISOString().split('T')[0]).toBe('2026-04-07');
  });

  it('accepts string input: "2026-03-21" → "2026-03-23"', () => {
    const result = nextWorkingDay('2026-03-21');
    expect(result.toISOString().split('T')[0]).toBe('2026-03-23');
  });

  it('safety: max 14 iterations guard — console.warn on corrupted data with stuck date', () => {
    // Corrupt the cache with a date string that would be a holiday every day
    // We simulate by populating every date around 2026-06-01 as holiday
    const corruptHolidays = [];
    for (let d = 1; d <= 30; d++) {
      corruptHolidays.push(`2026-06-${String(d).padStart(2, '0')}`);
    }
    // Also cover July to exceed 14-day window
    for (let d = 1; d <= 20; d++) {
      corruptHolidays.push(`2026-07-${String(d).padStart(2, '0')}`);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(corruptHolidays));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // This should hit the safety guard since every day is a "holiday"
    const result = nextWorkingDay(new Date('2026-06-01T00:00:00Z'));
    expect(warnSpy).toHaveBeenCalled();
    // Should still return a Date (not throw)
    expect(result).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// adjustedPaymentDate
// ---------------------------------------------------------------------------
describe('adjustedPaymentDate', () => {
  it('(date, "none") → returns same Date object (no adjustment)', () => {
    const d = new Date('2026-03-21T00:00:00Z');
    const result = adjustedPaymentDate(d, 'none');
    expect(result.toISOString().split('T')[0]).toBe('2026-03-21');
  });

  it('(date, "next-working-day") → delegates to nextWorkingDay', () => {
    const d = new Date('2026-03-21T00:00:00Z');
    const result = adjustedPaymentDate(d, 'next-working-day');
    expect(result.toISOString().split('T')[0]).toBe('2026-03-23');
  });

  it('("2026-03-21", "next-working-day") → Date for "2026-03-23"', () => {
    const result = adjustedPaymentDate('2026-03-21', 'next-working-day');
    expect(result.toISOString().split('T')[0]).toBe('2026-03-23');
  });
});

// ---------------------------------------------------------------------------
// refreshBankHolidaysCache
// ---------------------------------------------------------------------------
describe('refreshBankHolidaysCache', () => {
  it('on success: stores date array under CACHE_KEY and today under CACHE_DATE_KEY', async () => {
    const mockDates = ['2026-01-01', '2026-04-03'];
    const mockResponse = {
      'england-and-wales': {
        events: mockDates.map(d => ({ date: d, title: 'Holiday', notes: '', bunting: true }))
      }
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await refreshBankHolidaysCache();
    expect(result).toEqual({ success: true, count: mockDates.length });

    const stored = localStorage.getItem(CACHE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    expect(parsed).toEqual(mockDates);

    const storedDate = localStorage.getItem(CACHE_DATE_KEY);
    // Should be today's date in YYYY-MM-DD format
    expect(storedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('on fetch failure: does NOT throw; logs console.warn; localStorage unchanged', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(refreshBankHolidaysCache()).resolves.toMatchObject({ success: false, error: 'Network error' });
    expect(warnSpy).toHaveBeenCalled();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    expect(localStorage.getItem(CACHE_DATE_KEY)).toBeNull();
  });

  it('on non-ok HTTP response: does NOT throw; logs console.warn', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(refreshBankHolidaysCache()).resolves.toMatchObject({ success: false, error: 'HTTP 503' });
    expect(warnSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// loadBankHolidays fallback behaviour (via isUKBankHoliday)
// ---------------------------------------------------------------------------
describe('loadBankHolidays (static fallback behaviour)', () => {
  it('when CACHE_KEY has a valid JSON array → uses it instead of STATIC_HOLIDAYS', () => {
    // Override cache with a custom holiday
    localStorage.setItem(CACHE_KEY, JSON.stringify(['2026-06-15']));
    // Static set does not include 2026-06-15 as holiday (it's a Monday)
    expect(isUKBankHoliday('2026-06-15')).toBe(true);
    // 2026-01-01 is in STATIC_HOLIDAYS but not in our custom cache
    expect(isUKBankHoliday('2026-01-01')).toBe(false);
  });

  it('when CACHE_KEY is corrupt JSON → falls back to STATIC_HOLIDAYS silently', () => {
    localStorage.setItem(CACHE_KEY, 'NOT_VALID_JSON{{{');
    // Should fall back to static and not throw
    expect(() => isUKBankHoliday('2026-01-01')).not.toThrow();
    expect(isUKBankHoliday('2026-01-01')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// maxCachedYear guard
// ---------------------------------------------------------------------------
describe('maxCachedYear guard', () => {
  it('when date year > max year in static fallback AND cache is empty → console.warn called', () => {
    // Do not set cache (localStorage is clear from beforeEach)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Static holidays only go up to 2027; test with 2030
    const result = isUKBankHoliday('2030-06-15');
    expect(warnSpy).toHaveBeenCalled();
    // Should still return a result (weekend-only logic: 2030-06-15 is a Saturday)
    expect(typeof result).toBe('boolean');
  });
});
