import { debtRepository, statementRepository, recurrentExpenseRepository, incomeRepository, categoryRepository, oneOffExpenseRepository } from '../db/repository.js';
import { db } from '../db/schema.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { calcMinPayment, calcUtilization, simulatePayoff } from '../utils/finance.js';
import { safeHTML, renderTabSummary, modalUI } from './render.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';
import {
  renderStatementBalanceChart,
  renderStatementInterestChart,
  renderStatementPaymentChart,
  renderStatementUtilisationChart,
  destroyStatementCharts,
} from './charts.js';

const FIELD_IDS = {
  name: 'debtNameInput',
  type: 'debtTypeInput',
  // Phase 12: credit card fieldset
  ccBalance:             'ccBalanceInput',
  ccApr:                 'ccAprInput',
  ccLimit:               'ccLimitInput',
  ccMinPayment:          'ccMinPaymentInput',
  ccPromoEnd:            'ccPromoEndInput',
  ccPostApr:             'ccPostAprInput',
  // Phase 12: mortgage fieldset
  mortgagePropertyValue: 'mortgagePropertyValueInput',
  mortgageBalance:       'mortgageBalanceInput',
  mortgageTerm:          'mortgageTermInput',
  mortgageRate:          'mortgageRateInput',
  mortgageErc:           'mortgageErcInput',
  // Phase 18: loan/mortgage monthly payment & start date
  mortgageMonthlyPayment: 'mortgageMonthlyPaymentInput',
  mortgagePaymentStart:   'mortgagePaymentStartInput',
  mortgageInterestOnly:   'mortgageInterestOnlyInput',
  // Phase 12: personal loan fieldset
  loanOriginal:          'loanOriginalInput',
  loanBalance:           'loanBalanceInput',
  loanTerm:              'loanTermInput',
  loanRate:              'loanRateInput',
  // Phase 18: loan monthly payment & start date
  loanMonthlyPayment:     'loanMonthlyPaymentInput',
  loanPaymentStart:       'loanPaymentStartInput',
  // Phase 12: other fieldset
  otherBalance:          'otherBalanceInput',
};

// Module-level storage for original td HTML during Mark Paid inline prompt
const _markPaidOriginals = new Map();

/**
 * Debt UI Module
 * Handles rendering and event handling for Debts and Statements.
 */
export const debtUI = {
  editingId: null,
  editingStmtId: null,
  activeStmtDebtId: null,

  /**
   * Initialize Debt UI.
   */
  async init() {
    modalUI.init();  // Sets up Esc key, X button, and backdrop click
    this.setupEventListeners();
    window.addEventListener('app:refresh', () => this.render());
    await this.render();
  },

  /**
   * Set up event listeners for debt management.
   */
  setupEventListeners() {
    const addDebtBtn = document.getElementById('addDebtBtn');
    if (addDebtBtn) {
      addDebtBtn.onclick = () => this.openDebtModal();
    }

    const stmtPdfFile = document.getElementById('stmtPdfFile');
    if (stmtPdfFile) {
      stmtPdfFile.onchange = async (e) => {
        const file = e.target.files[0];
        if (file && window.pdfImportUI) {
          await window.pdfImportUI.handleStatementUpload(file);
        }
        e.target.value = ''; // Reset for next use
      };
    }

    // Global handlers
    window.deleteDebt = async (id) => {
      if (!confirm('Are you sure you want to delete this debt? All statements will be lost.')) return;
      try {
        const stmts = await statementRepository.getAll();
        const debtStmts = stmts.filter(s => Number(s.debtId) === Number(id));
        for (const s of debtStmts) {
          await statementRepository.delete(s.id);
        }
        await debtRepository.delete(id);
        triggerHaptic('delete');
        if (this.activeStmtDebtId === id) this.activeStmtDebtId = null;
        await this.render();
      } catch (error) {
        console.error('Failed to delete debt:', error);
        alertWithHaptic('Failed to delete debt: ' + error.message, 'error');
      }
    };

    window.deleteStatement = async (id, debtId) => {
      if (!confirm('Are you sure you want to delete this statement? The linked payment expense will also be removed.')) return;
      try {
        await statementRepository.deleteWithExpense(id);
        triggerHaptic('delete');
        
        // Update debt balance to the latest remaining statement
        const allStmts = await statementRepository.getAll();
        const debtStmts = allStmts.filter(s => s.debtId === debtId).sort((a,b) => b.date.localeCompare(a.date));
        const newBalance = debtStmts.length > 0 ? fromPence(debtStmts[0].amount) : 0;
        await debtRepository.update(debtId, { currentBalance: newBalance });

        await this.renderStatements(debtId);
        await this.render(); 
      } catch (error) {
        console.error('Failed to delete statement:', error);
      }
    };

    window.editDebt = (id) => this.editDebt(id);

    window.showMarkPaidPrompt = (stmtId, debtId, minPaymentPence) => {
      const td = document.getElementById(`mark-paid-td-${stmtId}`);
      if (!td) return;
      _markPaidOriginals.set(stmtId, td.innerHTML);
      const defaultAmount = (minPaymentPence / 100).toFixed(2);
      const today = new Date().toISOString().slice(0, 10);
      td.innerHTML =
        `<div style="display:flex;flex-direction:column;gap:2px;align-items:flex-end">` +
        `<input id="markPaidAmt-${stmtId}" type="number" step="0.01" min="0"` +
        ` value="${defaultAmount}" placeholder="Amount" style="width:80px;font-size:0.85em">` +
        `<input id="markPaidDate-${stmtId}" type="date"` +
        ` value="${today}" style="width:110px;font-size:0.85em">` +
        `<div style="display:flex;gap:4px">` +
        `<button class="sm" style="color:var(--success)" title="Confirm"` +
        ` onclick="confirmMarkPaid(${stmtId}, ${debtId})">✓ Confirm</button>` +
        `<button class="sm ghost" title="Cancel"` +
        ` onclick="cancelMarkPaid(${stmtId})">✕</button>` +
        `</div></div>`;
    };

    window.cancelMarkPaid = (stmtId) => {
      const td = document.getElementById(`mark-paid-td-${stmtId}`);
      if (td) td.innerHTML = _markPaidOriginals.get(stmtId) || '';
      _markPaidOriginals.delete(stmtId);
    };

    window.confirmMarkPaid = async (stmtId, debtId) => {
      const amtInput = document.getElementById(`markPaidAmt-${stmtId}`);
      const dateInput = document.getElementById(`markPaidDate-${stmtId}`);
      const amtPounds = parseFloat(amtInput?.value) || 0;
      const paymentDate = dateInput?.value || new Date().toISOString().slice(0, 10);

      // Get debt for name and current balance (currentBalance stored as pence in DB)
      const debt = await debtRepository.get(debtId);
      const stmt = await statementRepository.get(stmtId);

      if (stmt.linkedExpenseId) {
        // Normal case: statement already has a linked recurrent expense from addWithExpense.
        // Update it in place — do NOT create a duplicate one-off expense.
        await recurrentExpenseRepository.update(stmt.linkedExpenseId, {
          status: 'paid',
          amount: amtPounds,
          date: paymentDate
        });
        await statementRepository.update(stmtId, {
          actualPaymentAmount: amtPounds,
          actualPaymentDate: paymentDate
          // linkedExpenseId already set — do not overwrite
        });
      } else {
        // Edge case: old statement created before addWithExpense logic.
        // Fall back to creating a one-off expense.
        const debtCategory = await db.categories.where('name').equals('Credit Cards & Loans').first();
        const expenseId = await oneOffExpenseRepository.add({
          date: paymentDate,
          note: `${debt.name} - payment`,
          amount: amtPounds,
          categoryId: debtCategory ? debtCategory.id : null,
          isRecurring: false,
          isCleared: false,
          isReconciled: false,
          status: 'paid',
          isDebtPayment: true,
          linkedDebtId: debtId
        });
        await statementRepository.update(stmtId, {
          actualPaymentAmount: amtPounds,
          actualPaymentDate: paymentDate,
          linkedExpenseId: expenseId
        });
      }

      // Deduct payment from debt currentBalance (DB stores pence; pass pounds to update)
      const currentBalancePence = debt.currentBalance || 0;
      const paymentPence = Math.round(amtPounds * 100);
      const newBalancePence = Math.max(0, currentBalancePence - paymentPence);
      await debtRepository.update(debtId, { currentBalance: fromPence(newBalancePence) });

      triggerHaptic('success');

      // Re-render debts and notify other panels
      await debtUI.renderStatements(debtId);
      await debtUI.render();
      if (window.app) window.app.renderAll();
    };
  },

  async openDebtModal(id = null) {
    this.editingId = id;

    const title = id === null ? 'Add Debt Account' : 'Edit Debt Account';
    const formHTML = this._buildFormHTML();

    const buttons = [
      { label: 'Cancel', className: 'ghost', onClick: () => this._closeDebtModal() },
      { label: id === null ? 'Add' : 'Save', className: 'primary', onClick: () => this._saveDebt() },
    ];

    modalUI.show(title, formHTML, buttons);

    // MODAL-04: auto-focus name field (show() is synchronous — DOM is ready)
    document.getElementById(FIELD_IDS.name)?.focus();

    // Wire X button to _closeDebtModal so editingId is cleared (not just modalUI.close)
    if (modalUI.elements.close) {
      modalUI.elements.close.onclick = () => this._closeDebtModal();
    }

    // Wire Esc key to _closeDebtModal so editingId is cleared (mirrors X button override above).
    // modalUI.init() sets a global Esc listener that calls modalUI.close() directly — that path
    // skips editingId reset. This scoped listener intercepts Escape first, calls _closeDebtModal()
    // (which resets editingId then calls modalUI.close()), and removes itself so it does not stack
    // on subsequent openDebtModal() calls.
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        this._closeDebtModal();
      }
    };
    document.addEventListener('keydown', escHandler);

    // Phase 12: pre-select correct fieldset
    if (id !== null) {
      const debt = await debtRepository.get(id);
      if (debt?.debtType) {
        const typeSelect = document.getElementById(FIELD_IDS.type);
        if (typeSelect) typeSelect.value = debt.debtType;
      }
      this._onTypeChange();
      this._populateEditFields(debt);
    } else {
      this._onTypeChange();
    }
  },

  _populateEditFields(debt) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    };

    set(FIELD_IDS.name, debt.name);
    // type already set before _onTypeChange() call

    const type = debt.debtType;
    if (type === 'credit-card') {
      const balancePounds = fromPence(debt.currentBalance);
      set(FIELD_IDS.ccBalance, balancePounds);
      const displayEl = document.getElementById('ccBalanceDisplay');
      if (displayEl) displayEl.textContent = formatGBP(debt.currentBalance);
      set(FIELD_IDS.ccApr,      debt.apr);
      set(FIELD_IDS.ccLimit,    fromPence(debt.creditLimit));
      set(FIELD_IDS.ccPromoEnd, debt.promoEndDate ?? '');
      set(FIELD_IDS.ccPostApr,  debt.postPromoApr ?? debt.apr);
    } else if (type === 'mortgage') {
      set(FIELD_IDS.mortgagePropertyValue, fromPence(debt.propertyValue ?? 0));
      set(FIELD_IDS.mortgageBalance,       fromPence(debt.currentBalance));
      set(FIELD_IDS.mortgageTerm,          debt.termMonths);
      set(FIELD_IDS.mortgageRate,          debt.interestRate);
      set(FIELD_IDS.mortgageErc,           fromPence(debt.earlyRepaymentFee ?? 0));
      set(FIELD_IDS.mortgageMonthlyPayment, debt.fixedMonthlyPayment ? fromPence(debt.fixedMonthlyPayment) : '');
      set(FIELD_IDS.mortgagePaymentStart, debt.paymentStartDate ?? '');
      const ioCheckbox = document.getElementById(FIELD_IDS.mortgageInterestOnly);
      if (ioCheckbox) ioCheckbox.checked = !!debt.isInterestOnly;
    } else if (type === 'loan') {
      set(FIELD_IDS.loanOriginal, fromPence(debt.originalPrincipal ?? 0));
      set(FIELD_IDS.loanBalance,  fromPence(debt.currentBalance));
      set(FIELD_IDS.loanTerm,     debt.termMonths);
      set(FIELD_IDS.loanRate,     debt.interestRate);
      set(FIELD_IDS.loanMonthlyPayment, debt.fixedMonthlyPayment ? fromPence(debt.fixedMonthlyPayment) : '');
      set(FIELD_IDS.loanPaymentStart, debt.paymentStartDate ?? '');
    } else {
      set(FIELD_IDS.otherBalance, fromPence(debt.currentBalance));
    }
  },

  async _saveDebt() {
    this._clearFieldErrors();

    const name = document.getElementById(FIELD_IDS.name)?.value.trim();
    const type = document.getElementById(FIELD_IDS.type)?.value;

    let valid = true;
    if (!name) {
      this._showFieldError(FIELD_IDS.name, 'Name is required');
      valid = false;
    }

    if (!valid) return;

    let payload = { name, debtType: type };

    const val = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const str = (id) => document.getElementById(id)?.value || '';

    if (type === 'credit-card') {
      const apr = val(FIELD_IDS.ccApr);
      const postAprVal = document.getElementById(FIELD_IDS.ccPostApr)?.value;
      payload = {
        ...payload,
        currentBalance: val(FIELD_IDS.ccBalance),
        apr,
        creditLimit: val(FIELD_IDS.ccLimit),
        promoEndDate: str(FIELD_IDS.ccPromoEnd) || null,
        postPromoApr: (postAprVal === '' || postAprVal === undefined) ? apr : parseFloat(postAprVal)
      };
    } else if (type === 'mortgage') {
      const rate = val(FIELD_IDS.mortgageRate);
      payload = {
        ...payload,
        propertyValue: val(FIELD_IDS.mortgagePropertyValue),
        currentBalance: val(FIELD_IDS.mortgageBalance),
        termMonths: parseInt(document.getElementById(FIELD_IDS.mortgageTerm)?.value) || 0,
        interestRate: rate,
        apr: rate,
        earlyRepaymentFee: val(FIELD_IDS.mortgageErc),
        fixedMonthlyPayment: val(FIELD_IDS.mortgageMonthlyPayment),
        paymentStartDate: str(FIELD_IDS.mortgagePaymentStart) || null,
        isInterestOnly: document.getElementById(FIELD_IDS.mortgageInterestOnly)?.checked || false
      };
    } else if (type === 'loan') {
      const rate = val(FIELD_IDS.loanRate);
      payload = {
        ...payload,
        originalPrincipal: val(FIELD_IDS.loanOriginal),
        currentBalance: val(FIELD_IDS.loanBalance),
        termMonths: parseInt(document.getElementById(FIELD_IDS.loanTerm)?.value) || 0,
        interestRate: rate,
        apr: rate,
        fixedMonthlyPayment: val(FIELD_IDS.loanMonthlyPayment),
        paymentStartDate: str(FIELD_IDS.loanPaymentStart) || null
      };
    } else {
      payload = {
        ...payload,
        currentBalance: val(FIELD_IDS.otherBalance)
      };
    }

    try {
      if (this.editingId) {
        await debtRepository.update(this.editingId, payload);
      } else {
        await debtRepository.add(payload);
      }
      triggerHaptic('success');
      this._closeDebtModal();
      await this.render();
      if (window.app) window.app.renderAll();
    } catch (error) {
      console.error('Failed to save debt:', error);
      this._showFieldError(FIELD_IDS.name, 'Save failed: ' + error.message);
    }
  },

  _closeDebtModal() {
    this.editingId = null;
    modalUI.close();
  },

  _showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    const existing = field.parentElement?.querySelector('.field-error');
    if (existing) existing.remove();
    const span = document.createElement('span');
    span.className = 'field-error';
    span.textContent = message;
    field.insertAdjacentElement('afterend', span);
  },

  _clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.remove());
  },

  _onTypeChange() {
    const type = document.getElementById(FIELD_IDS.type)?.value;
    const fieldsets = {
      'credit-card': document.getElementById('fieldset-credit-card'),
      'mortgage':    document.getElementById('fieldset-mortgage'),
      'loan':        document.getElementById('fieldset-loan'),
      'other':       document.getElementById('fieldset-other'),
    };
    for (const [key, el] of Object.entries(fieldsets)) {
      if (!el) continue;
      el.classList[key === type ? 'remove' : 'add']('hidden');
    }
  },

  _buildFormHTML() {
    return safeHTML`
      <div class="form-row">
        <div>
          <label for="${FIELD_IDS.name}">Name</label>
          <input id="${FIELD_IDS.name}" type="text" placeholder="e.g. TSB Credit Card"/>
        </div>
        <div>
          <label for="${FIELD_IDS.type}">Type</label>
          <select id="${FIELD_IDS.type}" onchange="debtUI._onTypeChange()">
            <option value="credit-card">Credit Card</option>
            <option value="mortgage">Mortgage</option>
            <option value="loan">Personal Loan</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div id="fieldset-credit-card">
        ${this.editingId !== null
          ? `<div style="margin-bottom:10px; padding:8px 10px; background:var(--bg-alt); border-radius:6px; font-size:0.85rem">
               Current Balance: <strong id="ccBalanceDisplay">—</strong>
               <input id="${FIELD_IDS.ccBalance}" type="hidden" value="0"/>
             </div>`
          : `<p class="hint" style="margin:0 0 10px; font-size:0.85rem">
               Balance and minimum payment are tracked automatically via your statement history.
               <input id="${FIELD_IDS.ccBalance}" type="hidden" value="0"/>
             </p>`
        }
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.ccApr}">APR (%)</label>
            <input id="${FIELD_IDS.ccApr}" type="number" step="0.1"/>
          </div>
          <div>
            <label for="${FIELD_IDS.ccLimit}">Credit Limit (£)</label>
            <input id="${FIELD_IDS.ccLimit}" type="number" step="0.01"/>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.ccPromoEnd}">Promo End Date</label>
            <input id="${FIELD_IDS.ccPromoEnd}" type="date"/>
          </div>
          <div>
            <label for="${FIELD_IDS.ccPostApr}">Post-Promo APR (%)</label>
            <input id="${FIELD_IDS.ccPostApr}" type="number" step="0.1"/>
          </div>
        </div>
      </div>

      <div id="fieldset-mortgage" class="hidden">
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.mortgagePropertyValue}">Property Value (£)</label>
            <input id="${FIELD_IDS.mortgagePropertyValue}" type="number" step="0.01"/>
          </div>
          <div>
            <label for="${FIELD_IDS.mortgageBalance}">Remaining Balance (£)</label>
            <input id="${FIELD_IDS.mortgageBalance}" type="number" step="0.01"/>
          </div>
          <div>
            <label for="${FIELD_IDS.mortgageTerm}">Term (Months)</label>
            <input id="${FIELD_IDS.mortgageTerm}" type="number"/>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.mortgageRate}">Interest Rate (%)</label>
            <input id="${FIELD_IDS.mortgageRate}" type="number" step="0.1"/>
          </div>
          <div>
            <label for="${FIELD_IDS.mortgageErc}">Early Repayment Charge (£)</label>
            <input id="${FIELD_IDS.mortgageErc}" type="number" step="0.01"/>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.mortgageMonthlyPayment}">Monthly Payment (£)</label>
            <input id="${FIELD_IDS.mortgageMonthlyPayment}" type="number" step="0.01" placeholder="e.g. 1200"/>
          </div>
          <div>
            <label for="${FIELD_IDS.mortgagePaymentStart}">First Payment Date</label>
            <input id="${FIELD_IDS.mortgagePaymentStart}" type="date"/>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding-top:18px">
            <input id="${FIELD_IDS.mortgageInterestOnly}" type="checkbox"/>
            <label for="${FIELD_IDS.mortgageInterestOnly}" style="margin:0">Interest Only</label>
          </div>
        </div>
      </div>

      <div id="fieldset-loan" class="hidden">
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.loanOriginal}">Original Amount (£)</label>
            <input id="${FIELD_IDS.loanOriginal}" type="number" step="0.01"/>
          </div>
          <div>
            <label for="${FIELD_IDS.loanBalance}">Remaining Balance (£)</label>
            <input id="${FIELD_IDS.loanBalance}" type="number" step="0.01"/>
          </div>
          <div>
            <label for="${FIELD_IDS.loanTerm}">Term (Months)</label>
            <input id="${FIELD_IDS.loanTerm}" type="number"/>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.loanRate}">Interest Rate (%)</label>
            <input id="${FIELD_IDS.loanRate}" type="number" step="0.1"/>
          </div>
        </div>
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.loanMonthlyPayment}">Monthly Payment (£)</label>
            <input id="${FIELD_IDS.loanMonthlyPayment}" type="number" step="0.01" placeholder="e.g. 200"/>
          </div>
          <div>
            <label for="${FIELD_IDS.loanPaymentStart}">First Payment Date</label>
            <input id="${FIELD_IDS.loanPaymentStart}" type="date"/>
          </div>
        </div>
      </div>

      <div id="fieldset-other" class="hidden">
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.otherBalance}">Outstanding Balance (£)</label>
            <input id="${FIELD_IDS.otherBalance}" type="number" step="0.01"/>
          </div>
        </div>
      </div>
    `;
  },

  editDebt(id) {
    this.openDebtModal(id);
  },

  async toggleStmtForm(debtId, show = true) {
    if (!debtId && this.activeStmtDebtId) debtId = this.activeStmtDebtId;
    if (!debtId) return;

    // Target modal container if it exists, otherwise fallback to legacy
    const container = document.getElementById('stmtFormContainer-modal') || document.getElementById(`stmtFormContainer-${debtId}`);
    if (!container) return;

    if (show) {
      this.activeStmtDebtId = debtId;
      container.classList.remove('hidden');
      return await this.renderStmtForm(debtId);
    } else {
      container.classList.add('hidden');
      this.editingStmtId = null;
    }
  },

  async renderStmtForm(debtId) {
    const container = document.getElementById('stmtFormContainer-modal') || document.getElementById(`stmtFormContainer-${debtId}`);
    if (!container) return;
    
    // Determine suffix for input IDs (modal or debtId)
    const suffix = container.id === 'stmtFormContainer-modal' ? 'modal' : debtId;

    let data = {
      date: new Date().toISOString().slice(0, 10),
      openingBalance: '',
      amount: '',
      interest: 0,
      fees: 0,
      minimumPayment: '',
      paymentDueDate: '',
      actualPaymentAmount: '',
      actualPaymentDate: '',
      linkedExpenseId: null
    };

    if (this.editingStmtId) {
      const stmt = await statementRepository.get(this.editingStmtId);
      if (stmt) {
        data = {
          ...stmt,
          openingBalance: fromPence(stmt.openingBalance).toFixed(2),
          amount: fromPence(stmt.amount).toFixed(2),
          interest: fromPence(stmt.interest).toFixed(2),
          fees: fromPence(stmt.fees).toFixed(2),
          minimumPayment: fromPence(stmt.minimumPayment).toFixed(2),
          actualPaymentAmount: stmt.actualPaymentAmount ? fromPence(stmt.actualPaymentAmount).toFixed(2) : '',
          actualPaymentDate: stmt.actualPaymentDate || '',
          linkedExpenseId: stmt.linkedExpenseId || null
        };
      }
    } else if (debtId) {
      // Suggest opening balance from the latest statement's closing balance
      const allStmts = await statementRepository.getAll();
      const debtStmts = allStmts.filter(s => Number(s.debtId) === Number(debtId)).sort((a,b) => b.date.localeCompare(a.date));
      if (debtStmts.length > 0) {
        data.openingBalance = fromPence(debtStmts[0].amount).toFixed(2);
      }
    }

    const isUpdate = !!this.editingStmtId;
    container.className = `card ${isUpdate ? 'update-mode' : ''}`;
    container.style.border = isUpdate ? '1px solid var(--accent)' : '1px solid var(--border-light)';

    container.innerHTML = safeHTML`
      <div class="card-hd">
        <h3 style="font-size: 0.8rem; margin:0; color: ${isUpdate ? 'var(--accent)' : 'var(--text-soft)'}">
          ${isUpdate ? '📝 Update Statement' : '📄 Log Monthly Statement'}
        </h3>
      </div>
      <div class="form-row">
        <div><label>Statement Date</label><input id="stmtDateInput-${suffix}" type="date" value="${data.date}"/></div>
        <div><label>Opening Balance (£)</label><input id="stmtOpeningBalanceInput-${suffix}" type="number" step="0.01" value="${data.openingBalance}" placeholder="0.00"/></div>
        <div><label>New Balance (£)</label><input id="stmtBalanceInput-${suffix}" type="number" step="0.01" value="${data.amount}" placeholder="0.00"/></div>
      </div>
      <div class="form-row">
        <div><label>Interest (£)</label><input id="stmtInterestInput-${suffix}" type="number" step="0.01" value="${data.interest}"/></div>
        <div><label>Fees (£)</label><input id="stmtFeesInput-${suffix}" type="number" step="0.01" value="${data.fees}"/></div>
      </div>
      <div class="form-row">
        <div><label>Min Payment Due (£)</label><input id="stmtMinPaymentInput-${suffix}" type="number" step="0.01" value="${data.minimumPayment}" placeholder="0.00"/></div>
        <div><label>Payment Due Date</label><input id="stmtDueDateInput-${suffix}" type="date" value="${data.paymentDueDate || ''}"/></div>
      </div>
      <div class="form-row">
        <div><label>Paid Amount (£)</label><input id="stmtPaidAmtInput-${suffix}" type="number" step="0.01" value="${data.actualPaymentAmount}" placeholder="—" /></div>
        <div><label>Paid On</label><input id="stmtPaidDateInput-${suffix}" type="date" value="${data.actualPaymentDate || ''}"/></div>
        <div style="display:flex;align-items:flex-end;gap:8px">
          <button class="primary sm" onclick="debtUI.handleSaveStatement()">
            ${isUpdate ? 'Save Changes' : 'Log Statement'}
          </button>
          <button class="ghost sm" onclick="debtUI.cancelEditStmt()">
            ${isUpdate ? 'Cancel' : 'Hide'}
          </button>
        </div>
      </div>
    `;

    if (isUpdate) {
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  async handleSaveStatement() {
    const debtId = this.activeStmtDebtId;
    if (!debtId) return;

    const container = document.getElementById('stmtFormContainer-modal') || document.getElementById(`stmtFormContainer-${debtId}`);
    const suffix = container?.id === 'stmtFormContainer-modal' ? 'modal' : debtId;

    const date = document.getElementById(`stmtDateInput-${suffix}`).value;
    const openingBalance = parseFloat(document.getElementById(`stmtOpeningBalanceInput-${suffix}`).value);
    const balance = parseFloat(document.getElementById(`stmtBalanceInput-${suffix}`).value);
    const interest = parseFloat(document.getElementById(`stmtInterestInput-${suffix}`).value);
    const fees = parseFloat(document.getElementById(`stmtFeesInput-${suffix}`).value);
    const minPayment = parseFloat(document.getElementById(`stmtMinPaymentInput-${suffix}`).value);
    const dueDate = document.getElementById(`stmtDueDateInput-${suffix}`).value;
    const paidAmtRaw = document.getElementById(`stmtPaidAmtInput-${suffix}`)?.value;
    const paidDate = document.getElementById(`stmtPaidDateInput-${suffix}`)?.value || null;
    const paidAmt = paidAmtRaw && paidAmtRaw !== '' ? parseFloat(paidAmtRaw) : null;

    if (!date || isNaN(balance) || isNaN(openingBalance)) {
      alertWithHaptic('Please fill in Date, Opening Balance, and New Balance.', 'error');
      return;
    }

    // Continuity Validation
    if (!this.editingStmtId) {
      const allStmts = await statementRepository.getAll();
      const debtStmts = allStmts.filter(s => Number(s.debtId) === Number(debtId)).sort((a,b) => b.date.localeCompare(a.date));
      if (debtStmts.length > 0) {
        const prevClosing = fromPence(debtStmts[0].amount);
        if (Math.abs(openingBalance - prevClosing) > 0.01) {
          if (!confirm(`Warning: Opening Balance (£${openingBalance.toFixed(2)}) does not match previous Statement's Closing Balance (£${prevClosing.toFixed(2)}). Continue anyway?`)) {
            return;
          }
        }
      }
    }

    try {
      const payload = {
        debtId: Number(debtId),
        date,
        openingBalance,
        amount: balance,
        interest: isNaN(interest) ? 0 : interest,
        fees: isNaN(fees) ? 0 : fees,
        minimumPayment: isNaN(minPayment) ? 0 : minPayment,
        paymentDueDate: dueDate || null,
        actualPaymentAmount: paidAmt !== null ? paidAmt : undefined,
        actualPaymentDate: paidDate || undefined
      };

      if (this.editingStmtId) {
        // Fetch before update to get linkedExpenseId
        const existingStmt = await statementRepository.get(this.editingStmtId);
        await statementRepository.update(this.editingStmtId, payload);

        // If paid amount or date changed, sync the linked expense
        if (existingStmt?.linkedExpenseId && paidAmt !== null) {
          await oneOffExpenseRepository.update(existingStmt.linkedExpenseId, {
            amount: paidAmt,
            date: paidDate || existingStmt.actualPaymentDate
          });
        }
      } else {
        const debt = await debtRepository.get(debtId);
        await statementRepository.addWithExpense(payload, debt ? debt.name : 'Debt');
      }

      // Update the main debt record's currentBalance to reflect the latest statement
      const allStmts = await statementRepository.getAll();
      const debtStmts = allStmts.filter(s => Number(s.debtId) === Number(debtId)).sort((a,b) => b.date.localeCompare(a.date));
      if (debtStmts.length > 0) {
        await debtRepository.update(debtId, { currentBalance: fromPence(debtStmts[0].amount) });
      }

      triggerHaptic('success');
      this.toggleStmtForm(debtId, false);
      await this.renderStatements(debtId);
      await this.render();
      if (window.app) window.app.renderAll();
    } catch (error) {
      console.error('Failed to save statement:', error);
      alertWithHaptic('Failed to save statement: ' + error.message, 'error');
    }
  },

  cancelEditStmt() {
    if (this.editingStmtId && !confirm('Discard changes?')) return;
    this.toggleStmtForm(this.activeStmtDebtId, false);
  },

  async editStatement(id, debtId) {
    if (this.editingStmtId && this.editingStmtId !== id) {
      if (!confirm('Discard changes to the current item?')) return;
    }
    this.editingStmtId = id;
    this.toggleStmtForm(debtId, true);
  },

  /**
   * Pre-fills the statement form with extracted PDF data
   */
  async prefillStatementForm(summary) {
    // pdfImport sets activeStmtDebtId before triggering file input
    const debtId = this.activeStmtDebtId;
    if (!debtId) {
       alertWithHaptic('No active debt selected for import.', 'error');
       return;
    }

    // If the shared modal was replaced/closed by another flow, rebuild history UI first.
    let container = document.getElementById('stmtFormContainer-modal') || document.getElementById(`stmtFormContainer-${debtId}`);
    if (!container) {
      await this.openHistoryModal(debtId);
      container = document.getElementById('stmtFormContainer-modal') || document.getElementById(`stmtFormContainer-${debtId}`);
    }
    if (!container) {
      alertWithHaptic('Could not open statement form for pre-fill.', 'error');
      return;
    }

    await this.toggleStmtForm(debtId, true);

    const suffix = container?.id === 'stmtFormContainer-modal' ? 'modal' : debtId;

    const dateInput = document.getElementById(`stmtDateInput-${suffix}`);
    const openInput = document.getElementById(`stmtOpeningBalanceInput-${suffix}`);
    const balanceInput = document.getElementById(`stmtBalanceInput-${suffix}`);
    const minInput = document.getElementById(`stmtMinPaymentInput-${suffix}`);
    const dueInput = document.getElementById(`stmtDueDateInput-${suffix}`);

    if (summary.statementDate && dateInput) dateInput.value = summary.statementDate;
    if (summary.openingBalance !== null && openInput) openInput.value = (summary.openingBalance / 100).toFixed(2);
    if (summary.newBalance !== null && balanceInput) balanceInput.value = (summary.newBalance / 100).toFixed(2);
    if (summary.minimumPayment !== null && minInput) minInput.value = (summary.minimumPayment / 100).toFixed(2);
    if (summary.paymentDueDate && dueInput) dueInput.value = summary.paymentDueDate;

    // Pulse effect to show what was filled
    const fields = [dateInput, openInput, balanceInput, minInput, dueInput];
    fields.forEach(el => {
      if (el) {
        el.style.transition = 'background-color 0.5s';
        el.style.backgroundColor = 'var(--accent-light)';
        setTimeout(() => el.style.backgroundColor = '', 1500);
      }
    });
  },

  /**
   * Render the list of debts grouped by type.
   */
  async render() {
    const debts = await debtRepository.getAll();
    const container = document.getElementById('debtList');
    if (!container) return;

    // --- Tab Summary Calculation ---
    const totalDebtPence = debts.reduce((sum, d) => sum + (d.currentBalance || 0), 0);
    
    // Recurrent-to-Income Calculation
    const todayMonth = new Date().toISOString().slice(0, 7);
    const monthIncome = await incomeRepository.getByMonth(todayMonth);
    const totalIncomePence = monthIncome.reduce((s, i) => s + (i.amount || 0), 0);
    
    const extraMonthlyPounds = parseFloat(localStorage.getItem('payoffExtra')) || 0;
    const extraMonthlyPence = extraMonthlyPounds * 100;
    const totalMinPayments = debts.reduce((sum, d) => sum + calcMinPayment(d.currentBalance, d.apr, 0, new Date(), d.promoEndDate), 0);
    const totalRepayment = totalMinPayments + extraMonthlyPence;
    const fixedToIncomeRatio = totalIncomePence > 0 ? Math.round((totalRepayment / totalIncomePence) * 100) : 0;

    // Debt-Free Countdown Calculation
    let debtFreeText = 'No debt';
    let debtFreeColor = 'var(--accent)';
    if (debts.length > 0) {
      const savedStrategy = localStorage.getItem('budget_payoff_preference') || 'avalanche';
      const simulation = simulatePayoff(debts, savedStrategy, extraMonthlyPence);
      if (simulation.monthsToClear >= 600) {
        debtFreeText = 'Never (at min)';
        debtFreeColor = 'var(--danger)';
      } else {
        const years = Math.floor(simulation.monthsToClear / 12);
        const months = simulation.monthsToClear % 12;
        debtFreeText = years > 0 ? `${years}y ${months}m` : `${months}mo`;
        debtFreeColor = 'var(--warn)';
      }
    }

    renderTabSummary('debtsSummary', [
      { label: 'Total Debt', value: totalDebtPence, color: 'var(--danger)' },
      { label: 'Debt-Free In', value: debtFreeText, color: debtFreeColor, isRaw: true },
      { label: 'Recurrent-to-Income', value: `${fixedToIncomeRatio}%`, color: fixedToIncomeRatio > 50 ? 'var(--warn)' : 'var(--text-soft)', isRaw: true }
    ]);
    // --- End Tab Summary ---

    if (debts.length === 0) {
      container.innerHTML = '<div class="hint" style="text-align:center; padding:20px">No debts tracked yet.</div>';
      return;
    }

    const groups = {
      'Credit Cards': debts.filter(d => (d.debtType || 'credit-card') === 'credit-card'),
      'Loans & Mortgages': debts.filter(d => d.debtType === 'loan' || d.debtType === 'mortgage')
    };

    let html = '';
    for (const [groupName, groupDebts] of Object.entries(groups)) {
      if (groupDebts.length === 0) continue;

      html += `<h3 style="font-size:1rem; margin:20px 0 10px; border-bottom:1px solid var(--border-light); padding-bottom:5px">${groupName}</h3>`;
      html += `<div class="grid3">`;
      
      html += groupDebts.map(debt => {
        const type = debt.debtType || 'credit-card';
        const utilization = type === 'credit-card' ? calcUtilization(debt.currentBalance, debt.creditLimit) : 0;
        const minPay = type === 'credit-card' ? calcMinPayment(debt.currentBalance, debt.apr) : (debt.fixedMonthlyPayment || 0);
        
        let typeLabel = 'Credit Card';
        if (type === 'loan') typeLabel = 'Personal Loan';
        if (type === 'mortgage') typeLabel = 'Mortgage';

        return safeHTML`
          <div class="card clickable-card" 
               onclick="debtUI.openHistoryModal(${debt.id})"
               style="border:1px solid var(--border); padding:15px; display:flex; flex-direction:column; gap:8px; cursor:pointer; position:relative;">
            
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
              <div>
                <h3 style="margin:0; font-size:1.1rem">${debt.name}</h3>
                <div style="display:flex; gap:4px; align-items:center">
                  <span class="pill" style="font-size:0.7rem">${typeLabel}</span>
                  ${debt.isInterestOnly ? '<span class="pill" style="font-size:0.7rem; background:rgba(217,119,6,0.1); color:var(--warn); border-color:rgba(217,119,6,0.2)">Interest-Only</span>' : ''}
                </div>
              </div>
              <div style="display:flex; gap:4px">
                <button class="sm ghost" onclick="event.stopPropagation(); debtUI.editDebt(${debt.id})" title="Edit Debt Details">✏️</button>
                <button class="sm danger" onclick="event.stopPropagation(); deleteDebt(${debt.id})" title="Delete Debt">🗑</button>
              </div>
            </div>
            
            <div style="font-size:1.4rem; font-weight:bold; margin:5px 0">
              <span class="privacy-blur">${formatGBP(debt.currentBalance)}</span>
            </div>
            
            <div class="grid2" style="font-size:0.85rem; color:var(--text-soft)">
              <div>${type === 'credit-card' ? 'APR' : 'Rate'}: ${type === 'credit-card' ? debt.apr : debt.interestRate}%</div>
              <div class="r">${type === 'credit-card' ? `Limit: ${debt.creditLimit > 0 ? `<span class="privacy-blur">${formatGBP(debt.creditLimit)}</span>` : 'N/A'}` : `Term: ${debt.termMonths}mo`}</div>
            </div>

            ${type === 'credit-card' && debt.promoEndDate ? `
              <div style="font-size:0.75rem; color:var(--warn); margin-top:4px">
                Promo ends: ${debt.promoEndDate} (${debt.postPromoApr}%)
              </div>
            ` : ''}
            
            ${type === 'credit-card' && debt.creditLimit > 0 ? `
              <div style="height:6px; background:var(--bg-alt); border-radius:3px; overflow:hidden; margin-top:4px">
                <div style="height:100%; width:${Math.min(utilization, 100)}%; background:${utilization > 90 ? 'var(--danger)' : utilization > 50 ? 'var(--warn)' : 'var(--success)'}"></div>
              </div>
              <div style="font-size:0.75rem; text-align:right">${utilization.toFixed(1)}% used</div>
            ` : ''}
            
            <div style="margin-top:auto; padding-top:10px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
              <div style="font-size:0.85rem">
                ${type === 'credit-card' ? 'Est. Min:' : 'Monthly:'} <strong><span class="privacy-blur">${formatGBP(minPay)}</span></strong>
              </div>
              <div class="hint" style="font-size:0.7rem">Click to view history</div>
            </div>
          </div>
        `;
      }).join('');
      
      html += `</div>`;
    }

    container.innerHTML = html;
  },

  /**
   * Render the statement history for a specific debt in a modal.
   */
  async openHistoryModal(debtId) {
    this.activeStmtDebtId = debtId;
    const debt = await debtRepository.get(debtId);
    if (!debt) return;

    const title = `Statement History: ${debt.name}`;
    const content = this._buildHistoryModalHTML(debt);
    const footer = [
      { label: 'Close', className: 'ghost', onClick: () => this._closeHistoryModal() }
    ];

    modalUI.show(title, content, footer);

    // Scroll hint: fade in, then fade out after 2s
    const hint = document.getElementById('stmtScrollHint');
    if (hint) {
      hint.style.opacity = '1';
      setTimeout(() => { hint.style.opacity = '0'; }, 2000);
    }

    // Initial render of statements into the modal table
    await this.renderStatements(debtId);

    // Wire X button to _closeHistoryModal for cleanup
    if (modalUI.elements.close) {
      modalUI.elements.close.onclick = () => this._closeHistoryModal();
    }
  },

  _closeHistoryModal() {
    this.activeStmtDebtId = null;
    this.editingStmtId = null;
    destroyStatementCharts();
    modalUI.close();
  },

  _renderStatementCharts(stmts, debt) {
    const container = document.getElementById('stmtChartsContainer');
    if (!container) return;

    if (!stmts || stmts.length < 2) {
      container.classList.add('hidden');
      return;
    }

    // Show container and render all 4 charts
    container.classList.remove('hidden');

    // Sort chronologically (oldest first) for chart X-axis
    const sorted = [...stmts].sort((a, b) => a.date.localeCompare(b.date));

    renderStatementBalanceChart('stmt-chart-balance', sorted);
    renderStatementInterestChart('stmt-chart-interest', sorted);
    renderStatementPaymentChart('stmt-chart-payments', sorted);

    // Utilisation only relevant for credit cards with a limit
    const utilisationPanel = document.getElementById('stmt-chart-utilisation-panel');
    const showUtilisation = debt && debt.debtType === 'credit-card' && debt.creditLimit > 0;
    if (utilisationPanel) utilisationPanel.style.display = showUtilisation ? '' : 'none';
    if (showUtilisation) {
      renderStatementUtilisationChart('stmt-chart-utilisation', sorted, debt.creditLimit);
    }
  },

  _buildHistoryModalHTML(debt) {
    const type = debt.debtType || 'credit-card';
    return safeHTML`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px">
        <div style="display:flex; gap:8px">
          <button class="primary" onclick="debtUI.toggleStmtForm(${debt.id}, true)">+ Log Statement</button>
          ${type === 'credit-card' ? `<button class="ghost" onclick="debtUI.activeStmtDebtId=${debt.id}; document.getElementById('stmtPdfFile').click()">📄 Import PDF</button>` : ''}
        </div>
        <div class="hint" style="font-size:0.8rem">
          Current Balance: <strong>${formatGBP(debt.currentBalance)}</strong>
        </div>
      </div>

      <!-- Statement Form Placeholder (Inside Modal) -->
      <div id="stmtFormContainer-modal" class="card hidden" style="margin-bottom:16px; background:var(--bg-alt); border: 1px solid var(--border-light);"></div>

      <!-- Statement Analytics Charts (shown when >= 2 statements) -->
      <div id="stmtChartsContainer" class="hidden" style="margin-bottom:16px">
        <div class="grid2" style="gap:12px; margin-bottom:12px">
          <div style="background:var(--bg-alt); border:1px solid var(--border-light); border-radius:8px; padding:12px">
            <div style="font-size:0.75rem; color:var(--text-soft); margin-bottom:6px">Balance Over Time</div>
            <div style="height:160px; position:relative"><canvas id="stmt-chart-balance"></canvas></div>
          </div>
          <div style="background:var(--bg-alt); border:1px solid var(--border-light); border-radius:8px; padding:12px">
            <div style="font-size:0.75rem; color:var(--text-soft); margin-bottom:6px">Cumulative Interest &amp; Fees</div>
            <div style="height:160px; position:relative"><canvas id="stmt-chart-interest"></canvas></div>
          </div>
        </div>
        <div class="grid2" style="gap:12px">
          <div style="background:var(--bg-alt); border:1px solid var(--border-light); border-radius:8px; padding:12px">
            <div style="font-size:0.75rem; color:var(--text-soft); margin-bottom:6px">Payment Behaviour</div>
            <div style="height:160px; position:relative"><canvas id="stmt-chart-payments"></canvas></div>
          </div>
          <div id="stmt-chart-utilisation-panel" style="background:var(--bg-alt); border:1px solid var(--border-light); border-radius:8px; padding:12px">
            <div style="font-size:0.75rem; color:var(--text-soft); margin-bottom:6px">Credit Utilisation</div>
            <div style="height:160px; position:relative"><canvas id="stmt-chart-utilisation"></canvas></div>
          </div>
        </div>
      </div>

      <div style="position:relative">
        <div id="stmtScrollHint" style="position:absolute;right:0;top:0;bottom:0;width:48px;background:linear-gradient(to right,transparent,var(--bg) 70%);display:flex;align-items:center;justify-content:flex-end;padding-right:4px;pointer-events:none;font-size:0.7rem;color:var(--text-soft);opacity:0;transition:opacity 0.5s;z-index:5">→</div>
      <div id="stmtTableWrapper" style="overflow-x:auto; overflow-y:visible">
        <table class="tbl sm stmt-tbl">
          <thead>
            <tr>
              <th style="width:80px">Date</th>
              <th class="r" style="width:70px">Opening</th>
              <th class="r" style="width:70px">Closing</th>
              <th class="r" style="width:50px">Int</th>
              <th class="r" style="width:50px">Fees</th>
              <th class="r" style="width:65px">Min Due</th>
              <th style="width:80px">Due Date</th>
              <th class="r" style="width:60px">Paid</th>
              <th style="width:80px">Paid On</th>
              <th style="width:60px"></th>
            </tr>
          </thead>
          <tbody id="stmtBody-modal">
            <tr><td colspan="10" class="hint" style="text-align:center">Loading history...</td></tr>
          </tbody>
        </table>
      </div>
      </div>
    `;
  },

  /**
   * Render the statement history for a specific debt.
   */
  async renderStatements(debtId) {
    const allStmts = await statementRepository.getAll();
    const stmts = allStmts.filter(s => Number(s.debtId) === Number(debtId));
    
    // Target the modal-specific body first, fallback to legacy for safety during transition
    const container = document.getElementById('stmtBody-modal') || document.getElementById(`stmtBody-${debtId}`);
    if (!container) return;

    if (stmts.length === 0) {
      container.innerHTML = '<tr><td colspan="10" class="hint" style="text-align:center">No statements logged yet.</td></tr>';
      const chartsEl = document.getElementById('stmtChartsContainer');
      if (chartsEl) chartsEl.classList.add('hidden');
      return;
    }

    stmts.sort((a, b) => b.date.localeCompare(a.date));

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
    const abbrevGBP = (pence) => {
      if (!pence && pence !== 0) return '—';
      const pounds = pence / 100;
      return pounds >= 1000 ? `£${(pounds / 1000).toFixed(1)}k` : formatGBP(pence);
    };

    container.innerHTML = stmts.map(s => safeHTML`
      <tr>
        <td>${fmtDate(s.date)}</td>
        <td class="r">${abbrevGBP(s.openingBalance)}</td>
        <td class="r">${abbrevGBP(s.amount)}</td>
        <td class="r">${formatGBP(s.interest)}</td>
        <td class="r">${formatGBP(s.fees)}</td>
        <td class="r">${formatGBP(s.minimumPayment)}</td>
        <td>${s.paymentDueDate ? fmtDate(s.paymentDueDate) : '—'}</td>
        <td class="r" style="color:${s.actualPaymentAmount ? 'var(--success)' : 'inherit'}">
          ${s.actualPaymentAmount ? formatGBP(s.actualPaymentAmount) : '—'}
        </td>
        <td style="color:${s.actualPaymentDate ? 'var(--success)' : 'inherit'}">
          ${s.actualPaymentDate ? fmtDate(s.actualPaymentDate) : '—'}
        </td>
        <td class="r nw" id="mark-paid-td-${s.id}">
          <button class="sm ghost" title="Edit statement" onclick="debtUI.editStatement(${s.id}, ${debtId})">✏️</button>
          <button class="sm danger" onclick="deleteStatement(${s.id}, ${debtId})">✕</button>
          ${!s.actualPaymentDate ? safeHTML`<button class="sm" style="color:var(--success)" title="Mark as paid"
            onclick="showMarkPaidPrompt(${s.id}, ${debtId}, ${s.minimumPayment})">✓</button>` : ''}
        </td>
      </tr>
    `).join('');

    // Render analytics charts
    const debt = await debtRepository.get(debtId);
    await this._renderStatementCharts(stmts, debt);
  }
};

window.debtUI = debtUI;
