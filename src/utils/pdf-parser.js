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
  const rowTexts = rows.map(r => r.map(i => i.text).join(' '));

  const summary = {
    statementDate: null,
    openingBalance: null,
    newBalance: null,
    minimumPayment: null,
    paymentDueDate: null
  };

  // Helper to normalize currency string to pence
  const parseCurrency = (str) => {
    if (str === undefined || str === null) return null;
    // Clean string: remove symbols, commas, and pipes
    const cleaned = str.replace(/[£,]|\|/g, '').replace(/\s+/g, '').trim();
    // Must contain a digit to be valid
    if (!/\d/.test(cleaned)) return null;
    const val = parseFloat(cleaned);
    if (isNaN(val)) return null;
    return Math.round(val * 100);
  };

  // Helper to normalize date string to ISO format (YYYY-MM-DD)
  const parseDate = (str) => {
    if (!str) return null;
    // Clean string: remove pipes and extra spaces
    const cleaned = str.replace(/\|/g, '').trim();
    let d = new Date(cleaned);
    if (isNaN(d.getTime())) {
      // Try DD/MM/YYYY
      const parts = cleaned.split('/');
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

  // Value patterns (currency and date)
  const currencyValuePattern = /(?:[£]|£\s*\|)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})/;
  const dateValuePattern = /\d{1,2}\s\w+\s\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/;

  // Scanner that handles same-line, next-line, and Amex multi-value GRID layouts
  const scanFor = (labels, type) => {
    const valPattern = type === 'currency' ? currencyValuePattern : dateValuePattern;
    const candidates = [];

    for (let i = 0; i < rows.length; i++) {
      const rowItems = rows[i];
      const rowText = rowItems.map(item => item.text).join(' ');

      for (const labelRegex of labels) {
        // Use word boundaries to avoid matching labels inside sentences
        const strictLabelRegex = new RegExp(`\\b${labelRegex.source}\\b`, 'i');
        
        if (strictLabelRegex.test(rowText)) {
          // 1. Same-line extraction (Strongest Priority)
          // Value must follow label with only non-digit/non-currency chars between
          const sameLineRegex = new RegExp(`${labelRegex.source}[^\\d£]*?(${valPattern.source})(?!\\s*%)`, 'i');
          const sameLineMatch = rowText.match(sameLineRegex);
          if (sameLineMatch && sameLineMatch[1]) {
            const val = type === 'currency' ? parseCurrency(sameLineMatch[1]) : parseDate(sameLineMatch[1]);
            if (val !== null) {
              candidates.push({ val, score: 100, row: i });
              continue;
            }
          }

          // 2. Amex GRID extraction: multiple labels in row i, multiple values in row i+1
          const labelIdxInRow = rowItems.findIndex(item => strictLabelRegex.test(item.text));
          if (labelIdxInRow !== -1 && i + 1 < rows.length) {
            const nextRowItems = rows[i + 1];
            const valuesInNextRow = [];
            nextRowItems.forEach((item, idx) => {
               const m = item.text.match(new RegExp(`(${valPattern.source})(?!\\s*%)`, 'i'));
               if (m) {
                 valuesInNextRow.push({ val: m[1], x: item.x, idx });
               } else if (type === 'currency' && item.text.trim() === '£' && idx + 1 < nextRowItems.length) {
                 const nextItem = nextRowItems[idx+1];
                 const nextM = nextItem.text.match(/^\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))(?!\s*%)/);
                 if (nextM) valuesInNextRow.push({ val: nextM[1], x: item.x, idx });
               }
            });

            if (valuesInNextRow.length > 0) {
               const allRelevantLabelsInRow = [];
               const masterLabels = [
                 { regex: /Previous Closing Balance|Previous Balance/i, type: 'opening' },
                 { regex: /New Credits/i, type: 'credits' },
                 { regex: /New Debits/i, type: 'debits' },
                 { regex: /(?<!Previous\s)Closing Balance|New Balance/i, type: 'closing' },
                 { regex: /Minimum Repayment|Minimum Payment/i, type: 'min' },
                 { regex: /Payment Due Date/i, type: 'due' },
                 { regex: /Direct Debit Amount/i, type: 'dd_amount' },
                 { regex: /Direct Debit Date/i, type: 'dd_date' }
               ];

               rowItems.forEach((item, idx) => {
                  const masterMatch = masterLabels.find(ml => ml.regex.test(item.text));
                  if (masterMatch) {
                    let lType = 'other';
                    if (item.text.includes('Closing Balance')) lType = item.text.includes('Previous') ? 'opening' : 'closing';
                    else if (item.text.includes('Repayment')) lType = 'min';
                    else if (item.text.includes('Due Date')) lType = 'due';
                    else lType = masterMatch.type;
                    allRelevantLabelsInRow.push({ text: item.text, x: item.x, idx, type: labelType });
                  }
               });

               if (allRelevantLabelsInRow.length > 0) {
                  const currentMaster = masterLabels.find(ml => ml.regex.source === labelRegex.source);
                  const targetType = currentMaster ? currentMaster.type : null;

                  if (targetType) {
                    const myLabelIdx = allRelevantLabelsInRow.findIndex(l => l.type === targetType);
                    if (myLabelIdx !== -1 && valuesInNextRow[myLabelIdx]) {
                       const val = type === 'currency' ? parseCurrency(valuesInNextRow[myLabelIdx].val) : parseDate(valuesInNextRow[myLabelIdx].val);
                       if (val !== null) candidates.push({ val, score: 90, row: i });
                    }
                  }
               }

               const labelX = rowItems[labelIdxInRow].x;
               valuesInNextRow.sort((a, b) => Math.abs(a.x - labelX) - Math.abs(b.x - labelX));
               const bestMatch = valuesInNextRow[0];
               const val = type === 'currency' ? parseCurrency(bestMatch.val) : parseDate(bestMatch.val);
               if (val !== null) candidates.push({ val, score: 80, row: i });
            }
          }

          // 3. Simple Next-line fallback (Lowest Priority)
          if (rowText.length < 60) {
            for (let j = 1; j <= 3; j++) {
              if (i + j >= rows.length) break;
              const nextRowText = rows[i+j].map(item => item.text).join(' ');
              const nextMatch = nextRowText.match(new RegExp(`^\\s*(${valPattern.source})(?!\\s*%)`, 'i'));
              if (nextMatch && nextMatch[1]) {
                const val = type === 'currency' ? parseCurrency(nextMatch[1]) : parseDate(nextMatch[1]);
                if (val !== null) {
                  candidates.push({ val, score: 50, row: i });
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (candidates.length === 0) return null;
    // Sort by score (highest first) then by row (earliest first if scores equal)
    candidates.sort((a, b) => b.score - a.score || a.row - b.row);
    return candidates[0].val;
  };

  summary.statementDate = scanFor([
    /received by/i,
    /Statement Date/i, 
    /Date of Statement/i, 
    /Produced On/i,
    /Your credit card statement/i,
    /as at/i
  ], 'date');

  summary.openingBalance = scanFor([
    /Previous Closing Balance/i,
    /Previous Balance/i, 
    /Opening Balance/i, 
    /Balance B\/F/i,
    /Last statement/i,
    /Balance from previous statement/i
  ], 'currency');

  summary.newBalance = scanFor([
    /(?<!Previous\s)Closing Balance/i,
    /New Balance/i, 
    /Your new balance/i,
    /Total balance/i
  ], 'currency');

  summary.minimumPayment = scanFor([
    /Minimum Repayment/i,
    /Minimum Payment/i, 
    /Minimum Payment Due/i, 
    /Min Payment Due/i
  ], 'currency');

  summary.paymentDueDate = scanFor([
    /Payment Due Date/i, 
    /Payment due on/i,
    /To reach your account by/i,
    /Please pay by/i
  ], 'date');

  return summary;
}
