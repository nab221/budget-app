import DOMPurify from 'dompurify';
import { formatGBP, formatGBPShort } from '../utils/currency.js';

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
      'style', 'for', 'disabled', 'readonly', 'selected', 'checked', 'onclick', 'onchange', 'href'
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
   * @param {string|Array} footer - The HTML content of the footer OR an array of button configs.
   */
  show(title, content, footer = '') {
    this.elements.title.textContent = title;
    this.elements.body.innerHTML = content;

    if (Array.isArray(footer)) {
      // Clear footer
      this.elements.footer.innerHTML = '';
      
      // Build buttons from array
      footer.forEach(btnConfig => {
        const btn = document.createElement('button');
        btn.textContent = btnConfig.label || 'Action';
        if (btnConfig.className) btn.className = btnConfig.className;
        if (btnConfig.onClick) {
          btn.onclick = (e) => {
            e.preventDefault();
            btnConfig.onClick();
          };
        }
        this.elements.footer.appendChild(btn);
      });
    } else {
      this.elements.footer.innerHTML = footer;
    }

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

/**
 * Standalone showModal function.
 */
export function showModal(title, content, footer) {
  modalUI.show(title, content, footer);
}

/**
 * Standalone closeModal function.
 */
export function closeModal() {
  modalUI.close();
}

/**
 * Renders a summary banner for a tab.
 * @param {string} containerId - The ID of the container element.
 * @param {Array} cards - Array of card definitions { label, value, color, isRaw, note, warning, badge, percent, progressBars }.
 */
export function renderTabSummary(containerId, cards) {
  let container = document.getElementById(containerId);
  if (!container) return;

  container.className = 'sum-grid';
  container.style.marginBottom = '20px';
  container.textContent = '';

  for (const card of cards) {
    const item = document.createElement('div');
    item.className = 'sum-item';
    if (card.warning) {
      item.style.borderColor = 'var(--danger)';
      item.style.borderWidth = '2px';
    }

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'flex-start';

    const labelEl = document.createElement('div');
    labelEl.className = 'sum-label';
    labelEl.textContent = card.label;
    if (card.badge) {
      const b = document.createElement('span');
      b.className = 'pill';
      b.style.background = 'var(--danger)';
      b.style.color = '#fff';
      b.style.fontSize = '0.6rem';
      b.style.marginLeft = '4px';
      b.textContent = card.badge.text;
      b.title = card.badge.title;
      labelEl.appendChild(b);
    }
    head.appendChild(labelEl);
    item.appendChild(head);

    const valEl = document.createElement('div');
    valEl.className = 'sum-val';
    valEl.style.color = card.color || 'inherit';
    
    if (card.isRaw) {
      valEl.textContent = card.value;
    } else {
      adjustFontSize(valEl, card.value);
      if (card.percent !== undefined) {
        const p = document.createElement('div');
        p.style.cssText = 'font-size:0.75rem; color:var(--text-soft); font-weight:400; margin-top:2px;';
        p.textContent = `${card.percent}% of income`;
        valEl.appendChild(p);
      }
    }
    item.appendChild(valEl);

    if (card.note) {
      const note = document.createElement('div');
      note.className = 'sum-note';
      note.textContent = card.note;
      item.appendChild(note);
    }

    if (card.warning) {
      const warn = document.createElement('div');
      warn.style.cssText = 'font-size:0.65rem; color:var(--danger); font-weight:600; margin-top:4px;';
      warn.innerHTML = `⚠️ ${card.warning.title}: ${card.warning.text}`;
      item.appendChild(warn);
    }

    // Special handling for progress bars (e.g. budget targets)
    if (card.progressBars && card.progressBars.length > 0) {
      const barsCont = document.createElement('div');
      barsCont.style.marginTop = '10px';
      card.progressBars.forEach(b => {
        const row = document.createElement('div');
        row.style.marginBottom = '6px';
        row.innerHTML = `
          <div style="display:flex; justify-content:space-between; font-size:.65rem; margin-bottom:2px">
            <span style="font-weight:600">${b.label}</span>
            <span style="font-weight:600">${b.percent}%</span>
          </div>
          <div style="height:4px; background:var(--bg-alt); border-radius:2px; overflow:hidden">
            <div style="height:100%; width:${Math.min(b.percent, 100)}%; background:${b.color}; transition:width 0.3s"></div>
          </div>
        `;
        barsCont.appendChild(row);
      });
      item.appendChild(barsCont);
    }

    container.appendChild(item);
  }
}

/**
 * Adjusts the font size of an element based on the length of the currency string.
 */
export function adjustFontSize(el, pence) {
  const amount = Math.abs(pence / 100);
  let fontSize = '1.35rem';
  let displayValue = formatGBP(pence);

  if (amount >= 100000) {
    displayValue = formatGBPShort(pence);
  } else if (amount >= 10000) {
    fontSize = '1.15rem';
  } else if (amount >= 1000) {
    fontSize = '1.25rem';
  }

  el.style.fontSize = fontSize;
  el.innerHTML = `<span class="privacy-blur">${displayValue}</span>`;
}
