import { describe, expect, it, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { createSegmentedControl } from './segmented-control.js';

function makeDOM() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="mount"></div></body></html>');
  return { document: dom.window.document, window: dom.window };
}

const OPTIONS = [
  { value: 'current', label: 'This Month' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All Time' },
];

describe('createSegmentedControl', () => {
  let document;
  let container;

  beforeEach(() => {
    ({ document } = makeDOM());
    container = document.getElementById('mount');
  });

  it('Test 1: renders three options and marks the initial selected value as active', () => {
    createSegmentedControl({
      container,
      name: 'view',
      options: OPTIONS,
      value: 'ytd',
      onChange: vi.fn(),
    });

    const buttons = container.querySelectorAll('[role="radio"]');
    expect(buttons).toHaveLength(3);

    const activeBtn = container.querySelector('[aria-checked="true"]');
    expect(activeBtn).not.toBeNull();
    expect(activeBtn.dataset.value).toBe('ytd');

    const inactiveButtons = container.querySelectorAll('[aria-checked="false"]');
    expect(inactiveButtons).toHaveLength(2);
  });

  it('Test 2: pointer activation invokes onChange with the selected option value', () => {
    const onChange = vi.fn();
    createSegmentedControl({
      container,
      name: 'view',
      options: OPTIONS,
      value: 'current',
      onChange,
    });

    const allBtn = container.querySelector('[data-value="all"]');
    allBtn.click();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('Test 3: ArrowRight auto-selects next segment and moves focus (WAI-ARIA radiogroup pattern); ArrowLeft wraps', () => {
    const onChange = vi.fn();
    createSegmentedControl({
      container,
      name: 'view',
      options: OPTIONS,
      value: 'current',
      onChange,
    });

    const buttons = Array.from(container.querySelectorAll('[role="radio"]'));

    // ArrowRight from index 0: focus AND selection moves to index 1
    buttons[0].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    // Focus moved (roving tabIndex)
    expect(buttons[1].tabIndex).toBe(0);
    expect(buttons[0].tabIndex).toBe(-1);
    expect(buttons[2].tabIndex).toBe(-1);
    // Auto-selected: onChange called with 'ytd'
    expect(onChange).toHaveBeenCalledWith('ytd');
    expect(buttons[1].getAttribute('aria-checked')).toBe('true');
    expect(buttons[0].getAttribute('aria-checked')).toBe('false');
    onChange.mockClear();

    // ArrowLeft from index 1 back to index 0
    buttons[1].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(buttons[0].tabIndex).toBe(0);
    expect(buttons[1].tabIndex).toBe(-1);
    expect(onChange).toHaveBeenCalledWith('current');
    onChange.mockClear();

    // ArrowLeft from index 0 should wrap to index 2
    buttons[0].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(buttons[2].tabIndex).toBe(0);
    expect(buttons[0].tabIndex).toBe(-1);
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('Test 4: Enter and Space re-confirm the already-selected segment (no double-activation side-effects)', () => {
    const onChange = vi.fn();
    createSegmentedControl({
      container,
      name: 'view',
      options: OPTIONS,
      value: 'current',
      onChange,
    });

    const buttons = Array.from(container.querySelectorAll('[role="radio"]'));

    // ArrowRight auto-selects 'ytd' (index 1)
    buttons[0].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(buttons[1].tabIndex).toBe(0);
    expect(onChange).toHaveBeenCalledWith('ytd');
    onChange.mockClear();

    // Enter re-confirms the focused/selected segment (calls onChange again — idempotent from UX view)
    buttons[1].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('ytd');
    onChange.mockClear();

    // ArrowRight auto-selects 'all' (index 2)
    buttons[1].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('all');
    onChange.mockClear();

    // Space re-confirms 'all'
    buttons[2].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('Test 5: ARIA state stays synchronized after keyboard and pointer interactions', () => {
    const onChange = vi.fn();
    createSegmentedControl({
      container,
      name: 'view',
      options: OPTIONS,
      value: 'current',
      onChange,
    });

    const buttons = Array.from(container.querySelectorAll('[role="radio"]'));

    // Initial ARIA state
    expect(buttons[0].getAttribute('aria-checked')).toBe('true');
    expect(buttons[1].getAttribute('aria-checked')).toBe('false');
    expect(buttons[2].getAttribute('aria-checked')).toBe('false');

    // Pointer click on 'all'
    buttons[2].click();
    expect(buttons[2].getAttribute('aria-checked')).toBe('true');
    expect(buttons[0].getAttribute('aria-checked')).toBe('false');
    expect(buttons[1].getAttribute('aria-checked')).toBe('false');

    // Keyboard: ArrowLeft from index 2 to index 1, then Enter
    buttons[2].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    buttons[1].dispatchEvent(new document.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(buttons[1].getAttribute('aria-checked')).toBe('true');
    expect(buttons[2].getAttribute('aria-checked')).toBe('false');
  });
});
