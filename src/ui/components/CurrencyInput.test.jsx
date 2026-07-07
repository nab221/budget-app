import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CurrencyInput, { parseCurrencyInput } from './CurrencyInput.jsx';

afterEach(cleanup);

describe('parseCurrencyInput', () => {
  it('parses a thousands-separated amount', () => {
    expect(parseCurrencyInput('1,234.56')).toBe(1234.56);
  });

  it('strips a leading £ and whitespace', () => {
    expect(parseCurrencyInput(' £250 ')).toBe(250);
  });

  it('returns null for empty input', () => {
    expect(parseCurrencyInput('')).toBeNull();
    expect(parseCurrencyInput('   ')).toBeNull();
  });

  it('rejects junk', () => {
    expect(parseCurrencyInput('abc')).toBeNull();
    expect(parseCurrencyInput('12.3.4')).toBeNull();
    expect(parseCurrencyInput('1.2.')).toBeNull();
  });

  it('parses a plain integer and a decimal', () => {
    expect(parseCurrencyInput('42')).toBe(42);
    expect(parseCurrencyInput('0.99')).toBe(0.99);
  });
});

describe('<CurrencyInput>', () => {
  it('reports the parsed pounds number via onChange', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1,234.56' } });
    expect(onChange).toHaveBeenLastCalledWith(1234.56);
  });

  it('reports null for junk', () => {
    const onChange = vi.fn();
    render(<CurrencyInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'xyz' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('does not wipe the field while typing a decimal point', () => {
    // Reproduces BUG-2: a controlled parent that mirrors `value` back in.
    function Host() {
      const [v, setV] = useState('');
      return <CurrencyInput value={v} onChange={setV} />;
    }
    render(<Host />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.change(input, { target: { value: '12.' } });
    // The intermediate "12." must survive — not be cleared.
    expect(input.value).toBe('12.');
  });

  it('commits the parsed value on blur after an intermediate decimal', () => {
    function Host() {
      const [v, setV] = useState('');
      return (
        <>
          <CurrencyInput value={v} onChange={setV} />
          <span data-testid="v">{String(v)}</span>
        </>
      );
    }
    render(<Host />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '12.' } });
    fireEvent.change(input, { target: { value: '12.5' } });
    fireEvent.blur(input);
    expect(input.value).toBe('12.5');
    expect(screen.getByTestId('v').textContent).toBe('12.5');
  });

  it('a lone "." never clears and commits to empty on blur', () => {
    function Host() {
      const [v, setV] = useState('');
      return <CurrencyInput value={v} onChange={setV} />;
    }
    render(<Host />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '.' } });
    expect(input.value).toBe('.'); // preserved while typing
    fireEvent.blur(input);
    expect(input.value).toBe(''); // no valid number → empty
  });
});
