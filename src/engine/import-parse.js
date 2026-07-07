/**
 * import-parse.js — pure helpers for the PDF bank-statement import flow
 * (spec §4.6). No DB access, no pdf.js: this module takes already-parsed bank
 * rows (from `pdf-parser.js`) and turns them into preview rows, computes stable
 * duplicate-detection hashes, and suggests categories from the learned
 * `categoryMappings` table. Everything here is deterministic and unit-tested;
 * the React layer wires it to the repositories.
 *
 * Money convention: this module works in integer **pence** (the same domain the
 * bank parsers emit). Conversion to the repositories' pounds edge happens in the
 * UI at insert time.
 */

import { findBestMatch } from './string-similarity.js';

/**
 * Normalise a transaction description into a stable lookup/hash key: lower-cased,
 * punctuation collapsed to spaces, runs of whitespace squeezed, trimmed. This is
 * the single normalisation used for BOTH the importHash and the category-mapping
 * key, so a description always hashes and maps the same way.
 *
 * @param {string} desc
 * @returns {string}
 */
export function normaliseDescription(desc) {
  return String(desc || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stable, pure hash of (date + signed amount pence + normalised description).
 * FNV-1a 32-bit → zero-padded hex. Used to flag rows already present in the
 * `transactions` table and to guard against duplicates within one import batch.
 *
 * `amountPence` is the SIGNED pence value (negative for spend, positive for
 * income) so an identical-value income and spend on the same day don't collide.
 *
 * @param {{date:string, amountPence:number, description:string}} row
 * @returns {string}
 */
export function importHash({ date, amountPence, description }) {
  const key = `${date}|${amountPence}|${normaliseDescription(description)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Turn raw bank-parser output ({ date, description, amount } where `amount` is
 * SIGNED pence) into preview rows carrying the display fields, the (positive)
 * amount + kind the ledger stores, and the stable importHash.
 *
 * @param {Array<{date:string, description:string, amount:number}>} parsed
 * @returns {Array<object>}
 */
export function parsedToRows(parsed) {
  return (parsed || []).map((p) => {
    const signed = p.amount || 0;
    return {
      date: p.date,
      description: p.description,
      amountPence: Math.abs(signed),
      kind: signed < 0 ? 'spend' : 'income',
      signedPence: signed,
      hash: importHash({ date: p.date, amountPence: signed, description: p.description }),
    };
  });
}

/**
 * Annotate rows with duplicate flags. A row is a duplicate if its hash already
 * exists in `existingHashes` (a Set drawn from the transactions table) OR if the
 * same hash appeared earlier in this same batch.
 *
 * @param {Array<object>} rows - rows from `parsedToRows`.
 * @param {Set<string>} existingHashes
 * @returns {Array<object>} rows with `duplicate` + `duplicateReason` added.
 */
export function annotateDuplicates(rows, existingHashes = new Set()) {
  const seen = new Set();
  return (rows || []).map((r) => {
    const alreadyImported = existingHashes.has(r.hash);
    const batchDuplicate = !alreadyImported && seen.has(r.hash);
    seen.add(r.hash);
    return {
      ...r,
      duplicate: alreadyImported || batchDuplicate,
      duplicateReason: alreadyImported
        ? 'already imported'
        : batchDuplicate
          ? 'duplicate in this file'
          : null,
    };
  });
}

/**
 * Suggest a categoryId for a description using the learned mappings.
 *   1. exact match on the normalised description key, else
 *   2. best fuzzy (Dice) match ≥ `threshold` against known mapping keys, else
 *   3. null (leave unset).
 *
 * @param {string} description
 * @param {Array<{descriptionKey:string, categoryId:number}>} mappings
 * @param {number} [threshold=0.6]
 * @returns {number|null}
 */
export function suggestCategory(description, mappings = [], threshold = 0.6) {
  const key = normaliseDescription(description);
  if (!key || !mappings || mappings.length === 0) return null;

  const exact = mappings.find((m) => m.descriptionKey === key);
  if (exact) return exact.categoryId;

  const keys = mappings.map((m) => m.descriptionKey);
  const best = findBestMatch(key, keys);
  if (best && best.rating >= threshold) {
    // findBestMatch lower-cases targets; mapping keys are already normalised
    // (lower-case), so `best.target` matches a stored descriptionKey directly.
    const match = mappings.find((m) => m.descriptionKey === best.target);
    if (match) return match.categoryId;
  }
  return null;
}
