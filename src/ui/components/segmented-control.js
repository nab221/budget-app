/**
 * Segmented control component.
 *
 * Renders a radiogroup/radio ARIA widget inside `container`.
 * Supports roving keyboard navigation (ArrowLeft/ArrowRight),
 * activation via Enter/Space, and touch-friendly 44px minimum height.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container  - Mount point element
 * @param {string}      opts.name       - Radio group name (for ARIA label)
 * @param {Array<{value:string, label:string}>} opts.options
 * @param {string}      opts.value      - Initially selected value
 * @param {function}    opts.onChange   - Called with next value when selection changes
 */
export function createSegmentedControl({ container, name, options, value, onChange }) {
  // Track internal focused index for roving tabindex
  let focusedIndex = options.findIndex(o => o.value === value);
  if (focusedIndex < 0) focusedIndex = 0;

  // Track selected value (ARIA state)
  let selectedValue = value;

  // Build the widget
  const group = container.ownerDocument.createElement('div');
  group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', name);
  group.className = 'segmented-control';

  const buttons = options.map((opt, idx) => {
    const btn = container.ownerDocument.createElement('button');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(opt.value === selectedValue));
    btn.dataset.value = opt.value;
    btn.tabIndex = idx === focusedIndex ? 0 : -1;
    btn.className = 'segmented-control__btn';
    if (opt.value === selectedValue) btn.classList.add('is-active');
    btn.textContent = opt.label;
    btn.type = 'button';

    btn.addEventListener('click', () => {
      activate(idx);
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveFocus((focusedIndex + 1) % options.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveFocus((focusedIndex - 1 + options.length) % options.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(focusedIndex);
      }
    });

    group.appendChild(btn);
    return btn;
  });

  container.appendChild(group);

  /**
   * Move roving focus to the given index without activating.
   */
  function moveFocus(nextIdx) {
    buttons[focusedIndex].tabIndex = -1;
    focusedIndex = nextIdx;
    buttons[focusedIndex].tabIndex = 0;
    buttons[focusedIndex].focus();
  }

  /**
   * Activate (select) the option at index, update ARIA and call onChange.
   */
  function activate(idx) {
    const nextValue = options[idx].value;
    selectedValue = nextValue;

    buttons.forEach((btn, i) => {
      const isSelected = i === idx;
      btn.setAttribute('aria-checked', String(isSelected));
      if (isSelected) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });

    // Update focus to the activated button
    buttons[focusedIndex].tabIndex = -1;
    focusedIndex = idx;
    buttons[focusedIndex].tabIndex = 0;

    if (typeof onChange === 'function') {
      onChange(nextValue);
    }
  }
}
