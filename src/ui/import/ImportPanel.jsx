import { useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import {
  transactionsRepo,
  categoriesRepo,
  categoryMappingsRepo,
} from '../../db/repositories.js';
import { fromPence } from '../../engine/currency.js';
import {
  parsedToRows,
  annotateDuplicates,
  suggestCategory,
  normaliseDescription,
} from '../../engine/import-parse.js';
import { parseStatementFile } from './parseStatementFile.js';
import ImportPreviewTable from './ImportPreviewTable.jsx';

/**
 * PDF bank-statement import (spec §4.6). Modal flow:
 *   file input → pdf.js text extraction → parse rows → preview with per-row
 *   include / category / duplicate flag → confirm inserts as `source:'import'`
 *   transactions and saves the chosen category mappings so suggestions learn.
 *
 * `parseFile` is injectable so tests can drive the preview with a stubbed parse
 * result without touching pdf.js.
 *
 * @param {object} props
 * @param {()=>void} props.onClose
 * @param {(file:File)=>Promise<Array>} [props.parseFile] - defaults to the real pdf.js path.
 */
export default function ImportPanel({ onClose, parseFile = parseStatementFile }) {
  // Categories drive the per-row select; they update live as Settings changes.
  const { data: categories } = useLiveData(() => categoriesRepo.getAll(), []);

  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | parsing | preview | saving
  const [error, setError] = useState(null);
  const [savedCount, setSavedCount] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file after an error
    if (!file) return;
    setError(null);
    setSavedCount(null);
    setStatus('parsing');
    try {
      // Read the learned mappings + existing hashes fresh at parse time so the
      // suggestion + dedup reflect the current ledger (no snapshot race).
      const [parsed, mappings, existingHashes] = await Promise.all([
        parseFile(file),
        categoryMappingsRepo.getAll(),
        transactionsRepo.importDedupHashes(),
      ]);
      const annotated = annotateDuplicates(parsedToRows(parsed), existingHashes).map((r) => ({
        ...r,
        // Duplicates are excluded by default; the user can opt them back in.
        include: !r.duplicate,
        categoryId: suggestCategory(r.description, mappings) ?? '',
      }));
      setRows(annotated);
      setStatus('preview');
    } catch (err) {
      setError(err.message || String(err));
      setStatus('idle');
    }
  };

  const toggle = (index, include) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, include } : r)));
  const setCategory = (index, categoryId) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, categoryId } : r)));

  const includedCount = (rows || []).filter((r) => r.include).length;

  const confirm = async () => {
    setStatus('saving');
    let count = 0;
    for (const r of rows) {
      if (!r.include) continue;
      const categoryId =
        r.categoryId === '' || r.categoryId == null ? null : Number(r.categoryId);
      await transactionsRepo.add({
        date: r.date,
        kind: r.kind,
        amountPence: fromPence(r.amountPence), // pence → pounds at the repo edge
        categoryId,
        description: r.description,
        source: 'import',
        importHash: r.hash,
      });
      // Learn the mapping so future imports suggest this category.
      if (categoryId != null) {
        await categoryMappingsRepo.upsert(normaliseDescription(r.description), categoryId);
      }
      count += 1;
    }
    setSavedCount(count);
    setStatus('done');
    setRows(null);
  };

  return (
    <div
      className="dialog__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import bank statement"
    >
      <div className="dialog dialog--wide">
        <h3 className="dialog__title">Import statement (PDF)</h3>

        {status === 'done' ? (
          <>
            <p>
              Imported {savedCount} transaction{savedCount === 1 ? '' : 's'}. They’re now in the
              ledger with an “Import” badge.
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : status === 'preview' || status === 'saving' ? (
          <>
            <p className="muted">
              Review the parsed rows. Duplicates already in your ledger are unticked; tick a row to
              include it, and adjust categories before importing.
            </p>
            <ImportPreviewTable
              rows={rows}
              categories={categories}
              onToggle={toggle}
              onCategory={setCategory}
            />
            <div className="dialog__actions">
              <button
                type="button"
                className="btn"
                onClick={onClose}
                disabled={status === 'saving'}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={confirm}
                disabled={status === 'saving' || includedCount === 0}
              >
                Import {includedCount} transaction{includedCount === 1 ? '' : 's'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Choose a bank current-account statement PDF (not a credit-card statement). We’ll read
              the transactions and let you review them before adding.
            </p>
            <label className="field">
              <span>Statement PDF</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="input"
                onChange={onFile}
                aria-label="Choose statement PDF"
              />
            </label>
            {status === 'parsing' && <p className="muted">Reading PDF…</p>}
            {error && (
              <p className="form__error">
                {error}
              </p>
            )}
            <div className="dialog__actions">
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
