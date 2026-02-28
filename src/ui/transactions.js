import { 
  incomeRepository, 
  fixedSpendRepository, 
  variableSpendRepository,
  categoryRepository
} from '../db/repository.js';
import { formatGBP, toPence, fromPence } from '../utils/currency.js';
import { safeHTML } from './render.js';

/**
 * Transaction UI Module
 * Handles rendering and event handling for Income, Fixed, and Variable transactions.
 */
export const transactionUI = {
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM

  /**
   * Initialize Transaction UI.
   * Sets up event listeners and performs initial render.
   */
  async init() {
    this.setupEventListeners();
    await this.render();
  },

  /**
   * Set up event listeners for transaction management.
   */
  setupEventListeners() {
    const monthPicker = document.getElementById('monthPicker');
    if (monthPicker) {
      // Set default value
      monthPicker.value = this.currentMonth;
      monthPicker.addEventListener('change', async (e) => {
        this.currentMonth = e.target.value;
        await this.render();
      });
    }

    // Income Add
    const addIncBtn = document.getElementById('addIncBtn');
    if (addIncBtn) {
      addIncBtn.addEventListener('click', () => this.handleAddIncome());
    }

    // Fixed Add
    const addFixBtn = document.getElementById('addFixBtn');
    if (addFixBtn) {
      addFixBtn.addEventListener('click', () => this.handleAddFixed());
    }

    // Variable Add
    const addVarBtn = document.getElementById('addVarBtn');
    if (addVarBtn) {
      addVarBtn.addEventListener('click', () => this.handleAddVariable());
    }

    // Global delete/edit handlers (using window for simple implementation with onclick in template)
    window.deleteTransaction = async (type, id) => {
      if (!confirm(`Are you sure you want to delete this ${type} entry?`)) return;
      
      try {
        if (type === 'income') await incomeRepository.delete(id);
        if (type === 'fixed') await fixedSpendRepository.delete(id);
        if (type === 'variable') await variableSpendRepository.delete(id);
        await this.render();
      } catch (error) {
        console.error(`Failed to delete ${type}:`, error);
        alert(`Failed to delete ${type}: ` + error.message);
      }
    };

    window.toggleFixedStatus = async (id, currentStatus) => {
      try {
        const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
        await fixedSpendRepository.update(id, { status: newStatus });
        await this.render();
      } catch (error) {
        console.error('Failed to toggle status:', error);
      }
    };
  },

  async handleAddIncome() {
    const date = document.getElementById('incDate').value;
    const source = document.getElementById('incSource').value.trim();
    const amount = parseFloat(document.getElementById('incAmount').value);

    if (!date || !source || isNaN(amount)) {
      alert('Please fill in all fields correctly.');
      return;
    }

    try {
      await incomeRepository.add({ date, source, amount });
      document.getElementById('incSource').value = '';
      document.getElementById('incAmount').value = '';
      await this.render();
    } catch (error) {
      console.error('Failed to add income:', error);
      alert('Failed to add income: ' + error.message);
    }
  },

  async handleAddFixed() {
    const date = document.getElementById('fixDate').value;
    const categoryId = document.getElementById('fixCat').value;
    const label = document.getElementById('fixLabel').value.trim();
    const amount = parseFloat(document.getElementById('fixAmt').value);

    if (!date || !label || isNaN(amount)) {
      alert('Please fill in all fields correctly.');
      return;
    }

    try {
      await fixedSpendRepository.add({ 
        date, 
        categoryId: categoryId === '__other' ? null : parseInt(categoryId), 
        label, 
        amount, 
        status: 'pending' 
      });
      document.getElementById('fixLabel').value = '';
      document.getElementById('fixAmt').value = '';
      await this.render();
    } catch (error) {
      console.error('Failed to add fixed spend:', error);
      alert('Failed to add fixed spend: ' + error.message);
    }
  },

  async handleAddVariable() {
    const date = document.getElementById('varDate').value;
    const categoryId = document.getElementById('varCat').value;
    const note = document.getElementById('varNote').value.trim();
    const amount = parseFloat(document.getElementById('varAmt').value);

    if (!date || isNaN(amount)) {
      alert('Please fill in all fields correctly.');
      return;
    }

    try {
      await variableSpendRepository.add({ 
        date, 
        categoryId: categoryId === '__other' ? null : parseInt(categoryId), 
        note, 
        amount 
      });
      document.getElementById('varNote').value = '';
      document.getElementById('varAmt').value = '';
      await this.render();
    } catch (error) {
      console.error('Failed to add variable spend:', error);
      alert('Failed to add variable spend: ' + error.message);
    }
  },

  /**
   * Render all transaction lists for the current month.
   */
  async render() {
    const month = this.currentMonth;
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    await Promise.all([
      this.renderIncome(month),
      this.renderFixed(month, catMap),
      this.renderVariable(month, catMap)
    ]);
  },

  async renderIncome(month) {
    const items = await incomeRepository.getByMonth(month);
    const body = document.getElementById('incBody');
    if (!body) return;

    if (items.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="hint" style="text-align:center">No income for this month.</td></tr>';
      this.updateTotal('income', 0);
      return;
    }

    // Sort by date descending
    items.sort((a, b) => b.date.localeCompare(a.date));

    body.innerHTML = items.map(item => safeHTML`
      <tr>
        <td>${item.date}</td>
        <td>${item.source}</td>
        <td class="r">${formatGBP(item.amount)}</td>
        <td class="r">
          <button class="sm danger" onclick="deleteTransaction('income', ${item.id})">✕</button>
        </td>
      </tr>
    `).join('');

    const total = items.reduce((sum, item) => sum + item.amount, 0);
    this.updateTotal('income', total);
  },

  async renderFixed(month, catMap) {
    const items = await fixedSpendRepository.getByMonth(month);
    const body = document.getElementById('fixBody');
    if (!body) return;

    if (items.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="hint" style="text-align:center">No fixed spends for this month.</td></tr>';
      this.updateTotal('fixed', 0);
      return;
    }

    items.sort((a, b) => b.date.localeCompare(a.date));

    body.innerHTML = items.map(item => safeHTML`
      <tr class="${item.status === 'paid' ? 'paid-row' : ''}">
        <td>${item.date}</td>
        <td>${catMap[item.categoryId] || 'None'}</td>
        <td>${item.label}</td>
        <td class="r">${formatGBP(item.amount)}</td>
        <td class="r">
          <button class="sm ${item.status === 'paid' ? 'success' : 'ghost'}" onclick="toggleFixedStatus(${item.id}, '${item.status}')">
            ${item.status === 'paid' ? 'Paid' : 'Mark Paid'}
          </button>
          <button class="sm danger" onclick="deleteTransaction('fixed', ${item.id})">✕</button>
        </td>
      </tr>
    `).join('');

    const total = items.reduce((sum, item) => sum + item.amount, 0);
    this.updateTotal('fixed', total);
  },

  async renderVariable(month, catMap) {
    const items = await variableSpendRepository.getByMonth(month);
    const body = document.getElementById('varBody');
    if (!body) return;

    if (items.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="hint" style="text-align:center">No variable spends for this month.</td></tr>';
      this.updateTotal('variable', 0);
      return;
    }

    items.sort((a, b) => b.date.localeCompare(a.date));

    body.innerHTML = items.map(item => safeHTML`
      <tr>
        <td>${item.date}</td>
        <td>${catMap[item.categoryId] || 'None'}</td>
        <td>${item.note || '-'}</td>
        <td class="r">${formatGBP(item.amount)}</td>
        <td class="r">
          <button class="sm danger" onclick="deleteTransaction('variable', ${item.id})">✕</button>
        </td>
      </tr>
    `).join('');

    const total = items.reduce((sum, item) => sum + item.amount, 0);
    this.updateTotal('variable', total);
  },

  updateTotal(type, totalPence) {
    // We'll update the dashboard summary if it exists, 
    // or we could add a total row to the table.
    // For now, let's try to find or create a summary element in the panel.
    const panel = document.querySelector(`[data-panel="${type}"]`);
    if (!panel) return;

    let totalEl = panel.querySelector('.panel-total');
    if (!totalEl) {
      totalEl = document.createElement('div');
      totalEl.className = 'panel-total';
      totalEl.style.textAlign = 'right';
      totalEl.style.padding = '10px';
      totalEl.style.fontWeight = 'bold';
      totalEl.style.borderTop = '1px solid var(--border)';
      panel.appendChild(totalEl);
    }

    totalEl.innerHTML = `Total: ${formatGBP(totalPence)}`;
  }
};
