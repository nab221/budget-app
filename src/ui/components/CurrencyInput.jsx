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
 * Tiny currency text input. Holds the RAW string the user is typing in local
 * state while the field is focused, so intermediate values like "12.", ".", or
 * "1,2" are preserved and never wiped — the parse/commit happens on blur (and
 * the value is reformatted to its canonical string once the field is no longer
 * focused). It still reports the parsed pounds number (or null) via `onChange`
 * on every keystroke so live consumers (running totals, etc.) stay current.
 *
 * ── Why the raw string matters (BUG-2) ─────────────────────────────────────
 * The previous version reformatted on every keystroke: it re-derived the text
 * from the parent's `value` on each render. Typing "12." parses to `null`
 * (a trailing dot isn't a complete number), the parent's `value` became `null`,
 * and the re-sync effect wiped the field mid-type. Keeping the raw string local
 * while focused fixes that; we only sync FROM `value` when NOT focused (so an
 * external reset — e.g. a form clearing after save — still shows).
 *
 * @param {object} props
 * @param {number|string|null} props.value - initial / controlled pounds value.
 * @param {(pounds: number|null) => void} props.onChange
 */
export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0.00',
  id,
  onFocus,
  onBlur,
  ...rest
}) {
  const [text, setText] = useState(value == null || value === '' ? '' : String(value));
  const [focused, setFocused] = useState(false);

  // Sync FROM the parent only when NOT focused (external resets / reformatting),
  // and only when the numeric value genuinely differs from what the current text
  // parses to — so an in-progress intermediate string is never clobbered.
  useEffect(() => {
    if (focused) return;
    const asNum = value == null || value === '' ? null : Number(value);
    const cur = parseCurrencyInput(text);
    if (asNum === cur) return;
    setText(asNum == null ? '' : String(asNum));
  }, [value, focused, text]);

  const handleChange = (e) => {
    const next = e.target.value;
    setText(next);
    onChange?.(parseCurrencyInput(next));
  };

  const handleFocus = (e) => {
    setFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    // Commit: tolerate a lone trailing decimal point ("12." → 12) and normalise
    // the visible text to the parsed value's canonical string.
    const parsed = parseCurrencyInput(String(text).replace(/\.$/, ''));
    onChange?.(parsed);
    setText(parsed == null ? '' : String(parsed));
    onBlur?.(e);
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
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...rest}
      />
    </span>
  );
}
