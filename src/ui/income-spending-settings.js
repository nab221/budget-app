/**
 * income-spending-settings.js — Phase 33 Settings UI module.
 *
 * Renders and manages:
 *   - Spending Buckets section (row-based, add/edit/delete/reorder)
 *
 * Income Sources CRUD has moved to the dedicated Pay Sources tab (Plan 39.1-03).
 *
 * Strictly configuration-only. No affordability dashboard, no pay-period
 * navigation, no current-balance entry — those are Phase 34 concerns.
 */

import { spendingBucketRepository } from '../db/repository.js';
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
   * Render the Spending Buckets settings section.
   * Expects a <div id="incomeSpendingSettingsContainer"> in the page.
   * Income Sources CRUD has moved to the dedicated Pay Sources tab.
   */
  async render() {
    const container = document.getElementById(this.CONTAINER_ID);
    if (!container) return;

    const buckets = await spendingBucketRepository.getAll();

    container.innerHTML = _renderBucketsSection(buckets);

    this._bindBucketEvents(container, buckets);
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
