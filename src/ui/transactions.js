import {
  incomeRepository,
  categoryRepository
} from '../db/repository.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { safeHTML, renderTabSummary } from './render.js';
import { filterTransactions } from '../utils/filtering.js';

/**
 * Transaction UI Module
 * Handles rendering and event handling for Income transactions only.
 */
export const transactionUI = {
  currentMonth: '', // YYYY-MM, set by initMonths
  editingId: null,
  searchQuery: '',
  selectedCategories: [], // Filter categories
  reconciliationMode: false,

  /**
   * Initialize Transaction UI.
   */
  async init() {
    this.initMonths();
    this.setupEventListeners();
    window.addEventListener('app:refresh', () => this.render());
    await this.render();
  },

  /**
   * Load current month from localStorage or default to current.
   */
  initMonths() {
    const saved = localStorage.getItem('transaction_month');
    if (saved && /^\d{4}-\d{2}$/.test(saved)) {
      this.currentMonth = saved;
    } else {
      this.currentMonth = new Date().toISOString().slice(0, 7);
    }
  },

  /**
   * Persist current month to localStorage.
   */
  setCurrentMonth(month) {
    this.currentMonth = month;
    localStorage.setItem('transaction_month', month);
  },

  /**
   * Set up event listeners for income management.
   */
  setupEventListeners() {
    // Toggle Add Income Form
    const addBtn = document.getElementById('addIncBtn');
    if (addBtn) {
      addBtn.onclick = () => this.toggleForm();
    }

    // Toggle Reconciliation Mode
    const reconBtn = document.getElementById('toggleIncReconBtn');
    if (reconBtn) {
      reconBtn.onclick = () => this.toggleReconciliationMode();
    }

    // Search Input
    const searchInput = document.getElementById('incSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render();
      };
    }

    // Navigation and Filter handlers
    window.incPrevMonth = () => {
      const [y, m] = this.currentMonth.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 2, 1));
      this.setCurrentMonth(d.toISOString().slice(0, 7));
      this.render();
    };

    window.incNextMonth = () => {
      const [y, m] = this.currentMonth.split('-').map(Number);
      const d = new Date(Date.UTC(y, m, 1));
      this.setCurrentMonth(d.toISOString().slice(0, 7));
      this.render();
    };

    window.handleIncMonthChange = (e) => {
      this.setCurrentMonth(e.target.value);
      this.render();
    };

    // Category Filter handlers
    window.toggleIncCategoryDropdown = (show) => {
      const dropdown = document.getElementById('incCategoryDropdown');
      if (dropdown) {
        dropdown.style.display = (show === undefined) 
          ? (dropdown.style.display === 'none' ? 'block' : 'none')
          : (show ? 'block' : 'none');
      }
    };

    // Global click listener to close category dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const container = document.getElementById('incCategoryFilterContainer');
      const dropdown = document.getElementById('incCategoryDropdown');
      if (container && dropdown && !container.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });

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

    window.toggleIncCleared = async (id, currentStatus) => {
      try {
        await incomeRepository.update(id, { isCleared: !currentStatus });
        await this.render();
      } catch (err) {
        console.error('Failed to toggle cleared status:', err);
      }
    };
  },

  /**
   * Toggles reconciliation mode.
   */
  toggleReconciliationMode() {
    this.reconciliationMode = !this.reconciliationMode;
    const btn = document.getElementById('toggleIncReconBtn');
    if (btn) {
      btn.textContent = this.reconciliationMode ? '✖ Exit Reconciliation' : '🔍 Reconciliation Mode';
      btn.classList.toggle('primary', this.reconciliationMode);
      btn.classList.toggle('ghost', !this.reconciliationMode);
    }
    
    const header = document.getElementById('incReconHeader');
    if (header) {
      header.classList.toggle('hidden', !this.reconciliationMode);
    }

    if (this.reconciliationMode) {
      this.toggleForm(false);
    }

    this.render();
  },

  /**
   * Handles category selection changes.
   */
  handleCategoryChange(checkbox) {
    const cid = parseInt(checkbox.value);
    if (checkbox.checked) {
      if (!this.selectedCategories.includes(cid)) this.selectedCategories.push(cid);
    } else {
      this.selectedCategories = this.selectedCategories.filter(id => id !== cid);
    }
    this.render();
  },

  /**
   * Clears the category filter.
   */
  clearCategoryFilter() {
    this.selectedCategories = [];
    this.render();
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
      if (this.reconciliationMode) this.toggleReconciliationMode();
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
    if (month) this.setCurrentMonth(month);
    await this.renderMonthPicker();
    await this.renderCategoryFilter();
    await this.renderIncome(this.currentMonth);
  },

  async renderMonthPicker() {
    const container = document.getElementById('incMonthPicker');
    if (!container) return;

    const [year, month] = this.currentMonth.split('-').map(Number);
    const options = [];
    
    // 12 months before to 24 months after current
    let iter = new Date(Date.UTC(year, month - 1 - 12, 1));
    const end = new Date(Date.UTC(year, month - 1 + 24, 1));

    while (iter <= end) {
      const val = iter.toISOString().slice(0, 7);
      const label = iter.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      options.push(`<option value="${val}" ${val === this.currentMonth ? 'selected' : ''}>${label}</option>`);
      iter.setUTCMonth(iter.getUTCMonth() + 1);
    }

    container.innerHTML = safeHTML`
      <button onclick="incPrevMonth()" title="Previous Month">◄</button>
      <select onchange="handleIncMonthChange(event)">
        ${options.join('')}
      </select>
      <button onclick="incNextMonth()" title="Next Month">►</button>
    `;
  },

  async renderCategoryFilter() {
    const container = document.getElementById('incCategoryFilterContainer');
    if (!container) return;

    const categories = await categoryRepository.getCategories();
    // Income usually uses both fixed (Salary) and variable (Gifts) groups depending on setup,
    // but we'll show all categories for filtering.
    const incomeCats = categories; 

    container.innerHTML = safeHTML`
      <div class="custom-select" style="position:relative">
        <button class="sm ghost" onclick="toggleIncCategoryDropdown()">
          Categories (${this.selectedCategories.length || 'All'})
        </button>
        <div id="incCategoryDropdown" class="card" style="display:none; position:absolute; top:100%; right:0; z-index:100; min-width:200px; padding:12px; margin-top:5px; box-shadow: var(--shadow); border: 1px solid var(--border); background: var(--bg-card)">
          <div style="max-height: 200px; overflow-y: auto; margin-bottom: 10px">
            ${incomeCats.map(c => `
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">
                <input type="checkbox" id="inc-filter-cat-${c.id}" value="${c.id}" 
                  ${this.selectedCategories.includes(c.id) ? 'checked' : ''}
                  onchange="transactionUI.handleCategoryChange(this)"/>
                <label for="inc-filter-cat-${c.id}" style="font-size:.75rem; margin:0; cursor:pointer; color:var(--text)">${c.name}</label>
              </div>
            `).join('')}
          </div>
          <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; justify-content:space-between">
            <button class="sm ghost" onclick="transactionUI.clearCategoryFilter()">Clear</button>
            <button class="sm primary" onclick="toggleIncCategoryDropdown(false)">Done</button>
          </div>
        </div>
      </div>
    `;
  },

  async renderIncome(month) {
    const allItems = await incomeRepository.getByMonth(month || this.currentMonth);
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    
    const body = document.getElementById('incBody');
    if (!body) return;

    // Apply Filter using utility (Search and Categories)
    const items = filterTransactions(allItems, this.searchQuery, this.selectedCategories, ['source'], catMap);

    // Calculate total based on filtered items
    const filteredTotal = items.reduce((sum, i) => sum + i.amount, 0);
    
    // Render Tab Summary
    renderTabSummary('incomeSummary', [
      { label: 'Total Income', value: filteredTotal, color: 'var(--accent)' }
    ]);

    if (this.reconciliationMode) {
      this.renderReconHeader(items);
    }

    if (items.length === 0) {
      body.innerHTML = '<tr><td colspan="4" class="hint" style="text-align:center">No income found matching your search and category selection.</td></tr>';
      this.updateTotal('income', 0);
      return;
    }

    // Sort items by date descending
    items.sort((a, b) => b.date.localeCompare(a.date));

    // Render data rows
    body.innerHTML = safeHTML`${items.map(item => {
      const isReconciled = item.isReconciled === true;
      const isCleared = item.isCleared === true;

      return safeHTML`
        <tr data-id="${item.id}" class="${isReconciled ? 'reconciled-row' : ''} ${isCleared ? 'cleared-row' : ''}">
          <td>${item.date}</td>
          <td>
            ${item.source} 
            ${item.categoryId ? `<span class="tag" style="margin-left:6px">${catMap[item.categoryId]}</span>` : ''}
            ${isReconciled ? `<span class="pill" style="background:var(--success); color:#fff; font-size:0.65rem; margin-left:6px">✓ Reconciled</span>` : ''}
          </td>
          <td class="r"><span class="privacy-blur">${formatGBP(item.amount)}</span></td>
          <td class="r">
            ${this.reconciliationMode ? `
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px">
                <label style="font-size:0.75rem; color:var(--text-soft)">Cleared:</label>
                <input type="checkbox" ${isCleared ? 'checked' : ''} ${isReconciled ? 'disabled' : ''} 
                  onclick="toggleIncCleared(${item.id}, ${isCleared})"/>
              </div>
            ` : `
              <button class="sm ghost" ${isReconciled ? 'disabled title="Reconciled items cannot be edited"' : ''} onclick="transactionUI.editTransaction(${item.id})">Edit</button>
              <button class="sm danger" ${isReconciled ? 'disabled title="Reconciled items cannot be deleted"' : ''} onclick="deleteTransaction('income', ${item.id})">✕</button>
            `}
          </td>
        </tr>
      `;
    }).join('')}`;

    this.updateTotal('income', filteredTotal);
  },

  renderReconHeader(items) {
    const header = document.getElementById('incReconHeader');
    if (!header) return;

    const clearedTotal = items.filter(i => i.isCleared).reduce((sum, i) => sum + i.amount, 0);
    const statementTotal = items.reduce((sum, i) => sum + i.amount, 0);
    const diff = statementTotal - clearedTotal;

    header.innerHTML = safeHTML`
      <div class="card-hd" style="display:flex; justify-content:space-between; align-items:center">
        <h3 style="font-size:0.9rem; color:var(--accent)">🔍 Income Reconciliation</h3>
        <button class="primary sm" onclick="transactionUI.finalizeReconciliation()">Finalize Reconciliation</button>
      </div>
      <div class="grid3" style="padding:15px; gap:15px">
        <div>
          <div class="sum-label">Cleared Total</div>
          <div class="sum-val" style="color:var(--success); font-size:1.1rem">${formatGBP(clearedTotal)}</div>
        </div>
        <div>
          <div class="sum-label">Month Total</div>
          <div class="sum-val" style="font-size:1.1rem">${formatGBP(statementTotal)}</div>
        </div>
        <div>
          <div class="sum-label">Difference</div>
          <div class="sum-val" style="color:${diff === 0 ? 'var(--success)' : 'var(--danger)'}; font-size:1.1rem">${formatGBP(diff)}</div>
        </div>
      </div>
      <div style="padding:0 15px 15px 15px" class="hint">
        Match your bank statement by checking "Cleared" for each transaction. 
        Once the Difference is £0.00, click Finalize to lock the month.
      </div>
    `;
  },

  async finalizeReconciliation() {
    const monthStr = this.currentMonth;
    const items = await incomeRepository.getByMonth(monthStr);
    const cleared = items.filter(i => i.isCleared && !i.isReconciled);

    if (cleared.length === 0) {
      alert('No cleared items to reconcile.');
      return;
    }

    if (!confirm(`This will mark ${cleared.length} items as Reconciled and lock them from further edits. Continue?`)) {
      return;
    }

    try {
      for (const item of cleared) {
        await incomeRepository.update(item.id, { isReconciled: true });
      }
      alert('Reconciliation finalized successfully.');
      this.toggleReconciliationMode();
      await this.render();
    } catch (err) {
      console.error('Failed to finalize reconciliation:', err);
      alert('Failed: ' + err.message);
    }
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
