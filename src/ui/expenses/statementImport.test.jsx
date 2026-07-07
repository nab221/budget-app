/**
 * Integration tests for the credit-card statement import flow (spec §4.6):
 *  - successful parse → preview → "Update debt" writes balance + as-of date,
 *    optionally the min-payment override, and remembers the provider→debt map;
 *  - graceful error on an unparseable PDF with the supported-providers hint.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// pdf.js can't load in jsdom (no DOMMatrix); the parse is stubbed via the
// `parseFile` prop, so a minimal module mock lets the graph
// (StatementImport → parseStatementPdf → pdf-parser → pdfjs-dist) import.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));
import { debtsRepo } from '../../db/repositories.js';
import { getStatementDebtMap, rememberDebtForProvider } from './statementDebtMap.js';
import StatementImport from './StatementImport.jsx';

beforeEach(resetDb);
afterEach(cleanup);

const summary = {
  provider: 'MBNA',
  closingBalancePence: 123456, // £1,234.56
  minimumPaymentPence: 2500, // £25.00
  statementDate: '2025-08-01',
  paymentDueDate: '2025-08-21',
};

const pickFile = () => {
  const input = screen.getByLabelText('Choose statement PDF');
  const file = new File(['%PDF'], 'statement.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('StatementImport', () => {
  it('updates the selected debt balance + as-of date and remembers the provider', async () => {
    // Balance passed in POUNDS at the repo edge; stored as pence.
    await debtsRepo.add({ name: 'MBNA Platinum', debtType: 'credit-card', balancePence: 500, apr: 24 });

    render(<StatementImport onClose={() => {}} parseFile={async () => summary} />);
    pickFile();

    // Preview shows the parsed summary; wait for the debt list to load.
    await screen.findByText('MBNA');
    expect(screen.getByText('£1,234.56')).toBeTruthy();
    await screen.findByLabelText('Choose debt to update');

    fireEvent.click(screen.getByRole('button', { name: /update debt/i }));

    await waitFor(async () => {
      const debts = await debtsRepo.getAll();
      expect(debts[0].balancePence).toBe(1234.56); // pounds at repo edge
    });
    const debts = await debtsRepo.getAll();
    expect(debts[0].balanceAsOf).toBe('2025-08-01');
    // Override NOT set (checkbox default off).
    expect(debts[0].minPaymentOverridePence == null || debts[0].minPaymentOverridePence === undefined).toBe(true);

    // Association remembered.
    const map = await getStatementDebtMap();
    expect(map.MBNA).toBe(debts[0].id);

    // Success confirmation shows old → new (£500 → £1,234.56).
    expect(screen.getByText(/MBNA Platinum/)).toBeTruthy();
    expect(screen.getByText('£500.00')).toBeTruthy();
    expect(screen.getByText('£1,234.56')).toBeTruthy();
  });

  it('sets the minimum-payment override when opted in', async () => {
    await debtsRepo.add({ name: 'MBNA Platinum', debtType: 'credit-card', balancePence: 500, apr: 24 });

    render(<StatementImport onClose={() => {}} parseFile={async () => summary} />);
    pickFile();
    await screen.findByText('MBNA');
    await screen.findByLabelText('Choose debt to update');

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /update debt/i }));

    await waitFor(async () => {
      const debts = await debtsRepo.getAll();
      expect(debts[0].minPaymentOverridePence).toBe(25); // £25 at repo edge
    });
  });

  it('preselects the remembered debt for a provider', async () => {
    // Amex Gold is the first debt (id 1); MBNA Platinum is second. Without a
    // remembered association the picker would default to the first debt.
    await debtsRepo.add({ name: 'Amex Gold', debtType: 'credit-card', balancePence: 100, apr: 22 });
    await debtsRepo.add({ name: 'MBNA Platinum', debtType: 'credit-card', balancePence: 500, apr: 24 });
    const all = await debtsRepo.getAll();
    const mbna = all.find((d) => d.name === 'MBNA Platinum');
    await rememberDebtForProvider('MBNA', mbna.id);

    render(<StatementImport onClose={() => {}} parseFile={async () => summary} />);
    pickFile();
    await screen.findByText('MBNA');
    const select = await screen.findByLabelText('Choose debt to update');
    // Picker defaults to the remembered MBNA debt, not the first (Amex).
    await waitFor(() => expect(select.value).toBe(String(mbna.id)));
  });

  it('shows a graceful error with the supported-providers hint on an unparseable PDF', async () => {
    await debtsRepo.add({ name: 'MBNA Platinum', debtType: 'credit-card', balancePence: 500, apr: 24 });
    const parseFile = async () => {
      throw new Error("Couldn't read this statement — you can update the balance manually.");
    };

    render(<StatementImport onClose={() => {}} parseFile={parseFile} />);
    pickFile();

    const err = await screen.findByText(/Couldn't read this statement/);
    expect(err.textContent).toMatch(/update the balance manually/);
    expect(err.textContent).toMatch(/Lloyds\/TSB credit card, MBNA, and American Express/);
  });
});
