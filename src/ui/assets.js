import { assetRepository } from '../db/repository.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { safeHTML } from './render.js';

/**
 * Asset UI Module
 * Handles rendering and event handling for Assets.
 */
export const assetUI = {
  editingId: null,

  /**
   * Initialize Asset UI.
   */
  async init() {
    this.setupEventListeners();
    window.addEventListener('app:refresh', () => this.render());
    await this.render();
  },

  /**
   * Set up event listeners for asset management.
   */
  setupEventListeners() {
    const addAstBtn = document.getElementById('addAstBtn');
    if (addAstBtn) {
      addAstBtn.onclick = () => this.toggleForm();
    }

    // Global handlers
    window.deleteAsset = async (id) => {
      if (!confirm('Are you sure you want to delete this asset?')) return;
      try {
        await assetRepository.delete(id);
        await this.render();
      } catch (error) {
        console.error('Failed to delete asset:', error);
        alert('Failed to delete asset: ' + error.message);
      }
    };
  },

  toggleForm(show = true) {
    const container = document.getElementById('assetFormContainer');
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
    const container = document.getElementById('assetFormContainer');
    if (!container) return;

    let data = {
      date: new Date().toISOString().slice(0, 10),
      type: 'cash',
      name: '',
      currentBalance: ''
    };

    if (this.editingId) {
      const asset = await assetRepository.get(this.editingId);
      if (asset) data = { ...asset, currentBalance: fromPence(asset.currentBalance) };
    }

    const isUpdate = !!this.editingId;
    container.className = `card ${isUpdate ? 'update-mode' : ''}`;

    container.innerHTML = safeHTML`
      <div class="card-hd">
        <h2 style="font-size: 0.85rem; color: ${isUpdate ? 'var(--accent)' : 'var(--text-soft)'}">
          ${isUpdate ? '📝 Update Asset Account' : '➕ Add Asset Account'}
        </h2>
      </div>
      <div class="form-row">
        <div><label>Date</label><input id="astDateInput" type="date" value="${data.date}"/></div>
        <div>
          <label>Type</label>
          <select id="astTypeInput">
            <option value="cash" ${data.type === 'cash' ? 'selected' : ''}>Cash / Savings</option>
            <option value="investment" ${data.type === 'investment' ? 'selected' : ''}>Investment</option>
            <option value="property" ${data.type === 'property' ? 'selected' : ''}>Property</option>
            <option value="pension" ${data.type === 'pension' ? 'selected' : ''}>Pension</option>
            <option value="other" ${data.type === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div><label>Name</label><input id="astNameInput" type="text" value="${data.name}" placeholder="e.g. Savings Account"/></div>
        <div><label>Value (£)</label><input id="astValueInput" type="number" step="0.01" value="${data.currentBalance}" placeholder="0.00"/></div>
        <div style="display:flex;align-items:flex-end;gap:8px;flex:0.5">
          <button class="primary" onclick="assetUI.handleSaveAsset()">${isUpdate ? 'Save Changes' : 'Add Account'}</button>
          <button class="ghost" onclick="assetUI.cancelEdit()">${isUpdate ? 'Cancel' : 'Hide'}</button>
        </div>
      </div>
    `;

    if (isUpdate) {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  async handleSaveAsset() {
    const name = document.getElementById('astNameInput').value.trim();
    const type = document.getElementById('astTypeInput').value;
    const date = document.getElementById('astDateInput').value;
    const value = parseFloat(document.getElementById('astValueInput').value);

    if (!name || !date || isNaN(value)) {
      alert('Please fill in Name, Date, and Value correctly.');
      return;
    }

    try {
      const payload = {
        name,
        type,
        date,
        currentBalance: value
      };

      if (this.editingId) {
        await assetRepository.update(this.editingId, payload);
      } else {
        await assetRepository.add(payload);
      }

      this.toggleForm(false);
      await this.render();
      if (window.app) window.app.renderAll();
    } catch (error) {
      console.error('Failed to save asset:', error);
      alert('Failed to save asset: ' + error.message);
    }
  },

  cancelEdit() {
    if (this.editingId && !confirm('Discard changes?')) return;
    this.toggleForm(false);
  },

  async editAsset(id) {
    if (this.editingId && this.editingId !== id) {
      if (!confirm('Discard changes to the current item?')) return;
    }
    this.editingId = id;
    this.toggleForm(true);
  },

  /**
   * Render the list of assets.
   */
  async render() {
    const assets = await assetRepository.getAll();
    const body = document.getElementById('astBody');
    if (!body) return;

    if (assets.length === 0) {
      body.innerHTML = '<tr><td colspan="5" class="hint" style="text-align:center">No assets tracked yet.</td></tr>';
      return;
    }

    // Sort by date DESC, then name
    assets.sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return a.name.localeCompare(b.name);
    });

    body.innerHTML = assets.map(asset => safeHTML`
      <tr>
        <td>${asset.date}</td>
        <td>${asset.name}</td>
        <td><span class="pill" style="font-size:0.7rem">${asset.type.replace('_', ' ')}</span></td>
        <td class="r">${formatGBP(asset.currentBalance)}</td>
        <td class="r nw">
          <button class="sm ghost" onclick="assetUI.editAsset(${asset.id})">Edit</button>
          <button class="sm danger" onclick="deleteAsset(${asset.id})">✕</button>
        </td>
      </tr>
    `).join('');
  }
};

window.assetUI = assetUI;
