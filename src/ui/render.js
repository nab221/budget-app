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
  
  // Check if it's a table fragment that DOMPurify might strip
  const trimmed = raw.trim().toLowerCase();
  const isTableFragment = 
    trimmed.startsWith('<tr') || 
    trimmed.startsWith('<td') || 
    trimmed.startsWith('<th') || 
    trimmed.startsWith('<thead') || 
    trimmed.startsWith('<tbody');
  
  const rawToSanitize = isTableFragment ? `<table>${raw}</table>` : raw;

  let sanitized = DOMPurify.sanitize(rawToSanitize, {
    FORCE_BODY: true,
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

  if (isTableFragment) {
    // Remove the table wrapper and any tbody that DOMPurify might have added
    sanitized = sanitized.replace(/^<table>/, '').replace(/<\/table>$/, '');
    sanitized = sanitized.replace(/^<tbody>/, '').replace(/<\/tbody>$/, '');
  }

  return sanitized;
}

/**
 * Sanitizes a single string.
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
export function sanitize(str) {
  return DOMPurify.sanitize(str);
}

/**
 * Modal management utility.
 */
export const modalUI = {
  elements: {
    overlay: document.getElementById('modalOverlay'),
    title: document.getElementById('modalTitle'),
    body: document.getElementById('modalBody'),
    footer: document.getElementById('modalFooter'),
    close: document.getElementById('modalClose')
  },

  init() {
    if (!this.elements.overlay) {
      // Re-query in case DOM wasn't ready
      this.elements = {
        overlay: document.getElementById('modalOverlay'),
        title: document.getElementById('modalTitle'),
        body: document.getElementById('modalBody'),
        footer: document.getElementById('modalFooter'),
        close: document.getElementById('modalClose')
      };
    }
    if (this.elements.close) {
      this.elements.close.onclick = () => this.close();
    }
    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  },

  /**
   * Shows a modal.
   * @param {string} title - The title of the modal.
   * @param {string} content - The HTML content of the body.
   * @param {string} footer - The HTML content of the footer.
   */
  show(title, content, footer = '') {
    this.elements.title.textContent = title;
    this.elements.body.innerHTML = content;
    this.elements.footer.innerHTML = footer;
    this.elements.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  },

  /**
   * Closes the modal.
   */
  close() {
    this.elements.overlay.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
  }
};
