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
import { render, screen, cleanup } from '@testing-library/react';
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
