import { describe, it, expect, vi } from 'vitest';
import { extractTextFromPdf } from './pdf-parser.js';

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
});
