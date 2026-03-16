import {
  incomeRepository,
  categoryRepository,
  getYearlyDailyIncome
} from '../db/repository.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { safeHTML, renderTabSummary, modalUI } from './render.js';
import { filterTransactions } from '../utils/filtering.js';
import { triggerHaptic } from '../utils/haptics.js';
import { notificationUI } from './notifications.js';
import { renderSpendingHeatmap } from './heatmap.js';
import { SwipeHandler } from '../utils/gestures.js';

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
  // Swipe gesture state — swipe is additive for touch users; keyboard/mouse users use inline buttons
  _swipeInstances: [],
  currentOpenRow: null,

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
      addBtn.onclick = () => this.openForm();
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
      if (!await modalUI.confirm('Delete Entry', `Are you sure you want to delete this ${type} entry?`)) return;

      try {
        if (type === 'income') await incomeRepository.delete(id);
        triggerHaptic('delete');
        await this.render();
      } catch (error) {
        console.error(`Failed to delete ${type}:`, error);
        notificationUI.error(`Failed to delete ${type}: ` + error.message);
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
      modalUI.close();
    }

    this.render();
  },

  /**
   * Opens the Income form (Add or Edit) in a modal.
   */
  async openForm(id = null) {
    if (id && this.editingId !== id) {
      this.editingId = id;
    } else if (!id) {
      this.editingId = null;
    }

    if (this.reconciliationMode) this.toggleReconciliationMode();

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
    const incomeCategories = categories.filter(c => c.group === 'income');
    const selectedCategory = categories.find(c => Number(data.categoryId) === c.id);
    const formCategories = selectedCategory && selectedCategory.group !== 'income'
      ? [selectedCategory, ...incomeCategories.filter(c => c.id !== selectedCategory.id)]
      : incomeCategories;
    
    const content = safeHTML`
      <div class="form-row">
        <div><label>Date</label><input id="incDate" type="date" value="${data.date}" autofocus/></div>
        <div><label>Source</label><input id="incSource" type="text" value="${data.source}" placeholder="e.g. Salary"/></div>
      </div>
      <div class="form-row">
        <div><label>Category</label>
          <select id="incCat">
            <option value="">— Category —</option>
            ${formCategories.map(c => `<option value="${c.id}" ${Number(data.categoryId) === c.id ? 'selected' : ''}>${c.name}${c.group !== 'income' ? ' (Legacy)' : ''}</option>`).join('')}
          </select>
        </div>
        <div><label>Amount (£)</label><input id="incAmount" type="number" step="0.01" value="${data.amount}" placeholder="0.00"/></div>
      </div>
    `;

    const footer = [
      { 
        label: isUpdate ? 'Save Changes' : 'Add Income', 
        className: 'primary', 
        onClick: () => this.handleSave() 
      },
      { 
        label: 'Cancel', 
        className: 'ghost', 
        onClick: () => modalUI.close() 
      }
    ];

    modalUI.show(isUpdate ? '📝 Update Income Entry' : '➕ Add Income Entry', content, footer);
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
      notificationUI.warning('Please fill in all fields correctly.');
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
      } else {
        await incomeRepository.add(payload);
      }

      const savedId = this.editingId;
      modalUI.close();
      await this.render();
      triggerHaptic('success');

      if (savedId) {
        const row = document.querySelector(`tr[data-id="${savedId}"]`);
        if (row) {
          row.classList.add('row-flash');
          setTimeout(() => row.classList.remove('row-flash'), 1500);
        }
      }
    } catch (error) {
      console.error('Failed to save income:', error);
      notificationUI.error('Failed to save income: ' + error.message);
    }
  },

  /**
   * Enters edit mode for a specific transaction.
   */
  async editTransaction(id) {
    await this.openForm(id);
  },

  /**
   * Render income list for the current month.
   */
  async render(month) {
    if (month) this.setCurrentMonth(month);
    await this.renderMonthPicker();
    await this.renderHeatmap();
    await this.renderCategoryFilter();
    await this.renderIncome(this.currentMonth);
  },

  async renderHeatmap() {
    const container = document.getElementById('incomeTabHeatmapContainer');
    if (!container) return;

    try {
      const year = parseInt(this.currentMonth.slice(0, 4), 10);
      const currentYearData = await getYearlyDailyIncome(year);
      renderSpendingHeatmap('incomeTabHeatmapContainer', year, currentYearData);
    } catch (err) {
      console.warn('Could not render income tab heatmap:', err);
    }
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
    const incomeCats = categories.filter(c => c.group === 'income');

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
    // Swipe gestures are additive for touch users — inline buttons remain for keyboard and mouse users.
    body.innerHTML = safeHTML`${items.map(item => {
      const isReconciled = item.isReconciled === true;
      const isCleared = item.isCleared === true;
      const canSwipe = !isReconciled && !this.reconciliationMode;

      return safeHTML`
        <tr class="swipe-row ${isReconciled ? 'reconciled-row' : ''} ${isCleared ? 'cleared-row' : ''}" data-id="${item.id}">
          <td class="nw">
            ${canSwipe ? `<div class="swipe-action-left">Edit</div>` : ''}
            ${canSwipe ? `<div class="swipe-action-right">Delete</div>` : ''}
            ${this._formatDateCompact(item.date)}
          </td>
          <td>
            ${item.source}
            ${item.categoryId ? `<span class="tag" style="margin-left:6px">${catMap[item.categoryId]}</span>` : ''}
            ${isReconciled ? `<span class="pill" style="background:var(--success); color:#fff; font-size:0.65rem; margin-left:6px">✓ Reconciled</span>` : ''}
          </td>
          <td class="r"><span class="privacy-blur">${formatGBP(item.amount)}</span></td>
          <td class="r col-actions">
            ${this.reconciliationMode ? `
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px">
                <label style="font-size:0.75rem; color:var(--text-soft)">Cleared:</label>
                <input type="checkbox" ${isCleared ? 'checked' : ''} ${isReconciled ? 'disabled' : ''}
                  onclick="toggleIncCleared(${item.id}, ${isCleared})"/>
              </div>
            ` : `
              <button class="sm ghost btn-edit" ${isReconciled ? 'disabled title="Reconciled items cannot be edited"' : ''} onclick="transactionUI._handleEdit(${item.id})">Edit</button>
              <button class="sm danger btn-delete" ${isReconciled ? 'disabled title="Reconciled items cannot be deleted"' : ''} onclick="transactionUI._handleDelete(${item.id})">✕</button>
            `}
          </td>
        </tr>
      `;
    }).join('')}`;

    this.updateTotal('income', filteredTotal);
    this._initSwipe(body);
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
      notificationUI.info('No cleared items to reconcile.');
      return;
    }

    if (!confirm(`This will mark ${cleared.length} items as Reconciled and lock them from further edits. Continue?`)) {
      return;
    }

    try {
      for (const item of cleared) {
        await incomeRepository.update(item.id, { isReconciled: true });
      }
      notificationUI.success('Reconciliation finalized successfully.');
      this.toggleReconciliationMode();
      await this.render();
    } catch (err) {
      console.error('Failed to finalize reconciliation:', err);
      notificationUI.error('Failed: ' + err.message);
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
  },

  /**
   * Shared edit handler — used by both swipe-right gesture and inline .btn-edit button.
   */
  _handleEdit(id) {
    this.closeAllRows();
    this.editTransaction(Number(id));
  },

  /**
   * Shared delete handler — used by both swipe-left gesture and inline .btn-delete button.
   */
  async _handleDelete(id) {
    this.closeAllRows();
    await window.deleteTransaction('income', Number(id));
  },

  /**
   * Closes any open swiped rows and resets transform.
   */
  closeAllRows() {
    const rows = document.querySelectorAll('#incBody .swipe-row');
    rows.forEach(row => {
      row.style.transform = '';
      row.classList.remove('swipe-active');
    });
    this.currentOpenRow = null;
  },

  /**
   * Initialise SwipeHandler instances for all income rows.
   * Destroys existing instances before each rebuild to prevent memory leaks.
   * Swipe gestures are additive for touch users; keyboard/mouse users use inline buttons.
   */
  _initSwipe(tableBody) {
    // Destroy existing instances first to prevent memory leaks
    this._swipeInstances.forEach(({ handler }) => handler.destroy());
    this._swipeInstances = [];
    this.currentOpenRow = null;

    tableBody.querySelectorAll('.swipe-row').forEach(row => {
      const id = Number(row.dataset.id);
      const isLocked = row.classList.contains('reconciled-row') || this.reconciliationMode;

      const handler = new SwipeHandler(row, {
        threshold: 80,
        edgeThreshold: 40,
        onStart: () => {
          if (this.currentOpenRow && this.currentOpenRow !== row) {
            this.closeAllRows();
          }
        },
        onSwipe: (deltaX) => {
          if (isLocked) {
            const limit = 20;
            const constrained = Math.min(limit, Math.max(-limit, deltaX));
            row.style.transform = `translateX(${constrained}px)`;
            return;
          }
          // Right swipe reveals Edit (positive deltaX); left swipe reveals Delete (negative deltaX)
          row.style.transform = `translateX(${deltaX}px)`;
          row.classList.add('swipe-active');
        },
        onEnd: (deltaX, thresholdMet) => {
          if (isLocked) {
            row.style.transform = '';
            if (Math.abs(deltaX) > 10) triggerHaptic('error');
            return;
          }

          // If the row is already open and this was a tap (not a swipe), keep it open
          // so the click event can reach the action div's listener.
          if (this.currentOpenRow === row && Math.abs(deltaX) < 15) return;

          if (thresholdMet) {
            const finalOffset = deltaX < 0 ? -80 : 80;
            row.style.transform = `translateX(${finalOffset}px)`;
            row.classList.add('swipe-active');
            this.currentOpenRow = row;
            // Trigger action immediately on full swipe
            if (deltaX > 0) {
              this._handleEdit(id);
            } else {
              this._handleDelete(id);
            }
          } else {
            row.style.transform = '';
            row.classList.remove('swipe-active');
            if (this.currentOpenRow === row) this.currentOpenRow = null;
          }
        }
      });

      // Wire up revealed action divs via JS (onclick attrs are stripped by DOMPurify)
      const editDiv = row.querySelector('.swipe-action-left');
      const deleteDiv = row.querySelector('.swipe-action-right');
      if (editDiv) editDiv.addEventListener('click', () => this._handleEdit(id));
      if (deleteDiv) deleteDiv.addEventListener('click', () => this._handleDelete(id));

      // Close row on tap if it's currently open (but not on the action divs themselves)
      row.onclick = (e) => {
        if (this.currentOpenRow === row) {
          if (!e.target.classList.contains('swipe-action-left') && !e.target.classList.contains('swipe-action-right')) {
            this.closeAllRows();
          }
        }
      };

      this._swipeInstances.push({ id, handler });
    });
  },

  /**
   * Formats an ISO date string as a two-line compact date cell:
   * line 1: dd-MMM (e.g. "14-Mar")
   * line 2: YYYY  (e.g. "2026") in smaller muted text.
   * Uses UTC to avoid browser timezone shifts on date-only strings.
   */
  _formatDateCompact(dateStr) {
    const fallback = '<span class="date-compact">--<br><span class="date-year">----</span></span>';
    try {
      if (typeof dateStr !== 'string' || !dateStr.trim()) return fallback;
      const isoDate = dateStr.split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return fallback;

      const [yyyy, mm, dd] = isoDate.split('-').map(Number);
      const d = new Date(Date.UTC(yyyy, mm - 1, dd));
      if (Number.isNaN(d.getTime())) return fallback;

      const day = String(d.getUTCDate()).padStart(2, '0');
      const mmm = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
      const year = d.getUTCFullYear();
      return `<span class="date-compact">${day}-${mmm}<br><span class="date-year">${year}</span></span>`;
    } catch (_err) {
      return fallback;
    }
  }
};

// Global access for inline onclick handlers
window.transactionUI = transactionUI;
