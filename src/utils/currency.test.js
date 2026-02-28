import { describe, it, expect } from 'vitest';
import { toPence, fromPence, formatGBP } from './currency';

describe('Currency Utilities', () => {
  describe('toPence', () => {
    it('converts integers pounds to pence', () => {
      expect(toPence(10)).toBe(1000);
    });

    it('converts floating point pounds to pence accurately', () => {
      expect(toPence(10.25)).toBe(1025);
    });

    it('handles floating point errors (0.1 + 0.2)', () => {
      expect(toPence(0.1 + 0.2)).toBe(30);
    });

    it('converts string pounds to pence', () => {
      expect(toPence("10.50")).toBe(1050);
    });

    it('rounds to the nearest pence', () => {
      expect(toPence(10.256)).toBe(1026);
    });
  });

  describe('fromPence', () => {
    it('converts pence back to pounds', () => {
      expect(fromPence(1025)).toBe(10.25);
    });

    it('handles zero', () => {
      expect(fromPence(0)).toBe(0);
    });
  });

  describe('formatGBP', () => {
    it('formats pence as GBP string', () => {
      expect(formatGBP(1025)).toBe('£10.25');
    });

    it('formats large amounts with commas', () => {
      expect(formatGBP(100000000)).toBe('£1,000,000.00');
    });

    it('formats zero correctly', () => {
      expect(formatGBP(0)).toBe('£0.00');
    });
  });
});
