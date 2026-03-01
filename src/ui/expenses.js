import {
  recurrentExpenseRepository,
  oneOffExpenseRepository,
  categoryRepository
} from '../db/repository.js';
import { formatGBP, toPence } from '../utils/currency.js';
import { safeHTML } from './render.js';

/**
 * Expenses UI Module
 * Handles the unified "Expenses" tab with "Recurrent" and "One-off" sub-views.
 */
export const expensesUI = {
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  activeSubTab: 'recurrent',

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
        this._syncFormPanels();
        await this.render(this.currentMonth);
      });
    }

    // Add Recurrent Expense
    const addRecBtn = document.getElementById('addRecBtn');
    if (addRecBtn) {
      addRecBtn.addEventListener('click', () => this.handleAddRecurrent());
    }

    // Add One-off Expense
    const addOneOffBtn = document.getElementById('addOneOffBtn');
    if (addOneOffBtn) {
      addOneOffBtn.addEventListener('click', () => this.handleAddOneOff());
    }

    // Mark all as paid
    const markAllBtn = document.getElementById('markAllPaidBtn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => this.handleMarkAllPaid());
    }

    // Global delete handlers (called via onclick in table rows)
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
        const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
        const updates = { status: newStatus };
        // If marking paid and item has cycles, increment cycleCurrent
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

  async handleAddRecurrent() {
    const date = document.getElementById('recDate').value;
    const categoryId = document.getElementById('recCat').value;
    const label = document.getElementById('recLabel').value.trim();
    const amount = parseFloat(document.getElementById('recAmt').value);
    const frequency = document.getElementById('recFreq').value;
    const nextDate = document.getElementById('recNextDate').value;
    const isEssential = document.getElementById('recIsEssential').checked;
    const cycleTotal = parseInt(document.getElementById('recCycleTotal').value) || 0;
    const endDate = document.getElementById('recEndDate').value || null;

    if (!label || isNaN(amount) || amount <= 0) {
      alert('Please provide at least a description and a valid amount.');
      return;
    }

    try {
      await recurrentExpenseRepository.add({
        date: date || new Date().toISOString().slice(0, 10),
        categoryId: categoryId && categoryId !== '__other' ? parseInt(categoryId) : null,
        label,
        amount,
        status: 'pending',
        frequency,
        nextDate: nextDate || date || new Date().toISOString().slice(0, 10),
        isEssential,
        cycleTotal,
        cycleCurrent: 0,
        endDate
      });

      // Clear form fields (keep date/category for convenience)
      document.getElementById('recLabel').value = '';
      document.getElementById('recAmt').value = '';
      document.getElementById('recNextDate').value = '';
      document.getElementById('recCycleTotal').value = '';
      document.getElementById('recEndDate').value = '';

      await this.render(this.currentMonth);
    } catch (err) {
      console.error('Failed to add recurrent expense:', err);
      alert('Failed to add: ' + err.message);
    }
  },

  async handleAddOneOff() {
    const date = document.getElementById('oneOffDate').value;
    const categoryId = document.getElementById('oneOffCat').value;
    const note = document.getElementById('oneOffNote').value.trim();
    const amount = parseFloat(document.getElementById('oneOffAmt').value);

    if (!date || isNaN(amount) || amount <= 0) {
      alert('Please fill in the date and a valid amount.');
      return;
    }

    try {
      await oneOffExpenseRepository.add({
        date,
        categoryId: categoryId && categoryId !== '__other' ? parseInt(categoryId) : null,
        note,
        amount
      });

      document.getElementById('oneOffNote').value = '';
      document.getElementById('oneOffAmt').value = '';

      await this.render(this.currentMonth);
    } catch (err) {
      console.error('Failed to add one-off expense:', err);
      alert('Failed to add: ' + err.message);
    }
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

  /**
   * Sync form panels and list container visibility to the active sub-tab.
   */
  _syncFormPanels() {
    const recurrentForm = document.getElementById('recurrentFormPanel');
    const oneOffForm = document.getElementById('oneOffFormPanel');
    const markAllRow = document.getElementById('markAllPaidRow');
    const recurrentList = document.getElementById('recurrentList');
    const oneOffList = document.getElementById('oneOffList');

    const isRecurrent = this.activeSubTab === 'recurrent';

    if (recurrentForm) recurrentForm.style.display = isRecurrent ? '' : 'none';
    if (oneOffForm) oneOffForm.style.display = isRecurrent ? 'none' : '';
    if (markAllRow) markAllRow.style.display = isRecurrent ? '' : 'none';
    if (recurrentList) recurrentList.style.display = isRecurrent ? '' : 'none';
    if (oneOffList) oneOffList.style.display = isRecurrent ? 'none' : '';
  },

  /**
   * Main render entry point — delegates to the active sub-tab.
   * @param {string} month - YYYY-MM
   */
  async render(month) {
    if (month) this.currentMonth = month;

    // Sync form/list visibility
    this._syncFormPanels();

    // Populate category dropdowns if they exist
    await this.populateCategoryDropdowns();

    if (this.activeSubTab === 'recurrent') {
      await this.renderRecurrent();
    } else {
      await this.renderOneOff();
    }
  },

  /**
   * Populate the category <select> elements inside the Expenses panel.
   * Preserves the user's current selection while refreshing the option list.
   */
  async populateCategoryDropdowns() {
    const categories = await categoryRepository.getCategories();

    const fillSelect = (id) => {
      const el = document.getElementById(id);
      if (!el) return;
      // Remember the current selection before repopulating
      const currentVal = el.value;
      el.innerHTML = '<option value="">— Category —</option>' +
        categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      // Restore selection if it still exists
      if (currentVal) el.value = currentVal;
    };

    fillSelect('recCat');
    fillSelect('oneOffCat');
  },

  /**
   * Render the Recurrent sub-view: Essential and Non-essential groups.
   */
  async renderRecurrent() {
    const container = document.getElementById('recurrentList');
    if (!container) return;

    const items = await recurrentExpenseRepository.getByMonth(this.currentMonth);
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    // Sort by nextDate ascending (due-date ordering per context spec)
    items.sort((a, b) => (a.nextDate || '').localeCompare(b.nextDate || ''));

    const essential = items.filter(i => i.isEssential);
    const nonEssential = items.filter(i => !i.isEssential);

    const essentialTotal = essential.reduce((s, i) => s + (i.amount || 0), 0);
    const nonEssentialTotal = nonEssential.reduce((s, i) => s + (i.amount || 0), 0);
    const grandTotal = essentialTotal + nonEssentialTotal;

    if (items.length === 0) {
      container.innerHTML = '<p class="hint" style="text-align:center;padding:20px">No recurrent items. Add one above.</p>';
      this.updateTotal('recurrent', 0);
      return;
    }

    const renderRow = (item) => {
      const catName = catMap[item.categoryId] || 'None';
      const isPaid = item.status === 'paid';
      const isFinished = item.cycleTotal > 0 && (item.cycleCurrent || 0) >= item.cycleTotal;

      // Payment progress badge
      let progressBadge = '';
      if (item.cycleTotal > 0) {
        const current = item.cycleCurrent || 0;
        if (isFinished) {
          progressBadge = `<span class="pill" style="background:var(--success);color:#fff;font-size:.65rem">Finished</span>`;
        } else {
          progressBadge = `<span class="pill" style="background:var(--bg-alt);font-size:.65rem">Payment ${current + 1} of ${item.cycleTotal}</span>`;
        }
      }

      // Cancel badge for non-essential items with endDate
      let cancelBadge = '';
      if (!item.isEssential && item.endDate) {
        cancelBadge = `<span class="pill" style="background:var(--warn);color:#000;font-size:.65rem" title="Ends ${item.endDate}">Cancelable</span>`;
      }

      return safeHTML`
        <tr class="${isPaid ? 'paid-row' : ''} ${isFinished ? 'finished-row' : ''}">
          <td>${item.nextDate || item.date}</td>
          <td>${catName}</td>
          <td>
            ${item.label}
            ${progressBadge}
            ${cancelBadge}
          </td>
          <td>${item.frequency || 'monthly'}</td>
          <td class="r">${formatGBP(item.amount)}</td>
          <td class="r">
            <button class="sm ${isPaid ? 'success' : 'ghost'}" onclick="toggleRecurrentStatus(${item.id}, '${item.status}')">
              ${isPaid ? 'Paid' : 'Mark Paid'}
            </button>
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

    container.innerHTML = `
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

    this.updateTotal('recurrent', grandTotal);
  },

  /**
   * Render the One-off sub-view: simple date-sorted list.
   */
  async renderOneOff() {
    const container = document.getElementById('oneOffList');
    if (!container) return;

    const items = await oneOffExpenseRepository.getByMonth(this.currentMonth);
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    // Sort by date descending
    items.sort((a, b) => b.date.localeCompare(a.date));

    if (items.length === 0) {
      container.innerHTML = '<p class="hint" style="text-align:center;padding:20px">No one-off expenses for this month.</p>';
      this.updateTotal('oneoff', 0);
      return;
    }

    const total = items.reduce((s, i) => s + (i.amount || 0), 0);

    const renderNoteCell = (item) => {
      const note = item.note || '—';
      const isTFC = typeof item.note === 'string' && item.note.startsWith('Tax-free Childcare:');
      const badge = isTFC
        ? `<span class="pill" style="background:var(--info);color:#fff;font-size:.65rem;margin-left:4px">Tax-free Childcare</span>`
        : '';
      return `${note}${badge}`;
    };

    container.innerHTML = `
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
            <tr>
              <td>${item.date}</td>
              <td>${catMap[item.categoryId] || 'None'}</td>
              <td>${renderNoteCell(item)}</td>
              <td class="r">${formatGBP(item.amount)}</td>
              <td class="r">
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
   * Update the total display element at the bottom of the active sub-panel.
   * @param {'recurrent'|'oneoff'} type
   * @param {number} totalPence
   */
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

    const label = type === 'recurrent' ? 'Total Recurrent' : 'Total One-off';
    totalEl.textContent = `${label}: ${formatGBP(totalPence)}`;
  }
};
