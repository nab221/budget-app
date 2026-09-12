/**
 * Integration smoke test for the Company tab: seed people and dividend
 * events through the REAL repositories (real Dexie over fake-indexeddb) and
 * render the real Company component. Confirms the profit / CT figures reach
 * the screen.
 *
 * The tab opens on whatever company year "today" falls in, so events are
 * seeded relative to that rather than to a hard-coded date.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { peopleRepo, incomeEventsRepo } from '../../db/repositories.js';
import { financialYearForDate, financialYearBounds } from '../../engine/corporation-tax.js';
import Company from '../Company.jsx';

const TODAY = new Date().toISOString().slice(0, 10);
const CURRENT_FY = financialYearForDate(TODAY);
const { startDate } = financialYearBounds(CURRENT_FY);
/** An ISO date `days` after the start of the current company year. */
const inYear = (days) => {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

beforeEach(resetDb);
afterEach(cleanup);

describe('Company tab (seeded)', () => {
  it('points to the Income tab when there are no people', async () => {
    render(<Company />);
    expect(await screen.findByText(/No people yet/)).toBeTruthy();
    expect(screen.getByText(/Income tab/)).toBeTruthy();
  });

  it('renders the CT summary from the pooled dividends', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    const b = await peopleRepo.add({ name: 'Wife' });
    // £5,400 + £2,700 = £8,100 net ← £10,000 profit, £1,900 CT.
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 5400, note: 'Q1' });
    await incomeEventsRepo.add({ personId: b, date: inYear(11), kind: 'dividend', amountPence: 2700 });

    render(<Company />);

    expect(await screen.findByText('Dividends drawn')).toBeTruthy();
    expect(screen.getByText(new RegExp(`Company year ${CURRENT_FY}`))).toBeTruthy();
    expect(screen.getByText('Corporation tax to set aside')).toBeTruthy();
    expect(screen.getAllByText('£8,100.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£1,900.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£10,000.00').length).toBeGreaterThan(0);
    // Still in the small band: £40,000 of profit headroom = £32,400 of dividends.
    // The headroom is a <Money> span inside the sentence, so match on the
    // sentence element's full textContent rather than its own text nodes.
    expect(
      screen.getByText(
        (_, el) => el.tagName === 'SPAN' && /£32,400\.00 more in dividends/.test(el.textContent)
      )
    ).toBeTruthy();
    expect(screen.getByText(/Next £1 of profit is taxed at 19.0%/)).toBeTruthy();
    // Per-person split.
    expect(screen.getAllByText('Anderson').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£5,400.00').length).toBeGreaterThan(0);
  });

  it('flips the band meter once profit passes £50,000', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    // £77,250 net ← £100,000 profit.
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 77250 });

    render(<Company />);

    expect(await screen.findByText(/Past £50,000.00 of profit/)).toBeTruthy();
    expect(screen.getByText(/each further pound costs 26.5%/)).toBeTruthy();
    expect(screen.getAllByText('£22,750.00').length).toBeGreaterThan(0);
  });
});

describe('Company tab ledger', () => {
  it('lists every dividend from both people, newest first, with a note', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    const b = await peopleRepo.add({ name: 'Wife' });
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 5400, note: 'Q1 draw' });
    await incomeEventsRepo.add({ personId: b, date: inYear(20), kind: 'dividend', amountPence: 2700, note: 'Summer' });

    render(<Company />);

    expect(await screen.findByText('Q1 draw')).toBeTruthy();
    const rows = screen.getAllByRole('row').filter((r) => /Q1 draw|Summer/.test(r.textContent));
    expect(rows[0].textContent).toMatch(/Summer/); // newest first
    expect(rows[1].textContent).toMatch(/Q1 draw/);
  });

  it('records a dividend for a chosen person through the same incomeEvents store', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await peopleRepo.add({ name: 'Wife' });

    render(<Company />);
    // The button renders disabled until the people have loaded; wait for the
    // summary (which only renders with people) before clicking it.
    await screen.findByText('Dividends drawn');
    fireEvent.click(screen.getByRole('button', { name: 'Record dividend' }));

    const person = screen.getByLabelText('Person');
    fireEvent.change(person, { target: { value: String(a) } });
    // EventForm's Amount label has no htmlFor, so find the currency input
    // inside the open dialog rather than by label.
    const amount = screen.getByRole('dialog').querySelector('.currency-input input');
    fireEvent.change(amount, { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add dividend draw' }));

    await waitFor(async () => {
      const rows = await incomeEventsRepo.getAll();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ personId: a, kind: 'dividend', amountPence: 1000 });
    });
    // Appears in the KPI row and in the ledger.
    expect((await screen.findAllByText('£1,000.00')).length).toBeGreaterThan(0);
  });

  it('deletes a dividend after confirming', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 5400, note: 'Q1 draw' });

    render(<Company />);
    expect(await screen.findByText('Q1 draw')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete dividend' }));

    await waitFor(async () => {
      expect(await incomeEventsRepo.getAll()).toHaveLength(0);
    });
  });
});

describe('Company tab draw calculator', () => {
  it('shows the company picture before and after a draw', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    // £8,100 drawn ← £10,000 profit, £1,900 CT.
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 8100 });

    render(<Company />);
    const amount = await screen.findByLabelText('Amount to draw');
    fireEvent.change(amount, { target: { value: '1000' } });

    // £9,100 net ← £11,234.57 profit, £2,134.57 CT: +£234.57 of CT on
    // +£1,234.57 of profit. The sentence figures sit inside <Money> spans,
    // so match on the paragraph's textContent.
    expect((await screen.findAllByText('£11,234.57')).length).toBeGreaterThan(0);
    expect(screen.getByText('£2,134.57')).toBeTruthy();
    const sentence = (re) => (_, el) => el.tagName === 'P' && re.test(el.textContent);
    expect(screen.getByText(sentence(/adds £234\.57 of corporation tax/))).toBeTruthy();
    expect(screen.getByText(sentence(/needs £1,234\.57 more profit/))).toBeTruthy();
    // Personal side, for the (only) person, in the tax year of the draw date.
    expect(await screen.findByText(/For Anderson in tax year/)).toBeTruthy();
    expect(screen.getByText('Net in hand')).toBeTruthy();
  });

  it('warns when a draw crosses the £50,000 profit line', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });
    await incomeEventsRepo.add({ personId: a, date: inYear(10), kind: 'dividend', amountPence: 40000 });

    render(<Company />);
    fireEvent.change(await screen.findByLabelText('Amount to draw'), { target: { value: '5000' } });

    expect(await screen.findByText(/takes the year past £50,000 of profit/)).toBeTruthy();
  });

  it('records the previewed dividend and clears the amount', async () => {
    const a = await peopleRepo.add({ name: 'Anderson' });

    render(<Company />);
    const amount = await screen.findByLabelText('Amount to draw');
    fireEvent.change(amount, { target: { value: '2500' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Record this dividend' }));

    await waitFor(async () => {
      const rows = await incomeEventsRepo.getAll();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ personId: a, kind: 'dividend', amountPence: 2500 });
    });
    await waitFor(() => expect(screen.getByLabelText('Amount to draw').value).toBe(''));
  });

  it('defaults the date into the newly selected company year when stepping back', async () => {
    await peopleRepo.add({ name: 'Anderson' });

    render(<Company />);
    await screen.findByLabelText('Amount to draw');
    fireEvent.click(screen.getByRole('button', { name: 'Previous company year' }));

    // The previous year has loaded once the navigator label changes…
    const previousFy = `FY${Number(CURRENT_FY.slice(2)) - 1}`;
    await screen.findByText(new RegExp(`Company year ${previousFy}`));
    // …and the calculator's date must have moved into that year, not stayed on today.
    await waitFor(() => {
      expect(screen.getByLabelText('Dated').value).toBe(`${previousFy.slice(2)}-04-01`);
    });
    expect(screen.queryByText(/outside company year/)).toBeNull();
  });
});
