import { assetRepository } from '../db/repository.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { safeHTML, renderTabSummary } from './render.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';

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
      addAstBtn.onclick = () => this.openForm();
    }

    // Global handlers
    window.deleteAsset = async (id) => {
      if (!confirm('Are you sure you want to delete this asset?')) return;
      try {
        await assetRepository.delete(id);
        triggerHaptic('delete');
        await this.render();
      } catch (error) {
        console.error('Failed to delete asset:', error);
        alertWithHaptic('Failed to delete asset: ' + error.message, 'error');
      }
    };
  },

  /**
   * Opens the Asset form (Add or Edit) in a modal.
   */
  async openForm(id = null) {
    if (id && this.editingId !== id) {
      this.editingId = id;
    } else if (!id) {
      this.editingId = null;
    }

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

    const content = safeHTML`
      <div class="form-row">
        <div><label>Date</label><input id="astDateInput" type="date" value="${data.date}" autofocus/></div>
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
      </div>
    `;

    const footer = [
      { 
        label: isUpdate ? 'Save Changes' : 'Add Account', 
        className: 'primary', 
        onClick: () => this.handleSaveAsset() 
      },
      { 
        label: 'Cancel', 
        className: 'ghost', 
        onClick: () => modalUI.close() 
      }
    ];

    modalUI.show(isUpdate ? '📝 Update Asset Account' : '➕ Add Asset Account', content, footer);
  },

  async handleSaveAsset() {
    const name = document.getElementById('astNameInput').value.trim();
    const type = document.getElementById('astTypeInput').value;
    const date = document.getElementById('astDateInput').value;
    const valueInput = document.getElementById('astValueInput');
    const value = parseFloat(valueInput.value);

    if (!name || !date || isNaN(value)) {
      alertWithHaptic('Please fill in Name, Date, and Value correctly.', 'error');
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

      triggerHaptic('success');
      modalUI.close();
      await this.render();
      if (window.app) window.app.renderAll();
    } catch (error) {
      console.error('Failed to save asset:', error);
      alertWithHaptic('Failed to save asset: ' + error.message, 'error');
    }
  },

  async editAsset(id) {
    await this.openForm(id);
  },

  /**
   * Render the list of assets.
   */
  async render() {
    const assets = await assetRepository.getAll();
    const body = document.getElementById('astBody');
    if (!body) return;

    // --- Tab Summary ---
    const totalAssetsPence = assets.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    renderTabSummary('assetsSummary', [
      { label: 'Total Assets', value: totalAssetsPence, color: 'var(--accent)' }
    ]);
    // --- End Summary ---

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
        <td class="r"><span class="privacy-blur">${formatGBP(asset.currentBalance)}</span></td>
        <td class="r nw">
          <button class="sm ghost" onclick="assetUI.editAsset(${asset.id})">Edit</button>
          <button class="sm danger" onclick="deleteAsset(${asset.id})">✕</button>
        </td>
      </tr>
    `).join('');
  }
};

window.assetUI = assetUI;
