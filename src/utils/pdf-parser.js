import * as pdfjsLib from 'pdfjs-dist';
import { toPence } from './currency.js';

// Worker initialization for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Extracts text items from a PDF with their coordinates.
 * Groups items into rows based on Y-coordinate.
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

  const EPSILON_Y = 2.0; 
  const rows = [];

  allTextItems.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return b.y - a.y;
  });

  let currentRow = [];
  let currentY = null;

  for (const item of allTextItems) {
    if (currentY === null || Math.abs(item.y - currentY) > EPSILON_Y) {
      if (currentRow.length > 0) {
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
  lloydsTsbCredit: (rows) => {
    const transactions = [];
    const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthPattern = months.join('|');
    
    const datePattern = `(?:\\d{2}\\s(?:${monthPattern}))`;
    const txRegex = new RegExp(`^(${datePattern})(?:\\s+${datePattern})?\\s+(.+?)\\s+([\\d,]+\\.\\d{2})(?:\\s+(CR))?$`, 'i');

    for (const row of rows) {
      if (row.length < 3) continue;

      const rowText = row.map(item => item.text.trim()).filter(Boolean).join(' ');
      const match = rowText.match(txRegex);
      
      if (match) {
        let rawDate = match[1];
        let desc = match[2].trim();
        let amountStr = match[3].replace(/,/g, '');
        let isCredit = !!match[4];
        
        desc = desc.replace(/^[|\s]+|[|\s]+$/g, '').trim();
        
        let dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) {
            dateObj = new Date(`${rawDate} ${new Date().getFullYear()}`);
        }
        
        if (!isNaN(dateObj.getTime())) {
          let amountPence = toPence(amountStr);
          if (!isCredit) amountPence *= -1;

          transactions.push({
            date: dateObj.toISOString().split('T')[0],
            description: desc,
            amount: amountPence
          });
        }
      }
    }
    return transactions;
  },

  santanderCurrent: (rows) => {
    const transactions = [];
    for (const row of rows) {
      if (row.length < 3) continue;
      const rowText = row.map(item => item.text.trim()).filter(Boolean).join(' ');
      const match = rowText.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d,]+\.\d{2})?(?:\s+([\d,]+\.\d{2}))?$/);
      if (match) {
        const [_, dateStr, descRaw, moneyOutStr, moneyInStr] = match;
        let amountPence = 0;
        if (moneyInStr) {
            amountPence = toPence(moneyInStr);
        } else if (moneyOutStr) {
            const desc = descRaw.toLowerCase();
            if (desc.includes('salary') || desc.includes('interest') || desc.includes('credit')) {
                amountPence = toPence(moneyOutStr);
            } else {
                amountPence = toPence(moneyOutStr) * -1;
            }
        }
        
        const parts = dateStr.split('/');
        if (parts.length === 3 && amountPence !== 0) {
            transactions.push({
                date: `${parts[2]}-${parts[1]}-${parts[0]}`,
                description: descRaw.trim(),
                amount: amountPence
            });
        }
      }
    }
    return transactions;
  },

  nationwide: (rows) => {
    const transactions = [];
    for (const row of rows) {
      if (row.length < 3) continue;
      const rowText = row.map(item => item.text.trim()).filter(Boolean).join(' ');
      const match = rowText.match(/^(\d{2}\s[A-Za-z]{3})\s+(.+?)\s+£?([\d,]+\.\d{2})/);
      if (match) {
        let dateObj = new Date(`${match[1]} ${new Date().getFullYear()}`);
        if (!isNaN(dateObj.getTime())) {
          transactions.push({
            date: dateObj.toISOString().split('T')[0],
            description: match[2].trim(),
            amount: toPence(match[3]) * -1
          });
        }
      }
    }
    return transactions;
  },

  amex: (rows) => {
    const transactions = [];
    for (const row of rows) {
      if (row.length < 3) continue;
      const rowText = row.map(item => item.text.trim()).filter(Boolean).join(' ');
      const match = rowText.match(/^(\d{2}\/\d{2}\/\d{4}|\d{2}\s[A-Za-z]{3})\s+(.+?)\s+([\d,]+\.\d{2})/);
      if (match) {
        let dateStr = match[1];
        let dateObj = new Date(dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : `${dateStr} ${new Date().getFullYear()}`);
        if (!isNaN(dateObj.getTime())) {
          transactions.push({
            date: dateObj.toISOString().split('T')[0],
            description: match[2].trim(),
            amount: toPence(match[3]) * -1
          });
        }
      }
    }
    return transactions;
  },

  mbna: (rows) => { return parsers.lloydsTsbCredit(rows); },

  tsbMortgage: (rows) => {
    const transactions = [];
    let lastInterestPence = null;
    for (const row of rows) {
      if (row.length < 3) continue;
      const rowText = row.map(item => item.text.trim()).filter(Boolean).join(' ');
      const match = rowText.match(/^(\d{2}\s[A-Za-z]{3}(?:\s\d{2})?)\s+(.+?)\s+£?([\d,]+\.\d{2})/);
      if (match) {
        let rawDate = match[1];
        let desc = match[2].trim();
        let amountPence = toPence(match[3]);
        let dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) dateObj = new Date(`${rawDate} ${new Date().getFullYear()}`);
        if (isNaN(dateObj.getTime())) continue;
        const isoDate = dateObj.toISOString().split('T')[0];

        if (desc.toLowerCase().includes("interest charged")) {
            lastInterestPence = amountPence;
            transactions.push({ date: isoDate, description: "Mortgage Interest Charged", amount: amountPence * -1 });
        } else if (desc.toLowerCase().includes("payment received") || desc.toLowerCase().includes("direct debit")) {
            transactions.push({ date: isoDate, description: "Mortgage Payment", amount: amountPence, _isPayment: true });
        } else {
            transactions.push({ date: isoDate, description: desc, amount: amountPence });
        }
      }
    }
    const processed = [];
    for (let tx of transactions) {
        if (tx._isPayment) {
            delete tx._isPayment;
            if (lastInterestPence !== null && tx.amount > lastInterestPence) {
                processed.push({ date: tx.date, description: "Mortgage Capital Repaid", amount: tx.amount - lastInterestPence });
            } else {
                processed.push(tx);
            }
        } else {
            processed.push(tx);
        }
    }
    return processed;
  }
};

/**
 * Extracts high-level summary data from a bank statement (PDF text rows).
 * Returns { statementDate, openingBalance, newBalance, minimumPayment, paymentDueDate }
 */
export function extractStatementSummary(rows) {
  const text = rows.map(r => r.map(i => i.text).join(' ')).join('\n');

  const summary = {
    statementDate: null,
    openingBalance: null,
    newBalance: null,
    minimumPayment: null,
    paymentDueDate: null
  };

  // Helper to normalize currency string to pence
  const parseCurrency = (str) => {
    if (!str) return null;
    const cleaned = str.replace(/[£,]/g, '').trim();
    return Math.round(parseFloat(cleaned) * 100);
  };

  // Helper to normalize date string to ISO format (YYYY-MM-DD)
  const parseDate = (str) => {
    if (!str) return null;
    let d = new Date(str);
    if (isNaN(d.getTime())) {
      // Try DD/MM/YYYY
      const parts = str.split('/');
      if (parts.length === 3) {
        d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    }
    if (isNaN(d.getTime())) return null;
    
    // Return YYYY-MM-DD without timezone shifts
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Patterns for Statement Date
  const datePatterns = [
    /Statement Date\s+(\d{2}\s\w{3}\s\d{4})/i,
    /Date of Statement\s+(\d{2}\/\d{2}\/\d{4})/i,
    /Produced On\s+(\d{2}\s\w{3}\s\d{4})/i
  ];

  for (const p of datePatterns) {
    const m = text.match(p);
    if (m) {
      summary.statementDate = parseDate(m[1]);
      break;
    }
  }

  // Patterns for Opening Balance
  const openingPatterns = [
    /Previous Balance\s+[£]?([\d,]+\.\d{2})/i,
    /Opening Balance\s+[£]?([\d,]+\.\d{2})/i,
    /Balance B\/F\s+[£]?([\d,]+\.\d{2})/i
  ];

  for (const p of openingPatterns) {
    const m = text.match(p);
    if (m) {
      summary.openingBalance = parseCurrency(m[1]);
      break;
    }
  }

  // Patterns for Closing/New Balance
  const closingPatterns = [
    /New Balance\s+[£]?([\d,]+\.\d{2})/i,
    /Closing Balance\s+[£]?([\d,]+\.\d{2})/i
  ];

  for (const p of closingPatterns) {
    const m = text.match(p);
    if (m) {
      summary.newBalance = parseCurrency(m[1]);
      break;
    }
  }

  // Patterns for Minimum Payment
  const minPatterns = [
    /Minimum Payment\s+[£]?([\d,]+\.\d{2})/i,
    /Minimum Payment Due\s+[£]?([\d,]+\.\d{2})/i,
    /Min Payment Due\s+[£]?([\d,]+\.\d{2})/i
  ];

  for (const p of minPatterns) {
    const m = text.match(p);
    if (m) {
      summary.minimumPayment = parseCurrency(m[1]);
      break;
    }
  }

  // Patterns for Due Date
  const duePatterns = [
    /Payment Due Date\s+(\d{2}\s\w{3}\s\d{4})/i,
    /Payment Due Date\s+(\d{2}\/\d{2}\/\d{4})/i,
    /Payment due on\s+(\d{2}\s\w{3}\s\d{4})/i
  ];

  for (const p of duePatterns) {
    const m = text.match(p);
    if (m) {
      summary.paymentDueDate = parseDate(m[1]);
      break;
    }
  }

  return summary;
}

