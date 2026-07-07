import { extractTextFromPdf, detectStatement } from '../../engine/pdf-parser.js';

/**
 * List of supported providers, for the UI hint on unparseable PDFs.
 */
export const SUPPORTED_PROVIDERS = 'Lloyds/TSB credit card, MBNA, and American Express';

/**
 * Extract text from a credit-card statement PDF and detect its summary
 * (spec §4.6). Returns `{ provider, closingBalancePence, minimumPaymentPence,
 * statementDate, paymentDueDate }` (money in **pence**, dates ISO). Throws a
 * caller-friendly Error when the PDF can't be read so the UI can show the
 * manual-entry hint.
 *
 * @param {File|ArrayBuffer} file
 * @returns {Promise<object>}
 */
export async function parseStatementPdf(file) {
  let rows;
  try {
    rows = await extractTextFromPdf(file);
  } catch (err) {
    // Both the no-text-layer case and any pdf.js failure land on the same
    // graceful message — the user can always update the balance by hand.
    throw new Error(
      "Couldn't read this statement — you can update the balance manually."
    );
  }

  const summary = detectStatement(rows);
  if (!summary) {
    throw new Error(
      "Couldn't read this statement — you can update the balance manually."
    );
  }
  return summary;
}
