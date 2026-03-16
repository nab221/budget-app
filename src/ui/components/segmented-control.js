/**
 * Segmented control component.
 *
 * Renders a radiogroup/radio ARIA widget inside `container`.
 * Follows the WAI-ARIA radiogroup authoring practices:
 *   - Arrow keys move focus AND auto-select (same as native radio buttons)
 *   - Enter/Space confirm the currently focused (already-selected) option
 *   - Tab moves focus in/out of the group as a single stop
 * Touch-friendly: buttons have a minimum 44px height.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.container  - Mount point element
 * @param {string}      opts.name       - Radio group name (for ARIA label)
 * @param {Array<{value:string, label:string}>} opts.options
 * @param {string}      opts.value      - Initially selected value
 * @param {function}    opts.onChange   - Called with next value when selection changes
 */
export function createSegmentedControl({ container, name, options, value, onChange }) {
  // Track internal focused/selected index for roving tabindex
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
        // WAI-ARIA radiogroup: arrow keys move focus AND auto-select
        e.preventDefault();
        activate((focusedIndex + 1) % options.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activate((focusedIndex - 1 + options.length) % options.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        // Confirm the currently focused option (already selected by arrow nav)
        e.preventDefault();
        activate(focusedIndex);
      }
    });

    group.appendChild(btn);
    return btn;
  });

  container.appendChild(group);

  /**
   * Activate (select) the option at index:
   *  - Updates ARIA checked state
   *  - Updates is-active class
   *  - Moves roving tabIndex to this button and calls .focus()
   *  - Calls onChange with the new value
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

    // Rove the tabIndex to the activated button and move browser focus
    buttons[focusedIndex].tabIndex = -1;
    focusedIndex = idx;
    buttons[focusedIndex].tabIndex = 0;
    buttons[focusedIndex].focus();

    if (typeof onChange === 'function') {
      onChange(nextValue);
    }
  }
}
