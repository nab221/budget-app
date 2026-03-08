import { debtRepository, statementRepository, incomeRepository, categoryRepository } from '../db/repository.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { calcMinPayment, calcUtilization, simulatePayoff } from '../utils/finance.js';
import { safeHTML, renderTabSummary, modalUI } from './render.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';

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
  // Phase 12: personal loan fieldset
  loanOriginal:          'loanOriginalInput',
  loanBalance:           'loanBalanceInput',
  loanTerm:              'loanTermInput',
  loanRate:              'loanRateInput',
  // Phase 12: other fieldset
  otherBalance:          'otherBalanceInput',
};

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
      set(FIELD_IDS.ccBalance,    fromPence(debt.currentBalance));
      set(FIELD_IDS.ccApr,        debt.apr);
      set(FIELD_IDS.ccLimit,      fromPence(debt.creditLimit));
      set(FIELD_IDS.ccMinPayment, debt.minPayment ?? '');
      set(FIELD_IDS.ccPromoEnd,   debt.promoEndDate ?? '');
      set(FIELD_IDS.ccPostApr,    debt.postPromoApr ?? debt.apr);
    } else if (type === 'mortgage') {
      set(FIELD_IDS.mortgagePropertyValue, fromPence(debt.propertyValue ?? 0));
      set(FIELD_IDS.mortgageBalance,       fromPence(debt.currentBalance));
      set(FIELD_IDS.mortgageTerm,          debt.termMonths);
      set(FIELD_IDS.mortgageRate,          debt.interestRate);
      set(FIELD_IDS.mortgageErc,           fromPence(debt.earlyRepaymentFee ?? 0));
    } else if (type === 'loan') {
      set(FIELD_IDS.loanOriginal, fromPence(debt.originalPrincipal ?? 0));
      set(FIELD_IDS.loanBalance,  fromPence(debt.currentBalance));
      set(FIELD_IDS.loanTerm,     debt.termMonths);
      set(FIELD_IDS.loanRate,     debt.interestRate);
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
        minPayment: val(FIELD_IDS.ccMinPayment),
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
        apr: rate, // Sync for strategy sorting
        earlyRepaymentFee: val(FIELD_IDS.mortgageErc)
      };
    } else if (type === 'loan') {
      const rate = val(FIELD_IDS.loanRate);
      payload = {
        ...payload,
        originalPrincipal: val(FIELD_IDS.loanOriginal),
        currentBalance: val(FIELD_IDS.loanBalance),
        termMonths: parseInt(document.getElementById(FIELD_IDS.loanTerm)?.value) || 0,
        interestRate: rate,
        apr: rate // Sync for strategy sorting
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
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.ccBalance}">Current Balance (£)</label>
            <input id="${FIELD_IDS.ccBalance}" type="number" step="0.01"/>
          </div>
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
            <label for="${FIELD_IDS.ccMinPayment}">Min Monthly Payment (£)</label>
            <input id="${FIELD_IDS.ccMinPayment}" type="number" step="0.01"/>
          </div>
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
      </div>

      <div id="fieldset-other" class="hidden">
        <div class="form-row">
          <div>
            <label for="${FIELD_IDS.otherBalance}">Current Balance (£)</label>
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
      paymentDueDate: ''
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
          minimumPayment: fromPence(stmt.minimumPayment).toFixed(2)
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
        paymentDueDate: dueDate || null
      };

      if (this.editingStmtId) {
        await statementRepository.update(this.editingStmtId, payload);
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

    await this.toggleStmtForm(debtId, true);
    
    const container = document.getElementById('stmtFormContainer-modal') || document.getElementById(`stmtFormContainer-${debtId}`);
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

    // Scroll hint: visible on open, fades after 2s
    const wrapper = document.getElementById('stmtTableWrapper');
    if (wrapper) {
      wrapper.classList.add('scroll-hint-visible');
      setTimeout(() => wrapper.classList.remove('scroll-hint-visible'), 2000);
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
    modalUI.close();
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

      <style>
        .stmt-tbl th, .stmt-tbl td { white-space: nowrap; padding: 4px 6px; }
        .stmt-tbl th:first-child, .stmt-tbl td:first-child { position: sticky; left: 0; z-index: 2; background: var(--bg); }
        .stmt-tbl th:last-child, .stmt-tbl td:last-child { position: sticky; right: 0; z-index: 2; background: var(--bg); }
        .scroll-hint-visible::after { content: '→ scroll'; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); opacity: 1; transition: opacity 0.5s; font-size: 0.75rem; color: var(--text-soft); pointer-events: none; }
      </style>

      <div id="stmtTableWrapper" style="overflow-x:auto; overflow-y:visible; position:relative">
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
        <td class="r nw">
          <button class="sm ghost" title="Edit statement" onclick="debtUI.editStatement(${s.id}, ${debtId})">✏️</button>
          <button class="sm danger" onclick="deleteStatement(${s.id}, ${debtId})">✕</button>
        </td>
      </tr>
    `).join('');
  }
};

window.debtUI = debtUI;
