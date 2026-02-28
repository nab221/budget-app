import { debtRepository, statementRepository } from '../db/repository.js';
import { formatGBP, toPence, fromPence } from '../utils/currency.js';
import { calcMinPayment, calcUtilization } from '../utils/finance.js';
import { safeHTML } from './render.js';

/**
 * Debt UI Module
 * Handles rendering and event handling for Debts and Statements.
 */
export const debtUI = {
  /**
   * Initialize Debt UI.
   */
  async init() {
    this.setupEventListeners();
    await this.render();
  },

  /**
   * Set up event listeners for debt management.
   */
  setupEventListeners() {
    const addDebtBtn = document.getElementById('addDebtBtn');
    if (addDebtBtn) {
      addDebtBtn.addEventListener('click', () => this.handleAddDebt());
    }

    const addStmtBtn = document.getElementById('addStmtBtn');
    if (addStmtBtn) {
      addStmtBtn.addEventListener('click', () => this.handleAddStatement());
    }

    // Global handlers
    window.deleteDebt = async (id) => {
      if (!confirm('Are you sure you want to delete this debt? All statements will be lost.')) return;
      try {
        // Delete statements first
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
      await this.renderStatements(id);
      // Scroll to statement section
      document.getElementById('statementSection').scrollIntoView({ behavior: 'smooth' });
    };

    window.deleteStatement = async (id, debtId) => {
      if (!confirm('Are you sure you want to delete this statement?')) return;
      try {
        await statementRepository.delete(id);
        await this.renderStatements(debtId);
        // Note: We don't automatically update the debt balance when deleting a statement 
        // because we don't know what the previous balance was easily without more complex logic.
        // The user should manually update the debt balance if needed, or log a new statement.
        await this.render(); 
      } catch (error) {
        console.error('Failed to delete statement:', error);
      }
    };
  },

  async handleAddDebt() {
    const name = document.getElementById('debtName').value.trim();
    const type = document.getElementById('debtType').value;
    const apr = parseFloat(document.getElementById('debtApr').value);
    const limit = parseFloat(document.getElementById('debtLimit').value);
    const balance = parseFloat(document.getElementById('debtBalance').value);

    if (!name || isNaN(apr) || isNaN(balance)) {
      alert('Please fill in Name, APR, and Balance correctly.');
      return;
    }

    try {
      await debtRepository.add({
        name,
        type,
        apr,
        creditLimit: isNaN(limit) ? 0 : limit,
        currentBalance: balance
      });
      
      // Clear form
      document.getElementById('debtName').value = '';
      document.getElementById('debtApr').value = '';
      document.getElementById('debtLimit').value = '';
      document.getElementById('debtBalance').value = '';
      
      await this.render();
    } catch (error) {
      console.error('Failed to add debt:', error);
      alert('Failed to add debt: ' + error.message);
    }
  },

  async handleAddStatement() {
    const debtId = parseInt(document.getElementById('stmtDebtId').value);
    const date = document.getElementById('stmtDate').value;
    const balance = parseFloat(document.getElementById('stmtBalance').value);
    const interest = parseFloat(document.getElementById('stmtInterest').value);
    const fees = parseFloat(document.getElementById('stmtFees').value);

    if (!debtId || !date || isNaN(balance)) {
      alert('Please fill in Date and Balance.');
      return;
    }

    try {
      await statementRepository.add({
        debtId,
        date,
        amount: balance, // This is the "New Balance" as per UI
        interest: isNaN(interest) ? 0 : interest,
        fees: isNaN(fees) ? 0 : fees
      });

      // Update the main debt record's currentBalance
      await debtRepository.update(debtId, { currentBalance: balance });

      // Clear form (except debtId and date)
      document.getElementById('stmtBalance').value = '';
      document.getElementById('stmtInterest').value = '0';
      document.getElementById('stmtFees').value = '0';

      await this.renderStatements(debtId);
      await this.render();
    } catch (error) {
      console.error('Failed to log statement:', error);
      alert('Failed to log statement: ' + error.message);
    }
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

    // Render as a grid of cards for better visualization
    container.innerHTML = `
      <div class="grid3" style="margin-top:20px">
        ${debts.map(debt => {
          const utilization = calcUtilization(debt.currentBalance, debt.creditLimit);
          const minPay = calcMinPayment(debt.currentBalance, debt.apr);
          
          return safeHTML`
            <div class="card" style="border:1px solid var(--border); padding:15px; display:flex; flex-direction:column; gap:8px">
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
                  <button class="sm ghost" onclick="showStatements(${debt.id}, '${debt.name}')">History</button>
                  <button class="sm danger" onclick="deleteDebt(${debt.id})">✕</button>
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
      body.innerHTML = '<tr><td colspan="5" class="hint" style="text-align:center">No statements logged yet.</td></tr>';
      return;
    }

    // Sort by date DESC
    stmts.sort((a, b) => b.date.localeCompare(a.date));

    body.innerHTML = stmts.map(s => safeHTML`
      <tr>
        <td>${s.date}</td>
        <td class="r">${formatGBP(s.amount)}</td>
        <td class="r">${formatGBP(s.interest)}</td>
        <td class="r">${formatGBP(s.fees)}</td>
        <td class="r">
          <button class="sm danger" onclick="deleteStatement(${s.id}, ${debtId})">✕</button>
        </td>
      </tr>
    `).join('');
  }
};
