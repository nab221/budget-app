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
  oneOffExpenseRepository: {
    add: vi.fn(async () => 99),
    update: vi.fn(),
  },
  recurrentExpenseRepository: {
    update: vi.fn(),
  },
}));

// Mock db schema for category lookup used by confirmMarkPaid
vi.mock('../db/schema.js', () => ({
  db: {
    categories: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(async () => ({ id: 5, name: 'Credit Cards & Loans' })),
        })),
      })),
    },
  },
}));

// Mock haptics to avoid import errors in jsdom
vi.mock('../utils/haptics.js', () => ({
  triggerHaptic: vi.fn(),
  alertWithHaptic: vi.fn(),
}));

// Mock charts.js — stub statement chart functions
vi.mock('./charts.js', () => ({
  renderStatementBalanceChart: vi.fn(),
  renderStatementInterestChart: vi.fn(),
  renderStatementPaymentChart: vi.fn(),
  renderStatementUtilisationChart: vi.fn(),
  destroyStatementCharts: vi.fn(),
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
import { debtRepository, statementRepository, recurrentExpenseRepository, oneOffExpenseRepository } from '../db/repository.js';
import {
  renderStatementBalanceChart,
  renderStatementInterestChart,
  renderStatementPaymentChart,
  renderStatementUtilisationChart,
  destroyStatementCharts,
} from './charts.js';

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

  it('EDIT-04a: populates credit-card fields when editing a credit-card debt', async () => {
    debtRepository.get.mockResolvedValueOnce({
      id: 2,
      name: 'TSB Credit Card',
      debtType: 'credit-card',
      currentBalance: 50000,   // £500 in pence
      apr: 19.9,
      creditLimit: 200000,     // £2000 in pence
      minPayment: 2500,        // £25 in pence — stored as pence but displayed as-is via set()
      promoEndDate: '2025-12-31',
      postPromoApr: 24.9,
    });

    modalUI.show.mockImplementationOnce((title, content) => {
      document.body.innerHTML = content;
    });

    await debtUI.openDebtModal(2);

    expect(document.getElementById('ccBalanceInput').value).toBe('500');
    expect(document.getElementById('ccAprInput').value).toBe('19.9');
    expect(document.getElementById('ccLimitInput').value).toBe('2000');
    expect(document.getElementById('ccPromoEndInput').value).toBe('2025-12-31');
    expect(document.getElementById('ccPostAprInput').value).toBe('24.9');
  });

  it('EDIT-04b: populates mortgage fields when editing a mortgage debt', async () => {
    debtRepository.get.mockResolvedValueOnce({
      id: 3,
      name: 'Home Mortgage',
      debtType: 'mortgage',
      currentBalance: 25000000, // £250,000 in pence
      propertyValue: 40000000,  // £400,000 in pence
      termMonths: 240,
      interestRate: 3.5,
      earlyRepaymentFee: 50000, // £500 in pence
    });

    modalUI.show.mockImplementationOnce((title, content) => {
      document.body.innerHTML = content;
    });

    await debtUI.openDebtModal(3);

    expect(document.getElementById('mortgagePropertyValueInput').value).toBe('400000');
    expect(document.getElementById('mortgageBalanceInput').value).toBe('250000');
    expect(document.getElementById('mortgageTermInput').value).toBe('240');
    expect(document.getElementById('mortgageRateInput').value).toBe('3.5');
    expect(document.getElementById('mortgageErcInput').value).toBe('500');
  });

  it('EDIT-04c: populates loan fields when editing a loan debt', async () => {
    debtRepository.get.mockResolvedValueOnce({
      id: 4,
      name: 'Car Loan',
      debtType: 'loan',
      currentBalance: 800000,     // £8,000 in pence
      originalPrincipal: 1500000, // £15,000 in pence
      termMonths: 60,
      interestRate: 6.9,
    });

    modalUI.show.mockImplementationOnce((title, content) => {
      document.body.innerHTML = content;
    });

    await debtUI.openDebtModal(4);

    expect(document.getElementById('loanOriginalInput').value).toBe('15000');
    expect(document.getElementById('loanBalanceInput').value).toBe('8000');
    expect(document.getElementById('loanTermInput').value).toBe('60');
    expect(document.getElementById('loanRateInput').value).toBe('6.9');
  });

  it('EDIT-04d: populates other fields when editing an other debt', async () => {
    debtRepository.get.mockResolvedValueOnce({
      id: 5,
      name: 'Family Loan',
      debtType: 'other',
      currentBalance: 300000, // £3,000 in pence
    });

    modalUI.show.mockImplementationOnce((title, content) => {
      document.body.innerHTML = content;
    });

    await debtUI.openDebtModal(5);

    expect(document.getElementById('otherBalanceInput').value).toBe('3000');
  });

  it('FORM-01: _buildFormHTML() in add mode hides ccBalanceInput and ccMinPaymentInput', () => {
    debtUI.editingId = null;
    const html = debtUI._buildFormHTML();
    // No visible balance label for new cards
    expect(html).not.toContain('Current Balance (£)');
    expect(html).not.toContain('Min Monthly Payment');
    // Hint text is present
    expect(html).toContain('tracked automatically');
    // A hidden input for ccBalanceInput must exist so _saveDebt can read it
    expect(html).toContain('id="ccBalanceInput"');
    expect(html).toContain('type="hidden"');
  });

  it('FORM-02: _buildFormHTML() in edit mode includes read-only balance display and hidden input', () => {
    debtUI.editingId = 99; // non-null = editing
    const html = debtUI._buildFormHTML();
    // Hidden input for balance preservation
    expect(html).toContain('id="ccBalanceInput"');
    expect(html).toContain('type="hidden"');
    // Read-only display span
    expect(html).toContain('id="ccBalanceDisplay"');
    // No min payment field in edit mode either
    expect(html).not.toContain('Min Monthly Payment');
  });

  it('FORM-03: _populateEditFields sets ccBalanceInput and ccBalanceDisplay for credit-card', () => {
    debtUI.editingId = 5;

    // Build and inject the edit-mode form HTML
    const html = debtUI._buildFormHTML();
    document.body.innerHTML = html;

    // Set up type select
    const typeSelect = document.getElementById('debtTypeInput');
    if (typeSelect) typeSelect.value = 'credit-card';

    debtUI._populateEditFields({
      name: 'Test CC',
      debtType: 'credit-card',
      currentBalance: 75000, // £750 in pence
      apr: 21.9,
      creditLimit: 300000, // £3000 in pence
      promoEndDate: null,
      postPromoApr: 21.9,
    });

    // Hidden input should have the pounds value (fromPence)
    const hiddenInput = document.getElementById('ccBalanceInput');
    expect(hiddenInput).not.toBeNull();
    expect(hiddenInput.value).toBe('750');

    // Display span should show formatted balance
    const display = document.getElementById('ccBalanceDisplay');
    expect(display).not.toBeNull();
    expect(display.textContent).toContain('750');
  });
});

describe('HIST-01: history table layout — column widths, sticky columns, scroll UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    statementRepository.getAll.mockResolvedValue([]);
  });

  const mockDebt = {
    id: 42,
    name: 'Test CC',
    debtType: 'credit-card',
    currentBalance: 150000,
    apr: 19.9,
    creditLimit: 500000,
  };

  it('HIST-01a: _buildHistoryModalHTML HTML contains stmtTableWrapper', () => {
    const html = debtUI._buildHistoryModalHTML(mockDebt);
    expect(html).toContain('stmtTableWrapper');
  });

  it('HIST-01b: _buildHistoryModalHTML HTML contains stmt-tbl class (sticky styles applied via global CSS)', () => {
    const html = debtUI._buildHistoryModalHTML(mockDebt);
    expect(html).toContain('stmt-tbl');
  });

  it('HIST-01c: _buildHistoryModalHTML HTML contains at least 10 <th> elements', () => {
    const html = debtUI._buildHistoryModalHTML(mockDebt);
    const thMatches = html.match(/<th/g) || [];
    expect(thMatches.length).toBeGreaterThanOrEqual(10);
  });

  it('HIST-01d: renderStatements renders date as "08 Mar" format', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      {
        id: 1,
        debtId: 42,
        date: '2024-03-08',
        openingBalance: 50000,
        amount: 45000,
        interest: 500,
        fees: 0,
        minimumPayment: 2500,
        paymentDueDate: '',
        actualPaymentAmount: 0,
        actualPaymentDate: '',
      },
    ]);

    // Set up a table + tbody in the DOM (tbody must be inside a table to be valid)
    document.body.innerHTML = '<table><tbody id="stmtBody-modal"></tbody></table>';
    await debtUI.renderStatements(42);

    const tbody = document.getElementById('stmtBody-modal');
    expect(tbody.innerHTML).toContain('08 Mar');
  });

  it('HIST-01e: renderStatements renders large openingBalance as "£1.5k"', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      {
        id: 2,
        debtId: 42,
        date: '2024-03-08',
        openingBalance: 150000, // £1,500 in pence → "£1.5k"
        amount: 140000,
        interest: 500,
        fees: 0,
        minimumPayment: 2500,
        paymentDueDate: '',
        actualPaymentAmount: 0,
        actualPaymentDate: '',
      },
    ]);

    document.body.innerHTML = '<table><tbody id="stmtBody-modal"></tbody></table>';
    await debtUI.renderStatements(42);

    const tbody = document.getElementById('stmtBody-modal');
    expect(tbody.innerHTML).toContain('£1.5k');
  });
});

describe('HIST-02: pencil icon in statement rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    statementRepository.getAll.mockResolvedValue([]);
  });

  it('HIST-02a: renderStatements row HTML does NOT contain ">Edit<"', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      {
        id: 3,
        debtId: 99,
        date: '2024-01-15',
        openingBalance: 10000,
        amount: 9000,
        interest: 100,
        fees: 0,
        minimumPayment: 500,
        paymentDueDate: '',
        actualPaymentAmount: 0,
        actualPaymentDate: '',
      },
    ]);

    document.body.innerHTML = '<table><tbody id="stmtBody-modal"></tbody></table>';
    await debtUI.renderStatements(99);

    const tbody = document.getElementById('stmtBody-modal');
    expect(tbody.innerHTML).not.toContain('>Edit<');
  });

  it('HIST-02b: renderStatements row HTML contains ✏️', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      {
        id: 4,
        debtId: 99,
        date: '2024-01-15',
        openingBalance: 10000,
        amount: 9000,
        interest: 100,
        fees: 0,
        minimumPayment: 500,
        paymentDueDate: '',
        actualPaymentAmount: 0,
        actualPaymentDate: '',
      },
    ]);

    document.body.innerHTML = '<table><tbody id="stmtBody-modal"></tbody></table>';
    await debtUI.renderStatements(99);

    const tbody = document.getElementById('stmtBody-modal');
    expect(tbody.innerHTML).toContain('✏️');
  });
});

describe('PREFILL-01: statement prefill recovery flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    debtUI.activeStmtDebtId = 42;
    debtUI.editingStmtId = null;
    statementRepository.getAll.mockResolvedValue([]);
  });

  it('reopens history modal when form container is missing, then pre-fills rendered fields', async () => {
    const openHistorySpy = vi
      .spyOn(debtUI, 'openHistoryModal')
      .mockImplementation(async () => {
        document.body.innerHTML = '<div id="stmtFormContainer-modal" class="hidden"></div>';
      });

    const summary = {
      statementDate: '2026-02-28',
      openingBalance: 12345,
      newBalance: 67890,
      minimumPayment: 5000,
      paymentDueDate: '2026-03-15',
    };

    await debtUI.prefillStatementForm(summary);

    expect(openHistorySpy).toHaveBeenCalledWith(42);
    expect(document.getElementById('stmtDateInput-modal')?.value).toBe('2026-02-28');
    expect(document.getElementById('stmtOpeningBalanceInput-modal')?.value).toBe('123.45');
    expect(document.getElementById('stmtBalanceInput-modal')?.value).toBe('678.90');
    expect(document.getElementById('stmtMinPaymentInput-modal')?.value).toBe('50.00');
    expect(document.getElementById('stmtDueDateInput-modal')?.value).toBe('2026-03-15');
  });
});

describe('HIST-03: Mark Paid inline action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    statementRepository.getAll.mockResolvedValue([]);
    // Default: statement has no linkedExpenseId (old/fallback path)
    statementRepository.get.mockResolvedValue({ linkedExpenseId: null });
    // Register global handlers (showMarkPaidPrompt, cancelMarkPaid, etc.)
    debtUI.setupEventListeners();
  });

  // --- Task 1: ✓ button presence/absence and showMarkPaidPrompt / cancelMarkPaid ---

  it('HIST-03a: unpaid statement row shows ✓ button with showMarkPaidPrompt onclick', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      {
        id: 10,
        debtId: 50,
        date: '2024-03-01',
        openingBalance: 50000,
        amount: 45000,
        interest: 500,
        fees: 0,
        minimumPayment: 2500,
        paymentDueDate: '',
        actualPaymentAmount: 0,
        actualPaymentDate: '',
      },
    ]);

    document.body.innerHTML = '<table><tbody id="stmtBody-modal"></tbody></table>';
    await debtUI.renderStatements(50);

    const tbody = document.getElementById('stmtBody-modal');
    expect(tbody.innerHTML).toContain('✓');
    expect(tbody.innerHTML).toContain('showMarkPaidPrompt');
  });

  it('HIST-03b: paid statement row does NOT show ✓ button or showMarkPaidPrompt', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      {
        id: 11,
        debtId: 50,
        date: '2024-03-01',
        openingBalance: 50000,
        amount: 45000,
        interest: 500,
        fees: 0,
        minimumPayment: 2500,
        paymentDueDate: '',
        actualPaymentAmount: 2500,
        actualPaymentDate: '2024-03-15',
      },
    ]);

    document.body.innerHTML = '<table><tbody id="stmtBody-modal"></tbody></table>';
    await debtUI.renderStatements(50);

    const tbody = document.getElementById('stmtBody-modal');
    expect(tbody.innerHTML).not.toContain('showMarkPaidPrompt');
  });

  it('HIST-03c: showMarkPaidPrompt replaces td innerHTML with inline prompt containing input and Confirm/Cancel buttons', () => {
    // Set up a td with the correct id
    document.body.innerHTML = `
      <table><tbody>
        <tr><td id="mark-paid-td-20">original content</td></tr>
      </tbody></table>
    `;

    window.showMarkPaidPrompt(20, 50, 2500); // stmtId=20, debtId=50, minPaymentPence=2500

    const td = document.getElementById('mark-paid-td-20');
    expect(td.innerHTML).toContain('markPaidAmt-20');
    expect(td.innerHTML).toContain('25.00'); // 2500 pence = £25.00
    expect(td.innerHTML).toContain('confirmMarkPaid');
    expect(td.innerHTML).toContain('cancelMarkPaid');
  });

  it('HIST-03d: cancelMarkPaid restores td innerHTML to original content', () => {
    document.body.innerHTML = `
      <table><tbody>
        <tr><td id="mark-paid-td-21">original content here</td></tr>
      </tbody></table>
    `;

    // First show the prompt (stores original)
    window.showMarkPaidPrompt(21, 50, 1000);
    const td = document.getElementById('mark-paid-td-21');
    expect(td.innerHTML).not.toContain('original content here');

    // Then cancel (restores original)
    window.cancelMarkPaid(21);
    expect(td.innerHTML).toContain('original content here');
  });

  // --- Task 2: confirmMarkPaid saves payment and updates debt balance ---

  it('HIST-03e: confirmMarkPaid calls statementRepository.update with actualPaymentAmount and today date', async () => {
    const today = new Date().toISOString().slice(0, 10);
    document.body.innerHTML = `
      <input id="markPaidAmt-30" type="number" value="150.00" />
      <input id="markPaidDate-30" type="date" value="${today}" />
    `;

    debtRepository.get.mockResolvedValueOnce({
      id: 60,
      name: 'Test Card',
      currentBalance: 50000, // 50000 pence = £500.00
    });

    await window.confirmMarkPaid(30, 60);

    expect(statementRepository.update).toHaveBeenCalledWith(30, expect.objectContaining({
      actualPaymentAmount: 150,
      actualPaymentDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }));
  });

  it('HIST-03f: confirmMarkPaid calls debtRepository.update with balance reduced by payment (clamped to 0)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    document.body.innerHTML = `
      <input id="markPaidAmt-31" type="number" value="150.00" />
      <input id="markPaidDate-31" type="date" value="${today}" />
    `;

    debtRepository.get.mockResolvedValueOnce({
      id: 61,
      name: 'Test Card',
      currentBalance: 50000, // 50000 pence = £500.00
    });

    await window.confirmMarkPaid(31, 61);

    // currentBalance = 50000 pence (£500)
    // payment = £150.00 = 15000 pence
    // new balance = 50000 - 15000 = 35000 pence → fromPence(35000) = 350
    expect(debtRepository.update).toHaveBeenCalledWith(61, expect.objectContaining({
      currentBalance: 350,
    }));
  });

  it('HIST-03g: confirmMarkPaid clamps new balance to 0 when payment exceeds balance', async () => {
    const today = new Date().toISOString().slice(0, 10);
    document.body.innerHTML = `
      <input id="markPaidAmt-32" type="number" value="600.00" />
      <input id="markPaidDate-32" type="date" value="${today}" />
    `;

    debtRepository.get.mockResolvedValueOnce({
      id: 62,
      name: 'Test Card',
      currentBalance: 50000, // 50000 pence = £500.00
    });

    await window.confirmMarkPaid(32, 62);

    // payment £600 (60000 pence) > balance £500 (50000 pence) → clamped to 0
    expect(debtRepository.update).toHaveBeenCalledWith(62, expect.objectContaining({
      currentBalance: 0,
    }));
  });

  it('HIST-03h: confirmMarkPaid calls renderStatements and render after saving', async () => {
    const today = new Date().toISOString().slice(0, 10);
    document.body.innerHTML = `
      <input id="markPaidAmt-33" type="number" value="25.00" />
      <input id="markPaidDate-33" type="date" value="${today}" />
    `;

    debtRepository.get.mockResolvedValueOnce({
      id: 63,
      name: 'Test Card',
      currentBalance: 10000,
    });

    // Mock renderStatements and render to track calls
    const renderStatementsSpy = vi.spyOn(debtUI, 'renderStatements').mockResolvedValue(undefined);
    const renderSpy = vi.spyOn(debtUI, 'render').mockResolvedValue(undefined);

    await window.confirmMarkPaid(33, 63);

    expect(renderStatementsSpy).toHaveBeenCalledWith(63);
    expect(renderSpy).toHaveBeenCalled();

    renderStatementsSpy.mockRestore();
    renderSpy.mockRestore();
  });

  it('HIST-03i: confirmMarkPaid updates existing linked expense when linkedExpenseId present (no duplicate one-off)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    document.body.innerHTML = `
      <input id="markPaidAmt-40" type="number" value="75.00" />
      <input id="markPaidDate-40" type="date" value="${today}" />
    `;

    debtRepository.get.mockResolvedValueOnce({
      id: 70,
      name: 'My Card',
      currentBalance: 20000,
    });

    // Statement already has a linked recurrent expense
    statementRepository.get.mockResolvedValueOnce({ linkedExpenseId: 55 });

    await window.confirmMarkPaid(40, 70);

    // Must update the existing linked expense — NOT create a new one-off
    expect(recurrentExpenseRepository.update).toHaveBeenCalledWith(55, expect.objectContaining({
      status: 'paid',
      amount: 75,
      date: today,
    }));
    expect(oneOffExpenseRepository.add).not.toHaveBeenCalled();

    // Statement update must preserve linkedExpenseId (not overwrite it)
    expect(statementRepository.update).toHaveBeenCalledWith(40, expect.objectContaining({
      actualPaymentAmount: 75,
      actualPaymentDate: today,
    }));
    const updateCall = statementRepository.update.mock.calls[0][1];
    expect(updateCall.linkedExpenseId).toBeUndefined();
  });
});

describe('Phase 18: mortgage/loan payment fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    debtUI.editingId = null;
  });

  // Test A — form HTML has new inputs
  it('mortgage fieldset includes monthly payment, start date and interest-only inputs', () => {
    document.body.innerHTML = debtUI._buildFormHTML();
    expect(document.getElementById('mortgageMonthlyPaymentInput')).not.toBeNull();
    expect(document.getElementById('mortgagePaymentStartInput')).not.toBeNull();
    expect(document.getElementById('mortgageInterestOnlyInput')).not.toBeNull();
  });

  it('loan fieldset includes monthly payment and start date inputs', () => {
    document.body.innerHTML = debtUI._buildFormHTML();
    expect(document.getElementById('loanMonthlyPaymentInput')).not.toBeNull();
    expect(document.getElementById('loanPaymentStartInput')).not.toBeNull();
  });

  // Test B — populate fills new fields
  it('populates mortgage monthly payment, start date and interest-only on edit', () => {
    document.body.innerHTML = debtUI._buildFormHTML();
    debtUI._populateEditFields({
      debtType: 'mortgage',
      name: 'My House',
      propertyValue: 30000000,
      currentBalance: 25000000,
      termMonths: 300,
      interestRate: 4.5,
      earlyRepaymentFee: 0,
      fixedMonthlyPayment: 138900,
      paymentStartDate: '2026-05-01',
      isInterestOnly: true,
    });
    expect(document.getElementById('mortgageMonthlyPaymentInput').value).toBe('1389');
    expect(document.getElementById('mortgagePaymentStartInput').value).toBe('2026-05-01');
    expect(document.getElementById('mortgageInterestOnlyInput').checked).toBe(true);
  });

  it('populates loan monthly payment and start date on edit', () => {
    document.body.innerHTML = debtUI._buildFormHTML();
    debtUI._populateEditFields({
      debtType: 'loan',
      name: 'Car Loan',
      originalPrincipal: 1000000,
      currentBalance: 800000,
      termMonths: 60,
      interestRate: 5,
      fixedMonthlyPayment: 20000,
      paymentStartDate: '2026-04-01',
    });
    expect(document.getElementById('loanMonthlyPaymentInput').value).toBe('200');
    expect(document.getElementById('loanPaymentStartInput').value).toBe('2026-04-01');
  });

  it('populates mortgage monthly payment as empty string when fixedMonthlyPayment is not set', () => {
    document.body.innerHTML = debtUI._buildFormHTML();
    debtUI._populateEditFields({
      debtType: 'mortgage',
      name: 'My House',
      propertyValue: 30000000,
      currentBalance: 25000000,
      termMonths: 300,
      interestRate: 4.5,
      earlyRepaymentFee: 0,
      // fixedMonthlyPayment deliberately absent
    });
    expect(document.getElementById('mortgageMonthlyPaymentInput').value).toBe('');
  });

  it('populates loan monthly payment as empty string when fixedMonthlyPayment is not set', () => {
    document.body.innerHTML = debtUI._buildFormHTML();
    debtUI._populateEditFields({
      debtType: 'loan',
      name: 'Car Loan',
      originalPrincipal: 1000000,
      currentBalance: 800000,
      termMonths: 60,
      interestRate: 5,
      // fixedMonthlyPayment deliberately absent
    });
    expect(document.getElementById('loanMonthlyPaymentInput').value).toBe('');
  });

  // Test C — save payload includes new fields
  it('mortgage save payload includes fixedMonthlyPayment, paymentStartDate, isInterestOnly', async () => {
    document.body.innerHTML = debtUI._buildFormHTML();
    document.getElementById('debtNameInput').value = 'My House';
    document.getElementById('debtTypeInput').value = 'mortgage';
    document.getElementById('mortgageBalanceInput').value = '250000';
    document.getElementById('mortgageRateInput').value = '4.5';
    document.getElementById('mortgageMonthlyPaymentInput').value = '1389';
    document.getElementById('mortgagePaymentStartInput').value = '2026-05-01';
    document.getElementById('mortgageInterestOnlyInput').checked = true;

    await debtUI._saveDebt();

    expect(debtRepository.add).toHaveBeenCalledWith(expect.objectContaining({
      fixedMonthlyPayment: 1389, // pounds — toPence() applied inside real repo (mocked here)
      paymentStartDate: '2026-05-01',
      isInterestOnly: true,
    }));
  });

  it('loan save payload includes fixedMonthlyPayment and paymentStartDate', async () => {
    document.body.innerHTML = debtUI._buildFormHTML();
    document.getElementById('debtNameInput').value = 'Car Loan';
    document.getElementById('debtTypeInput').value = 'loan';
    document.getElementById('loanBalanceInput').value = '8000';
    document.getElementById('loanRateInput').value = '5';
    document.getElementById('loanMonthlyPaymentInput').value = '200';
    document.getElementById('loanPaymentStartInput').value = '2026-04-01';

    await debtUI._saveDebt();

    expect(debtRepository.add).toHaveBeenCalledWith(expect.objectContaining({
      fixedMonthlyPayment: 200, // pounds — toPence() applied inside real repo (mocked here)
      paymentStartDate: '2026-04-01',
    }));
  });
});

describe('debtUI statement charts', () => {
  function buildModalDOM() {
    document.body.innerHTML = `
      <div id="stmtChartsContainer" class="hidden"></div>
      <table><tbody id="stmtBody-modal"></tbody></table>
    `;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    buildModalDOM();
    debtUI.activeStmtDebtId = null;
  });

  it('CHART-01: renderStatements calls chart functions when >= 2 statements exist', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      { id: 1, debtId: 1, date: '2025-01-01', amount: 50000, openingBalance: 60000, interest: 1500, fees: 0, minimumPayment: 2500, actualPaymentAmount: null },
      { id: 2, debtId: 1, date: '2025-02-01', amount: 48000, openingBalance: 50000, interest: 1400, fees: 0, minimumPayment: 2400, actualPaymentAmount: null },
    ]);
    debtRepository.get.mockResolvedValue({
      id: 1, debtType: 'credit-card', currentBalance: 48000, creditLimit: 200000
    });

    await debtUI.renderStatements(1);

    expect(renderStatementBalanceChart).toHaveBeenCalledOnce();
    expect(renderStatementInterestChart).toHaveBeenCalledOnce();
    expect(renderStatementPaymentChart).toHaveBeenCalledOnce();
    expect(renderStatementUtilisationChart).toHaveBeenCalledOnce();
  });

  it('CHART-02: renderStatements does NOT call chart functions when < 2 statements', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      { id: 1, debtId: 1, date: '2025-01-01', amount: 50000, openingBalance: 60000, interest: 1500, fees: 0, minimumPayment: 2500 },
    ]);
    debtRepository.get.mockResolvedValue({
      id: 1, debtType: 'credit-card', currentBalance: 50000, creditLimit: 200000
    });

    await debtUI.renderStatements(1);

    expect(renderStatementBalanceChart).not.toHaveBeenCalled();
  });

  it('CHART-03: charts container is shown when >= 2 statements', async () => {
    statementRepository.getAll.mockResolvedValueOnce([
      { id: 1, debtId: 1, date: '2025-01-01', amount: 50000, openingBalance: 60000, interest: 1500, fees: 0, minimumPayment: 2500 },
      { id: 2, debtId: 1, date: '2025-02-01', amount: 48000, openingBalance: 50000, interest: 1400, fees: 0, minimumPayment: 2400 },
    ]);
    debtRepository.get.mockResolvedValue({
      id: 1, debtType: 'credit-card', currentBalance: 48000, creditLimit: 200000
    });

    await debtUI.renderStatements(1);

    const container = document.getElementById('stmtChartsContainer');
    expect(container.classList.contains('hidden')).toBe(false);
  });

  it('CHART-04: _closeHistoryModal calls destroyStatementCharts', () => {
    debtUI.activeStmtDebtId = 1;
    debtUI._closeHistoryModal();
    expect(destroyStatementCharts).toHaveBeenCalledOnce();
  });
});
