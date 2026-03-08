import { describe, expect, it } from 'vitest';
import { formatLocalDateKey, resolveCanvasColor } from './heatmap.js';

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

describe('heatmap canvas color resolution', () => {
  it('resolves CSS variable values for canvas colors', () => {
    const resolver = (varName) => (varName === '--heatmap-zero' ? '#112233' : '');
    expect(resolveCanvasColor('var(--heatmap-zero, #e5e7eb)', resolver)).toBe('#112233');
  });

  it('falls back when CSS variable is missing', () => {
    expect(resolveCanvasColor('var(--unknown-color, #abcdef)', () => '')).toBe('#abcdef');
  });
});
