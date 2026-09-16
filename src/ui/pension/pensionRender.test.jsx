// src/ui/pension/pensionRender.test.jsx
/**
 * Integration test for the Pension tab: seed people, salary periods,
 * pension years and SIPP events through the REAL repositories (real Dexie
 * over fake-indexeddb) and render the real Pension component pinned to
 * 2026-27, the owner's acceptance year (CPI seeded, anchor 31 Mar 2026).
 */
import { resetDb } from '../../db/test-utils.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { peopleRepo, salaryPeriodsRepo, incomeEventsRepo, pensionYearsRepo } from '../../db/repositories.js';
import Pension from '../Pension.jsx';

beforeEach(resetDb);
afterEach(cleanup);

const seedOwner = async () => {
  const p = await peopleRepo.add({
    name: 'Anderson',
    pensionScheme: 'nhs-2015',
    pensionAnchorPence: 7900.18,
    pensionAnchorDate: '2026-03-31',
  });
  await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 70000 });
  await pensionYearsRepo.upsert(p, '2023-24', { piaPence: 15060 });
  await pensionYearsRepo.upsert(p, '2024-25', { piaPence: 18533 });
  await pensionYearsRepo.upsert(p, '2025-26', { piaPence: 21486, note: 'TRS reconstruction' });
  await incomeEventsRepo.add({ personId: p, date: '2026-06-15', kind: 'sipp-contribution', amountPence: 4000 });
  return p;
};

const inSpan = (re) => (_, el) => el.tagName === 'SPAN' && re.test(el.textContent);

describe('Pension tab', () => {
  it('points to the Income tab when there are no people', async () => {
    render(<Pension initialTaxYear="2026-27" />);
    expect(await screen.findByText(/No people yet/)).toBeTruthy();
    expect(screen.getByText(/Income tab/)).toBeTruthy();
  });

  it('shows the owner’s 2026-27 headline: used, carry-forward, SIPP headroom gross and net', async () => {
    await seedOwner();
    render(<Pension initialTaxYear="2026-27" />);

    expect(await screen.findByText('Anderson')).toBeTruthy();
    expect(screen.getByText('NHS 2015')).toBeTruthy();
    // The figure is a <Money> span inside the sentence — match on the paragraph's textContent.
    expect(screen.getByText((_, el) => el.tagName === 'P' && /£7,900\.18 accrued at 31 Mar 2026/.test(el.textContent))).toBeTruthy();
    expect(screen.getByText('Allowance used this year')).toBeTruthy();
    expect(screen.getAllByText('£27,636.78').length).toBeGreaterThan(0); // £22,636.78 PIA + £5,000 SIPP
    expect(screen.getByText('Carry-forward available')).toBeTruthy();
    expect(screen.getAllByText('£124,921.00').length).toBeGreaterThan(0);
    expect(screen.getByText('SIPP headroom')).toBeTruthy();
    expect(screen.getByText(inSpan(/£157,284\.22 gross · pay in £125,827\.38/))).toBeTruthy();
    expect(screen.queryByText(/No rate table/)).toBeNull();
  });

  it('shows this year’s estimate with its inputs', async () => {
    await seedOwner();
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');

    const estimate = screen.getByText(/This year’s estimate/).closest('section');
    const list = within(estimate);
    expect(list.getByText('£7,900.18')).toBeTruthy(); // opening
    expect(list.getByText('3.8%')).toBeTruthy(); // CPI
    expect(list.getByText('5.3%')).toBeTruthy(); // revaluation
    expect(list.getByText(/£70,000\.00/)).toBeTruthy(); // earnings, from the timeline
    expect(list.getByText(/from salary timeline/)).toBeTruthy();
    expect(list.getByText('£9,615.19')).toBeTruthy(); // closing
    expect(list.getByText('£22,636.78')).toBeTruthy(); // PIA
  });

  it('lists the four-year window with source badges and lets a year be edited', async () => {
    const p = await seedOwner();
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');
    // Entered years need no pension-earned prompt even without a pension-earned row.
    expect(screen.queryByText(/Enter each year’s pension earned/)).toBeNull();

    const rows = screen.getAllByRole('row').filter((r) => /^20\d\d-\d\d/.test(r.textContent));
    expect(rows.map((r) => r.textContent.slice(0, 7))).toEqual(['2023-24', '2024-25', '2025-26', '2026-27']);
    expect(rows[0].textContent).toMatch(/£15,060\.00/);
    expect(rows[0].textContent).toMatch(/£44,940\.00/); // unused
    expect(within(rows[0]).getByText('entered')).toBeTruthy();
    expect(within(rows[3]).getByText('estimate')).toBeTruthy();
    expect(rows[2].textContent).toMatch(/TRS reconstruction/);

    fireEvent.click(within(rows[3]).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toMatch(/2026-27/);
    fireEvent.change(screen.getByLabelText('Pension input amount'), { target: { value: '23000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const saved = (await pensionYearsRepo.forPerson(p)).find((r) => r.taxYear === '2026-27');
      expect(saved).toMatchObject({ piaPence: 23000, pensionableEarningsPence: null });
    });
    const current = (await screen.findAllByRole('row')).find((r) => r.textContent.startsWith('2026-27'));
    expect(within(current).getByText('entered')).toBeTruthy();
    expect(screen.getAllByText('£28,000.00').length).toBeGreaterThan(0); // £23,000 + £5,000 SIPP
  });

  it('back-chains prior years from the statement’s pension earned, showing opening and closing', async () => {
    const p = await peopleRepo.add({
      name: 'Anderson',
      pensionScheme: 'nhs-2015',
      pensionAnchorPence: 7900.18,
      pensionAnchorDate: '2026-03-31',
    });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 70000 });
    await pensionYearsRepo.upsert(p, '2024-25', { pensionEarnedPence: 1083.93 });
    await pensionYearsRepo.upsert(p, '2025-26', { pensionEarnedPence: 1246.15 });
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');

    // 2023-24 has no pension-earned row yet: the chain stops there and the card says what to do.
    expect(screen.getByText(/Enter each year’s pension earned from the statement/)).toBeTruthy();
    const yearRows = () => screen.getAllByRole('row').filter((r) => /^20\d\d-\d\d/.test(r.textContent));
    let rows = yearRows();
    expect(within(rows[0]).getByText('none')).toBeTruthy();
    expect(within(rows[1]).getByText('estimate')).toBeTruthy();
    expect(rows[1].textContent).toMatch(/£4,957\.27/); // 2024-25 opening
    expect(rows[1].textContent).toMatch(/£6,447\.70/); // 2024-25 closing
    expect(rows[2].textContent).toMatch(/£7,900\.18/); // 2025-26 closing = the anchor
    expect(within(rows[0]).getAllByText('—').length).toBeGreaterThanOrEqual(3); // opening, closing, pension input

    fireEvent.click(within(rows[0]).getByRole('button', { name: 'Edit' }));
    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Pension earned'), { target: { value: '886.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      const saved = (await pensionYearsRepo.forPerson(p)).find((r) => r.taxYear === '2023-24');
      expect(saved).toMatchObject({ pensionEarnedPence: 886.5, piaPence: null, pensionableEarningsPence: null });
    });
    await waitFor(() => {
      rows = yearRows();
      expect(within(rows[0]).getByText('estimate')).toBeTruthy();
    });
    expect(rows[0].textContent).toMatch(/£3,647\.64/); // 2023-24 opening
    expect(rows[0].textContent).toMatch(/£15,059\.43/); // 2023-24 PIA, within £1 of the TRS £15,060
    expect(screen.queryByText(/Enter each year’s pension earned/)).toBeNull();
  });

  it('does not prompt for pension earned when the only reachable prior year has it, even with a missing CPI beyond it', async () => {
    const p = await peopleRepo.add({
      name: 'Anderson',
      pensionScheme: 'nhs-2015',
      pensionAnchorPence: 7900.18,
      pensionAnchorDate: '2026-03-31',
    });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 70000 });
    await pensionYearsRepo.upsert(p, '2023-24', { pensionEarnedPence: 886.5 });
    await pensionYearsRepo.upsert(p, '2024-25', { pensionEarnedPence: 1083.93 });
    await pensionYearsRepo.upsert(p, '2025-26', { pensionEarnedPence: 1246.15 });
    render(<Pension initialTaxYear="2028-29" />);
    await screen.findByText('Anderson');

    expect(screen.queryByText(/Enter each year’s pension earned/)).toBeNull();
    expect(await screen.findByText(/No September CPI/)).toBeTruthy();
  });

  it('labels the accrual as from the statement when this year has a pension-earned figure', async () => {
    const p = await seedOwner();
    await pensionYearsRepo.upsert(p, '2026-27', { pensionEarnedPence: 1300 });
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');
    const estimate = screen.getByText(/This year’s estimate/).closest('section');
    expect(within(estimate).getByText(/from statement/)).toBeTruthy();
    expect(within(estimate).getByText('£1,300.00')).toBeTruthy();
  });

  it('edits the scheme and anchor through the details form', async () => {
    const p = await peopleRepo.add({ name: 'Wife' });
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Wife');
    expect(screen.getByText(/SIPP-only/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit pension details' }));
    fireEvent.change(await screen.findByLabelText('Scheme'), { target: { value: 'lgps-2014' } });
    fireEvent.change(screen.getByLabelText('Accrued annual pension'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('As at'), { target: { value: '2026-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => {
      expect(await peopleRepo.get(p)).toMatchObject({ pensionScheme: 'lgps-2014', pensionAnchorPence: 5000, pensionAnchorDate: '2026-03-31' });
    });
    expect(await screen.findByText('LGPS 2014')).toBeTruthy();
  });

  it('warns about the taper when adjusted net income passes £200,000', async () => {
    const p = await peopleRepo.add({ name: 'Anderson' });
    await salaryPeriodsRepo.add({ personId: p, effectiveFrom: '1900-01-01', annualSalaryPence: 250000 });
    render(<Pension initialTaxYear="2026-27" />);
    expect(await screen.findByText(/tapered annual allowance may apply/)).toBeTruthy();
  });

  it('flags a year with no September CPI', async () => {
    await seedOwner();
    render(<Pension initialTaxYear="2028-29" />);
    expect(await screen.findByText(/No September CPI for 2027-28, 2028-29/)).toBeTruthy();
    expect(screen.getByText(/No rate table for 2027-28, 2028-29/)).toBeTruthy();
  });

  it('treats an anchor before 2022-23 as no estimate, not a missing CPI', async () => {
    await peopleRepo.add({
      name: 'Wife',
      pensionScheme: 'nhs-2015',
      pensionAnchorPence: 100,
      pensionAnchorDate: '2021-03-31',
    });
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Wife');
    expect(screen.getByText(/The anchor predates 2022-23 — enter a statement figure dated 31 March 2022 or later\./)).toBeTruthy();
    expect(screen.queryByText(/No September CPI/)).toBeNull();
  });

  it('steps between tax years', async () => {
    await seedOwner();
    render(<Pension initialTaxYear="2026-27" />);
    await screen.findByText('Anderson');
    fireEvent.click(screen.getByRole('button', { name: 'Previous tax year' }));
    expect(await screen.findByText(/Tax year 2025-26/)).toBeTruthy();
    expect(screen.getAllByText('£21,486.00').length).toBeGreaterThan(0);
  });
});
