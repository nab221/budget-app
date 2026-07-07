import { describe, it, expect, vi } from 'vitest';
import { extractTextFromPdf, parsers } from './pdf-parser.js';

// Mock pdfjs-dist
vi.mock('pdfjs-dist', () => {
  return {
    GlobalWorkerOptions: {
      workerSrc: ''
    },
    getDocument: vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [
              { str: '02 Mar', transform: [0, 0, 0, 0, 10, 100], width: 20, height: 10 },
              { str: 'TESCO', transform: [0, 0, 0, 0, 50, 100], width: 30, height: 10 },
              { str: '12.50', transform: [0, 0, 0, 0, 100, 100], width: 20, height: 10 },
              { str: 'Page 1', transform: [0, 0, 0, 0, 10, 10], width: 20, height: 10 }
            ]
          })
        })
      })
    })
  };
});

describe('pdf-parser', () => {
  describe('extractTextFromPdf', () => {
    it('should extract text items and group them into rows', async () => {
      const result = await extractTextFromPdf(new ArrayBuffer(0));

      // We expect 2 rows: one for Y=100 and one for Y=10
      expect(result).toHaveLength(2);

      // Check first row (Y=100) - should be sorted by X
      expect(result[0]).toHaveLength(3);
      expect(result[0][0].text).toBe('02 Mar');
      expect(result[0][1].text).toBe('TESCO');
      expect(result[0][2].text).toBe('12.50');

      // Check second row (Y=10)
      expect(result[1]).toHaveLength(1);
      expect(result[1][0].text).toBe('Page 1');
    });

    it('should throw NO_TEXT_LAYER error for scanned PDFs', async () => {
      // Mock an empty page
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.getDocument.mockReturnValueOnce({
        promise: Promise.resolve({
          numPages: 1,
          getPage: vi.fn().mockResolvedValue({
            getTextContent: vi.fn().mockResolvedValue({
              items: []
            })
          })
        })
      });

      await expect(extractTextFromPdf(new ArrayBuffer(0))).rejects.toThrow('NO_TEXT_LAYER');
    });
  });

  // Bank current-account parsers only (credit-card / Amex / mortgage parsing and
  // the statement-summary prefill were removed in Phase 5 — spec §4.6).
  describe('parsers', () => {
    const mockRow = (texts) => texts.map((text, i) => ({ text, x: i * 10 }));

    describe('santanderCurrent', () => {
      it('should parse Santander current account transactions (out = spend, in = income)', () => {
        const rows = [
          mockRow(['01/01/2024', 'ATM WITHDRAWAL', '20.00', '']),
          mockRow(['02/01/2024', 'SALARY', '', '2000.00'])
        ];
        const result = parsers.santanderCurrent(rows);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ date: '2024-01-01', description: 'ATM WITHDRAWAL', amount: -2000 });
        expect(result[1]).toMatchObject({ date: '2024-01-02', description: 'SALARY', amount: 200000 });
      });
    });

    describe('nationwide', () => {
      it('should parse Nationwide transactions', () => {
        const rows = [
          mockRow(['01 JAN', 'GAS BILL', '45.00'])
        ];
        const result = parsers.nationwide(rows);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('GAS BILL');
        expect(result[0].amount).toBe(-4500);
      });
    });
  });
});
