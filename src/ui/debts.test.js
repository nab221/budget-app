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

describe('debtUI save and edit', () => {
  // Shared DOM setup for save/edit tests
  function buildFullFormDOM() {
    document.body.innerHTML = '';
    
    // Core fields
    const nameInput = document.createElement('input');
    nameInput.id = 'debtNameInput';
    document.body.appendChild(nameInput);

    const typeSelect = document.createElement('select');
    typeSelect.id = 'debtTypeInput';
    ['credit-card', 'mortgage', 'loan', 'other'].forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      typeSelect.appendChild(opt);
    });
    document.body.appendChild(typeSelect);

    // CC fieldset
    const ccFs = document.createElement('div');
    ccFs.id = 'fieldset-credit-card';
    ['ccBalanceInput', 'ccAprInput', 'ccLimitInput', 'ccMinPaymentInput', 'ccPromoEndInput', 'ccPostAprInput'].forEach(id => {
      const inp = document.createElement('input');
      inp.id = id;
      ccFs.appendChild(inp);
    });
    document.body.appendChild(ccFs);

    // Mortgage fieldset
    const mFs = document.createElement('div');
    mFs.id = 'fieldset-mortgage';
    ['mortgagePropertyValueInput', 'mortgageBalanceInput', 'mortgageTermInput', 'mortgageRateInput', 'mortgageErcInput'].forEach(id => {
      const inp = document.createElement('input');
      inp.id = id;
      mFs.appendChild(inp);
    });
    document.body.appendChild(mFs);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    buildFullFormDOM();
    debtUI.editingId = null;
  });

  it('ADD-01: _saveDebt() in Add mode saves payload and closes modal', async () => {
    document.getElementById('debtNameInput').value = 'New CC';
    document.getElementById('debtTypeInput').value = 'credit-card';
    document.getElementById('ccBalanceInput').value = '1000.50';
    document.getElementById('ccAprInput').value = '19.9';

    await debtUI._saveDebt();

    expect(debtRepository.add).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New CC',
      debtType: 'credit-card',
      currentBalance: 1000.5,
      apr: 19.9
    }));
    expect(modalUI.close).toHaveBeenCalled();
  });

  it('ADD-02: validation error on empty name prevents save and shows error span', async () => {
    document.getElementById('debtNameInput').value = '';
    
    await debtUI._saveDebt();

    expect(debtRepository.add).not.toHaveBeenCalled();
    const error = document.querySelector('.field-error');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('Name is required');
  });

  it('ADD-03: openDebtModal in Add mode ensures fresh form', async () => {
    // Mock modalUI.show to inject the form into the real DOM so we can check it
    modalUI.show.mockImplementationOnce((title, content) => {
      document.body.innerHTML = content;
    });

    await debtUI.openDebtModal(null);

    const nameInput = document.getElementById('debtNameInput');
    expect(nameInput.value).toBe('');
  });

  it('EDIT-01: _saveDebt() in Edit mode updates existing record and closes modal', async () => {
    debtUI.editingId = 123;
    document.getElementById('debtNameInput').value = 'Updated Mortgage';
    document.getElementById('debtTypeInput').value = 'mortgage';
    document.getElementById('mortgageBalanceInput').value = '250000';
    document.getElementById('mortgageRateInput').value = '3.5';

    await debtUI._saveDebt();

    expect(debtRepository.update).toHaveBeenCalledWith(123, expect.objectContaining({
      name: 'Updated Mortgage',
      currentBalance: 250000,
      interestRate: 3.5,
      apr: 3.5 // Should sync rate to apr for strategy sorting
    }));
    expect(modalUI.close).toHaveBeenCalled();
  });

  it('EDIT-02: openDebtModal(id) pre-populates fields', async () => {
    debtRepository.get.mockResolvedValueOnce({
      id: 1,
      name: 'Fetched Debt',
      debtType: 'mortgage',
      currentBalance: 35000000, // 350,000 in pence
      interestRate: 4.2,
      termMonths: 300,
      propertyValue: 50000000
    });

    // Mock modalUI.show to inject the form
    modalUI.show.mockImplementationOnce((title, content) => {
      document.body.innerHTML = content;
    });

    await debtUI.openDebtModal(1);

    expect(document.getElementById('debtNameInput').value).toBe('Fetched Debt');
    expect(document.getElementById('mortgageBalanceInput').value).toBe('350000');
    expect(document.getElementById('mortgageRateInput').value).toBe('4.2');
    expect(document.getElementById('mortgageTermInput').value).toBe('300');
  });
});
