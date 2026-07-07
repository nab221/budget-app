import { describe, it, expect } from 'vitest';
import { formatPayRule, ordinal } from './payRule.js';

describe('ordinal', () => {
  it('adds correct suffixes', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(28)).toBe('28th');
  });
});

describe('formatPayRule', () => {
  it('formats nth-of-month with the day ordinal', () => {
    expect(formatPayRule('nth-of-month', 28)).toBe('28th of month');
    expect(formatPayRule('nth-of-month', 1)).toBe('1st of month');
  });

  it('formats the last-day rules', () => {
    expect(formatPayRule('last-day')).toBe('Last day of month');
    expect(formatPayRule('last-working-day')).toBe('Last working day');
  });
});
