import { describe, it, expect } from 'vitest';
import { compareStrings, findBestMatch } from './string-similarity.js';

describe('string-similarity utils', () => {
  it('compareStrings should return 1 for identical strings', () => {
    expect(compareStrings('Tesco', 'Tesco')).toBe(1);
  });

  it('compareStrings should be case-insensitive', () => {
    expect(compareStrings('Tesco', 'TESCO')).toBe(1);
  });

  it('compareStrings should return a score between 0 and 1 for similar strings', () => {
    const score = compareStrings('Tesco Stores', 'Tesco');
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThan(1);
  });

  it('findBestMatch should find the best match', () => {
    const targets = ['Tesco', 'Lloyds Bank', 'Waitrose'];
    const result = findBestMatch('Lloyds', targets);
    expect(result.target).toBe('lloyds bank'); // it returns lowercased from what I saw
    expect(result.rating).toBeGreaterThan(0.5);
  });

  it('findBestMatch should handle null or empty inputs', () => {
    expect(findBestMatch(null, [])).toEqual({ target: null, rating: 0 });
    expect(findBestMatch('test', [])).toEqual({ target: null, rating: 0 });
  });
});
