import { describe, it, expect } from 'vitest';
import {
  normaliseDescription,
  importHash,
  parsedToRows,
  annotateDuplicates,
  suggestCategory,
} from './import-parse.js';

describe('normaliseDescription', () => {
  it('lower-cases, strips punctuation and collapses whitespace', () => {
    expect(normaliseDescription('  TESCO   STORES-1234  ')).toBe('tesco stores 1234');
    expect(normaliseDescription('Card Payment: AMAZON*UK')).toBe('card payment amazon uk');
  });
  it('returns empty string for nullish input', () => {
    expect(normaliseDescription(null)).toBe('');
    expect(normaliseDescription(undefined)).toBe('');
  });
});

describe('importHash', () => {
  it('is stable for the same date + amount + normalised description', () => {
    const a = importHash({ date: '2025-03-02', amountPence: -1250, description: 'TESCO STORES' });
    const b = importHash({ date: '2025-03-02', amountPence: -1250, description: 'tesco   stores' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('differs when any component changes', () => {
    const base = { date: '2025-03-02', amountPence: -1250, description: 'TESCO' };
    expect(importHash(base)).not.toBe(importHash({ ...base, date: '2025-03-03' }));
    expect(importHash(base)).not.toBe(importHash({ ...base, amountPence: -1251 }));
    expect(importHash(base)).not.toBe(importHash({ ...base, description: 'SAINSBURYS' }));
  });

  it('distinguishes an income from a spend of the same magnitude', () => {
    const spend = importHash({ date: '2025-03-02', amountPence: -2000, description: 'X' });
    const income = importHash({ date: '2025-03-02', amountPence: 2000, description: 'X' });
    expect(spend).not.toBe(income);
  });
});

describe('parsedToRows', () => {
  it('maps signed-pence bank rows to preview rows with kind + hash', () => {
    // Shape emitted by the bank parsers (see pdf-parser.test.js): signed pence.
    const parsed = [
      { date: '2024-01-01', description: 'ATM WITHDRAWAL', amount: -2000 },
      { date: '2024-01-02', description: 'SALARY', amount: 200000 },
    ];
    const rows = parsedToRows(parsed);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: 'spend', amountPence: 2000, description: 'ATM WITHDRAWAL' });
    expect(rows[1]).toMatchObject({ kind: 'income', amountPence: 200000, description: 'SALARY' });
    expect(rows[0].hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('annotateDuplicates', () => {
  const rows = parsedToRows([
    { date: '2025-03-01', description: 'TESCO', amount: -1000 },
    { date: '2025-03-01', description: 'TESCO', amount: -1000 }, // intra-batch dup
    { date: '2025-03-02', description: 'SHELL', amount: -4500 },
  ]);

  it('flags rows whose hash already exists in the ledger', () => {
    const existing = new Set([rows[2].hash]);
    const out = annotateDuplicates(rows, existing);
    expect(out[2].duplicate).toBe(true);
    expect(out[2].duplicateReason).toBe('already imported');
  });

  it('flags a repeat within the same batch', () => {
    const out = annotateDuplicates(rows, new Set());
    expect(out[0].duplicate).toBe(false);
    expect(out[1].duplicate).toBe(true);
    expect(out[1].duplicateReason).toBe('duplicate in this file');
  });
});

describe('suggestCategory', () => {
  const mappings = [
    { descriptionKey: 'tesco stores', categoryId: 1 },
    { descriptionKey: 'shell petrol', categoryId: 2 },
  ];

  it('returns the exact-match category on the normalised key', () => {
    expect(suggestCategory('TESCO   STORES', mappings)).toBe(1);
  });

  it('falls back to the best fuzzy match above the threshold', () => {
    // "tesco store" is very close to "tesco stores"
    expect(suggestCategory('Tesco Store', mappings)).toBe(1);
  });

  it('returns null when nothing is similar enough', () => {
    expect(suggestCategory('Random Unrelated Payee', mappings)).toBeNull();
  });

  it('returns null when there are no mappings', () => {
    expect(suggestCategory('Tesco', [])).toBeNull();
  });
});
