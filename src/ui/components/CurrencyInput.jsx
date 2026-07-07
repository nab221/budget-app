import { useState, useEffect } from 'react';

/**
 * Parse a user-typed pounds string into a number of pounds.
 *
 * Accepts thousands separators and a leading currency symbol
 * (e.g. "£1,234.56" → 1234.56). Returns `null` for empty or junk input so the
 * caller can distinguish "nothing entered" from a real 0.
 *
 * @param {string} raw
 * @returns {number|null}
 */
export function parseCurrencyInput(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).trim().replace(/[£,\s]/g, '');
  if (cleaned === '') return null;
  // A single optional sign, digits, and up to two decimal places.
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Tiny controlled currency text input. Keeps the raw text locally (so the user
 * can type "1,234.") and reports the parsed pounds number (or null) via
 * `onChange`.
 *
 * @param {object} props
 * @param {number|string|null} props.value - initial pounds value.
 * @param {(pounds: number|null) => void} props.onChange
 */
export default function CurrencyInput({ value, onChange, placeholder = '0.00', id, ...rest }) {
  const [text, setText] = useState(value == null || value === '' ? '' : String(value));

  // Re-sync when the parent resets the field (e.g. after a save).
  useEffect(() => {
    setText(value == null || value === '' ? '' : String(value));
  }, [value]);

  const handle = (e) => {
    const next = e.target.value;
    setText(next);
    onChange?.(parseCurrencyInput(next));
  };

  return (
    <span className="currency-input">
      <span className="currency-input__symbol" aria-hidden="true">£</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className="input"
        value={text}
        placeholder={placeholder}
        onChange={handle}
        {...rest}
      />
    </span>
  );
}
