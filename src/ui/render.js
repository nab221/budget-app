import DOMPurify from 'dompurify';

/**
 * A template tag for safe HTML rendering.
 * Sanitizes the entire output string to prevent XSS.
 * 
 * @param {TemplateStringsArray} strings - Template literal strings.
 * @param {...any} values - Values to be interpolated.
 * @returns {string} - The sanitized HTML string.
 */
export function safeHTML(strings, ...values) {
  const raw = strings.reduce((acc, str, i) => {
    const val = values[i] !== undefined ? String(values[i]) : '';
    return acc + str + val;
  }, '');
  
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
      'b', 'strong', 'i', 'em', 'u', 'span', 'div', 'table', 'thead', 'tbody',
      'tr', 'th', 'td', 'button', 'input', 'select', 'option', 'label', 'textarea',
      'section', 'header', 'footer', 'main', 'span', 'i'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'data-*', 'type', 'value', 'placeholder', 'step', 'min', 'max',
      'style', 'for', 'disabled', 'readonly', 'selected', 'checked', 'onclick', 'href'
    ]
  });
}

/**
 * Sanitizes a single string.
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
export function sanitize(str) {
  return DOMPurify.sanitize(str);
}
