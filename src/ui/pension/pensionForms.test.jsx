import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import PensionDetailsForm from './PensionDetailsForm.jsx';
import PensionYearForm from './PensionYearForm.jsx';

afterEach(cleanup);

describe('PensionDetailsForm', () => {
  it('submits scheme, anchor amount (pounds) and anchor date', () => {
    const onSubmit = vi.fn();
    render(<PensionDetailsForm initial={{ pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: '' }} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Scheme'), { target: { value: 'nhs-2015' } });
    fireEvent.change(screen.getByLabelText('Accrued annual pension'), { target: { value: '7900.18' } });
    fireEvent.change(screen.getByLabelText('As at'), { target: { value: '2026-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ pensionScheme: 'nhs-2015', pensionAnchorPence: 7900.18, pensionAnchorDate: '2026-03-31' });
  });

  it('a scheme needs an anchor; no scheme clears the anchor', () => {
    const onSubmit = vi.fn();
    render(<PensionDetailsForm initial={{ pensionScheme: 'nhs-2015', pensionAnchorPence: 7900.18, pensionAnchorDate: '2026-03-31' }} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('As at'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/needs the accrued pension and its date/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Scheme'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ pensionScheme: '', pensionAnchorPence: 0, pensionAnchorDate: '' });
  });
});

describe('PensionYearForm', () => {
  it('submits nulls for blank fields (use the estimate / the timeline)', () => {
    const onSubmit = vi.fn();
    render(<PensionYearForm taxYear="2025-26" initial={null} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ piaPence: null, pensionableEarningsPence: null, note: '' });
  });

  it('submits the entered figure, override and note in pounds, prefilled from the row', () => {
    const onSubmit = vi.fn();
    render(<PensionYearForm taxYear="2025-26" initial={{ piaPence: 21486, pensionableEarningsPence: null, note: 'TRS' }} onSubmit={onSubmit} onCancel={() => {}} />);
    expect(screen.getByLabelText('Pension input amount').value).toBe('21486');
    fireEvent.change(screen.getByLabelText('Pensionable earnings'), { target: { value: '67292.10' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'PSS received' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({ piaPence: 21486, pensionableEarningsPence: 67292.1, note: 'PSS received' });
  });

  it('rejects a negative figure', () => {
    const onSubmit = vi.fn();
    render(<PensionYearForm taxYear="2025-26" initial={null} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Pension input amount'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(/can’t be negative/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
