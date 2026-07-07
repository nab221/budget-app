import { extractTextFromPdf, parsers } from '../../engine/pdf-parser.js';

/**
 * Run every kept bank current-account parser over the coordinate-grouped rows
 * and return the parse that yielded the most transactions (simple auto-detect
 * across the supported bank formats). Pure — exported for testing.
 *
 * @param {Array} rows - output of `extractTextFromPdf`.
 * @returns {Array<{date:string, description:string, amount:number}>}
 */
export function pickBestParse(rows) {
  let best = [];
  for (const name of Object.keys(parsers)) {
    let out;
    try {
      out = parsers[name](rows) || [];
    } catch {
      out = [];
    }
    if (out.length > best.length) best = out;
  }
  return best;
}

/**
 * Extract text from a PDF File and parse it into bank transactions (signed
 * pence). Throws a caller-friendly Error when the PDF has no text layer or no
 * recognisable rows so the UI can show a clear message + the manual-entry hint.
 *
 * @param {File|ArrayBuffer} file
 * @returns {Promise<Array<{date:string, description:string, amount:number}>>}
 */
export async function parseStatementFile(file) {
  let rows;
  try {
    rows = await extractTextFromPdf(file);
  } catch (err) {
    if (err && err.message === 'NO_TEXT_LAYER') {
      throw new Error(
        'This PDF has no readable text layer (it looks scanned). Try a downloaded statement PDF, or add these transactions manually.'
      );
    }
    throw new Error(
      'Could not read this PDF. Make sure it’s a bank current-account statement, or add the transactions manually.'
    );
  }

  const parsed = pickBestParse(rows);
  if (!parsed || parsed.length === 0) {
    throw new Error(
      'No transactions were recognised in this statement. It may be an unsupported format — you can still add transactions manually.'
    );
  }
  return parsed;
}
