/**
 * Integration smoke test for the PDF import flow. We STUB the pdf.js parse
 * (injecting a `parseFile` that returns bank rows) so no PDF is driven, but use
 * the REAL repositories over fake-indexeddb. Confirms the preview renders, a
 * duplicate is flagged + unticked, and confirming inserts import transactions
 * and learns the chosen category mapping.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// pdf.js can't load in jsdom (no DOMMatrix); the parse is stubbed via the
// `parseFile` prop, so a minimal module mock is all that's needed for the graph
// (ImportPanel → parseStatementFile → pdf-parser → pdfjs-dist) to import.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));
import {
  categoriesRepo,
  transactionsRepo,
  categoryMappingsRepo,
} from '../../db/repositories.js';
import { importHash } from '../../engine/import-parse.js';
import ImportPanel from './ImportPanel.jsx';

beforeEach(resetDb);
afterEach(cleanup);

// Stubbed parse result: two bank rows (signed pence, negative = spend).
const stubParsed = [
  { date: '2025-03-02', description: 'TESCO STORES', amount: -1250 },
  { date: '2025-03-05', description: 'SHELL PETROL', amount: -4500 },
];
const stubParseFile = async () => stubParsed;

const triggerFile = () => {
  const input = screen.getByLabelText(/choose statement pdf/i);
  const file = new File(['%PDF-'], 'statement.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('ImportPanel (stubbed parse)', () => {
  it('previews parsed rows and imports them as source:import transactions, learning the mapping', async () => {
    await categoriesRepo.add({ name: 'Groceries', kind: 'spending' }); // id 1
    await categoriesRepo.add({ name: 'Transport', kind: 'spending' }); // id 2

    render(<ImportPanel onClose={() => {}} parseFile={stubParseFile} />);

    triggerFile();

    // Preview appears with both descriptions.
    expect(await screen.findByText('TESCO STORES')).toBeTruthy();
    expect(screen.getByText('SHELL PETROL')).toBeTruthy();

    // Assign a category to the first row so the mapping is learned.
    const selects = screen.getAllByLabelText(/category for/i);
    fireEvent.change(selects[0], { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: /Import 2 transactions/i }));

    await screen.findByText(/Imported 2 transactions/i);

    const txns = await transactionsRepo.getAll();
    expect(txns).toHaveLength(2);
    expect(txns.every((t) => t.source === 'import')).toBe(true);
    expect(txns.every((t) => !!t.importHash)).toBe(true);

    // The chosen mapping was saved (normalised key → category).
    const mappings = await categoryMappingsRepo.getAll();
    expect(mappings).toContainEqual(
      expect.objectContaining({ descriptionKey: 'tesco stores', categoryId: 1 })
    );
  });

  it('flags an already-imported row as a duplicate and unticks it by default', async () => {
    // Pre-insert the Tesco row so its hash exists in the ledger.
    const hash = importHash({ date: '2025-03-02', amountPence: -1250, description: 'TESCO STORES' });
    await transactionsRepo.add({
      date: '2025-03-02',
      kind: 'spend',
      amountPence: 12.5,
      description: 'TESCO STORES',
      source: 'import',
      importHash: hash,
    });

    render(<ImportPanel onClose={() => {}} parseFile={stubParseFile} />);
    triggerFile();

    await screen.findByText('TESCO STORES');
    // Duplicate reason shown; only 1 of the 2 rows is included by default.
    expect(screen.getByText(/already imported/i)).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Import 1 transaction\b/i })).toBeTruthy()
    );
  });

  it('shows a clear error and a manual-entry hint when parsing fails', async () => {
    const failing = async () => {
      throw new Error('No transactions were recognised in this statement. You can still add transactions manually.');
    };
    render(<ImportPanel onClose={() => {}} parseFile={failing} />);
    triggerFile();
    expect(await screen.findByText(/add transactions manually/i)).toBeTruthy();
  });
});
