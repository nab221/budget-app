import {
  recurrentExpenseRepository,
  oneOffExpenseRepository,
  categoryRepository,
  statementRepository,
  targetRepository,
  getYearlyDailySpending,
  triggerBalanceRecalc,
  triggerDailyForecastRecalc
} from '../db/repository.js';
import { formatGBP, toPence, fromPence } from '../utils/currency.js';
import { safeHTML, renderTabSummary, modalUI } from './render.js';
import { filterTransactions } from '../utils/filtering.js';

import { templateUI } from './templates.js';
import { nextWorkingDay } from '../utils/cashflow.js';
import { generateInstances } from '../utils/recurrence.js';
import { generateUUID } from '../utils/security.js';
import { triggerHaptic } from '../utils/haptics.js';
import { notificationUI } from './notifications.js';
import { SwipeHandler } from '../utils/gestures.js';
import { renderSpendingHeatmap } from './heatmap.js';

/**
 * Returns true if the expense record is linked to a debt entry.
 * Uses isDebtPayment (Phase 18 field) or linkedDebtId (repository field).
 */
function isDebtLinked(expense) {
  return !!(expense.isDebtPayment || expense.linkedDebtId);
}

/**
 * Renders a compact accessible status icon for an expense status string.
 */
function renderStatusIcon(status) {
  const map = {
    paid:      { icon: '✓', label: 'Paid' },
    pending:   { icon: '○', label: 'Pending' },
    cancelled: { icon: '✗', label: 'Cancelled' },
  };
  const s = (status || 'pending').toLowerCase();
  const { icon, label } = map[s] || map.pending;
  return `<span class="status-icon" aria-label="${label}">${icon}</span>`;
}

/**
 * Expenses UI Module
 * Handles the unified "Expenses" tab.
 */
export const expensesUI = {
  selectedMonth: '',
  editingId: null,
  editingType: null, // 'recurrent' or 'oneoff'
  searchQuery: '',
  selectedCategories: [],
  reconciliationMode: false,
  _swipeInstances: [],
  currentOpenRow: null,

  /**
   * Initialize the Expenses UI — bind events and do first render.
   */
  async init() {
    this.initMonth();
    this.setupEventListeners();
    window.addEventListener('app:refresh', () => this.render());
    await this.render();
  },

  /**
   * Closes any open swiped rows.
   */
  closeAllRows() {
    const rows = document.querySelectorAll('#expenseBody .swipe-row');
    rows.forEach(row => {
      row.style.transform = '';
      row.classList.remove('swipe-active');
    });
    this.currentOpenRow = null;
  },

  /**
   * Initialize month from localStorage or current date.
   */
  initMonth() {
    const now = new Date().toISOString().slice(0, 7);
    this.selectedMonth = localStorage.getItem('expenses_selected_month') || now;
  },

  /**
   * Toggle the frequency field based on recurring checkbox.
   */
  toggleFrequencyField() {
    const isRecurring = document.getElementById('expIsRecurring').checked;
    const freqRow = document.getElementById('expFreqRow');
    const recurringFields = document.getElementById('expRecurringFields');
    if (freqRow) freqRow.classList.toggle('hidden', !isRecurring);
    if (recurringFields) recurringFields.classList.toggle('hidden', !isRecurring);
  },

  /**
   * Prompt user for choice on recurring item modification.
   */
  async promptRecurrenceChoice(title, message) {
    return new Promise((resolve) => {
      const content = safeHTML`
        <p style="margin-bottom:15px">${message}</p>
        <div style="display:grid; gap:10px">
          <button class="ghost" id="recurrenceThisBtn" style="text-align:left; padding:12px; border:1px solid var(--border); cursor:pointer">
            <strong style="display:block; margin-bottom:4px">Only this instance</strong>
            <span class="hint" style="font-size:0.75rem">Affects only the record for this specific date.</span>
          </button>
          <button class="ghost" id="recurrenceFutureBtn" style="text-align:left; padding:12px; border:1px solid var(--border); cursor:pointer">
            <strong style="display:block; margin-bottom:4px">All future instances</strong>
            <span class="hint" style="font-size:0.75rem">Affects this and all subsequent records in the series.</span>
          </button>
        </div>
      `;

      const footer = [
        { label: 'Cancel', className: 'ghost', onClick: () => cleanup(null) }
      ];

      modalUI.show(title, content, footer);

      const cleanup = (val) => {
        modalUI.close();
        resolve(val);
      };

      document.getElementById('recurrenceThisBtn').onclick = () => cleanup('this');
      document.getElementById('recurrenceFutureBtn').onclick = () => cleanup('future');
    });
  },

  /**
   * Update the month and persist to localStorage.
   */
  setCurrentMonth(month) {
    this.selectedMonth = month;
    localStorage.setItem('expenses_selected_month', month);
  },

  /**
   * Wire up all event listeners for forms and global action buttons.
   */
  setupEventListeners() {
    // Toggle Expense Form
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    if (addExpenseBtn) {
      addExpenseBtn.onclick = () => this.openForm();
    }

    // Toggle Reconciliation Mode
    const reconBtn = document.getElementById('toggleExpReconBtn');
    if (reconBtn) {
      reconBtn.onclick = () => this.toggleReconciliationMode();
    }

    // Search Input
    const searchInput = document.getElementById('expSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render();
      };
    }

    // Mark all as paid
    const markAllBtn = document.getElementById('markAllPaidBtn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => this.handleMarkAllPaid());
    }

    // Manual Recurrence Trigger
    const triggerBtn = document.getElementById('triggerRecurrenceBtn');
    if (triggerBtn) {
      triggerBtn.onclick = async () => {
        const originalContent = triggerBtn.innerHTML;
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = '⌛ Processing...';
        try {
          await templateUI.manualTrigger();
          await this.render();
        } finally {
          triggerBtn.disabled = false;
          triggerBtn.innerHTML = originalContent;
        }
      };
    }

    // Global delete handlers
    window.deleteExpense = async (id, type) => {
      const repo = type === 'recurrent' ? recurrentExpenseRepository : oneOffExpenseRepository;
      const item = await repo.get(id);
      if (!item) return;

      // Phase 18: Prevent deletion of debt-linked expenses from Expenses tab
      if (item.isDebtPayment) {
        notificationUI.info('This expense is managed in Debts. Redirecting…', [], 1800);
        document.querySelector('#mainTabs .tab[data-tab="debts"]')?.click();
        return;
      }

      const label = item.label || item.note || 'this expense';

      if (item.isRecurring && item.recurrenceId) {
        const choice = await this.promptRecurrenceChoice(
          'Delete Recurring Expense',
          `"${label}" is part of a recurring series. How would you like to delete it?`
        );
        if (!choice) return;

        try {
          if (choice === 'this') {
            await repo.delete(id);
          } else {
            await repo.deleteSeries(item.recurrenceId, item.nextDate || item.date);
          }
          triggerHaptic('delete');
          await this.render();
        } catch (err) {
          notificationUI.error('Failed to delete: ' + err.message);
        }
      } else {
        if (!await modalUI.confirm('Delete Expense', `Delete "${label}"?`)) return;
        try {
          await repo.delete(id);
          triggerHaptic('delete');
          await this.render();
        } catch (err) {
          notificationUI.error('Failed to delete: ' + err.message);
        }
      }
    };

    window.toggleExpenseStatus = async (id, type, currentStatus) => {
      if (type !== 'recurrent') return;
      try {
        const item = await recurrentExpenseRepository.get(id);
        if (!item) return;

        // Intercept for specialized debt payments
        if (item.isDebtPayment && item.linkedStatementId) {
          if (currentStatus === 'pending') {
            await expensesUI.showDebtPaymentConfirmation(item);
            return;
          } else if (currentStatus === 'paid') {
            if (confirm('Un-pay this debt payment? This will reset the linked statement.')) {
              await statementRepository.resetPayment(item.linkedStatementId);
              await this.render();
            }
            return;
          }
        }

        const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
        const updates = { status: newStatus };
        if (newStatus === 'paid' && item.cycleTotal > 0) {
          updates.cycleCurrent = Math.min((item.cycleCurrent || 0) + 1, item.cycleTotal);
        }
        await recurrentExpenseRepository.update(id, updates);
        triggerHaptic('tap');
        await this.render();
      } catch (err) {
        console.error('Failed to toggle status:', err);
      }
    };

    window.toggleExpCleared = async (id, type, currentStatus) => {
      try {
        const repo = type === 'recurrent' ? recurrentExpenseRepository : oneOffExpenseRepository;
        await repo.update(id, { isCleared: !currentStatus });
        triggerHaptic('tap');
        await this.render();
      } catch (err) {
        console.error('Failed to toggle cleared status:', err);
      }
    };

    // Month Picker Navigation
    window.expPrevMonth = () => {
      const current = this.selectedMonth;
      const [year, month] = current.split('-').map(Number);
      const d = new Date(Date.UTC(year, month - 2, 1));
      this.setCurrentMonth(d.toISOString().slice(0, 7));
      this.render();
    };

    window.expNextMonth = () => {
      const current = this.selectedMonth;
      const [year, month] = current.split('-').map(Number);
      const d = new Date(Date.UTC(year, month, 1));
      this.setCurrentMonth(d.toISOString().slice(0, 7));
      this.render();
    };

    window.handleExpMonthChange = (e) => {
      this.setCurrentMonth(e.target.value);
      this.render();
    };
  },

  /**
   * Toggles reconciliation mode.
   */
  toggleReconciliationMode() {
    this.reconciliationMode = !this.reconciliationMode;
    const btn = document.getElementById('toggleExpReconBtn');
    if (btn) {
      btn.textContent = this.reconciliationMode ? '✖ Exit Reconciliation' : '🔍 Reconciliation Mode';
      btn.classList.toggle('primary', this.reconciliationMode);
      btn.classList.toggle('ghost', !this.reconciliationMode);
    }
    
    const header = document.getElementById('expReconHeader');
    if (header) {
      header.classList.toggle('hidden', !this.reconciliationMode);
    }

    if (this.reconciliationMode) {
      modalUI.close();
    }

    this.render();
  },

  /**
   * Opens the Expense form (Add or Edit) in a modal.
   */
  async openForm(id = null, type = null) {
    if (id && (this.editingId !== id || this.editingType !== type)) {
      this.editingId = id;
      this.editingType = type;
    } else if (!id) {
      this.editingId = null;
      this.editingType = null;
    }

    // Phase 18: Guard — debt-linked expenses cannot be edited via generic form
    if (this.editingId && this.editingType === 'recurrent') {
      const item = await recurrentExpenseRepository.get(this.editingId);
      if (item && item.isDebtPayment) {
        notificationUI.info('This expense is managed in Debts. Redirecting…', [], 1800);
        this.editingId = null;
        this.editingType = null;
        document.querySelector('#mainTabs .tab[data-tab="debts"]')?.click();
        return;
      }
    }

    if (this.reconciliationMode) this.toggleReconciliationMode();

    const categories = await categoryRepository.getCategories();
    const isUpdate = !!this.editingId;

    let data = {
      date: new Date().toISOString().slice(0, 10),
      categoryId: '',
      label: '',
      amount: '',
      isRecurring: false,
      frequency: 'monthly',
      isEssential: true,
      cycleTotal: '',
      endDate: ''
    };

    if (isUpdate) {
      const repo = this.editingType === 'recurrent' ? recurrentExpenseRepository : oneOffExpenseRepository;
      const item = await repo.get(this.editingId);
      if (item) {
        data = { 
          ...item, 
          label: item.label || item.note || '',
          amount: (item.amount / 100).toFixed(2),
          date: item.nextDate || item.date
        };
      }
    }

    const expenseCategories = categories.filter(c => c.group === 'expenses');
    const selectedCategory = categories.find(c => Number(data.categoryId) === c.id);
    const formCategories = selectedCategory && selectedCategory.group !== 'expenses'
      ? [selectedCategory, ...expenseCategories.filter(c => c.id !== selectedCategory.id)]
      : expenseCategories;

    const categoryOptions = formCategories
      .map(c => `<option value="${c.id}" ${Number(data.categoryId) === c.id ? 'selected' : ''}>${c.name}${c.group !== 'expenses' ? ' (Legacy)' : ''}</option>`)
      .join('');

    const frequencyOptions = `
      <option value="weekly" ${data.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
      <option value="biweekly" ${data.frequency === 'biweekly' ? 'selected' : ''}>Bi-weekly</option>
      <option value="monthly" ${data.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
      <option value="quarterly" ${data.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
      <option value="annually" ${data.frequency === 'annually' ? 'selected' : ''}>Annually</option>
    `;

    const content = safeHTML`
      <div class="form-row">
        <div><label>Date</label><input id="expDate" type="date" value="${data.date}" autofocus/></div>
        <div><label>Category</label><select id="expCat"><option value="">— Category —</option>${categoryOptions}</select></div>
      </div>
      <div class="form-row">
        <div><label>Description</label><input id="expLabel" type="text" value="${data.label}" placeholder="e.g. Rent or Groceries"/></div>
      </div>
      <div class="form-row">
        <div><label>Amount (£)</label><input id="expAmt" type="number" step="0.01" value="${data.amount}" placeholder="0.00"/></div>
        <div style="display:flex;align-items:center;gap:6px;padding-top:18px">
          <input id="expIsRecurring" type="checkbox" ${data.isRecurring ? 'checked' : ''} onchange="expensesUI.toggleFrequencyField()"/>
          <label for="expIsRecurring" style="margin:0">Recurring</label>
        </div>
      </div>
      
      <div id="expFreqRow" class="form-row ${data.isRecurring ? '' : 'hidden'}">
        <div><label>Frequency</label>
          <select id="expFreq">
            ${frequencyOptions}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:6px;padding-top:18px">
          <input id="expIsEssential" type="checkbox" ${data.isEssential !== false ? 'checked' : ''}/>
          <label for="expIsEssential" style="margin:0">Essential</label>
        </div>
      </div>

      <div id="expRecurringFields" class="form-row ${data.isRecurring ? '' : 'hidden'}">
        <div><label>Total Payments</label><input id="expCycleTotal" type="number" min="0" value="${data.cycleTotal || ''}" placeholder="0 = ongoing"/></div>
        <div><label>End Date</label><input id="expEndDate" type="date" value="${data.endDate || ''}"/></div>
      </div>
    `;

    const footer = [
      { 
        label: isUpdate ? 'Save Changes' : 'Add Expense', 
        className: 'primary', 
        onClick: () => this.handleSaveExpense() 
      },
      { 
        label: 'Cancel', 
        className: 'ghost', 
        onClick: () => modalUI.close() 
      }
    ];

    modalUI.show(isUpdate ? '📝 Update Expense' : '➕ Add Expense', content, footer);
  },

  async handleSaveExpense() {
    const date = document.getElementById('expDate').value;
    const categoryId = document.getElementById('expCat').value;
    const label = document.getElementById('expLabel').value.trim();
    const amount = parseFloat(document.getElementById('expAmt').value);
    const isRecurring = document.getElementById('expIsRecurring').checked;
    const frequency = document.getElementById('expFreq').value;

    if (isNaN(amount) || amount <= 0) {
      notificationUI.warning('Please provide a valid amount.');
      return;
    }
    if (!label) {
      notificationUI.warning('Description is required.');
      return;
    }

    try {
      let id;
      const targetType = isRecurring ? 'recurrent' : 'oneoff';
      const repo = isRecurring ? recurrentExpenseRepository : oneOffExpenseRepository;

      const payload = {
        date: date || new Date().toISOString().slice(0, 10),
        categoryId: categoryId ? parseInt(categoryId) : null,
        amount,
        isRecurring,
        frequency: isRecurring ? frequency : 'monthly'
      };

      if (isRecurring) {
        payload.label = label;
        payload.nextDate = payload.date;
        payload.isEssential = document.getElementById('expIsEssential').checked;
        payload.cycleTotal = parseInt(document.getElementById('expCycleTotal').value) || 0;
        payload.endDate = document.getElementById('expEndDate').value || null;
      } else {
        payload.note = label;
      }

      if (this.editingId) {
        const item = await (this.editingType === 'recurrent' ? recurrentExpenseRepository : oneOffExpenseRepository).get(this.editingId);
        
        // If changing type from one-off to recurring or vice versa, we delete and re-add
        if (this.editingType !== targetType) {
          await (this.editingType === 'recurrent' ? recurrentExpenseRepository : oneOffExpenseRepository).delete(this.editingId);
          this.editingId = null; // Forces re-add logic below
        } else {
          let choice = 'this';
          if (item && item.isRecurring && item.recurrenceId) {
            choice = await this.promptRecurrenceChoice(
              'Update Recurring Expense',
              `"${label}" is part of a recurring series. How would you like to apply these changes?`
            );
            if (!choice) return;
          }

          if (choice === 'this') {
            await repo.update(this.editingId, payload);
          } else {
            await repo.updateSeries(item.recurrenceId, item.nextDate || item.date, payload);
          }
          id = this.editingId;
        }
      }

      if (!this.editingId) {
        // New or transformed expense
        if (isRecurring) {
          payload.recurrenceId = generateUUID();
          payload.parentDate = payload.date;
          id = await recurrentExpenseRepository.add({ ...payload, status: 'pending', cycleCurrent: 0 });
          
          const savedItem = await recurrentExpenseRepository.get(id);
          const instances = generateInstances(
            { ...savedItem, amount: fromPence(savedItem.amount) }, 
            frequency, 
            12
          );
          await recurrentExpenseRepository.bulkAdd(instances);
          
          const lastDate = instances[instances.length - 1].date;
          triggerBalanceRecalc(lastDate).catch(() => {});
          triggerDailyForecastRecalc(lastDate).catch(() => {});
        } else {
          id = await oneOffExpenseRepository.add(payload);
        }
      }

      modalUI.close();
      await this.render();

      if (id) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
          row.classList.add('row-flash');
          setTimeout(() => row.classList.remove('row-flash'), 1500);
        }
      }
      triggerHaptic('success');
    } catch (err) {
      console.error('Failed to save expense:', err);
      notificationUI.error('Failed to save: ' + err.message);
    }
  },

  async editExpense(id, type) {
    await this.openForm(id, type);
  },

  async renderCategoryFilter() {
    const container = document.getElementById('expCategoryFilterContainer');
    if (!container) return;

    const categories = await categoryRepository.getCategories();
    const expenseCategories = categories.filter(c => c.group === 'expenses');
    
    container.innerHTML = safeHTML`
      <div class="custom-select" style="position:relative">
        <button class="sm ghost" onclick="expensesUI.toggleCategoryDropdown()">
          Categories (${this.selectedCategories.length || 'All'})
        </button>
        <div id="catDropdown" class="card hidden" style="position:absolute; top:100%; right:0; z-index:100; min-width:200px; padding:12px; margin-top:5px; box-shadow: var(--shadow); border: 1px solid var(--border)">
          <div style="max-height: 200px; overflow-y: auto; margin-bottom: 10px">
            ${expenseCategories.map(c => `
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px">
                <input type="checkbox" id="filter-cat-${c.id}" value="${c.id}" 
                  ${this.selectedCategories.includes(c.id) ? 'checked' : ''}
                  onchange="expensesUI.handleCategoryChange(this)"/>
                <label for="filter-cat-${c.id}" style="font-size:.75rem; margin:0; cursor:pointer; color:var(--text)">${c.name}</label>
              </div>
            `).join('')}
          </div>
          <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; justify-content:space-between">
            <button class="sm ghost" onclick="expensesUI.clearCategoryFilter()">Clear</button>
            <button class="sm primary" onclick="expensesUI.toggleCategoryDropdown(false)">Done</button>
          </div>
        </div>
      </div>
    `;
  },

  async renderMonthPicker() {
    const container = document.getElementById('expMonthPicker');
    if (!container) return;

    const currentMonth = this.selectedMonth;
    const [year, month] = currentMonth.split('-').map(Number);

    const options = [];
    let iter = new Date(Date.UTC(year, month - 1 - 12, 1)); 
    const end = new Date(Date.UTC(year, month - 1 + 24, 1)); 
    
    while (iter <= end) {
      const val = iter.toISOString().slice(0, 7);
      const label = iter.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      options.push(`<option value="${val}" ${val === currentMonth ? 'selected' : ''}>${label}</option>`);
      iter.setUTCMonth(iter.getUTCMonth() + 1);
    }

    container.innerHTML = safeHTML`
      <button onclick="expPrevMonth()" title="Previous Month">◄</button>
      <select onchange="handleExpMonthChange(event)">
        ${options.join('')}
      </select>
      <button onclick="expNextMonth()" title="Next Month">►</button>
    `;
  },

  toggleCategoryDropdown(show) {
    const dropdown = document.getElementById('catDropdown');
    if (!dropdown) return;
    if (show === undefined) show = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', !show);
  },

  handleCategoryChange(checkbox) {
    const id = parseInt(checkbox.value);
    if (checkbox.checked) {
      if (!this.selectedCategories.includes(id)) this.selectedCategories.push(id);
    } else {
      this.selectedCategories = this.selectedCategories.filter(cid => cid !== id);
    }
    this.render();
  },

  clearCategoryFilter() {
    this.selectedCategories = [];
    this.render();
  },

  async handleMarkAllPaid() {
    if (!confirm('Mark all pending recurrent items as paid?')) return;
    try {
      await recurrentExpenseRepository.markAllAsPaid();
      triggerHaptic('success');
      await this.render();
    } catch (err) {
      console.error('Failed to mark all as paid:', err);
      notificationUI.error('Failed: ' + err.message);
    }
  },

  async render(month) {
    if (month) this.setCurrentMonth(month);
    
    const container = document.getElementById('expenseBody');
    if (!container) return;

    await this.renderMonthPicker();
    await this.renderHeatmap();
    await this.renderCategoryFilter();

    const [recurrentRaw, oneOffRaw, categories, targets] = await Promise.all([
      recurrentExpenseRepository.getByMonth(this.selectedMonth),
      oneOffExpenseRepository.getByMonth(this.selectedMonth),
      categoryRepository.getCategories(),
      targetRepository.getAll()
    ]);

    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    // Normalize and merge
    const recurrent = recurrentRaw
      .filter(item => (item.nextDate || item.date || '').startsWith(this.selectedMonth))
      .map(item => ({ ...item, type: 'recurrent', displayDate: item.nextDate || item.date, displayLabel: item.label }));
    
    const oneOff = oneOffRaw.map(item => ({ ...item, type: 'oneoff', displayDate: item.date, displayLabel: item.note }));

    const merged = [...recurrent, ...oneOff];

    // Filter using utility
    const items = filterTransactions(merged, this.searchQuery, this.selectedCategories, ['displayLabel'], catMap);

    // Totals for summary
    const totalPence = items.reduce((s, i) => s + (i.amount || 0), 0);
    const recTotal = items.filter(i => i.type === 'recurrent').reduce((s, i) => s + (i.amount || 0), 0);
    const oneTotal = items.filter(i => i.type === 'oneoff').reduce((s, i) => s + (i.amount || 0), 0);

    // Build progress bars for summary
    const progressBars = [];
    const targetMap = new Map(targets.map(t => [t.bucket, t.amount]));
    
    if (targetMap.has('recurrent')) {
      const target = targetMap.get('recurrent');
      const percent = Math.min(Math.round((recTotal / target) * 100), 100);
      progressBars.push({ label: 'Recurrent Target', percent, color: percent >= 100 ? 'var(--danger)' : 'var(--accent)' });
    }
    if (targetMap.has('one-off')) {
      const target = targetMap.get('one-off');
      const percent = Math.min(Math.round((oneTotal / target) * 100), 100);
      progressBars.push({ label: 'One-off Target', percent, color: percent >= 100 ? 'var(--danger)' : 'var(--warn)' });
    }

    renderTabSummary('expensesSummary', [
      { 
        label: 'Total Expenses', 
        value: totalPence, 
        color: 'var(--danger)',
        progressBars
      }
    ]);

    if (this.reconciliationMode) {
      this.renderReconHeader(items);
    }

    if (items.length === 0) {
      container.innerHTML = '<tr><td colspan="3" class="hint" style="text-align:center;padding:20px">No matching expenses found for this month.</td></tr>';
      this.updateTotal(0);
      return;
    }

    // Sort by date desc
    items.sort((a, b) => b.displayDate.localeCompare(a.displayDate));

    container.innerHTML = items.map(item => {
      const catName = catMap[item.categoryId] || 'None';
      const isPaid = item.status === 'paid';
      const isFinished = item.type === 'recurrent' && item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal;
      const isReconciled = item.isReconciled === true;
      const isCleared = item.isCleared === true;
      const canSwipe = !isReconciled;
      const debtLinked = isDebtLinked(item);

      const badgeHTML = [];
      if (item.type === 'recurrent') {
        badgeHTML.push(`<span title="Recurring: ${item.frequency || 'monthly'}">🔁</span>`);
        if (item.isDebtPayment) {
          let icon = '💳';
          if (item.debtType === 'mortgage') icon = '🏠';
          else if (item.debtType === 'loan') icon = '💰';
          badgeHTML.push(`<span class="pill" style="background:var(--accent);color:#fff;font-size:.65rem">${icon} Debt</span>`);
        }
        if (item.cycleTotal > 0) {
          if (isFinished) badgeHTML.push(`<span class="pill" style="background:var(--success);color:#fff;font-size:.65rem">Finished</span>`);
          else badgeHTML.push(`<span class="pill" style="background:var(--bg-alt);font-size:.65rem">${(item.cycleCurrent || 0) + 1}/${item.cycleTotal}</span>`);
        }
      }
      if (typeof item.note === 'string' && item.note.startsWith('Tax-free Childcare:')) {
        badgeHTML.push(`<span class="pill" style="background:var(--info);color:#fff;font-size:.65rem">TFC</span>`);
      }
      if (isReconciled) {
        badgeHTML.push(`<span class="pill" style="background:var(--success); color:#fff; font-size:0.65rem">✓ Reconciled</span>`);
      }

      // Reconciliation mode renders a dedicated cleared checkbox column
      if (this.reconciliationMode) {
        return safeHTML`
          <tr class="swipe-row expense-row ${isPaid ? 'paid-row' : ''} ${isFinished ? 'finished-row' : ''} ${isReconciled ? 'reconciled-row' : ''} ${isCleared ? 'cleared-row' : ''}${debtLinked ? ' debt-linked' : ''}"
              data-id="${item.id}" data-type="${item.type}" data-debt-linked="${debtLinked}">
            <td class="col-date">${this._formatDateCompact(item.displayDate)}</td>
            <td class="col-expense">
              <span class="expense-name">${item.displayLabel || '—'}</span>
              <br>
              <span class="badge-chip">${catName}</span>
              ${renderStatusIcon(item.status)}
              <div style="display:flex; gap:4px; margin-top:2px; flex-wrap:wrap">${badgeHTML.join('')}</div>
            </td>
            <td class="col-amount r nw">
              <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px">
                <span class="privacy-blur">${formatGBP(item.amount)}</span>
                <input type="checkbox" ${isCleared ? 'checked' : ''} ${isReconciled ? 'disabled' : ''}
                  onclick="toggleExpCleared(${item.id}, '${item.type}', ${isCleared})"/>
              </div>
            </td>
          </tr>
        `;
      }

      return safeHTML`
        <tr class="swipe-row expense-row ${isPaid ? 'paid-row' : ''} ${isFinished ? 'finished-row' : ''} ${isReconciled ? 'reconciled-row' : ''} ${isCleared ? 'cleared-row' : ''}${debtLinked ? ' debt-linked' : ''}"
            data-id="${item.id}" data-type="${item.type}" data-debt-linked="${debtLinked}">
          <td class="col-date">
            ${canSwipe && !debtLinked ? `<div class="swipe-action-left">Edit</div>` : ''}
            ${canSwipe && !debtLinked ? `<div class="swipe-action-right">Delete</div>` : ''}
            ${this._formatDateCompact(item.displayDate)}
          </td>
          <td class="col-expense">
            <span class="expense-name">${item.displayLabel || '—'}</span>
            <br>
            <span class="badge-chip">${catName}</span>
            ${renderStatusIcon(item.status)}
            <div style="display:flex; gap:4px; margin-top:2px; flex-wrap:wrap">${badgeHTML.join('')}</div>
          </td>
          <td class="col-amount r nw"><span class="privacy-blur">${formatGBP(item.amount)}</span></td>
        </tr>
      `;
    }).join('');

    this.updateTotal(totalPence);
    this.setupGestures();
  },

  async renderHeatmap() {
    const container = document.getElementById('expensesTabHeatmapContainer');
    if (!container) return;

    try {
      const year = parseInt(this.selectedMonth.slice(0, 4), 10);
      const currentYearData = await getYearlyDailySpending(year);
      renderSpendingHeatmap('expensesTabHeatmapContainer', year, currentYearData);
    } catch (err) {
      console.warn('Could not render expenses tab heatmap:', err);
    }
  },

  /**
   * Initialize swipe gestures for all rows in the current render.
   * Debt-linked rows get click-to-navigate (Debts tab) instead of swipe.
   */
  setupGestures() {
    // Cleanup old instances
    this._swipeInstances.forEach(s => s.destroy());
    this._swipeInstances = [];

    const rows = document.querySelectorAll('#expenseBody .swipe-row');
    rows.forEach(row => {
      const isLocked = row.classList.contains('reconciled-row');
      const isLinked = row.dataset.debtLinked === 'true';

      // Debt-linked rows: navigate to Debts tab on click, no swipe
      if (isLinked) {
        row.style.cursor = 'pointer';
        row.onclick = (e) => {
          e.stopPropagation();
          const debtsTabBtn = document.querySelector('[data-tab="debts"]');
          if (debtsTabBtn) debtsTabBtn.click();
        };
        // Hide swipe action hints (defensive — debt rows don't render them, but guard anyway)
        const actionRight = row.querySelector('.swipe-action-right');
        const actionLeft  = row.querySelector('.swipe-action-left');
        if (actionRight) actionRight.style.display = 'none';
        if (actionLeft)  actionLeft.style.display  = 'none';
        return;
      }

      const instance = new SwipeHandler(row, {
        threshold: 80,
        edgeThreshold: 40,
        onStart: () => {
          // If another row is open, close it when we start swiping a new one
          if (this.currentOpenRow && this.currentOpenRow !== row) {
            this.closeAllRows();
          }
        },
        onSwipe: (deltaX) => {
          if (isLocked) {
            // "Thud" effect for locked rows: limit movement to 20px
            const limit = 20;
            const constrained = Math.min(limit, Math.max(-limit, deltaX));
            row.style.transform = `translateX(${constrained}px)`;
            return;
          }

          // Right swipe (positive delta) reveals Edit (on the left)
          // Left swipe (negative delta) reveals Delete (on the right)
          row.style.transform = `translateX(${deltaX}px)`;
          row.classList.add('swipe-active');
        },
        onEnd: (deltaX, isThresholdMet) => {
          if (isLocked) {
            row.style.transform = '';
            // If swiped significantly, trigger error haptic to indicate it's locked
            if (Math.abs(deltaX) > 10) {
              triggerHaptic('error');
            }
            return;
          }

          if (isThresholdMet) {
            // Keep the row open at the threshold offset so user can tap the revealed action
            const finalOffset = deltaX < 0 ? -80 : 80;
            row.style.transform = `translateX(${finalOffset}px)`;
            row.classList.add('swipe-active');
            this.currentOpenRow = row;
          } else {
            // Snap back if threshold not met
            row.style.transform = '';
            row.classList.remove('swipe-active');
            if (this.currentOpenRow === row) this.currentOpenRow = null;
          }
        }
      });

      // Wire up revealed action divs via JS (onclick attrs are stripped by DOMPurify)
      const rowId = Number(row.dataset.id);
      const rowType = row.dataset.type;
      const editDiv = row.querySelector('.swipe-action-left');
      const deleteDiv = row.querySelector('.swipe-action-right');
      if (editDiv) editDiv.addEventListener('click', () => this.editExpense(rowId, rowType));
      if (deleteDiv) deleteDiv.addEventListener('click', () => window.deleteExpense(rowId, rowType));

      // Close row on tap if it's currently open (but not on the action divs themselves)
      row.onclick = (e) => {
        if (this.currentOpenRow === row) {
          if (!e.target.classList.contains('swipe-action-left') && !e.target.classList.contains('swipe-action-right')) {
            this.closeAllRows();
          }
        }
      };

      this._swipeInstances.push(instance);
    });
  },

  renderReconHeader(items) {
    const header = document.getElementById('expReconHeader');
    if (!header) return;

    const clearedTotal = items.filter(i => i.isCleared).reduce((sum, i) => sum + i.amount, 0);
    const statementTotal = items.reduce((sum, i) => sum + i.amount, 0);
    const diff = statementTotal - clearedTotal;

    header.innerHTML = safeHTML`
      <div class="card-hd" style="display:flex; justify-content:space-between; align-items:center">
        <h3 style="font-size:0.9rem; color:var(--danger)">🔍 Expenses Reconciliation</h3>
        <button class="primary sm" onclick="expensesUI.finalizeReconciliation()">Finalize Reconciliation</button>
      </div>
      <div class="grid3" style="padding:15px; gap:15px">
        <div>
          <div class="sum-label">Cleared Total</div>
          <div class="sum-val" style="color:var(--danger); font-size:1.1rem">${formatGBP(clearedTotal)}</div>
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
        Match your bank statement by checking "Cleared" for each expense. 
        Once the Difference is £0.00, click Finalize to lock the month.
      </div>
    `;
  },

  async finalizeReconciliation() {
    const monthStr = this.selectedMonth;
    const [recurrent, oneoff] = await Promise.all([
      recurrentExpenseRepository.getByMonth(monthStr),
      oneOffExpenseRepository.getByMonth(monthStr)
    ]);

    const items = [...recurrent, ...oneoff];
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
        const repo = item.frequency ? recurrentExpenseRepository : oneOffExpenseRepository;
        await repo.update(item.id, { isReconciled: true });
      }
      notificationUI.success('Reconciliation finalized successfully.');
      this.toggleReconciliationMode();
      await this.render();
    } catch (err) {
      console.error('Failed to finalize reconciliation:', err);
      notificationUI.error('Failed: ' + err.message);
    }
  },

  /**
   * Specialized confirmation for debt payments.
   */
  async showDebtPaymentConfirmation(item) {
    const today = new Date().toISOString().slice(0, 10);
    const suggestedDate = await nextWorkingDay(today, true);
    
    const content = safeHTML`
      <div style="margin-bottom:15px">
        <p>Minimum payment for <strong>${item.label}</strong> is <strong>${formatGBP(item.amount)}</strong>.</p>
        <p class="hint">How much did you actually pay and when?</p>
      </div>
      <div class="form-row">
        <div>
          <label>Actual Amount (£)</label>
          <input id="debtActualAmt" type="number" step="0.01" value="${fromPence(item.amount).toFixed(2)}"/>
        </div>
        <div>
          <label>Payment Date</label>
          <input id="debtPaymentDate" type="date" value="${suggestedDate}"/>
        </div>
      </div>
    `;

    const footer = safeHTML`
      <div style="display:flex; justify-content:flex-end; gap:8px; width:100%">
        <button class="ghost" onclick="templateUI.closeModal()">Cancel</button>
        <button class="primary" id="confirmDebtPayBtn">Confirm Payment</button>
      </div>
    `;

    templateUI.showModal('Confirm Debt Payment', content, footer);

    const confirmBtn = document.getElementById('confirmDebtPayBtn');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const actualAmt = document.getElementById('debtActualAmt').value;
        const paymentDate = document.getElementById('debtPaymentDate').value;
        
        if (!actualAmt || isNaN(actualAmt) || !paymentDate) {
          notificationUI.warning('Please provide a valid amount and date.');
          return;
        }

        try {
          await statementRepository.recordPayment(item.linkedStatementId, actualAmt, paymentDate);
          templateUI.closeModal();
          await this.render();
          // Broadcast refresh for Debts tab
          window.dispatchEvent(new CustomEvent('app:refresh'));
        } catch (err) {
          console.error('Failed to record debt payment:', err);
          notificationUI.error('Error: ' + err.message);
        }
      };
    }
  },

  /**
   * Formats a date string as a two-line compact display: dd-MMM on line 1, YYYY on line 2.
   */
  _formatDateCompact(dateStr) {
    const d = new Date(dateStr);
    const dd  = String(d.getDate()).padStart(2, '0');
    const mmm = d.toLocaleString('en-GB', { month: 'short' });
    const yyyy = d.getFullYear();
    return `<span class="date-compact">${dd}-${mmm}<br><span class="date-year">${yyyy}</span></span>`;
  },

  updateTotal(totalPence) {
    const panel = document.querySelector('[data-panel="expenses"]');
    if (!panel) return;

    let totalEl = document.getElementById('expenses-total-unified');
    if (!totalEl) {
      totalEl = document.createElement('div');
      totalEl.id = 'expenses-total-unified';
      totalEl.style.cssText = 'text-align:right;padding:10px;font-weight:bold;border-top:1px solid var(--border)';
      panel.appendChild(totalEl);
    }

    totalEl.textContent = `Filtered Total: ${formatGBP(totalPence)}`;
  }
};

window.expensesUI = expensesUI;
