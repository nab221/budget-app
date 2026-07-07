import * as pdfjsLib from 'pdfjs-dist';

// Worker initialization for Vite (pdfjs-dist v5). The bundled worker is resolved
// relative to this module at build time; the `.min.mjs` build is used in prod.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extracts text items from a PDF with their coordinates.
 * Groups items into rows based on Y-coordinate.
 *
 * This is the only part of the module that touches pdf.js; the parsing below is
 * pure (coordinate-grouped rows in → statement summary out) so it can be unit
 * tested with fixture text arrays.
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

// ---------------------------------------------------------------------------
// Credit-card statement summary extraction (spec §4.6)
//
// The app reads *credit-card statements* to update a debt balance — not bank
// current-account transactions. Each provider is a UK credit-card statement with
// the same summary vocabulary (closing balance / minimum payment / statement &
// due dates), so one label-scanning routine serves all three; the parsers differ
// only in the provider signature used for auto-detection.
//
// Restored/adapted from the pre-Phase-5 `utils/pdf-parser.js`
// (lloydsTsbCredit / mbna / amex + extractStatementSummary).
// ---------------------------------------------------------------------------

/** Currency string → integer pence, or null when unparseable. */
function parseCurrencyPence(str) {
  if (str === undefined || str === null) return null;
  const cleaned = str.replace(/[£,]|\|/g, '').replace(/\s+/g, '').trim();
  if (!/\d/.test(cleaned)) return null;
  const val = parseFloat(cleaned);
  if (isNaN(val)) return null;
  return Math.round(val * 100);
}

/** Date string (various UK formats) → ISO yyyy-MM-dd, or null. */
function parseIsoDate(str) {
  if (!str) return null;
  const cleaned = str.replace(/\|/g, '').trim();
  let d = new Date(cleaned);
  if (isNaN(d.getTime())) {
    const parts = cleaned.split('/');
    if (parts.length === 3) {
      d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  }
  if (isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const CURRENCY_VALUE = /(?:[£]|£\s*\|)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})/;
const DATE_VALUE = /\d{1,2}\s\w+\s\d{4}|\d{1,2}\/\d{1,2}\/\d{4}/;

/**
 * Scan `rows` for the value that follows one of `labels`. Handles same-line
 * layouts, the Amex multi-column GRID (labels on row i, values on row i+1), and
 * a simple next-line fallback. Returns the highest-confidence match (pence for
 * `currency`, ISO string for `date`) or null.
 */
function scanFor(rows, labels, type) {
  const valPattern = type === 'currency' ? CURRENCY_VALUE : DATE_VALUE;
  const parse = type === 'currency' ? parseCurrencyPence : parseIsoDate;
  const candidates = [];

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

  for (let i = 0; i < rows.length; i++) {
    const rowItems = rows[i];
    const rowText = rowItems.map(item => item.text).join(' ');

    for (const labelRegex of labels) {
      const strictLabelRegex = new RegExp(`\\b${labelRegex.source}\\b`, 'i');
      if (!strictLabelRegex.test(rowText)) continue;

      // 1. Same-line (strongest).
      const sameLineRegex = new RegExp(`${labelRegex.source}[^\\d£]*?(${valPattern.source})(?!\\s*%)`, 'i');
      const sameLineMatch = rowText.match(sameLineRegex);
      if (sameLineMatch && sameLineMatch[1]) {
        const val = parse(sameLineMatch[1]);
        if (val !== null) {
          candidates.push({ val, score: 100, row: i });
          continue;
        }
      }

      // 2. Amex GRID: labels in row i, values in row i+1.
      const labelIdxInRow = rowItems.findIndex(item => strictLabelRegex.test(item.text));
      if (labelIdxInRow !== -1 && i + 1 < rows.length) {
        const nextRowItems = rows[i + 1];
        const valuesInNextRow = [];
        nextRowItems.forEach((item, idx) => {
          const m = item.text.match(new RegExp(`(${valPattern.source})(?!\\s*%)`, 'i'));
          if (m) {
            valuesInNextRow.push({ val: m[1], x: item.x, idx });
          } else if (type === 'currency' && item.text.trim() === '£' && idx + 1 < nextRowItems.length) {
            const nextItem = nextRowItems[idx + 1];
            const nextM = nextItem.text.match(/^\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))(?!\s*%)/);
            if (nextM) valuesInNextRow.push({ val: nextM[1], x: item.x, idx });
          }
        });

        if (valuesInNextRow.length > 0) {
          const allRelevantLabelsInRow = [];
          rowItems.forEach((item, idx) => {
            const masterMatch = masterLabels.find(ml => ml.regex.test(item.text));
            if (masterMatch) {
              let lType = 'other';
              if (item.text.includes('Closing Balance')) lType = item.text.includes('Previous') ? 'opening' : 'closing';
              else if (item.text.includes('Repayment')) lType = 'min';
              else if (item.text.includes('Due Date')) lType = 'due';
              else lType = masterMatch.type;
              allRelevantLabelsInRow.push({ text: item.text, x: item.x, idx, type: lType });
            }
          });

          if (allRelevantLabelsInRow.length > 0) {
            const currentMaster = masterLabels.find(ml => ml.regex.source === labelRegex.source);
            const targetType = currentMaster ? currentMaster.type : null;
            if (targetType) {
              const myLabelIdx = allRelevantLabelsInRow.findIndex(l => l.type === targetType);
              if (myLabelIdx !== -1 && valuesInNextRow[myLabelIdx]) {
                const val = parse(valuesInNextRow[myLabelIdx].val);
                if (val !== null) candidates.push({ val, score: 90, row: i });
              }
            }
          }

          const labelX = rowItems[labelIdxInRow].x;
          valuesInNextRow.sort((a, b) => Math.abs(a.x - labelX) - Math.abs(b.x - labelX));
          const bestMatch = valuesInNextRow[0];
          const val = parse(bestMatch.val);
          if (val !== null) candidates.push({ val, score: 80, row: i });
        }
      }

      // 3. Simple next-line fallback (weakest).
      if (rowText.length < 60) {
        for (let j = 1; j <= 3; j++) {
          if (i + j >= rows.length) break;
          const nextRowText = rows[i + j].map(item => item.text).join(' ');
          const nextMatch = nextRowText.match(new RegExp(`^\\s*(${valPattern.source})(?!\\s*%)`, 'i'));
          if (nextMatch && nextMatch[1]) {
            const val = parse(nextMatch[1]);
            if (val !== null) {
              candidates.push({ val, score: 50, row: i });
              break;
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score || a.row - b.row);
  return candidates[0].val;
}

/**
 * Extract the credit-card statement summary fields from coordinate-grouped rows.
 * All money is integer **pence**; dates are ISO yyyy-MM-dd. Fields not found are
 * null. Pure — exported for testing and reuse.
 *
 * @param {Array} rows - output of `extractTextFromPdf`.
 * @returns {{ closingBalancePence:number|null, minimumPaymentPence:number|null, statementDate:string|null, paymentDueDate:string|null }}
 */
export function extractStatementSummary(rows) {
  return {
    closingBalancePence: scanFor(rows, [
      /(?<!Previous\s)Closing Balance/i,
      /New Balance/i,
      /Your new balance/i,
      /Total balance/i
    ], 'currency'),
    minimumPaymentPence: scanFor(rows, [
      /Minimum Repayment/i,
      /Minimum Payment/i,
      /Minimum Payment Due/i,
      /Min Payment Due/i
    ], 'currency'),
    statementDate: scanFor(rows, [
      /Statement Date/i,
      /Date of Statement/i,
      /Produced On/i,
      /Your credit card statement/i,
      /as at/i
    ], 'date'),
    paymentDueDate: scanFor(rows, [
      /Payment Due Date/i,
      /Payment due on/i,
      /To reach your account by/i,
      /Please pay by/i
    ], 'date'),
  };
}

// Provider auto-detection: each parser produces the same summary (UK card
// statements share the summary vocabulary) but tags a distinct provider name and
// only "claims" a statement when its signature keyword appears in the text.
const PROVIDER_PARSERS = [
  { key: 'lloydsTsbCredit', provider: 'Lloyds/TSB credit card', signature: /lloyds|tsb/i },
  { key: 'mbna', provider: 'MBNA', signature: /\bmbna\b/i },
  { key: 'amex', provider: 'American Express', signature: /american express|\bamex\b/i },
];

/**
 * Per-provider parsers. Each returns a summary `{ provider, ... }` when it can
 * read a closing balance, else null. Restored names: lloydsTsbCredit, mbna, amex.
 */
export const parsers = Object.fromEntries(
  PROVIDER_PARSERS.map(({ key, provider, signature }) => [
    key,
    (rows) => runParser(rows, provider, signature),
  ])
);

function runParser(rows, provider, signature) {
  const summary = extractStatementSummary(rows);
  // A statement with no closing balance is unusable for updating a debt.
  if (summary.closingBalancePence == null) return null;
  const signatureHit = rows.some(r => signature.test(r.map(i => i.text).join(' ')));
  const fieldsFound = [
    summary.closingBalancePence,
    summary.minimumPaymentPence,
    summary.statementDate,
    summary.paymentDueDate,
  ].filter(v => v != null).length;
  // Signature dominates (weight 10) so the named provider wins over look-alikes;
  // field count breaks ties between providers with no signature hit.
  return { provider, ...summary, _score: fieldsFound + (signatureHit ? 10 : 0), _signatureHit: signatureHit };
}

/**
 * Try every provider parser and return the best-scoring statement summary, or
 * null when no parser could read a closing balance (junk / unsupported PDF).
 *
 * @param {Array} rows - output of `extractTextFromPdf`.
 * @returns {{ provider:string, closingBalancePence:number, minimumPaymentPence:number|null, statementDate:string|null, paymentDueDate:string|null }|null}
 */
export function detectStatement(rows) {
  let best = null;
  for (const { key } of PROVIDER_PARSERS) {
    let out;
    try {
      out = parsers[key](rows);
    } catch {
      out = null;
    }
    if (!out) continue;
    if (!best || out._score > best._score) best = out;
  }
  if (!best) return null;
  const { _score, _signatureHit, ...summary } = best;
  return summary;
}
