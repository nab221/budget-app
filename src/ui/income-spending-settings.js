/**
 * income-spending-settings.js — Phase 33 Settings UI module.
 *
 * Renders and manages:
 *   - Income Sources section (row-based, unbounded, add/edit/delete/reorder)
 *   - Spending Buckets section (row-based, add/edit/delete/reorder)
 *
 * Each income source row shows its next projected nominal date and
 * banking-calendar-adjusted payday from src/utils/income.js.
 *
 * Strictly configuration-only. No affordability dashboard, no pay-period
 * navigation, no current-balance entry — those are Phase 34 concerns.
 */

import { incomeSourceRepository, spendingBucketRepository } from '../db/repository.js';
import { getNextIncomeEvent } from '../utils/income.js';
import { notificationUI } from './notifications.js';
import { triggerHaptic } from '../utils/haptics.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple HTML escaping to prevent XSS from user-entered strings.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format a pence integer as a pounds string (e.g. 350000 -> "3500.00").
 * @param {number} pence
 * @returns {string}
 */
function penceToStr(pence) {
  return ((pence ?? 0) / 100).toFixed(2);
}

/**
 * Parse a pounds string to pence integer.
 * @param {string} str
 * @returns {number}
 */
function strToPence(str) {
  const val = parseFloat(str) || 0;
  return Math.round(val * 100);
}

/**
 * Format a YYYY-MM-DD date string as a human-readable short date.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${day} ${months[month - 1]} ${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Return today's date as YYYY-MM-DD.
 * @returns {string}
 */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Income Sources section
// ---------------------------------------------------------------------------

/**
 * Render a single income source row.
 * @param {{ id: number, name: string, monthlyAmount: number, payDateRule: string,
 *           payDateDay: number|null, isActive: boolean, displayOrder: number }} source
 * @returns {string} HTML string for the row
 */
function _renderSourceRow(source) {
  const event = getNextIncomeEvent(source, todayStr());
  const nominalStr = event ? formatDate(event.nominalDate) : 'N/A';
  const adjustedStr = event ? formatDate(event.adjustedDate) : 'N/A';
  const sameDay = event && event.nominalDate === event.adjustedDate;

  const ruleLabel = {
    'nth-of-month': source.payDateDay ? `Day ${source.payDateDay} of month` : 'Nth of month',
    'last-day': 'Last day of month',
    'last-working-day': 'Last working day'
  }[source.payDateRule] || source.payDateRule;

  const payDayHtml = sameDay
    ? `<span class="hint">${adjustedStr}</span>`
    : `<span class="hint"><s style="opacity:.5">${nominalStr}</s> &rarr; ${adjustedStr}</span>`;

  return `
    <tr data-source-id="${source.id}">
      <td>
        <strong>${escHtml(source.name)}</strong><br>
        <small class="hint">${escHtml(ruleLabel)}</small>
      </td>
      <td>£${penceToStr(source.monthlyAmount)}</td>
      <td>${payDayHtml}</td>
      <td>
        <span class="badge ${source.isActive ? 'badge-green' : 'badge-grey'}">
          ${source.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style="white-space:nowrap">
        <button class="sm ghost js-edit-source" data-id="${source.id}" aria-label="Edit ${escHtml(source.name)}">Edit</button>
        <button class="sm ghost danger js-delete-source" data-id="${source.id}" aria-label="Delete ${escHtml(source.name)}">Delete</button>
      </td>
    </tr>
  `;
}

/**
 * Render the Income Sources section HTML.
 * @param {Array} sources
 * @returns {string}
 */
function _renderSourcesSection(sources) {
  const rows = sources.length
    ? sources.map(_renderSourceRow).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px">No income sources configured yet.</td></tr>`;

  return `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <h3 style="font-size:.9rem;margin:0">Income Sources</h3>
          <div class="hint">Configure income sources for payday projection and Phase 34 affordability engine.</div>
        </div>
        <button class="primary sm" id="addIncomeSourceBtn">+ Add Source</button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border);text-align:left">
              <th style="padding:6px 8px">Name / Rule</th>
              <th style="padding:6px 8px">Monthly (£)</th>
              <th style="padding:6px 8px">Next Payday</th>
              <th style="padding:6px 8px">Status</th>
              <th style="padding:6px 8px">Actions</th>
            </tr>
          </thead>
          <tbody id="incomeSourcesTableBody">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Spending Buckets section
// ---------------------------------------------------------------------------

/**
 * Render a single spending bucket row.
 * @param {{ id: number, name: string, monthlyAmount: number, icon: string|null, displayOrder: number }} bucket
 * @returns {string}
 */
function _renderBucketRow(bucket) {
  return `
    <tr data-bucket-id="${bucket.id}">
      <td>${escHtml(bucket.name)}</td>
      <td>£${penceToStr(bucket.monthlyAmount)}</td>
      <td style="white-space:nowrap">
        <button class="sm ghost js-edit-bucket" data-id="${bucket.id}" aria-label="Edit ${escHtml(bucket.name)}">Edit</button>
        <button class="sm ghost danger js-delete-bucket" data-id="${bucket.id}" aria-label="Delete ${escHtml(bucket.name)}">Delete</button>
      </td>
    </tr>
  `;
}

/**
 * Render the Spending Buckets section HTML.
 * @param {Array} buckets
 * @returns {string}
 */
function _renderBucketsSection(buckets) {
  const rows = buckets.length
    ? buckets.map(_renderBucketRow).join('')
    : `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:16px">No spending buckets configured yet.</td></tr>`;

  return `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div>
          <h3 style="font-size:.9rem;margin:0">Spending Buckets</h3>
          <div class="hint">Estimated monthly outgoings by category. Used as inputs to the Phase 34 affordability engine.</div>
        </div>
        <button class="primary sm" id="addSpendingBucketBtn">+ Add Bucket</button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border);text-align:left">
              <th style="padding:6px 8px">Name</th>
              <th style="padding:6px 8px">Monthly (£)</th>
              <th style="padding:6px 8px">Actions</th>
            </tr>
          </thead>
          <tbody id="spendingBucketsTableBody">
            ${rows}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Inline edit forms
// ---------------------------------------------------------------------------

/**
 * Build HTML for the income source add/edit inline form.
 * @param {{ id?: number, name?: string, monthlyAmount?: number, payDateRule?: string,
 *           payDateDay?: number|null, isActive?: boolean, displayOrder?: number } | null} source
 * @param {number} nextOrder
 * @returns {string}
 */
function _incomeSourceForm(source, nextOrder) {
  const isEdit = !!source;
  const name = isEdit ? escHtml(source.name) : '';
  const amount = isEdit ? penceToStr(source.monthlyAmount) : '';
  const rule = isEdit ? source.payDateRule : 'nth-of-month';
  const day = isEdit ? (source.payDateDay ?? '') : '';
  const isActive = !isEdit || source.isActive;
  const order = isEdit ? source.displayOrder : nextOrder;

  return `
    <form id="incomeSourceForm" data-edit-id="${isEdit ? source.id : ''}" style="border:1px solid var(--border);border-radius:6px;padding:16px;margin-top:12px">
      <h4 style="margin:0 0 12px">${isEdit ? 'Edit' : 'Add'} Income Source</h4>
      <div style="display:flex;flex-wrap:wrap;gap:12px">
        <div style="display:flex;flex-direction:column;gap:4px;min-width:180px">
          <label for="isf-name">Name</label>
          <input id="isf-name" type="text" value="${name}" placeholder="e.g. Salary" required style="width:100%" />
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:120px">
          <label for="isf-amount">Monthly Amount (£)</label>
          <input id="isf-amount" type="number" step="0.01" min="0" value="${amount}" placeholder="0.00" style="width:100%" />
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:180px">
          <label for="isf-rule">Pay Date Rule</label>
          <select id="isf-rule" style="width:100%">
            <option value="nth-of-month" ${rule === 'nth-of-month' ? 'selected' : ''}>Nth of month</option>
            <option value="last-day" ${rule === 'last-day' ? 'selected' : ''}>Last day of month</option>
            <option value="last-working-day" ${rule === 'last-working-day' ? 'selected' : ''}>Last working day</option>
          </select>
        </div>
        <div id="isf-day-wrapper" style="display:flex;flex-direction:column;gap:4px;min-width:100px;${rule !== 'nth-of-month' ? 'visibility:hidden' : ''}">
          <label for="isf-day">Day (1–28)</label>
          <input id="isf-day" type="number" min="1" max="28" step="1" value="${day}" placeholder="e.g. 25" style="width:100%" />
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:80px;justify-content:flex-end">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
            <input id="isf-active" type="checkbox" ${isActive ? 'checked' : ''} />
            Active
          </label>
        </div>
        <input type="hidden" id="isf-order" value="${order}" />
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button type="button" class="primary sm" id="isf-save">Save</button>
        <button type="button" class="ghost sm" id="isf-cancel">Cancel</button>
      </div>
      <div id="isf-error" style="color:var(--danger);font-size:.8rem;margin-top:6px"></div>
    </form>
  `;
}

/**
 * Build HTML for the spending bucket add/edit inline form.
 * @param {{ id?: number, name?: string, monthlyAmount?: number, displayOrder?: number } | null} bucket
 * @param {number} nextOrder
 * @returns {string}
 */
function _bucketForm(bucket, nextOrder) {
  const isEdit = !!bucket;
  const name = isEdit ? escHtml(bucket.name) : '';
  const amount = isEdit ? penceToStr(bucket.monthlyAmount) : '';
  const order = isEdit ? bucket.displayOrder : nextOrder;

  return `
    <form id="spendingBucketForm" data-edit-id="${isEdit ? bucket.id : ''}" style="border:1px solid var(--border);border-radius:6px;padding:16px;margin-top:12px">
      <h4 style="margin:0 0 12px">${isEdit ? 'Edit' : 'Add'} Spending Bucket</h4>
      <div style="display:flex;flex-wrap:wrap;gap:12px">
        <div style="display:flex;flex-direction:column;gap:4px;min-width:180px">
          <label for="sbf-name">Name</label>
          <input id="sbf-name" type="text" value="${name}" placeholder="e.g. Groceries" required style="width:100%" />
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;min-width:120px">
          <label for="sbf-amount">Monthly Amount (£)</label>
          <input id="sbf-amount" type="number" step="0.01" min="0" value="${amount}" placeholder="0.00" style="width:100%" />
        </div>
        <input type="hidden" id="sbf-order" value="${order}" />
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button type="button" class="primary sm" id="sbf-save">Save</button>
        <button type="button" class="ghost sm" id="sbf-cancel">Cancel</button>
      </div>
      <div id="sbf-error" style="color:var(--danger);font-size:.8rem;margin-top:6px"></div>
    </form>
  `;
}

// ---------------------------------------------------------------------------
// Public module
// ---------------------------------------------------------------------------

export const incomeSpendingSettings = {
  /** The container element id used in the Settings panel HTML. */
  CONTAINER_ID: 'incomeSpendingSettingsContainer',

  /**
   * Initialize the module: seed default spending buckets if needed.
   */
  async init() {
    await spendingBucketRepository.seedDefaults();
  },

  /**
   * Render the full Income Sources + Spending Buckets settings section.
   * Expects a <div id="incomeSpendingSettingsContainer"> in the page.
   */
  async render() {
    const container = document.getElementById(this.CONTAINER_ID);
    if (!container) return;

    const [sources, buckets] = await Promise.all([
      incomeSourceRepository.getAll(),
      spendingBucketRepository.getAll()
    ]);

    container.innerHTML =
      _renderSourcesSection(sources) +
      _renderBucketsSection(buckets);

    this._bindSourceEvents(container, sources);
    this._bindBucketEvents(container, buckets);
  },

  // ---------------------------------------------------------------------------
  // Income Source event bindings
  // ---------------------------------------------------------------------------

  /**
   * @param {HTMLElement} container
   * @param {Array} sources
   */
  _bindSourceEvents(container, sources) {
    const addBtn = container.querySelector('#addIncomeSourceBtn');
    if (addBtn) {
      addBtn.onclick = () => {
        // Remove any existing form
        const existing = container.querySelector('#incomeSourceForm');
        if (existing) { existing.remove(); return; }
        const formHtml = _incomeSourceForm(null, sources.length);
        container.querySelector('#incomeSourcesTableBody').closest('table').insertAdjacentHTML('afterend', formHtml);
        this._bindSourceFormEvents(container);
      };
    }

    container.querySelectorAll('.js-edit-source').forEach(btn => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.id);
        const source = await incomeSourceRepository.get(id);
        if (!source) return;
        const existing = container.querySelector('#incomeSourceForm');
        if (existing) existing.remove();
        const formHtml = _incomeSourceForm(source, sources.length);
        container.querySelector('#incomeSourcesTableBody').closest('table').insertAdjacentHTML('afterend', formHtml);
        this._bindSourceFormEvents(container);
      };
    });

    container.querySelectorAll('.js-delete-source').forEach(btn => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.id);
        if (!confirm('Delete this income source?')) return;
        try {
          await incomeSourceRepository.delete(id);
          triggerHaptic('delete');
          await this.render();
        } catch (err) {
          notificationUI.error('Failed to delete income source: ' + err.message);
        }
      };
    });
  },

  /**
   * Bind save/cancel events on the income source form.
   * @param {HTMLElement} container
   */
  _bindSourceFormEvents(container) {
    const form = container.querySelector('#incomeSourceForm');
    if (!form) return;

    const ruleSelect = form.querySelector('#isf-rule');
    const dayWrapper = form.querySelector('#isf-day-wrapper');

    if (ruleSelect && dayWrapper) {
      ruleSelect.onchange = () => {
        dayWrapper.style.visibility = ruleSelect.value === 'nth-of-month' ? 'visible' : 'hidden';
      };
    }

    const cancelBtn = form.querySelector('#isf-cancel');
    if (cancelBtn) {
      cancelBtn.onclick = () => form.remove();
    }

    const saveBtn = form.querySelector('#isf-save');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const errorDiv = form.querySelector('#isf-error');
        if (errorDiv) errorDiv.textContent = '';

        const name = form.querySelector('#isf-name')?.value?.trim();
        const amount = strToPence(form.querySelector('#isf-amount')?.value || '0');
        const rule = form.querySelector('#isf-rule')?.value;
        const dayRaw = form.querySelector('#isf-day')?.value;
        const day = dayRaw ? Number(dayRaw) : null;
        const isActive = form.querySelector('#isf-active')?.checked ?? true;
        const order = Number(form.querySelector('#isf-order')?.value || 0);
        const editId = form.dataset.editId ? Number(form.dataset.editId) : null;

        if (!name) {
          if (errorDiv) errorDiv.textContent = 'Name is required.';
          return;
        }

        const data = {
          name,
          monthlyAmount: amount,
          payDateRule: rule,
          payDateDay: rule === 'nth-of-month' ? day : null,
          isActive,
          displayOrder: order
        };

        try {
          if (editId) {
            await incomeSourceRepository.validateAndUpdate(editId, data);
          } else {
            await incomeSourceRepository.validateAndAdd(data);
          }
          triggerHaptic('success');
          await this.render();
        } catch (err) {
          if (errorDiv) errorDiv.textContent = err.message;
        }
      };
    }
  },

  // ---------------------------------------------------------------------------
  // Spending Bucket event bindings
  // ---------------------------------------------------------------------------

  /**
   * @param {HTMLElement} container
   * @param {Array} buckets
   */
  _bindBucketEvents(container, buckets) {
    const addBtn = container.querySelector('#addSpendingBucketBtn');
    if (addBtn) {
      addBtn.onclick = () => {
        const existing = container.querySelector('#spendingBucketForm');
        if (existing) { existing.remove(); return; }
        const formHtml = _bucketForm(null, buckets.length);
        container.querySelector('#spendingBucketsTableBody').closest('table').insertAdjacentHTML('afterend', formHtml);
        this._bindBucketFormEvents(container);
      };
    }

    container.querySelectorAll('.js-edit-bucket').forEach(btn => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.id);
        const bucket = await spendingBucketRepository.get(id);
        if (!bucket) return;
        const existing = container.querySelector('#spendingBucketForm');
        if (existing) existing.remove();
        const formHtml = _bucketForm(bucket, buckets.length);
        container.querySelector('#spendingBucketsTableBody').closest('table').insertAdjacentHTML('afterend', formHtml);
        this._bindBucketFormEvents(container);
      };
    });

    container.querySelectorAll('.js-delete-bucket').forEach(btn => {
      btn.onclick = async () => {
        const id = Number(btn.dataset.id);
        if (!confirm('Delete this spending bucket?')) return;
        try {
          await spendingBucketRepository.delete(id);
          triggerHaptic('delete');
          await this.render();
        } catch (err) {
          notificationUI.error('Failed to delete spending bucket: ' + err.message);
        }
      };
    });
  },

  /**
   * Bind save/cancel events on the spending bucket form.
   * @param {HTMLElement} container
   */
  _bindBucketFormEvents(container) {
    const form = container.querySelector('#spendingBucketForm');
    if (!form) return;

    const cancelBtn = form.querySelector('#sbf-cancel');
    if (cancelBtn) {
      cancelBtn.onclick = () => form.remove();
    }

    const saveBtn = form.querySelector('#sbf-save');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const errorDiv = form.querySelector('#sbf-error');
        if (errorDiv) errorDiv.textContent = '';

        const name = form.querySelector('#sbf-name')?.value?.trim();
        const amount = strToPence(form.querySelector('#sbf-amount')?.value || '0');
        const order = Number(form.querySelector('#sbf-order')?.value || 0);
        const editId = form.dataset.editId ? Number(form.dataset.editId) : null;

        if (!name) {
          if (errorDiv) errorDiv.textContent = 'Name is required.';
          return;
        }

        const data = { name, monthlyAmount: amount, icon: null, displayOrder: order };

        try {
          if (editId) {
            await spendingBucketRepository.update(editId, data);
          } else {
            await spendingBucketRepository.add(data);
          }
          triggerHaptic('success');
          await this.render();
        } catch (err) {
          if (errorDiv) errorDiv.textContent = err.message;
        }
      };
    }
  }
};
