import {
  incomeRepository
} from '../db/repository.js';
import { formatGBP } from '../utils/currency.js';
import { safeHTML } from './render.js';

/**
 * Transaction UI Module
 * Handles rendering and event handling for Income transactions only.
 * Fixed and Variable expenses have been consolidated into expensesUI (src/ui/expenses.js).
 */
export const transactionUI = {
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM

  /**
   * Initialize Transaction UI.
   * Sets up event listeners and performs initial render.
   */
  async init() {
    this.setupEventListeners();
    window.addEventListener('app:refresh', () => this.render());
    await this.render();
  },

  /**
   * Set up event listeners for income management.
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

    // Global delete handler for income rows
    window.deleteTransaction = async (type, id) => {
      if (!confirm(`Are you sure you want to delete this ${type} entry?`)) return;

      try {
        if (type === 'income') await incomeRepository.delete(id);
        await this.render();
      } catch (error) {
        console.error(`Failed to delete ${type}:`, error);
        alert(`Failed to delete ${type}: ` + error.message);
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

  /**
   * Render income list for the current month.
   * @param {string} [month] - Optional YYYY-MM override
   */
  async render(month) {
    if (month) this.currentMonth = month;
    await this.renderIncome(this.currentMonth);
  },

  async renderIncome(month) {
    const items = await incomeRepository.getThreeMonthHistory(month);
    const body = document.getElementById('incBody');
    if (!body) return;

    if (items.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="hint" style="text-align:center">No income in the last 3 months.</td></tr>';
      this.updateTotal('income', 0);
      return;
    }

    // Group items by YYYY-MM, sorted month descending
    const grouped = {};
    for (const item of items) {
      const monthKey = item.date.slice(0, 7); // YYYY-MM
      if (!grouped[monthKey]) grouped[monthKey] = [];
      grouped[monthKey].push(item);
    }

    const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    let grandTotal = 0;
    const rows = [];

    for (const monthKey of sortedMonths) {
      const monthItems = grouped[monthKey].sort((a, b) => b.date.localeCompare(a.date));
      const monthTotal = monthItems.reduce((sum, i) => sum + i.amount, 0);
      grandTotal += monthTotal;

      // Month header row
      const monthLabel = new Date(`${monthKey}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      rows.push(`
        <tr>
          <td colspan="4" style="padding:8px 6px 4px;font-weight:600;font-size:.8rem;color:var(--text-soft);background:var(--bg-alt)">
            ${monthLabel} — ${formatGBP(monthTotal)}
          </td>
        </tr>
      `);

      // Data rows for this month
      rows.push(...monthItems.map(item => safeHTML`
        <tr>
          <td>${item.date}</td>
          <td>${item.source}</td>
          <td class="r">${formatGBP(item.amount)}</td>
          <td class="r">
            <button class="sm danger" onclick="deleteTransaction('income', ${item.id})">✕</button>
          </td>
        </tr>
      `));
    }

    body.innerHTML = rows.join('');
    this.updateTotal('income', grandTotal);
  },

  updateTotal(type, totalPence) {
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
