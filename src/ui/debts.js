import { debtRepository, statementRepository, incomeRepository } from '../db/repository.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { calcMinPayment, calcUtilization, simulatePayoff } from '../utils/finance.js';
import { safeHTML, renderTabSummary } from './render.js';

/**
 * Debt UI Module
 * Handles rendering and event handling for Debts and Statements.
 */
export const debtUI = {
  editingId: null,
  editingStmtId: null,
  openLedgerId: null,

  /**
   * Initialize Debt UI.
   */
  async init() {
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
      addDebtBtn.onclick = () => this.toggleDebtForm();
    }

    const addStmtBtn = document.getElementById('addStmtBtn');
    if (addStmtBtn) {
      addStmtBtn.onclick = () => this.toggleStmtForm();
    }

    const importStmtPdfBtn = document.getElementById('importStmtPdfBtn');
    const stmtPdfFile = document.getElementById('stmtPdfFile');
    if (importStmtPdfBtn && stmtPdfFile) {
      importStmtPdfBtn.onclick = () => stmtPdfFile.click();
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
        const debtStmts = stmts.filter(s => s.debtId === id);
        for (const s of debtStmts) {
          await statementRepository.delete(s.id);
        }
        await debtRepository.delete(id);
        if (this.openLedgerId === id) this.openLedgerId = null;
        await this.render();
      } catch (error) {
        console.error('Failed to delete debt:', error);
        alert('Failed to delete debt: ' + error.message);
      }
    };

    window.toggleLedger = async (id) => {
      const container = document.getElementById(`ledger-container-${id}`);
      if (!container) return;

      if (this.openLedgerId === id) {
        container.classList.add('hidden');
        this.openLedgerId = null;
      } else {
        // Close previously open ledger if any
        if (this.openLedgerId !== null) {
          const prev = document.getElementById(`ledger-container-${this.openLedgerId}`);
          if (prev) prev.classList.add('hidden');
        }
        
        container.classList.remove('hidden');
        this.openLedgerId = id;
        await this.renderStatements(id);
        container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    window.deleteStatement = async (id, debtId) => {
      if (!confirm('Are you sure you want to delete this statement? The linked payment expense will also be removed.')) return;
      try {
        await statementRepository.deleteWithExpense(id);
        
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

  toggleDebtForm(show = true) {
    const container = document.getElementById('debtFormContainer');
    if (!container) return;
    if (show) {
      container.classList.remove('hidden');
      this.renderDebtForm();
    } else {
      container.classList.add('hidden');
      this.editingId = null;
    }
  },

  /**
   * Toggle field visibility based on debt type.
   */
  toggleDebtTypeFields() {
    const type = document.getElementById('debtTypeInput').value;
    const ccFields = document.getElementById('ccOnlyFields');
    const loanFields = document.getElementById('loanOnlyFields');
    
    if (type === 'credit-card') {
      ccFields?.classList.remove('hidden');
      loanFields?.classList.add('hidden');
    } else if (type === 'loan' || type === 'mortgage') {
      ccFields?.classList.add('hidden');
      loanFields?.classList.remove('hidden');
    } else {
      ccFields?.classList.add('hidden');
      loanFields?.classList.add('hidden');
    }
  },

  async renderDebtForm() {
    const container = document.getElementById('debtFormContainer');
    if (!container) return;

    const categories = await categoryRepository.getCategories();
    let data = {
      name: '',
      debtType: 'credit-card',
      apr: 0,
      creditLimit: 0,
      promoEndDate: '',
      postPromoApr: 0,
      currentBalance: 0,
      // Loan specific
      isInterestOnly: false,
      originalPrincipal: 0,
      termMonths: 0,
      fixedMonthlyPayment: 0,
      interestRate: 0,
      earlyRepaymentFee: 0,
      earlyRepaymentFeeIsPercent: false,
      earlyRepaymentAllowed: true
    };

    if (this.editingId) {
      const debt = await debtRepository.get(this.editingId);
      if (debt) {
        data = { 
          ...debt, 
          creditLimit: fromPence(debt.creditLimit),
          currentBalance: fromPence(debt.currentBalance),
          originalPrincipal: fromPence(debt.originalPrincipal),
          fixedMonthlyPayment: fromPence(debt.fixedMonthlyPayment),
          earlyRepaymentFee: debt.earlyRepaymentFeeIsPercent ? debt.earlyRepaymentFee : fromPence(debt.earlyRepaymentFee)
        };
      }
    }

    const isUpdate = !!this.editingId;
    container.className = `card ${isUpdate ? 'update-mode' : ''}`;

    container.innerHTML = safeHTML`
      <div class="card-hd">
        <h2 style="font-size: 0.85rem; color: ${isUpdate ? 'var(--accent)' : 'var(--text-soft)'}">
          ${isUpdate ? '📝 Update Debt Account' : '➕ Add Debt Account'}
        </h2>
      </div>
      <div class="form-row">
        <div><label>Name</label><input id="debtNameInput" type="text" value="${data.name}" placeholder="e.g. TSB Credit Card"/></div>
        <div>
          <label>Type</label>
          <select id="debtTypeInput" onchange="debtUI.toggleDebtTypeFields()">
            <option value="credit-card" ${data.debtType === 'credit-card' ? 'selected' : ''}>Credit Card</option>
            <option value="loan" ${data.debtType === 'loan' ? 'selected' : ''}>Personal Loan</option>
            <option value="mortgage" ${data.debtType === 'mortgage' ? 'selected' : ''}>Mortgage</option>
          </select>
        </div>
      </div>

      <!-- Credit Card Specific Fields -->
      <div id="ccOnlyFields" class="${data.debtType === 'credit-card' ? '' : 'hidden'}">
        <div class="form-row">
          <div><label>Current Balance (£)</label><input id="debtBalanceInput" type="number" step="0.01" value="${data.currentBalance}"/></div>
          <div><label>APR (%)</label><input id="debtAprInput" type="number" step="0.1" value="${data.apr}"/></div>
          <div><label>Credit Limit (£)</label><input id="debtLimitInput" type="number" step="0.01" value="${data.creditLimit}"/></div>
        </div>
        <div class="form-row">
          <div><label>Promo End</label><input id="debtPromoEndInput" type="date" value="${data.promoEndDate || ''}"/></div>
          <div><label>Post-Promo APR (%)</label><input id="debtPostAprInput" type="number" step="0.1" value="${data.postPromoApr || data.apr}"/></div>
        </div>
      </div>

      <!-- Loan/Mortgage Specific Fields -->
      <div id="loanOnlyFields" class="${(data.debtType === 'loan' || data.debtType === 'mortgage') ? '' : 'hidden'}">
        <div class="form-row">
          <div><label>Original Principal (£)</label><input id="loanPrincipalInput" type="number" step="0.01" value="${data.originalPrincipal}"/></div>
          <div><label>Current Balance (£)</label><input id="loanBalanceInput" type="number" step="0.01" value="${data.currentBalance}"/></div>
          <div><label>Fixed Monthly Payment (£)</label><input id="loanPaymentInput" type="number" step="0.01" value="${data.fixedMonthlyPayment}"/></div>
        </div>
        <div class="form-row">
          <div><label>Interest Rate (%)</label><input id="loanRateInput" type="number" step="0.1" value="${data.interestRate || data.apr}"/></div>
          <div><label>Term (Months)</label><input id="loanTermInput" type="number" value="${data.termMonths}"/></div>
        </div>
        <div class="form-row">
          <div>
            <label>Early Repayment Fee</label>
            <div style="display:flex; gap:4px">
              <input id="loanFeeInput" type="number" step="0.01" value="${data.earlyRepaymentFee}" style="flex:1"/>
              <select id="loanFeeTypeInput" style="width:60px">
                <option value="pounds" ${!data.earlyRepaymentFeeIsPercent ? 'selected' : ''}>£</option>
                <option value="percent" ${data.earlyRepaymentFeeIsPercent ? 'selected' : ''}>%</option>
              </select>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;padding-top:18px">
            <div style="display:flex;align-items:center;gap:6px">
              <input id="loanAllowedInput" type="checkbox" ${data.earlyRepaymentAllowed ? 'checked' : ''}/>
              <label for="loanAllowedInput" style="margin:0">Overpayment allowed</label>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <input id="loanInterestOnlyInput" type="checkbox" ${data.isInterestOnly ? 'checked' : ''}/>
              <label for="loanInterestOnlyInput" style="margin:0">Interest-Only</label>
            </div>
          </div>
        </div>

      <div class="form-row" style="margin-top:10px">
        <div style="display:flex;align-items:flex-end;gap:8px;flex:1.5">
          <button class="primary" onclick="debtUI.handleSaveDebt()">${isUpdate ? 'Save Changes' : 'Add Account'}</button>
          <button class="ghost" onclick="debtUI.cancelEditDebt()">${isUpdate ? 'Cancel' : 'Hide'}</button>
        </div>
      </div>
    `;

    if (isUpdate) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  async handleSaveDebt() {
    const name = document.getElementById('debtNameInput').value.trim();
    const debtType = document.getElementById('debtTypeInput').value;

    if (!name) {
      alert('Please provide a name for the debt account.');
      return;
    }

    try {
      let payload = { name, debtType };

      if (debtType === 'credit-card') {
        const apr = parseFloat(document.getElementById('debtAprInput').value) || 0;
        const limit = parseFloat(document.getElementById('debtLimitInput').value) || 0;
        const balance = parseFloat(document.getElementById('debtBalanceInput').value) || 0;
        const promoEnd = document.getElementById('debtPromoEndInput').value;
        const postApr = parseFloat(document.getElementById('debtPostAprInput').value);

        payload = {
          ...payload,
          apr,
          creditLimit: limit,
          currentBalance: balance,
          promoEndDate: promoEnd || null,
          postPromoApr: isNaN(postApr) ? apr : postApr
        };
      } else {
        const principal = parseFloat(document.getElementById('loanPrincipalInput').value) || 0;
        const balance = parseFloat(document.getElementById('loanBalanceInput').value) || 0;
        const payment = parseFloat(document.getElementById('loanPaymentInput').value) || 0;
        const rate = parseFloat(document.getElementById('loanRateInput').value) || 0;
        const term = parseInt(document.getElementById('loanTermInput').value) || 0;
        const fee = parseFloat(document.getElementById('loanFeeInput').value) || 0;
        const feeIsPercent = document.getElementById('loanFeeTypeInput').value === 'percent';
        const allowed = document.getElementById('loanAllowedInput').checked;
        const isInterestOnly = document.getElementById('loanInterestOnlyInput').checked;

        payload = {
          ...payload,
          originalPrincipal: principal,
          currentBalance: balance,
          fixedMonthlyPayment: payment,
          interestRate: rate,
          apr: rate, // Sync for strategy sorting
          termMonths: term,
          earlyRepaymentFee: fee,
          earlyRepaymentFeeIsPercent: feeIsPercent,
          earlyRepaymentAllowed: allowed,
          isInterestOnly: isInterestOnly
        };
      }

      if (this.editingId) {
        await debtRepository.update(this.editingId, payload);
      } else {
        await debtRepository.add(payload);
      }

      this.toggleDebtForm(false);
      await this.render();
      if (window.app) window.app.renderAll();
    } catch (error) {
      console.error('Failed to save debt:', error);
      alert('Failed to save debt: ' + error.message);
    }
  },

  cancelEditDebt() {
    if (this.editingId && !confirm('Discard changes?')) return;
    this.toggleDebtForm(false);
  },

  async editDebt(id) {
    if (this.editingId && this.editingId !== id) {
      if (!confirm('Discard changes to the current item?')) return;
    }
    this.editingId = id;
    this.toggleDebtForm(true);
  },

  async toggleStmtForm(show = true) {
    const container = document.getElementById('stmtFormContainer');
    if (!container) return;
    if (show) {
      container.classList.remove('hidden');
      return await this.renderStmtForm();
    } else {
      container.classList.add('hidden');
      this.editingStmtId = null;
    }
  },

  async renderStmtForm() {
    const container = document.getElementById('stmtFormContainer');
    if (!container) return;

    const debtIdInput = document.getElementById('stmtDebtId');
    const debtId = debtIdInput ? parseInt(debtIdInput.value) : null;
    
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
      const debtStmts = allStmts.filter(s => s.debtId === debtId).sort((a,b) => b.date.localeCompare(a.date));
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
        <div><label>Statement Date</label><input id="stmtDateInput" type="date" value="${data.date}"/></div>
        <div><label>Opening Balance (£)</label><input id="stmtOpeningBalanceInput" type="number" step="0.01" value="${data.openingBalance}" placeholder="0.00"/></div>
        <div><label>New Balance (£)</label><input id="stmtBalanceInput" type="number" step="0.01" value="${data.amount}" placeholder="0.00"/></div>
      </div>
      <div class="form-row">
        <div><label>Interest (£)</label><input id="stmtInterestInput" type="number" step="0.01" value="${data.interest}"/></div>
        <div><label>Fees (£)</label><input id="stmtFeesInput" type="number" step="0.01" value="${data.fees}"/></div>
      </div>
      <div class="form-row">
        <div><label>Min Payment Due (£)</label><input id="stmtMinPaymentInput" type="number" step="0.01" value="${data.minimumPayment}" placeholder="0.00"/></div>
        <div><label>Payment Due Date</label><input id="stmtDueDateInput" type="date" value="${data.paymentDueDate || ''}"/></div>
        <div style="display:flex;align-items:flex-end;gap:8px">
          <button class="primary sm" onclick="debtUI.handleSaveStatement()">${isUpdate ? 'Save Changes' : 'Log Statement'}</button>
          <button class="ghost sm" onclick="debtUI.cancelEditStmt()">${isUpdate ? 'Cancel' : 'Hide'}</button>
        </div>
      </div>
    `;

    if (isUpdate) {
      container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  async handleSaveStatement() {
    const debtIdInput = document.getElementById('stmtDebtId');
    const debtId = debtIdInput ? parseInt(debtIdInput.value) : null;
    const date = document.getElementById('stmtDateInput').value;
    const openingBalance = parseFloat(document.getElementById('stmtOpeningBalanceInput').value);
    const balance = parseFloat(document.getElementById('stmtBalanceInput').value);
    const interest = parseFloat(document.getElementById('stmtInterestInput').value);
    const fees = parseFloat(document.getElementById('stmtFeesInput').value);
    const minPayment = parseFloat(document.getElementById('stmtMinPaymentInput').value);
    const dueDate = document.getElementById('stmtDueDateInput').value;

    if (!debtId || !date || isNaN(balance) || isNaN(openingBalance)) {
      alert('Please fill in Date, Opening Balance, and New Balance.');
      return;
    }

    // Continuity Validation
    if (!this.editingStmtId) {
      const allStmts = await statementRepository.getAll();
      const debtStmts = allStmts.filter(s => s.debtId === debtId).sort((a,b) => b.date.localeCompare(a.date));
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
        debtId,
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
      const debtStmts = allStmts.filter(s => s.debtId === debtId).sort((a,b) => b.date.localeCompare(a.date));
      if (debtStmts.length > 0) {
        await debtRepository.update(debtId, { currentBalance: fromPence(debtStmts[0].amount) });
      }

      this.toggleStmtForm(false);
      await this.renderStatements(debtId);
      await this.render();
      if (window.app) window.app.renderAll();
    } catch (error) {
      console.error('Failed to save statement:', error);
      alert('Failed to save statement: ' + error.message);
    }
  },

  cancelEditStmt() {
    if (this.editingStmtId && !confirm('Discard changes?')) return;
    this.toggleStmtForm(false);
  },

  async editStatement(id) {
    if (this.editingStmtId && this.editingStmtId !== id) {
      if (!confirm('Discard changes to the current item?')) return;
    }
    this.editingStmtId = id;
    this.toggleStmtForm(true);
  },

  /**
 * Pre-fills the statement form with extracted PDF data
 */
async prefillStatementForm(summary) {
  await this.toggleStmtForm(true);
  
  if (summary.statementDate) document.getElementById('stmtDateInput').value = summary.statementDate;
  if (summary.openingBalance !== null) document.getElementById('stmtOpeningBalanceInput').value = (summary.openingBalance / 100).toFixed(2);
  if (summary.newBalance !== null) document.getElementById('stmtBalanceInput').value = (summary.newBalance / 100).toFixed(2);
  if (summary.minimumPayment !== null) document.getElementById('stmtMinPaymentInput').value = (summary.minimumPayment / 100).toFixed(2);
  if (summary.paymentDueDate) document.getElementById('stmtDueDateInput').value = summary.paymentDueDate;

  // Pulse effect to show what was filled
  const fields = ['stmtDateInput', 'stmtOpeningBalanceInput', 'stmtBalanceInput', 'stmtMinPaymentInput', 'stmtDueDateInput'];
  fields.forEach(id => {
    const el = document.getElementById(id);
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

        const isLedgerOpen = this.openLedgerId === debt.id;

        return safeHTML`
          <div style="display:contents">
            <div class="card clickable-card ${isLedgerOpen ? 'active' : ''}" 
                 onclick="toggleLedger(${debt.id})"
                 style="border:1px solid var(--border); padding:15px; display:flex; flex-direction:column; gap:8px; cursor:pointer; position:relative; ${isLedgerOpen ? 'border-color:var(--accent); background:var(--bg-alt);' : ''}">
              
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
                ${formatGBP(debt.currentBalance)}
              </div>
              
              <div class="grid2" style="font-size:0.85rem; color:var(--text-soft)">
                <div>${type === 'credit-card' ? 'APR' : 'Rate'}: ${type === 'credit-card' ? debt.apr : debt.interestRate}%</div>
                <div class="r">${type === 'credit-card' ? `Limit: ${debt.creditLimit > 0 ? formatGBP(debt.creditLimit) : 'N/A'}` : `Term: ${debt.termMonths}mo`}</div>
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
                  ${type === 'credit-card' ? 'Est. Min:' : 'Monthly:'} <strong>${formatGBP(minPay)}</strong>
                </div>
                <div class="hint" style="font-size:0.7rem">Click to view history</div>
              </div>
            </div>

            <!-- Inline Ledger Container -->
            <div id="ledger-container-${debt.id}" class="card ${isLedgerOpen ? '' : 'hidden'}" 
                 onclick="event.stopPropagation()"
                 style="grid-column: 1 / -1; margin-top:-10px; margin-bottom:20px; border-top:none; border-radius: 0 0 8px 8px; border: 1px solid var(--accent); background:var(--bg);">
              <div style="padding:15px">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
                  <h4 style="margin:0; font-size:0.9rem">Statement History: ${debt.name}</h4>
                  ${type === 'credit-card' ? `<button class="sm primary" onclick="document.getElementById('stmtDebtId').value=${debt.id}; debtUI.toggleStmtForm(true)">+ Log Statement</button>` : ''}
                </div>
                <div style="overflow-x:auto">
                  <table class="tbl sm">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th class="r">Opening</th>
                        <th class="r">Closing</th>
                        <th class="r">Int</th>
                        <th class="r">Fees</th>
                        <th class="r">Min Due</th>
                        <th>Due Date</th>
                        <th class="r">Paid</th>
                        <th>Paid On</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody id="stmtBody-${debt.id}">
                      <tr><td colspan="10" class="hint" style="text-align:center">Loading history...</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      html += `</div>`;
    }

    container.innerHTML = html;

    // If a ledger is open, re-render its content
    if (this.openLedgerId) {
      this.renderStatements(this.openLedgerId);
    }
  },

  /**
   * Render the statement history for a specific debt.
   */
  async renderStatements(debtId) {
    const allStmts = await statementRepository.getAll();
    const stmts = allStmts.filter(s => s.debtId === debtId);
    const body = document.getElementById(`stmtBody-${debtId}`);
    if (!body) return;

    if (stmts.length === 0) {
      body.innerHTML = '<tr><td colspan="10" class="hint" style="text-align:center">No statements logged yet.</td></tr>';
      return;
    }

    stmts.sort((a, b) => b.date.localeCompare(a.date));

    body.innerHTML = stmts.map(s => safeHTML`
      <tr>
        <td>${s.date}</td>
        <td class="r">${formatGBP(s.openingBalance)}</td>
        <td class="r">${formatGBP(s.amount)}</td>
        <td class="r">${formatGBP(s.interest)}</td>
        <td class="r">${formatGBP(s.fees)}</td>
        <td class="r">${formatGBP(s.minimumPayment)}</td>
        <td>${s.paymentDueDate || '—'}</td>
        <td class="r" style="color:${s.actualPaymentAmount ? 'var(--success)' : 'inherit'}">
          ${s.actualPaymentAmount ? formatGBP(s.actualPaymentAmount) : '—'}
        </td>
        <td style="color:${s.actualPaymentDate ? 'var(--success)' : 'inherit'}">
          ${s.actualPaymentDate || '—'}
        </td>
        <td class="r nw">
          <button class="sm ghost" onclick="debtUI.editStatement(${s.id})">Edit</button>
          <button class="sm danger" onclick="deleteStatement(${s.id}, ${debtId})">✕</button>
        </td>
      </tr>
    `).join('');
  }
};

window.debtUI = debtUI;
