import * as pdfjsLib from 'pdfjs-dist';
import { toPence } from './currency.js';

// Worker initialization for Vite (pdfjs-dist v5). The bundled worker is resolved
// relative to this module at build time; the `.min.mjs` build is used in prod.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
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
 * Bank current-account statement parsers (spec §4.6: bank statements only).
 *
 * Each parser takes the coordinate-grouped `rows` from `extractTextFromPdf` and
 * returns `[{ date, description, amount }]` where `amount` is SIGNED integer
 * pence (negative = money out / spend, positive = money in / income).
 *
 * Credit-card, Amex and mortgage statement parsing, plus the statement-summary
 * prefill, were intentionally removed in Phase 5 — the app imports bank
 * current-account statements only.
 */
export const parsers = {
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
  }
};
