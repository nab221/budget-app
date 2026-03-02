import {
  incomeRepository,
  categoryRepository
} from '../db/repository.js';
import { formatGBP } from '../utils/currency.js';
import { safeHTML } from './render.js';
import { filterTransactions } from '../utils/filtering.js';

/**
 * Transaction UI Module
 * Handles rendering and event handling for Income transactions only.
 */
export const transactionUI = {
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  editingId: null,
  searchQuery: '',

  /**
   * Initialize Transaction UI.
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
      monthPicker.addEventListener('change', async (e) => {
        this.currentMonth = e.target.value;
        this.toggleForm(false); // Hide form on month change
        await this.render();
      });
    }

    // Toggle Add Income Form
    const addBtn = document.getElementById('addIncBtn');
    if (addBtn) {
      addBtn.onclick = () => this.toggleForm();
    }

    // Search Input
    const searchInput = document.getElementById('incSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.renderIncome(this.currentMonth);
      };
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

  /**
   * Toggles the visibility of the inline form.
   */
  toggleForm(show = true) {
    const container = document.getElementById('incomeFormContainer');
    if (!container) return;
    
    if (show) {
      container.classList.remove('hidden');
      this.renderForm();
    } else {
      container.classList.add('hidden');
      this.editingId = null;
    }
  },

  /**
   * Renders the inline form for adding or updating income.
   */
  async renderForm() {
    const container = document.getElementById('incomeFormContainer');
    if (!container) return;

    const categories = await categoryRepository.getCategories();
    let data = { 
      date: new Date().toISOString().slice(0, 10), 
      source: '', 
      amount: '', 
      categoryId: '' 
    };

    if (this.editingId) {
      const item = await incomeRepository.get(this.editingId);
      if (item) {
        data = { 
          ...item, 
          amount: (item.amount / 100).toFixed(2) 
        };
      }
    }

    const isUpdate = !!this.editingId;
    container.className = `card ${isUpdate ? 'update-mode' : ''}`;
    
    container.innerHTML = safeHTML`
      <div class="card-hd">
        <h2 style="font-size: 0.85rem; color: ${isUpdate ? 'var(--accent)' : 'var(--text-soft)'}">
          ${isUpdate ? '📝 Update Income Entry' : '➕ Add Income Entry'}
        </h2>
      </div>
      <div class="form-row">
        <div><label>Date</label><input id="incDate" type="date" value="${data.date}"/></div>
        <div><label>Source</label><input id="incSource" type="text" value="${data.source}" placeholder="e.g. Salary"/></div>
        <div><label>Category</label>
          <select id="incCat">
            <option value="">— Category —</option>
            ${categories.map(c => `<option value="${c.id}" ${Number(data.categoryId) === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div><label>Amount (£)</label><input id="incAmount" type="number" step="0.01" value="${data.amount}" placeholder="0.00"/></div>
        <div style="display:flex;align-items:flex-end;gap:8px">
          <button class="primary" onclick="transactionUI.handleSave()">${isUpdate ? 'Save Changes' : 'Add Income'}</button>
          <button class="ghost" onclick="transactionUI.cancelEdit()">${isUpdate ? 'Cancel' : 'Hide'}</button>
        </div>
      </div>
    `;

    if (isUpdate) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  /**
   * Handles saving (Add or Update) the income entry.
   */
  async handleSave() {
    const date = document.getElementById('incDate').value;
    const source = document.getElementById('incSource').value.trim();
    const categoryId = document.getElementById('incCat').value;
    const amountInput = document.getElementById('incAmount');
    const amount = parseFloat(amountInput.value);

    if (!date || !source || isNaN(amount)) {
      alert('Please fill in all fields correctly.');
      return;
    }

    try {
      const payload = { 
        date, 
        source, 
        amount, 
        categoryId: categoryId ? parseInt(categoryId) : null 
      };

      if (this.editingId) {
        await incomeRepository.update(this.editingId, payload);
        // Success feedback will be handled by renderIncome identifying the row
      } else {
        await incomeRepository.add(payload);
      }

      const savedId = this.editingId;
      this.toggleForm(false);
      await this.render();

      if (savedId) {
        const row = document.querySelector(`tr[data-id="${savedId}"]`);
        if (row) {
          row.classList.add('row-flash');
          setTimeout(() => row.classList.remove('row-flash'), 1500);
        }
      }
    } catch (error) {
      console.error('Failed to save income:', error);
      alert('Failed to save income: ' + error.message);
    }
  },

  /**
   * Cancels the current edit operation.
   */
  cancelEdit() {
    if (this.editingId) {
      if (!confirm('Discard changes to the current entry?')) return;
    }
    this.toggleForm(false);
  },

  /**
   * Enters edit mode for a specific transaction.
   */
  async editTransaction(id) {
    if (this.editingId && this.editingId !== id) {
      if (!confirm('Discard changes to the current item?')) return;
    }
    this.editingId = id;
    this.toggleForm(true);
  },

  /**
   * Render income list for the current month.
   */
  async render(month) {
    if (month) this.currentMonth = month;
    await this.renderIncome(this.currentMonth);
  },

  async renderIncome(month) {
    const allItems = await incomeRepository.getThreeMonthHistory(month);
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    
    const body = document.getElementById('incBody');
    if (!body) return;

    // Apply Filter
    const items = allItems.filter(item => {
      const matchesSearch = !this.searchQuery || 
        item.source.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (catMap[item.categoryId] || '').toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesSearch;
    });

    if (items.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="hint" style="text-align:center">No income found matching your search.</td></tr>';
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

    // Calculate total based on filtered items as per 15.3
    const filteredTotal = items.reduce((sum, i) => sum + i.amount, 0);
    const rows = [];

    for (const monthKey of sortedMonths) {
      const monthItems = grouped[monthKey].sort((a, b) => b.date.localeCompare(a.date));
      const monthTotal = monthItems.reduce((sum, i) => sum + i.amount, 0);

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
        <tr data-id="${item.id}">
          <td>${item.date}</td>
          <td>
            ${item.source} 
            ${item.categoryId ? `<span class="tag" style="margin-left:6px">${catMap[item.categoryId]}</span>` : ''}
          </td>
          <td class="r">${formatGBP(item.amount)}</td>
          <td class="r">
            <button class="sm ghost" onclick="transactionUI.editTransaction(${item.id})">Edit</button>
            <button class="sm danger" onclick="deleteTransaction('income', ${item.id})">✕</button>
          </td>
        </tr>
      `));
    }

    body.innerHTML = safeHTML`${rows.join('')}`;
    this.updateTotal('income', filteredTotal);
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

    totalEl.innerHTML = `Filtered Total: ${formatGBP(totalPence)}`;
  }
};

// Global access for inline onclick handlers
window.transactionUI = transactionUI;
