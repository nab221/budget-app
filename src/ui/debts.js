import { debtRepository, statementRepository } from '../db/repository.js';
import { formatGBP, toPence, fromPence } from '../utils/currency.js';
import { calcMinPayment, calcUtilization } from '../utils/finance.js';
import { safeHTML } from './render.js';

/**
 * Debt UI Module
 * Handles rendering and event handling for Debts and Statements.
 */
export const debtUI = {
  editingId: null,
  editingStmtId: null,

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
        document.getElementById('statementSection').classList.add('hidden');
        await this.render();
      } catch (error) {
        console.error('Failed to delete debt:', error);
        alert('Failed to delete debt: ' + error.message);
      }
    };

    window.showStatements = async (id, name) => {
      document.getElementById('stmtDebtId').value = id;
      document.getElementById('statementTitle').innerText = `Statements: ${name}`;
      document.getElementById('statementSection').classList.remove('hidden');
      
      this.toggleStmtForm(false); // Reset form when switching debts
      await this.renderStatements(id);
      document.getElementById('statementSection').scrollIntoView({ behavior: 'smooth' });
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

  async renderDebtForm() {
    const container = document.getElementById('debtFormContainer');
    if (!container) return;

    let data = {
      name: '',
      type: 'credit_card',
      apr: '',
      creditLimit: '',
      promoEndDate: '',
      postPromoApr: ''
    };

    if (this.editingId) {
      const debt = await debtRepository.get(this.editingId);
      if (debt) data = { ...debt, creditLimit: fromPence(debt.creditLimit) };
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
        <div><label>Name</label><input id="debtNameInput" type="text" value="${data.name}" placeholder="e.g. TSB Anderson"/></div>
        <div>
          <label>Type</label>
          <select id="debtTypeInput">
            <option value="credit_card" ${data.type === 'credit_card' ? 'selected' : ''}>Credit Card</option>
            <option value="loan" ${data.type === 'loan' ? 'selected' : ''}>Loan</option>
            <option value="overdraft" ${data.type === 'overdraft' ? 'selected' : ''}>Overdraft</option>
            <option value="mortgage" ${data.type === 'mortgage' ? 'selected' : ''}>Mortgage</option>
            <option value="other" ${data.type === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div><label>APR (%)</label><input id="debtAprInput" type="number" step="0.1" value="${data.apr}"/></div>
        <div><label>Limit (£)</label><input id="debtLimitInput" type="number" step="0.01" value="${data.creditLimit}"/></div>
      </div>
      <div class="form-row">
        <div><label>Promo End</label><input id="debtPromoEndInput" type="date" value="${data.promoEndDate || ''}"/></div>
        <div><label>Post-Promo APR (%)</label><input id="debtPostAprInput" type="number" step="0.1" value="${data.postPromoApr || data.apr}"/></div>
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
    const type = document.getElementById('debtTypeInput').value;
    const apr = parseFloat(document.getElementById('debtAprInput').value);
    const limit = parseFloat(document.getElementById('debtLimitInput').value);
    const promoEnd = document.getElementById('debtPromoEndInput').value;
    const postApr = parseFloat(document.getElementById('debtPostAprInput').value);

    if (!name || isNaN(apr)) {
      alert('Please fill in Name and APR correctly.');
      return;
    }

    try {
      const payload = {
        name,
        type,
        apr,
        creditLimit: isNaN(limit) ? 0 : limit,
        promoEndDate: promoEnd || null,
        postPromoApr: isNaN(postApr) ? apr : postApr
      };

      if (this.editingId) {
        await debtRepository.update(this.editingId, payload);
      } else {
        await debtRepository.add({ ...payload, currentBalance: 0 });
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

    const debtId = parseInt(document.getElementById('stmtDebtId').value);
    
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
    const debtId = parseInt(document.getElementById('stmtDebtId').value);
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
   * Render the list of debts.
   */
  async render() {
    const debts = await debtRepository.getAll();
    const container = document.getElementById('debtList');
    if (!container) return;

    if (debts.length === 0) {
      container.innerHTML = '<div class="hint" style="text-align:center; padding:20px">No debts tracked yet.</div>';
      return;
    }

    container.innerHTML = `
      <div class="grid3" style="margin-top:20px">
        ${debts.map(debt => {
          const utilization = calcUtilization(debt.currentBalance, debt.creditLimit);
          const minPay = calcMinPayment(debt.currentBalance, debt.apr);
          
          return safeHTML`
            <div class="card clickable-card" 
                 onclick="debtUI.editDebt(${debt.id})"
                 style="border:1px solid var(--border); padding:15px; display:flex; flex-direction:column; gap:8px; cursor:pointer; position:relative">
              <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <h3 style="margin:0; font-size:1.1rem">${debt.name}</h3>
                <span class="pill" style="font-size:0.7rem">${debt.type.replace('_', ' ')}</span>
              </div>
              
              <div style="font-size:1.4rem; font-weight:bold; margin:5px 0">
                ${formatGBP(debt.currentBalance)}
              </div>
              
              <div class="grid2" style="font-size:0.85rem; color:var(--text-soft)">
                <div>APR: ${debt.apr}%</div>
                <div class="r">Limit: ${debt.creditLimit > 0 ? formatGBP(debt.creditLimit) : 'N/A'}</div>
              </div>

              ${debt.promoEndDate ? `
                <div style="font-size:0.75rem; color:var(--warn); margin-top:4px">
                  Promo ends: ${debt.promoEndDate} (${debt.postPromoApr}%)
                </div>
              ` : ''}
              
              ${debt.creditLimit > 0 ? `
                <div style="height:6px; background:var(--bg-alt); border-radius:3px; overflow:hidden; margin-top:4px">
                  <div style="height:100%; width:${Math.min(utilization, 100)}%; background:${utilization > 90 ? 'var(--danger)' : utilization > 50 ? 'var(--warn)' : 'var(--success)'}"></div>
                </div>
                <div style="font-size:0.75rem; text-align:right">${utilization.toFixed(1)}% used</div>
              ` : ''}
              
              <div style="margin-top:auto; padding-top:10px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center">
                <div style="font-size:0.85rem">
                  Est. Min: <strong>${formatGBP(minPay)}</strong>
                </div>
                <div style="display:flex; gap:5px">
                  <button class="sm ghost" onclick="event.stopPropagation(); showStatements(${debt.id}, '${debt.name}')">History</button>
                  <button class="sm danger" onclick="event.stopPropagation(); deleteDebt(${debt.id})">✕</button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  /**
   * Render the statement history for a specific debt.
   */
  async renderStatements(debtId) {
    const allStmts = await statementRepository.getAll();
    const stmts = allStmts.filter(s => s.debtId === debtId);
    const body = document.getElementById('stmtBody');
    if (!body) return;

    if (stmts.length === 0) {
      body.innerHTML = '<tr><td colspan="7" class="hint" style="text-align:center">No statements logged yet.</td></tr>';
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
