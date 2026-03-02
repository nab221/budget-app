import {
  recurrentExpenseRepository,
  oneOffExpenseRepository,
  categoryRepository,
  statementRepository
} from '../db/repository.js';
import { formatGBP, toPence, fromPence } from '../utils/currency.js';
import { safeHTML } from './render.js';
import { filterTransactions } from '../utils/filtering.js';
import { templateUI } from './templates.js';
import { nextWorkingDay } from '../utils/cashflow.js';

/**
 * Expenses UI Module
 * Handles the unified "Expenses" tab with "Recurrent" and "One-off" sub-views.
 */
export const expensesUI = {
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  activeSubTab: 'recurrent',
  lastSubTab: 'recurrent',
  editingId: null,
  searchQuery: '',
  selectedCategories: [],

  /**
   * Initialize the Expenses UI — bind events and do first render.
   */
  async init() {
    this.setupEventListeners();
    window.addEventListener('app:refresh', () => this.render(this.currentMonth));
    await this.render(this.currentMonth);
  },

  /**
   * Wire up all event listeners for forms, sub-tabs, and global action buttons.
   */
  setupEventListeners() {
    // Month picker sync
    const monthPicker = document.getElementById('monthPicker');
    if (monthPicker) {
      this.currentMonth = monthPicker.value || this.currentMonth;
      monthPicker.addEventListener('change', async (e) => {
        this.currentMonth = e.target.value;
        this.resetFilters();
        this.toggleForm(false);
        await this.render(this.currentMonth);
      });
    }

    // Sub-tab navigation
    const subTabs = document.getElementById('expenseSubTabs');
    if (subTabs) {
      subTabs.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-subtab]');
        if (!btn) return;
        this.activeSubTab = btn.dataset.subtab;
        subTabs.querySelectorAll('[data-subtab]').forEach(b =>
          b.classList.toggle('active', b === btn)
        );
        this.resetFilters();
        await this.render(this.currentMonth);
      });
    }

    // Toggle Expense Form
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    if (addExpenseBtn) {
      addExpenseBtn.onclick = () => this.toggleForm();
    }

    // Call Templates Manual Trigger
    const callTemplatesBtn = document.getElementById('callTemplatesBtn');
    if (callTemplatesBtn) {
      callTemplatesBtn.onclick = () => templateUI.manualTrigger(this.currentMonth);
    }

    // Search Input
    const searchInput = document.getElementById('expSearch');
    if (searchInput) {
      searchInput.oninput = (e) => {
        this.searchQuery = e.target.value;
        this.render(this.currentMonth);
      };
    }

    // Mark all as paid
    const markAllBtn = document.getElementById('markAllPaidBtn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => this.handleMarkAllPaid());
    }

    // Global delete handlers
    window.deleteRecurrentExpense = async (id) => {
      if (!confirm('Delete this recurrent expense?')) return;
      try {
        await recurrentExpenseRepository.delete(id);
        await this.render(this.currentMonth);
      } catch (err) {
        console.error('Failed to delete recurrent expense:', err);
        alert('Failed to delete: ' + err.message);
      }
    };

    window.deleteOneOffExpense = async (id) => {
      if (!confirm('Delete this one-off expense?')) return;
      try {
        await oneOffExpenseRepository.delete(id);
        await this.render(this.currentMonth);
      } catch (err) {
        console.error('Failed to delete one-off expense:', err);
        alert('Failed to delete: ' + err.message);
      }
    };

    window.toggleRecurrentStatus = async (id, currentStatus) => {
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
              await this.render(this.currentMonth);
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
        await this.render(this.currentMonth);
      } catch (err) {
        console.error('Failed to toggle status:', err);
      }
    };
  },

  resetFilters() {
    this.searchQuery = '';
    this.selectedCategories = [];
    const searchInput = document.getElementById('expSearch');
    if (searchInput) searchInput.value = '';
  },

  toggleForm(show = true) {
    const container = document.getElementById('expenseFormContainer');
    if (!container) return;
    
    if (show) {
      container.classList.remove('hidden');
      this.renderForm();
    } else {
      container.classList.add('hidden');
      this.editingId = null;
    }
  },

  async renderForm() {
    const container = document.getElementById('expenseFormContainer');
    if (!container) return;

    const categories = await categoryRepository.getCategories();
    const isRecurrent = this.activeSubTab === 'recurrent';
    const isUpdate = !!this.editingId;

    let data = {};
    if (isRecurrent) {
      data = {
        date: new Date().toISOString().slice(0, 10),
        categoryId: '',
        label: '',
        amount: '',
        frequency: 'monthly',
        nextDate: new Date().toISOString().slice(0, 10),
        isEssential: true,
        cycleTotal: '',
        endDate: ''
      };
      if (isUpdate) {
        const item = await recurrentExpenseRepository.get(this.editingId);
        if (item) data = { ...item, amount: (item.amount / 100).toFixed(2) };
      }
    } else {
      data = {
        date: new Date().toISOString().slice(0, 10),
        categoryId: '',
        note: '',
        amount: ''
      };
      if (isUpdate) {
        const item = await oneOffExpenseRepository.get(this.editingId);
        if (item) data = { ...item, amount: (item.amount / 100).toFixed(2) };
      }
    }

    container.className = `card ${isUpdate ? 'update-mode' : ''}`;
    
    const categoryOptions = categories
      .filter(c => c.group === (isRecurrent ? 'fixed' : 'variable'))
      .map(c => `<option value="${c.id}" ${Number(data.categoryId) === c.id ? 'selected' : ''}>${c.name}</option>`)
      .join('');

    if (isRecurrent) {
      container.innerHTML = safeHTML`
        <div class="card-hd">
          <h2 style="font-size: 0.85rem; color: ${isUpdate ? 'var(--accent)' : 'var(--text-soft)'}">
            ${isUpdate ? '📝 Update Recurrent Expense' : '➕ Add Recurrent Expense'}
          </h2>
        </div>
        <div class="form-row">
          <div><label>Date</label><input id="expDate" type="date" value="${data.date}"/></div>
          <div><label>Category</label><select id="expCat"><option value="">— Category —</option>${categoryOptions}</select></div>
        </div>
        <div class="form-row">
          <div><label>Description</label><input id="expLabel" type="text" value="${data.label}" placeholder="e.g. Rent"/></div>
        </div>
        <div class="form-row">
          <div><label>Amount (£)</label><input id="expAmt" type="number" step="0.01" value="${data.amount}" placeholder="0.00"/></div>
          <div><label>Frequency</label>
            <select id="expFreq">
              <option value="monthly" ${data.frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="weekly" ${data.frequency === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="quarterly" ${data.frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
              <option value="annual" ${data.frequency === 'annual' ? 'selected' : ''}>Annual</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div><label>Next Due Date</label><input id="expNextDate" type="date" value="${data.nextDate}"/></div>
          <div><label>Total Payments</label><input id="expCycleTotal" type="number" min="0" value="${data.cycleTotal}" placeholder="0 = ongoing"/></div>
        </div>
        <div class="form-row">
          <div><label>End Date</label><input id="expEndDate" type="date" value="${data.endDate || ''}"/></div>
          <div style="display:flex;align-items:center;gap:6px;padding-top:18px">
            <input id="expIsEssential" type="checkbox" ${data.isEssential ? 'checked' : ''}/>
            <label for="expIsEssential" style="margin:0">Essential</label>
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px;flex:2">
            <button class="primary" onclick="expensesUI.handleSaveExpense()">${isUpdate ? 'Save Changes' : 'Add Expense'}</button>
            <button class="ghost" onclick="expensesUI.cancelEdit()">${isUpdate ? 'Cancel' : 'Hide'}</button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = safeHTML`
        <div class="card-hd">
          <h2 style="font-size: 0.85rem; color: ${isUpdate ? 'var(--accent)' : 'var(--text-soft)'}">
            ${isUpdate ? '📝 Update One-off Expense' : '➕ Add One-off Expense'}
          </h2>
        </div>
        <div class="form-row">
          <div><label>Date</label><input id="expDate" type="date" value="${data.date}"/></div>
          <div><label>Category</label><select id="expCat"><option value="">— Category —</option>${categoryOptions}</select></div>
          <div><label>Note</label><input id="expNote" type="text" value="${data.note}" placeholder="Optional"/></div>
          <div><label>Amount (£)</label><input id="expAmt" type="number" step="0.01" value="${data.amount}" placeholder="0.00"/></div>
          <div style="display:flex;align-items:flex-end;gap:8px">
            <button class="primary" onclick="expensesUI.handleSaveExpense()">${isUpdate ? 'Save Changes' : 'Add Expense'}</button>
            <button class="ghost" onclick="expensesUI.cancelEdit()">${isUpdate ? 'Cancel' : 'Hide'}</button>
          </div>
        </div>
      `;
    }

    if (isUpdate) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  async handleSaveExpense() {
    const isRecurrent = this.activeSubTab === 'recurrent';
    const date = document.getElementById('expDate').value;
    const categoryId = document.getElementById('expCat').value;
    const amount = parseFloat(document.getElementById('expAmt').value);

    if (isNaN(amount) || amount <= 0) {
      alert('Please provide a valid amount.');
      return;
    }

    try {
      if (isRecurrent) {
        const label = document.getElementById('expLabel').value.trim();
        if (!label) { alert('Description is required.'); return; }
        
        const payload = {
          date: date || new Date().toISOString().slice(0, 10),
          categoryId: categoryId ? parseInt(categoryId) : null,
          label,
          amount,
          frequency: document.getElementById('expFreq').value,
          nextDate: document.getElementById('expNextDate').value || date,
          isEssential: document.getElementById('expIsEssential').checked,
          cycleTotal: parseInt(document.getElementById('expCycleTotal').value) || 0,
          endDate: document.getElementById('expEndDate').value || null
        };

        if (this.editingId) {
          await recurrentExpenseRepository.update(this.editingId, payload);
        } else {
          await recurrentExpenseRepository.add({ ...payload, status: 'pending', cycleCurrent: 0 });
        }
      } else {
        const note = document.getElementById('expNote').value.trim();
        const payload = {
          date,
          categoryId: categoryId ? parseInt(categoryId) : null,
          note,
          amount
        };

        if (this.editingId) {
          await oneOffExpenseRepository.update(this.editingId, payload);
        } else {
          await oneOffExpenseRepository.add(payload);
        }
      }

      const savedId = this.editingId;
      this.toggleForm(false);
      await this.render(this.currentMonth);

      if (savedId) {
        const row = document.querySelector(`tr[data-id="${savedId}"]`);
        if (row) {
          row.classList.add('row-flash');
          setTimeout(() => row.classList.remove('row-flash'), 1500);
        }
      }
    } catch (err) {
      console.error('Failed to save expense:', err);
      alert('Failed to save: ' + err.message);
    }
  },

  cancelEdit() {
    if (this.editingId && !confirm('Discard changes?')) return;
    this.toggleForm(false);
  },

  async editExpense(id) {
    if (this.editingId && this.editingId !== id) {
      if (!confirm('Discard changes to the current item?')) return;
    }
    this.editingId = id;
    this.toggleForm(true);
  },

  async renderCategoryFilter() {
    const container = document.getElementById('expCategoryFilterContainer');
    if (!container) return;

    const categories = await categoryRepository.getCategories();
    const isRecurrent = this.activeSubTab === 'recurrent';
    const expenseCats = categories.filter(c => c.group === (isRecurrent ? 'fixed' : 'variable'));

    container.innerHTML = safeHTML`
      <div class="custom-select" style="position:relative">
        <button class="sm ghost" onclick="expensesUI.toggleCategoryDropdown()">
          Categories (${this.selectedCategories.length || 'All'})
        </button>
        <div id="catDropdown" class="card hidden" style="position:absolute; top:100%; right:0; z-index:100; min-width:200px; padding:12px; margin-top:5px; box-shadow: var(--shadow); border: 1px solid var(--border)">
          <div style="max-height: 200px; overflow-y: auto; margin-bottom: 10px">
            ${expenseCats.map(c => `
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
    this.render(this.currentMonth);
  },

  clearCategoryFilter() {
    this.selectedCategories = [];
    this.render(this.currentMonth);
  },

  async handleMarkAllPaid() {
    if (!confirm('Mark all pending recurrent items as paid?')) return;
    try {
      await recurrentExpenseRepository.markAllAsPaid();
      await this.render(this.currentMonth);
    } catch (err) {
      console.error('Failed to mark all as paid:', err);
      alert('Failed: ' + err.message);
    }
  },

  _syncFormPanels() {
    const markAllRow = document.getElementById('markAllPaidRow');
    const recurrentList = document.getElementById('recurrentList');
    const oneOffList = document.getElementById('oneOffList');
    const container = document.getElementById('expenseFormContainer');

    if (this.lastSubTab !== this.activeSubTab) {
      this.editingId = null;
      if (container) container.classList.add('hidden');
      this.lastSubTab = this.activeSubTab;
    }

    const isRecurrent = this.activeSubTab === 'recurrent';
    if (markAllRow) markAllRow.style.display = isRecurrent ? '' : 'none';
    if (recurrentList) recurrentList.style.display = isRecurrent ? '' : 'none';
    if (oneOffList) oneOffList.style.display = isRecurrent ? 'none' : '';
  },

  async render(month) {
    if (month) this.currentMonth = month;
    this._syncFormPanels();
    await this.renderCategoryFilter();

    if (this.activeSubTab === 'recurrent') {
      await this.renderRecurrent();
    } else {
      await this.renderOneOff();
    }
  },

  async renderRecurrent() {
    const container = document.getElementById('recurrentList');
    if (!container) return;

    const allItems = await recurrentExpenseRepository.getByMonth(this.currentMonth);
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    // Apply Filter using utility
    const items = filterTransactions(allItems, this.searchQuery, this.selectedCategories, ['label'], catMap);

    if (items.length === 0) {
      container.innerHTML = '<p class="hint" style="text-align:center;padding:20px">No matching recurrent items found.</p>';
      this.updateTotal('recurrent', 0);
      return;
    }

    items.sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));

    const essential = items.filter(i => i.isEssential);
    const nonEssential = items.filter(i => !i.isEssential);

    const essentialTotal = essential.reduce((s, i) => s + (i.amount || 0), 0);
    const nonEssentialTotal = nonEssential.reduce((s, i) => s + (i.amount || 0), 0);
    const filteredTotal = essentialTotal + nonEssentialTotal;

    const renderRow = (item) => {
      const catName = catMap[item.categoryId] || 'None';
      const isPaid = item.status === 'paid';
      const isFinished = item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal;

      let progressBadge = '';
      if (item.cycleTotal > 0) {
        const current = item.cycleCurrent || 0;
        if (isFinished) {
          progressBadge = `<span class="pill" style="background:var(--success);color:#fff;font-size:.65rem">Finished</span>`;
        } else {
          progressBadge = `<span class="pill" style="background:var(--bg-alt);font-size:.65rem">Payment ${current + 1} of ${item.cycleTotal}</span>`;
        }
      }

      const cancelBadge = !item.isEssential && item.endDate
        ? `<span class="pill" style="background:var(--warn);color:#000;font-size:.65rem" title="Ends ${item.endDate}">Cancelable</span>`
        : '';

      const debtBadge = item.isDebtPayment 
        ? `<span class="pill" style="background:var(--accent);color:#fff;font-size:.65rem">💳 Debt</span>`
        : '';

      return safeHTML`
        <tr class="${isPaid ? 'paid-row' : ''} ${isFinished ? 'finished-row' : ''}" data-id="${item.id}">
          <td>${item.nextDate || item.date}</td>
          <td>${catName}</td>
          <td>
            ${item.label}
            ${progressBadge}
            ${cancelBadge}
            ${debtBadge}
          </td>
          <td>${item.frequency || 'monthly'}</td>
          <td class="r">${formatGBP(item.amount)}</td>
          <td class="r nw">
            <button class="sm ${isPaid ? 'success' : 'ghost'}" onclick="toggleRecurrentStatus(${item.id}, '${item.status}')">
              ${isPaid ? 'Paid' : 'Mark Paid'}
            </button>
            <button class="sm ghost" onclick="expensesUI.editExpense(${item.id})">Edit</button>
            <button class="sm danger" onclick="deleteRecurrentExpense(${item.id})">✕</button>
          </td>
        </tr>
      `;
    };

    const essentialSection = essential.length > 0 ? `
      <tr>
        <td colspan="6" style="padding:8px 6px 4px;font-weight:600;font-size:.8rem;color:var(--text-soft);background:var(--bg-alt)">
          ESSENTIAL — ${formatGBP(essentialTotal)}
        </td>
      </tr>
      ${essential.map(renderRow).join('')}
    ` : '';

    const nonEssentialSection = nonEssential.length > 0 ? `
      <tr>
        <td colspan="6" style="padding:8px 6px 4px;font-weight:600;font-size:.8rem;color:var(--text-soft);background:var(--bg-alt)">
          NON-ESSENTIAL — ${formatGBP(nonEssentialTotal)}
        </td>
      </tr>
      ${nonEssential.map(renderRow).join('')}
    ` : '';

    container.innerHTML = safeHTML`
      <table class="tbl">
        <thead>
          <tr>
            <th>Due Date</th>
            <th>Category</th>
            <th>Description</th>
            <th>Freq</th>
            <th class="r">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${essentialSection}
          ${nonEssentialSection}
        </tbody>
      </table>
    `;

    this.updateTotal('recurrent', filteredTotal);
  },

  async renderOneOff() {
    const container = document.getElementById('oneOffList');
    if (!container) return;

    const allItems = await oneOffExpenseRepository.getByMonth(this.currentMonth);
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    // Apply Filter using utility
    const items = filterTransactions(allItems, this.searchQuery, this.selectedCategories, ['note'], catMap);

    if (items.length === 0) {
      container.innerHTML = '<p class="hint" style="text-align:center;padding:20px">No matching one-off expenses found.</p>';
      this.updateTotal('oneoff', 0);
      return;
    }

    items.sort((a, b) => b.date.localeCompare(a.date));

    const total = items.reduce((s, i) => s + (i.amount || 0), 0);

    const renderNoteCell = (item) => {
      const note = item.note || '—';
      const isTFC = typeof item.note === 'string' && item.note.startsWith('Tax-free Childcare:');
      const badge = isTFC
        ? `<span class="pill" style="background:var(--info);color:#fff;font-size:.65rem;margin-left:4px">Tax-free Childcare</span>`
        : '';
      return `${note}${badge}`;
    };

    container.innerHTML = safeHTML`
      <table class="tbl">
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Note</th>
            <th class="r">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => safeHTML`
            <tr data-id="${item.id}">
              <td>${item.date}</td>
              <td>${catMap[item.categoryId] || 'None'}</td>
              <td>${renderNoteCell(item)}</td>
              <td class="r">${formatGBP(item.amount)}</td>
              <td class="r nw">
                <button class="sm ghost" onclick="expensesUI.editExpense(${item.id})">Edit</button>
                <button class="sm danger" onclick="deleteOneOffExpense(${item.id})">✕</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    this.updateTotal('oneoff', total);
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
          alert('Please provide a valid amount and date.');
          return;
        }

        try {
          await statementRepository.recordPayment(item.linkedStatementId, actualAmt, paymentDate);
          templateUI.closeModal();
          await this.render(this.currentMonth);
          // Broadcast refresh for Debts tab
          window.dispatchEvent(new CustomEvent('app:refresh'));
        } catch (err) {
          console.error('Failed to record debt payment:', err);
          alert('Error: ' + err.message);
        }
      };
    }
  },

  updateTotal(type, totalPence) {
    const panel = document.querySelector('[data-panel="expenses"]');
    if (!panel) return;

    const totalId = `expenses-total-${type}`;
    let totalEl = document.getElementById(totalId);
    if (!totalEl) {
      totalEl = document.createElement('div');
      totalEl.id = totalId;
      totalEl.style.cssText = 'text-align:right;padding:10px;font-weight:bold;border-top:1px solid var(--border)';
      panel.appendChild(totalEl);
    }

    const label = type === 'recurrent' ? 'Filtered Recurrent' : 'Filtered One-off';
    totalEl.textContent = `${label}: ${formatGBP(totalPence)}`;
  }
};

window.expensesUI = expensesUI;
