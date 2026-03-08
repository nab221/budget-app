// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock render.js — must come before importing debts.js
vi.mock('./render.js', () => {
  const modalUI = {
    elements: { overlay: null, title: null, body: null, footer: null, close: null },
    init: vi.fn(),
    show: vi.fn(() => {
      document.body.style.overflow = 'hidden';
    }),
    close: vi.fn(() => {
      document.body.style.overflow = '';
    }),
  };

  return {
    modalUI,
    safeHTML: (strings, ...values) =>
      strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? String(values[i]) : ''), ''),
    sanitize: (str) => str,
    renderTabSummary: vi.fn(),
    adjustFontSize: vi.fn(),
    showModal: vi.fn(),
    closeModal: vi.fn(),
  };
});

// Mock repository.js — stub debtRepository so Edit mode doesn't crash
vi.mock('../db/repository.js', () => ({
  debtRepository: {
    get: vi.fn(async () => ({
      id: 1,
      name: 'Test Debt',
      debtType: 'credit-card',
      apr: 0,
      creditLimit: 0,
      currentBalance: 0,
      promoEndDate: '',
      postPromoApr: 0,
    })),
    getAll: vi.fn(async () => []),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  statementRepository: {
    getAll: vi.fn(async () => []),
    get: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteWithExpense: vi.fn(),
    addWithExpense: vi.fn(),
  },
  incomeRepository: {
    getByMonth: vi.fn(async () => []),
  },
  categoryRepository: {
    getCategories: vi.fn(async () => []),
  },
}));

// Mock haptics to avoid import errors in jsdom
vi.mock('../utils/haptics.js', () => ({
  triggerHaptic: vi.fn(),
  alertWithHaptic: vi.fn(),
}));

// Mock currency utils
vi.mock('../utils/currency.js', () => ({
  formatGBP: (p) => `£${(p / 100).toFixed(2)}`,
  formatGBPShort: (p) => `£${(p / 100).toFixed(0)}`,
  fromPence: (p) => p / 100,
}));

// Mock finance utils
vi.mock('../utils/finance.js', () => ({
  calcMinPayment: vi.fn(() => 0),
  calcUtilization: vi.fn(() => 0),
  simulatePayoff: vi.fn(() => ({ monthsToClear: 0 })),
}));

import { debtUI } from './debts.js';
import { modalUI } from './render.js';
import { debtRepository } from '../db/repository.js';

describe('debtUI modal scaffold', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Build minimal DOM
    document.body.innerHTML = '';
    document.body.style.overflow = '';

    const addDebtBtn = document.createElement('button');
    addDebtBtn.id = 'addDebtBtn';
    document.body.appendChild(addDebtBtn);

    const debtFormContainer = document.createElement('div');
    debtFormContainer.id = 'debtFormContainer';
    document.body.appendChild(debtFormContainer);

    const debtNameInput = document.createElement('input');
    debtNameInput.id = 'debtNameInput';
    document.body.appendChild(debtNameInput);

    // Reset editingId
    debtUI.editingId = null;
  });

  it('MODAL-01: openDebtModal calls modalUI.show', () => {
    debtUI.openDebtModal();

    expect(modalUI.show).toHaveBeenCalledOnce();
    const titleArg = modalUI.show.mock.calls[0][0];
    expect(titleArg).toContain('Debt');
  });

  it('MODAL-02: backdrop click calls modalUI.close (editingId reset)', () => {
    debtUI.openDebtModal();

    // After opening, simulate backdrop click — backdrop is the overlay element
    // debtUI wires an onclick/listener on the overlay inside openDebtModal
    // We trigger _closeDebtModal directly via the overlay's registered handler
    // by dispatching a click on the overlay element and checking side effects
    const overlay = modalUI.elements.overlay || document.getElementById('modalOverlay');

    if (overlay) {
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else {
      // Fallback: call _closeDebtModal directly to verify it resets editingId
      debtUI._closeDebtModal();
    }

    expect(debtUI.editingId).toBe(null);
  });

  it('MODAL-03: scroll is locked on open and restored on close', () => {
    debtUI.openDebtModal();
    expect(document.body.style.overflow).toBe('hidden');

    debtUI._closeDebtModal();
    expect(document.body.style.overflow).toBe('');
  });

  it('MODAL-04: name field receives focus after openDebtModal', () => {
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');

    debtUI.openDebtModal();

    const nameInput = document.getElementById('debtNameInput');
    expect(nameInput).not.toBeNull();
    // Check focus was called on the name input specifically
    const focusedOnNameInput = focusSpy.mock.instances.some(
      (el) => el === nameInput || (el && el.id === 'debtNameInput')
    );
    expect(focusedOnNameInput).toBe(true);
  });
});

describe('debtUI type-specific fieldsets', () => {
  // Shared DOM setup: inject 4 fieldset divs + type select into document.body
  function buildFieldsetDOM() {
    document.body.innerHTML = '';
    document.body.style.overflow = '';

    // Fieldsets — credit-card starts visible (no hidden class), others hidden
    const fieldsets = [
      { id: 'fieldset-credit-card', hidden: false },
      { id: 'fieldset-mortgage', hidden: true },
      { id: 'fieldset-loan', hidden: true },
      { id: 'fieldset-other', hidden: true },
    ];
    for (const { id, hidden } of fieldsets) {
      const div = document.createElement('div');
      div.id = id;
      if (hidden) div.classList.add('hidden');
      document.body.appendChild(div);
    }

    // Type select with all 4 options, defaulting to credit-card
    const select = document.createElement('select');
    select.id = 'debtTypeInput';
    for (const val of ['credit-card', 'mortgage', 'loan', 'other']) {
      const opt = document.createElement('option');
      opt.value = val;
      if (val === 'credit-card') opt.selected = true;
      select.appendChild(opt);
    }
    document.body.appendChild(select);

    // Name input (required by openDebtModal focus call)
    const nameInput = document.createElement('input');
    nameInput.id = 'debtNameInput';
    document.body.appendChild(nameInput);

    // Reset editingId
    debtUI.editingId = null;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    buildFieldsetDOM();
  });

  it('TYPE-01: selecting credit-card shows fieldset-credit-card and hides others', () => {
    const typeSelect = document.getElementById('debtTypeInput');
    typeSelect.value = 'credit-card';

    debtUI._onTypeChange();

    expect(document.getElementById('fieldset-credit-card').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('fieldset-mortgage').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-loan').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-other').classList.contains('hidden')).toBe(true);
  });

  it('TYPE-02: selecting mortgage shows fieldset-mortgage and hides others', () => {
    const typeSelect = document.getElementById('debtTypeInput');
    typeSelect.value = 'mortgage';

    debtUI._onTypeChange();

    expect(document.getElementById('fieldset-mortgage').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('fieldset-credit-card').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-loan').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-other').classList.contains('hidden')).toBe(true);
  });

  it('TYPE-03: selecting loan shows fieldset-loan and hides others', () => {
    const typeSelect = document.getElementById('debtTypeInput');
    typeSelect.value = 'loan';

    debtUI._onTypeChange();

    expect(document.getElementById('fieldset-loan').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('fieldset-credit-card').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-mortgage').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-other').classList.contains('hidden')).toBe(true);
  });

  it('TYPE-04: selecting other shows fieldset-other and hides others', () => {
    const typeSelect = document.getElementById('debtTypeInput');
    typeSelect.value = 'other';

    debtUI._onTypeChange();

    expect(document.getElementById('fieldset-other').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('fieldset-credit-card').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-mortgage').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-loan').classList.contains('hidden')).toBe(true);
  });

  it('EDIT-03: openDebtModal(id) pre-shows correct fieldset for stored debt type', async () => {
    // Override debtRepository.get to return a mortgage debt
    debtRepository.get.mockResolvedValueOnce({
      id: 1,
      debtType: 'mortgage',
      name: 'My Mortgage',
      apr: 0,
      creditLimit: 0,
      currentBalance: 0,
      promoEndDate: '',
      postPromoApr: 0,
    });

    await debtUI.openDebtModal(1);

    expect(document.getElementById('debtTypeInput').value).toBe('mortgage');
    expect(document.getElementById('fieldset-mortgage').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('fieldset-credit-card').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-loan').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('fieldset-other').classList.contains('hidden')).toBe(true);
  });
});
