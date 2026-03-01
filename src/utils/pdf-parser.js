import * as pdfjsLib from 'pdfjs-dist';

// Worker initialization for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Extracts text items from a PDF with their coordinates.
 * Groups items into rows based on Y-coordinate.
 * 
 * @param {ArrayBuffer|File} source - PDF data source
 * @returns {Promise<Object[]>} Array of rows, each containing sorted text items
 * @throws {Error} "NO_TEXT_LAYER" if no text content is found (scanned PDF)
 */
export async function extractTextFromPdf(source) {
  let pdfData;
  if (source instanceof File) {
    pdfData = await source.arrayBuffer();
  } else {
    pdfData = source;
  }

  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const allTextItems = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // transform: [scaleX, skewX, skewY, scaleY, translateX, translateY]
    // index 4 is X, index 5 is Y
    const items = textContent.items.map(item => ({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height: item.height,
      page: i
    }));
    
    allTextItems.push(...items);
  }

  if (allTextItems.length === 0 || allTextItems.every(item => !item.text.trim())) {
    throw new Error("NO_TEXT_LAYER");
  }

  // Group by Y-coordinate (rows)
  // We use a small epsilon for Y comparison to account for minor alignment issues
  const EPSILON_Y = 2.0; 
  const rows = [];

  // Sort by page then Y descending (top to bottom)
  allTextItems.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return b.y - a.y;
  });

  let currentRow = [];
  let currentY = null;

  for (const item of allTextItems) {
    if (currentY === null || Math.abs(item.y - currentY) > EPSILON_Y) {
      if (currentRow.length > 0) {
        // Sort current row by X coordinate (left to right)
        currentRow.sort((a, b) => a.x - b.x);
        rows.push(currentRow);
      }
      currentRow = [item];
      currentY = item.y;
    } else {
      currentRow.push(item);
    }
  }

  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.x - b.x);
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Common bank parsers
 */
export const parsers = {
  /**
   * Lloyds/TSB Credit Card Parser
   * Expects rows with Date, Description, and Amount
   * @param {Array<Array<{text: string, x: number}>>} rows 
   * @returns {Array<Object>}
   */
  lloydsTsbCredit: (rows) => {
    const transactions = [];
    const dateRegex = /^(\d{2})\s([A-Z]{3})\s?(\d{2})?$/i;
    
    for (const row of rows) {
      if (row.length < 3) continue;

      // Concatenate text items that are close to each other
      const rowText = row.map(item => item.text.trim()).filter(Boolean).join(' ');
      
      // Simple regex to find Date at start, description in middle, and amount at end
      // Format: "02 Mar 24 TESCO STORES 12.50" or "02 Mar TESCO STORES 12.50"
      const match = rowText.match(/^(\d{2}\s[A-Za-z]{3}(?:\s\d{2})?)\s+(.+?)\s+£?([\d,]+\.\d{2})/);
      
      if (match) {
        let rawDate = match[1];
        let desc = match[2].trim();
        let amountStr = match[3].replace(/,/g, '');
        
        // Basic date formatting (assuming current year if not provided)
        let dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) {
            dateObj = new Date(`${rawDate} ${new Date().getFullYear()}`);
        }
        
        if (!isNaN(dateObj.getTime())) {
          transactions.push({
            date: dateObj.toISOString().split('T')[0],
            description: desc,
            amount: parseFloat(amountStr) * -1 // Credit card purchases are negative impacts to balance, but we might store as absolute. Let's keep it as parsed.
          });
        }
      }
    }
    return transactions;
  },

  /**
   * Santander Current Account Parser
   * Focuses on Salary and Direct Debit
   * @param {Array<Array<{text: string, x: number}>>} rows 
   * @returns {Array<Object>}
   */
  santanderCurrent: (rows) => {
    const transactions = [];
    
    for (const row of rows) {
      if (row.length < 3) continue;

      const rowText = row.map(item => item.text.trim()).filter(Boolean).join(' ');
      
      // Santander format: "Date Description Money In Money Out Balance"
      // Date: DD/MM/YYYY
      const match = rowText.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})?\s*([\d,]+\.\d{2})?/);
      
      if (match) {
        const [_, dateStr, descRaw, moneyOutStr, moneyInStr] = match;
        
        let desc = descRaw.trim();
        let amount = 0;
        
        if (moneyInStr) {
            amount = parseFloat(moneyInStr.replace(/,/g, ''));
        } else if (moneyOutStr) {
            amount = parseFloat(moneyOutStr.replace(/,/g, '')) * -1;
        }

        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            if (amount !== 0) {
                transactions.push({
                    date: isoDate,
                    description: desc,
                    amount
                });
            }
        }
      }
    }
    return transactions;
  }
};
