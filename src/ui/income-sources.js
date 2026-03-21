/**
 * income-sources.js — Phase 39.1 Income Sources tab UI.
 *
 * Dedicated tab module for managing income sources and confirming
 * auto-generated income transactions.
 *
 * Exports `incomeSources` with init(), render(), and helper methods
 * following the childcareUI/debtUI tab module pattern.
 */

import { incomeSourceRepository, incomeRepository } from '../db/repository.js';
import { getUpcomingIncomeEvents } from '../utils/income.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { notificationUI } from './notifications.js';
import { triggerHaptic } from '../utils/haptics.js';
import { safeHTML, modalUI } from './render.js';

// ---------------------------------------------------------------------------
// Local helpers (copied from income-spending-settings.js)
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

/**
 * Return a date 45 days in the past as YYYY-MM-DD.
 * @returns {string}
 */
function lookbackDate() {
  const d = new Date();
  d.setDate(d.getDate() - 45);
  return d.toISOString().split('T')[0];
}

/**
 * Return a date 45 days in the future as YYYY-MM-DD.
 * This matches the 45-day lookback window, giving a symmetric confirmation window.
 * @returns {string}
 */
function lookForwardDate() {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  return d.toISOString().split('T')[0];
}

/**
 * Return a date 90 days in the future as YYYY-MM-DD.
 * Used by the income modal to show upcoming entries in a wider window.
 * @returns {string}
 */
function lookForwardDate90() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Rule label mapping
// ---------------------------------------------------------------------------

const RULE_LABELS = {
  'nth-of-month': s => `Day ${s.payDateDay} of month`,
  'last-day': () => 'Last day of month',
  'last-working-day': () => 'Last working day',
};

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export const incomeSources = {
  /** The container element id used in the Income Sources tab HTML. */
  CONTAINER_ID: 'incomeSourcesContainer',

  /**
   * Stores the currently bound click handler so it can be removed before
   * re-attaching on each render, preventing listener accumulation.
   * @type {Function|null}
   */
  _boundClickHandler: null,

  /**
   * Tracks the sourceId of the currently open income modal.
   * @type {number|null}
   */
  activeSourceId: null,

  /**
   * Initialize the module: bind refresh event and do first render.
   */
  async init() {
    modalUI.init();
    this._registerGlobalHandlers();
    window.addEventListener('app:refresh', () => this.render());
    await this.render();
  },

  /**
   * Render the full Income Sources tab into #incomeSourcesContainer.
   * If the container is not found, returns silently.
   */
  async render() {
    const container = document.getElementById(this.CONTAINER_ID);
    if (!container) return;

    const activeSources = await incomeSourceRepository.getActive();

    // --- Source cards (card grid layout, replaces flat table) ---
    const sourceListHtml = this._renderSourceCards(activeSources);
    const formHtml = this._renderAddEditForm(null);

    container.innerHTML = `
      <div class="income-sources-tab">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2 style="margin:0;font-size:1.1rem">Income Sources</h2>
          <button class="primary sm" data-action="show-add-form">+ Add Source</button>
        </div>
        <div id="income-source-form-wrapper" style="display:none">${formHtml}</div>
        ${sourceListHtml}
      </div>
    `;

    this._bindEvents(container);
  },

  // ---------------------------------------------------------------------------
  // Internal action handlers (exposed on object for direct test invocation)
  // ---------------------------------------------------------------------------

  /**
   * Add a new income source.
   * @param {{ name: string, monthlyAmount: number, payDateRule: string,
   *           payDateDay: number|null, isActive: boolean, displayOrder: number }} data
   */
  async _handleAddSource(data) {
    try {
      await incomeSourceRepository.validateAndAdd(data);
      triggerHaptic('success');
      await this.render();
    } catch (err) {
      notificationUI.error(err.message);
    }
  },

  /**
   * Update an existing income source.
   * @param {number} id
   * @param {{ name: string, monthlyAmount: number, payDateRule: string,
   *           payDateDay: number|null, isActive: boolean, displayOrder: number }} data
   */
  async _handleEditSource(id, data) {
    try {
      await incomeSourceRepository.validateAndUpdate(id, data);
      triggerHaptic('success');
      await this.render();
    } catch (err) {
      notificationUI.error(err.message);
    }
  },

  /**
   * Delete an income source after confirmation.
   * Does NOT call render() — the caller (event delegation in _bindEvents)
   * is responsible for triggering re-render so that tests can control
   * mock state between the delete and subsequent render.
   * @param {number} id
   * @returns {Promise<boolean>} true if deleted, false if cancelled or errored
   */
  async _handleDeleteSource(id) {
    if (!window.confirm('Delete this income source?')) return false;
    try {
      await incomeSourceRepository.delete(id);
      triggerHaptic('delete');
      return true;
    } catch (err) {
      notificationUI.error(err.message);
      return false;
    }
  },

  /**
   * Confirm a pending income event and write it to incomeRepository.
   * @param {{ sourceName: string, adjustedDate: string, amount: number }} event
   *   amount is in PENCE
   */
  async confirmIncome(event) {
    try {
      await incomeRepository.add({
        date: event.adjustedDate,
        source: event.sourceName,
        amount: fromPence(event.amount),   // convert pence → pounds (repo calls toPence internally)
        categoryId: null,
        isCleared: false,
        isReconciled: false,
      });
      triggerHaptic('success');
      await this.render();
    } catch (err) {
      notificationUI.error(err.message);
    }
  },

  /**
   * Confirm a pending income event with a user-supplied override amount.
   * @param {{ sourceName: string, adjustedDate: string, amount: number }} event
   *   amount is in PENCE
   * @param {number} overrideAmountPounds - user-entered amount in POUNDS
   */
  async adjustIncome(event, overrideAmountPounds) {
    try {
      await incomeRepository.add({
        date: event.adjustedDate,
        source: event.sourceName,
        amount: overrideAmountPounds,      // already in pounds from user input
        categoryId: null,
        isCleared: false,
        isReconciled: false,
      });
      triggerHaptic('success');
      await this.render();
    } catch (err) {
      notificationUI.error(err.message);
    }
  },

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  /**
   * Render the sources table.
   * @param {Array} sources
   * @returns {string}
   */
  _renderSourceList(sources) {
    if (!sources.length) {
      return `
        <div style="text-align:center;color:var(--text-muted);padding:32px 16px">
          No income sources configured. Add one above.
        </div>
      `;
    }
    const rows = sources.map(s => this._renderSourceRow(s)).join('');
    return `
      <div style="overflow-x:auto;margin-top:8px" class="income-source-list">
        <table style="width:100%;border-collapse:collapse;font-size:.85rem">
          <thead>
            <tr style="border-bottom:1px solid var(--border);text-align:left">
              <th style="padding:6px 8px">Name / Rule</th>
              <th style="padding:6px 8px">Monthly (£)</th>
              <th style="padding:6px 8px">Status</th>
              <th style="padding:6px 8px">Actions</th>
            </tr>
          </thead>
          <tbody id="income-source-tbody">
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Render a single source row.
   * @param {Object} source
   * @returns {string}
   */
  _renderSourceRow(source) {
    const labelFn = RULE_LABELS[source.payDateRule];
    const ruleLabel = labelFn ? labelFn(source) : source.payDateRule;

    return `
      <tr data-source-id="${source.id}">
        <td style="padding:6px 8px">
          <strong>${escHtml(source.name)}</strong><br>
          <small class="hint">${escHtml(ruleLabel)}</small>
        </td>
        <td style="padding:6px 8px">£${penceToStr(source.monthlyAmount)}</td>
        <td style="padding:6px 8px">
          <span class="badge ${source.isActive ? 'badge-green' : 'badge-grey'}">
            ${source.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td style="padding:6px 8px;white-space:nowrap">
          <button class="sm ghost" data-action="edit-source" data-id="${source.id}"
                  aria-label="Edit ${escHtml(source.name)}">Edit</button>
          <button class="sm ghost danger" data-action="delete-source" data-id="${source.id}"
                  aria-label="Delete ${escHtml(source.name)}">Delete</button>
        </td>
      </tr>
    `;
  },

  /**
   * Render the add/edit inline form.
   * @param {Object|null} source - null for add mode, source object for edit mode
   * @returns {string}
   */
  _renderAddEditForm(source) {
    const isEdit = !!source;
    const name = isEdit ? escHtml(source.name) : '';
    const amount = isEdit ? penceToStr(source.monthlyAmount) : '';
    const rule = isEdit ? source.payDateRule : 'nth-of-month';
    const day = isEdit ? (source.payDateDay ?? '') : '';
    const isActive = !isEdit || source.isActive;
    const order = isEdit ? source.displayOrder : 0;

    return `
      <form id="income-source-form" data-edit-id="${isEdit ? source.id : ''}"
            style="border:1px solid var(--border);border-radius:6px;padding:16px;margin-bottom:16px">
        <h4 style="margin:0 0 12px">${isEdit ? 'Edit' : 'Add'} Income Source</h4>
        <div style="display:flex;flex-wrap:wrap;gap:12px">
          <div style="display:flex;flex-direction:column;gap:4px;min-width:180px">
            <label for="isf-name">Name</label>
            <input id="isf-name" type="text" value="${name}" placeholder="e.g. Salary"
                   required style="width:100%" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;min-width:120px">
            <label for="isf-amount">Monthly Amount (£)</label>
            <input id="isf-amount" type="number" step="0.01" min="0" value="${amount}"
                   placeholder="0.00" style="width:100%" />
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;min-width:180px">
            <label for="isf-rule">Pay Date Rule</label>
            <select id="isf-rule" style="width:100%">
              <option value="nth-of-month" ${rule === 'nth-of-month' ? 'selected' : ''}>Nth of month</option>
              <option value="last-day" ${rule === 'last-day' ? 'selected' : ''}>Last day of month</option>
              <option value="last-working-day" ${rule === 'last-working-day' ? 'selected' : ''}>Last working day</option>
            </select>
          </div>
          <div id="isf-day-wrapper"
               style="display:flex;flex-direction:column;gap:4px;min-width:100px;${rule !== 'nth-of-month' ? 'display:none' : ''}">
            <label for="isf-day">Day (1–28)</label>
            <input id="isf-day" type="number" min="1" max="28" step="1" value="${day}"
                   placeholder="e.g. 25" style="width:100%" />
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
          <button type="button" class="primary sm" data-action="save-source">Save</button>
          <button type="button" class="ghost sm" data-action="cancel-source">Cancel</button>
        </div>
        <div id="isf-error" style="color:var(--danger);font-size:.8rem;margin-top:6px"></div>
      </form>
    `;
  },

  /**
   * Render the pending income confirmations section.
   * @param {Array} upcoming - filtered upcoming income events
   * @returns {string}
   */
  _renderPendingSection(upcoming) {
    if (!upcoming.length) {
      return '';
    }

    const cards = upcoming.map(ev => this._renderPendingCard(ev)).join('');
    return `
      <div id="incomePendingConfirmations" style="margin-bottom:20px">
        <h3 style="font-size:.9rem;margin:0 0 8px">Upcoming Income to Confirm</h3>
        ${cards}
      </div>
    `;
  },

  /**
   * Render income sources as a clickable card grid (replaces _renderSourceList).
   * @param {Array} sources - active income sources
   * @returns {string}
   */
  _renderSourceCards(sources) {
    if (!sources.length) {
      return `<div style="text-align:center;color:var(--text-muted);padding:32px 16px">
        No income sources configured. Add one above.
      </div>`;
    }
    const cards = sources.map(s => {
      const labelFn = RULE_LABELS[s.payDateRule];
      const ruleLabel = labelFn ? labelFn(s) : s.payDateRule;
      return safeHTML`
        <div class="card clickable-card"
             data-source-id="${s.id}"
             data-action="open-income-modal"
             style="border:1px solid var(--border); padding:15px; display:flex;
                    flex-direction:column; gap:8px; cursor:pointer; position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start">
            <div>
              <h3 style="margin:0; font-size:1.1rem">${s.name}</h3>
              <span class="pill" style="font-size:0.7rem">${ruleLabel}</span>
            </div>
            <div style="display:flex; gap:4px">
              <button class="sm ghost" data-action="edit-source" data-id="${s.id}"
                      onclick="event.stopPropagation()">Edit</button>
              <button class="sm ghost danger" data-action="delete-source" data-id="${s.id}"
                      onclick="event.stopPropagation()">Delete</button>
            </div>
          </div>
          <div style="font-size:1.4rem; font-weight:bold; margin:5px 0">
            <span class="privacy-blur">${formatGBP(s.monthlyAmount)}</span>
          </div>
          <div style="margin-top:auto; padding-top:10px; border-top:1px solid var(--border);">
            <span class="hint" style="font-size:0.7rem">Click to view income entries</span>
          </div>
        </div>
      `;
    }).join('');
    return `<div class="grid3">${cards}</div>`;
  },

  /**
   * Render a single pending income confirmation card.
   * @param {{ sourceName: string, nominalDate: string, adjustedDate: string, amount: number }} event
   *   amount is in PENCE
   * @returns {string}
   */
  _renderPendingCard(event) {
    return `
      <div class="card income-pending-card" style="margin-bottom:12px"
           data-event-source="${escHtml(event.sourceName)}"
           data-event-date="${escHtml(event.adjustedDate)}"
           data-event-amount="${event.amount}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${escHtml(event.sourceName)}</strong>
            <span class="hint"> — Expected ${formatGBP(event.amount)} on ${formatDate(event.adjustedDate)}</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="sm" data-action="confirm-income">Confirm</button>
            <button class="sm ghost" data-action="adjust-income">Adjust</button>
          </div>
        </div>
        <div class="isf-adjust-wrapper" style="display:none;margin-top:8px">
          <input type="number" class="isf-adjust-amount" step="0.01" min="0"
                 value="${penceToStr(event.amount)}" aria-label="Adjusted amount"
                 style="width:120px;margin-right:8px">
          <button class="sm" data-action="save-adjusted-income">Save</button>
        </div>
      </div>
    `;
  },

  // ---------------------------------------------------------------------------
  // Event binding via delegation
  // ---------------------------------------------------------------------------

  /**
   * Bind all events on the container via delegation.
   * @param {HTMLElement} container
   */
  _bindEvents(container) {
    // Remove any previously bound handler to prevent accumulation across re-renders
    if (this._boundClickHandler) {
      container.removeEventListener('click', this._boundClickHandler);
    }

    this._boundClickHandler = async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      // --- Open income modal (card click) ---
      if (action === 'open-income-modal') {
        const card = btn.closest('[data-source-id]');
        if (!card) return;
        const id = Number(card.dataset.sourceId);
        await this.openIncomeModal(id);
        return;
      }

      // --- Add source form toggle ---
      if (action === 'show-add-form') {
        const wrapper = container.querySelector('#income-source-form-wrapper');
        if (!wrapper) return;
        if (wrapper.style.display === 'none') {
          wrapper.innerHTML = this._renderAddEditForm(null);
          wrapper.style.display = '';
          this._bindFormEvents(container, wrapper.querySelector('#income-source-form'));
        } else {
          wrapper.style.display = 'none';
        }
        return;
      }

      // --- Cancel inline form ---
      if (action === 'cancel-source') {
        const wrapper = container.querySelector('#income-source-form-wrapper');
        if (wrapper) {
          wrapper.style.display = 'none';
          wrapper.innerHTML = '';
        }
        return;
      }

      // --- Save inline form ---
      if (action === 'save-source') {
        await this._submitSourceForm(container);
        return;
      }

      // --- Edit source ---
      if (action === 'edit-source') {
        const id = Number(btn.dataset.id);
        const source = await incomeSourceRepository.get(id);
        if (!source) return;
        const wrapper = container.querySelector('#income-source-form-wrapper');
        if (wrapper) {
          wrapper.innerHTML = this._renderAddEditForm(source);
          wrapper.style.display = '';
          this._bindFormEvents(container, wrapper.querySelector('#income-source-form'));
        }
        return;
      }

      // --- Delete source ---
      if (action === 'delete-source') {
        const id = Number(btn.dataset.id);
        const deleted = await this._handleDeleteSource(id);
        if (deleted) await this.render();
        return;
      }

      // --- Confirm income ---
      if (action === 'confirm-income') {
        const card = btn.closest('.income-pending-card');
        if (!card) return;
        const event = this._readEventFromCard(card);
        await this.confirmIncome(event);
        return;
      }

      // --- Adjust income (reveal input) ---
      if (action === 'adjust-income') {
        const card = btn.closest('.income-pending-card');
        if (!card) return;
        const adjustWrapper = card.querySelector('.isf-adjust-wrapper');
        if (adjustWrapper) {
          adjustWrapper.style.display = adjustWrapper.style.display === 'none' ? '' : 'none';
        }
        return;
      }

      // --- Save adjusted income ---
      if (action === 'save-adjusted-income') {
        const card = btn.closest('.income-pending-card');
        if (!card) return;
        const event = this._readEventFromCard(card);
        const input = card.querySelector('.isf-adjust-amount');
        const amountPounds = fromPence(strToPence(input?.value || '0'));
        await this.adjustIncome(event, amountPounds);
        return;
      }
    };

    container.addEventListener('click', this._boundClickHandler);

    // --- Rule select toggle for day wrapper (if form is already visible) ---
    const ruleSelect = container.querySelector('#isf-rule');
    if (ruleSelect) {
      const dayWrapper = container.querySelector('#isf-day-wrapper');
      if (dayWrapper) {
        ruleSelect.onchange = () => {
          dayWrapper.style.display = ruleSelect.value === 'nth-of-month' ? '' : 'none';
        };
      }
    }
  },

  /**
   * Bind form-specific events (rule toggle, save, cancel) on a form element.
   * @param {HTMLElement} container
   * @param {HTMLElement|null} form
   */
  _bindFormEvents(container, form) {
    if (!form) return;

    const ruleSelect = form.querySelector('#isf-rule');
    const dayWrapper = form.querySelector('#isf-day-wrapper');
    if (ruleSelect && dayWrapper) {
      ruleSelect.onchange = () => {
        dayWrapper.style.display = ruleSelect.value === 'nth-of-month' ? '' : 'none';
      };
    }
  },

  /**
   * Read and submit the inline income source form.
   * @param {HTMLElement} container
   */
  async _submitSourceForm(container) {
    const form = container.querySelector('#income-source-form');
    if (!form) return;

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
      displayOrder: order,
    };

    if (editId) {
      await this._handleEditSource(editId, data);
    } else {
      await this._handleAddSource(data);
    }
  },

  /**
   * Read income event data from a pending card's data attributes.
   * @param {HTMLElement} card
   * @returns {{ sourceName: string, adjustedDate: string, amount: number }}
   */
  _readEventFromCard(card) {
    return {
      sourceName: card.dataset.eventSource || '',
      adjustedDate: card.dataset.eventDate || '',
      amount: Number(card.dataset.eventAmount) || 0,
    };
  },

  /**
   * Open the income modal for the given source.
   * Shows upcoming income entries with confirm/adjust actions.
   * @param {number} sourceId
   */
  async openIncomeModal(sourceId) {
    this.activeSourceId = sourceId;
    const source = await incomeSourceRepository.get(sourceId);
    if (!source) return;

    const title = `Income: ${source.name}`;
    const content = this._buildIncomeModalHTML(source);
    const footer = [
      { label: 'Close', className: 'ghost', onClick: () => this._closeIncomeModal() }
    ];

    modalUI.show(title, content, footer);
    await this._renderIncomeEntryStatuses(sourceId);

    if (modalUI.elements.close) {
      modalUI.elements.close.onclick = () => this._closeIncomeModal();
    }
  },

  /**
   * Close the income modal and clear active source.
   */
  _closeIncomeModal() {
    this.activeSourceId = null;
    modalUI.close();
  },

  /**
   * Build the modal body HTML for a given income source.
   * Renders upcoming income entries (±90 day window) as a list.
   * @param {Object} source
   * @returns {string}
   */
  _buildIncomeModalHTML(source) {
    const upcoming = getUpcomingIncomeEvents([source], lookbackDate(), 10)
      .filter(ev => ev.adjustedDate <= lookForwardDate90());

    if (!upcoming.length) {
      return `<p style="color:var(--text-muted);text-align:center;padding:24px 0">No upcoming income entries found for this source.</p>`;
    }

    const liItems = upcoming.map(ev => {
      const dateStr = formatDate(ev.adjustedDate);
      const amount = formatGBP(ev.amount);
      return `<li class="income-modal-entry" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">`
        + `<span style="min-width:100px">${dateStr}</span>`
        + `<span class="privacy-blur" style="min-width:80px;text-align:right">${amount}</span>`
        + `<span class="income-entry-status" id="income-entry-status-${source.id}-${ev.adjustedDate}" style="margin-left:12px"></span>`
        + `</li>`;
    }).join('');

    return `<ul id="income-modal-list-${source.id}" class="income-modal-list" style="list-style:none;padding:0;margin:0 0 8px 0">${liItems}</ul>`;
  },

  /**
   * Populate the status spans in the open income modal with Received badges
   * or Confirm buttons based on existing income entries.
   * @param {number} sourceId
   */
  async _renderIncomeEntryStatuses(sourceId) {
    const source = await incomeSourceRepository.get(sourceId);
    if (!source) return;

    const upcoming = getUpcomingIncomeEvents([source], lookbackDate(), 10)
      .filter(ev => ev.adjustedDate <= lookForwardDate90());

    const allIncome = await incomeRepository.getAll();
    const confirmedDates = new Set(
      allIncome
        .filter(e => e.source === source.name)
        .map(e => e.date)
    );

    for (const ev of upcoming) {
      const span = document.getElementById(`income-entry-status-${sourceId}-${ev.adjustedDate}`);
      if (!span) continue;

      const isConfirmed = confirmedDates.has(ev.adjustedDate);
      if (isConfirmed) {
        span.innerHTML = '<span class="badge badge-success" style="white-space:nowrap">Received</span>';
      } else {
        span.innerHTML = `<button class="sm primary" onclick="showIncomeConfirmPrompt(${sourceId}, '${ev.adjustedDate}', ${ev.amount})">Confirm</button>`;
      }
    }
  },

  /**
   * Register global window handlers for income modal interactions.
   * Called once from init(). These handlers are attached to window so
   * inline onclick attributes in dynamically rendered HTML can reach them.
   */
  _registerGlobalHandlers() {
    window.showIncomeConfirmPrompt = (sourceId, adjustedDate, amountPence) => {
      const span = document.getElementById(`income-entry-status-${sourceId}-${adjustedDate}`);
      if (!span) return;
      const amountPounds = (amountPence / 100).toFixed(2);
      span.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">`
        + `<div style="display:flex;gap:8px;align-items:center">`
        + `<label style="font-size:0.8rem;white-space:nowrap">Date:</label>`
        + `<input type="date" id="income-date-override-${sourceId}-${adjustedDate}" value="${adjustedDate}" style="width:140px">`
        + `</div>`
        + `<div style="display:flex;gap:8px;align-items:center">`
        + `<label style="font-size:0.8rem;white-space:nowrap">Amount (£):</label>`
        + `<input type="number" step="0.01" min="0" id="income-amount-override-${sourceId}-${adjustedDate}" value="${amountPounds}" style="width:100px">`
        + `</div>`
        + `<div style="display:flex;gap:6px">`
        + `<button class="sm primary" onclick="confirmIncomeEntry(${sourceId}, '${adjustedDate}')">Save</button>`
        + `<button class="sm ghost" onclick="cancelIncomeConfirm(${sourceId}, '${adjustedDate}', ${amountPence})">Cancel</button>`
        + `</div>`
        + `</div>`;
    };

    window.confirmIncomeEntry = async (sourceId, adjustedDate) => {
      const source = await incomeSourceRepository.get(sourceId);
      if (!source) return;
      const dateInput = document.getElementById(`income-date-override-${sourceId}-${adjustedDate}`);
      const amtInput = document.getElementById(`income-amount-override-${sourceId}-${adjustedDate}`);
      const finalDate = dateInput?.value || adjustedDate;
      const finalAmountPounds = parseFloat(amtInput?.value || '0') || 0;
      try {
        await incomeRepository.add({
          date: finalDate,
          source: source.name,
          amount: finalAmountPounds,   // pounds — repository's penceFields converts to pence
          categoryId: null,
          isCleared: false,
          isReconciled: false,
        });
        triggerHaptic('success');
        await incomeSources.openIncomeModal(sourceId);
        if (window.app) window.app.renderAll();
      } catch (err) {
        notificationUI.error(err.message);
      }
    };

    window.cancelIncomeConfirm = (sourceId, adjustedDate, amountPence) => {
      const span = document.getElementById(`income-entry-status-${sourceId}-${adjustedDate}`);
      if (!span) return;
      span.innerHTML = `<button class="sm primary" onclick="showIncomeConfirmPrompt(${sourceId}, '${adjustedDate}', ${amountPence})">Confirm</button>`;
    };
  },
};
