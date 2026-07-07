import { describe, it, expect, vi } from 'vitest';
import { extractTextFromPdf, parsers, extractStatementSummary } from './pdf-parser.js';

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

  describe('extractStatementSummary', () => {
    const mockRows = (texts) => texts.map(t => [{ text: t, x: 0, y: 0, page: 1 }]);

    it('should extract Barclays statement summary', () => {
      const rows = mockRows([
        'Statement Date 01 Aug 2025',
        'Previous Balance £500.00',
        'New Balance £1,234.56',
        'Minimum Payment £25.00',
        'Payment Due Date 21 Aug 2025'
      ]);
      const result = extractStatementSummary(rows);
      expect(result).toEqual({
        statementDate: '2025-08-01',
        openingBalance: 50000,
        newBalance: 123456,
        minimumPayment: 2500,
        paymentDueDate: '2025-08-21'
      });
    });

    it('should extract HSBC statement summary', () => {
      const rows = mockRows([
        'Date of Statement 14/07/2025',
        'Opening Balance 0.00',
        'New Balance 1,500.00',
        'Minimum Payment Due £35.00',
        'Payment due on 07 Aug 2025'
      ]);
      const result = extractStatementSummary(rows);
      expect(result).toEqual({
        statementDate: '2025-07-14',
        openingBalance: 0,
        newBalance: 150000,
        minimumPayment: 3500,
        paymentDueDate: '2025-08-07'
      });
    });

    it('should extract Lloyds statement summary', () => {
      const rows = mockRows([
        'Produced On 10 Sep 2025',
        'Balance B/F 100.00',
        'Closing Balance 250.00',
        'Min Payment Due £10.00',
        'Payment Due Date 10/10/2025'
      ]);
      const result = extractStatementSummary(rows);
      expect(result).toEqual({
        statementDate: '2025-09-10',
        openingBalance: 10000,
        newBalance: 25000,
        minimumPayment: 1000,
        paymentDueDate: '2025-10-10'
      });
    });

    it('should return null for missing fields', () => {
      const rows = mockRows(['No summary data here']);
      const result = extractStatementSummary(rows);
      expect(result).toEqual({
        statementDate: null,
        openingBalance: null,
        newBalance: null,
        minimumPayment: null,
        paymentDueDate: null
      });
    });
  });

  describe('parsers', () => {
    const mockRow = (texts) => texts.map((text, i) => ({ text, x: i * 10 }));

    describe('lloydsTsbCredit', () => {
      it('should parse Lloyds/TSB credit card transactions', () => {
        const rows = [
          mockRow(['01 JAN', '02 JAN', 'TESCO STORES', '12.50']),
          mockRow(['05 JAN', '06 JAN', 'PAYMENT RECEIVED', '50.00', 'CR'])
        ];
        const result = parsers.lloydsTsbCredit(rows);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ description: 'TESCO STORES', amount: -1250 });
        expect(result[1]).toMatchObject({ description: 'PAYMENT RECEIVED', amount: 5000 });
      });
    });

    describe('santanderCurrent', () => {
      it('should parse Santander current account transactions', () => {
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

    describe('amex', () => {
      it('should parse Amex transactions (long date)', () => {
        const rows = [
          mockRow(['01/01/2024', 'AMAZON.CO.UK', '29.99'])
        ];
        const result = parsers.amex(rows);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('AMAZON.CO.UK');
        expect(result[0].amount).toBe(-2999);
      });

      it('should parse Amex transactions (short date)', () => {
        const rows = [
          mockRow(['01 JAN', 'STARBUCKS', '5.50'])
        ];
        const result = parsers.amex(rows);
        expect(result).toHaveLength(1);
        expect(result[0].description).toBe('STARBUCKS');
        expect(result[0].amount).toBe(-550);
      });
    });

    describe('tsbMortgage', () => {
      it('should calculate Capital Repaid as Payment - Interest', () => {
        const rows = [
          mockRow(['01 JAN', 'INTEREST CHARGED', '400.00']),
          mockRow(['02 JAN', 'PAYMENT RECEIVED', '1000.00'])
        ];
        const result = parsers.tsbMortgage(rows);
        // Should have 2 results: the interest charge and the capital repaid
        expect(result).toHaveLength(2);
        expect(result).toContainEqual(expect.objectContaining({ description: 'Mortgage Interest Charged', amount: -40000 }));
        expect(result).toContainEqual(expect.objectContaining({ description: 'Mortgage Capital Repaid', amount: 60000 }));
      });

      it('should handle payment without preceding interest', () => {
        const rows = [
          mockRow(['02 JAN', 'PAYMENT RECEIVED', '1000.00'])
        ];
        const result = parsers.tsbMortgage(rows);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ description: 'Mortgage Payment', amount: 100000 });
      });
    });
  });
});
