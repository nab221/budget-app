import { describe, it, expect, vi } from 'vitest';
import {
  extractTextFromPdf,
  extractStatementSummary,
  parsers,
  detectStatement,
} from './pdf-parser.js';

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

// Rows are text-arrays: each row is a list of { text, x } items (the shape
// `extractTextFromPdf` produces). Helper builds a one-item-per-string row.
const mockRows = (texts) => texts.map(t => [{ text: t, x: 0, y: 0, page: 1 }]);

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

  // Card-statement summary extraction (spec §4.6): pence balances, ISO dates.
  describe('extractStatementSummary', () => {
    it('extracts a Lloyds/TSB-style credit-card summary', () => {
      const rows = mockRows([
        'Produced On 10 Sep 2025',
        'Balance B/F 100.00',
        'Closing Balance 250.00',
        'Minimum Payment Due £10.00',
        'Payment Due Date 10/10/2025'
      ]);
      expect(extractStatementSummary(rows)).toEqual({
        closingBalancePence: 25000,
        minimumPaymentPence: 1000,
        statementDate: '2025-09-10',
        paymentDueDate: '2025-10-10'
      });
    });

    it('extracts an MBNA-style summary (New Balance / Minimum Payment)', () => {
      const rows = mockRows([
        'Statement Date 01 Aug 2025',
        'Previous Balance £500.00',
        'New Balance £1,234.56',
        'Minimum Payment £25.00',
        'Payment Due Date 21 Aug 2025'
      ]);
      expect(extractStatementSummary(rows)).toEqual({
        closingBalancePence: 123456,
        minimumPaymentPence: 2500,
        statementDate: '2025-08-01',
        paymentDueDate: '2025-08-21'
      });
    });

    it('does not confuse Previous Closing Balance with the new Closing Balance', () => {
      const rows = mockRows([
        'Date of Statement 14/07/2025',
        'Previous Closing Balance 900.00',
        'Closing Balance 1,500.00',
        'Minimum Repayment £35.00',
        'Payment due on 07 Aug 2025'
      ]);
      const result = extractStatementSummary(rows);
      expect(result.closingBalancePence).toBe(150000);
      expect(result.minimumPaymentPence).toBe(3500);
      expect(result.statementDate).toBe('2025-07-14');
      expect(result.paymentDueDate).toBe('2025-08-07');
    });

    it('returns nulls when no summary fields are present', () => {
      expect(extractStatementSummary(mockRows(['No summary data here']))).toEqual({
        closingBalancePence: null,
        minimumPaymentPence: null,
        statementDate: null,
        paymentDueDate: null
      });
    });
  });

  describe('per-provider parsers', () => {
    const summaryRows = [
      'Statement Date 01 Aug 2025',
      'Closing Balance £1,000.00',
      'Minimum Payment £25.00',
      'Payment Due Date 21 Aug 2025'
    ];

    it('lloydsTsbCredit tags the Lloyds/TSB provider', () => {
      const rows = mockRows(['Lloyds Bank Credit Card', ...summaryRows]);
      const out = parsers.lloydsTsbCredit(rows);
      expect(out.provider).toBe('Lloyds/TSB credit card');
      expect(out.closingBalancePence).toBe(100000);
    });

    it('mbna tags the MBNA provider', () => {
      const rows = mockRows(['MBNA Credit Card Statement', ...summaryRows]);
      const out = parsers.mbna(rows);
      expect(out.provider).toBe('MBNA');
      expect(out.closingBalancePence).toBe(100000);
    });

    it('amex tags the American Express provider', () => {
      const rows = mockRows(['American Express', ...summaryRows]);
      const out = parsers.amex(rows);
      expect(out.provider).toBe('American Express');
      expect(out.closingBalancePence).toBe(100000);
    });

    it('returns null when there is no closing balance to read', () => {
      const rows = mockRows(['MBNA Credit Card', 'Minimum Payment £25.00']);
      expect(parsers.mbna(rows)).toBeNull();
    });
  });

  describe('detectStatement (auto-detect)', () => {
    it('picks MBNA when the MBNA signature is present', () => {
      const rows = mockRows([
        'MBNA Limited',
        'Statement Date 01 Aug 2025',
        'New Balance £1,234.56',
        'Minimum Payment £25.00',
        'Payment Due Date 21 Aug 2025'
      ]);
      const result = detectStatement(rows);
      expect(result.provider).toBe('MBNA');
      expect(result.closingBalancePence).toBe(123456);
      expect(result.minimumPaymentPence).toBe(2500);
      expect(result.statementDate).toBe('2025-08-01');
      expect(result.paymentDueDate).toBe('2025-08-21');
      // Internal scoring fields are stripped from the public result.
      expect(result._score).toBeUndefined();
    });

    it('picks Amex when the American Express signature is present', () => {
      const rows = mockRows([
        'American Express',
        'Closing Balance £742.10',
        'Minimum Payment £20.00'
      ]);
      const result = detectStatement(rows);
      expect(result.provider).toBe('American Express');
      expect(result.closingBalancePence).toBe(74210);
    });

    it('picks Lloyds/TSB when the Lloyds signature is present', () => {
      const rows = mockRows([
        'TSB Credit Card',
        'Closing Balance £310.00',
        'Minimum Payment £10.00'
      ]);
      const result = detectStatement(rows);
      expect(result.provider).toBe('Lloyds/TSB credit card');
      expect(result.closingBalancePence).toBe(31000);
    });

    it('returns null on junk with no readable balance', () => {
      expect(detectStatement(mockRows(['just some random text', 'page 1 of 3']))).toBeNull();
    });
  });
});
