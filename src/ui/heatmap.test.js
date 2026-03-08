import { describe, expect, it } from 'vitest';
import { formatLocalDateKey } from './heatmap.js';

describe('heatmap date keying', () => {
  it('formats YYYY-MM-DD using local date parts', () => {
    const d = new Date(2026, 0, 5, 23, 59, 59);
    expect(formatLocalDateKey(d)).toBe('2026-01-05');
  });

  it('pads month and day with leading zeros', () => {
    const d = new Date(2026, 2, 8);
    expect(formatLocalDateKey(d)).toBe('2026-03-08');
  });
});
