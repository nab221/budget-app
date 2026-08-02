/**
 * Integration smoke test for the Mileage tab: seed trips through the REAL
 * mileageTripsRepo (real Dexie over fake-indexeddb) and render the real
 * Mileage component. Confirms the 45p/25p claim figures reach the screen and
 * that the trip ledger renders.
 *
 * The tab opens on whatever tax year "today" falls in, so trips are seeded
 * relative to that rather than to a hard-coded date.
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { mileageTripsRepo } from '../../db/repositories.js';
import { taxYearForDate, taxYearBounds } from '../../engine/tax.js';
import Mileage from '../Mileage.jsx';

const CURRENT_YEAR = taxYearForDate(new Date().toISOString().slice(0, 10));
const { startDate } = taxYearBounds(CURRENT_YEAR);
/** An ISO date `days` after the start of the current tax year. */
const inYear = (days) => {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

beforeEach(resetDb);
afterEach(cleanup);

describe('Mileage tab (seeded)', () => {
  it('shows an empty state when nothing is logged', async () => {
    render(<Mileage />);
    expect(await screen.findByText(new RegExp(`No trips logged for ${CURRENT_YEAR}`))).toBeTruthy();
  });

  it('renders the claim summary and the trip ledger', async () => {
    // 100 miles at 45p = £45.00, £25.00 reimbursed → £20.00 to claim,
    // worth £8.00 back at the default 40%.
    await mileageTripsRepo.add({
      date: inYear(10),
      miles: 100,
      vehicle: 'car',
      purpose: 'Client visit — Leeds',
      reimbursedPence: 25, // pounds at the repo edge
    });

    render(<Mileage />);

    expect(await screen.findByText('Client visit — Leeds')).toBeTruthy();
    expect(screen.getByText('Business miles')).toBeTruthy();
    expect(screen.getByText('Claim from HMRC')).toBeTruthy();
    // Approved £45.00, paid £25.00, claim £20.00.
    expect(screen.getAllByText('£45.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£25.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('£20.00').length).toBeGreaterThan(0);
    // ...worth £8.00 as a refund at 40%.
    expect(screen.getByText('£8.00')).toBeTruthy();
    // The 45p band meter reports what is left of the 10,000 miles.
    expect(screen.getByText(/9,900 miles left at 45p, then 25p/)).toBeTruthy();
  });

  it('splits a trip that crosses the 10,000-mile line and flags it', async () => {
    await mileageTripsRepo.add({
      date: inYear(10),
      miles: 9990,
      vehicle: 'car',
      purpose: 'Long haul',
    });
    await mileageTripsRepo.add({
      date: inYear(20),
      miles: 20,
      vehicle: 'car',
      purpose: 'Over the line',
    });

    render(<Mileage />);

    expect(await screen.findByText('Over the line')).toBeTruthy();
    expect(screen.getByText(/10 \+ 10 over 10,000/)).toBeTruthy();
    expect(screen.getByText(/Past 10,000 miles/)).toBeTruthy();
    // 9,990 × 45p + 10 × 45p + 10 × 25p = £4,502.50
    expect(screen.getAllByText('£4,502.50').length).toBeGreaterThan(0);
  });

  it('warns when the employer paid more than the approved amount', async () => {
    await mileageTripsRepo.add({
      date: inYear(10),
      miles: 100, // approved £45.00
      vehicle: 'car',
      purpose: 'Generous employer',
      reimbursedPence: 60, // £60.00
    });

    render(<Mileage />);

    expect(await screen.findByText(/more than the approved amount/)).toBeTruthy();
    expect(screen.getByText(/counts as taxable pay/)).toBeTruthy();
  });

  it('gives a motorcycle its flat 24p rate and no threshold meter', async () => {
    await mileageTripsRepo.add({
      date: inYear(10),
      miles: 100,
      vehicle: 'motorcycle',
      purpose: 'Site visit',
    });

    render(<Mileage />);

    expect(await screen.findByText('Site visit')).toBeTruthy();
    // Once as the trip's tag, once as the per-vehicle breakdown row.
    expect(screen.getAllByText('Motorcycle').length).toBe(2);
    expect(screen.getAllByText('£24.00').length).toBeGreaterThan(0);
    expect(screen.queryByText(/miles left at 45p/)).toBeNull();
  });
});
