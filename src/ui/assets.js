import { assetRepository } from '../db/repository.js';
import { formatGBP } from '../utils/currency.js';
import { safeHTML } from './render.js';

/**
 * Asset UI Module
 * Handles rendering and event handling for Assets.
 */
export const assetUI = {
  /**
   * Initialize Asset UI.
   */
  async init() {
    this.setupEventListeners();
    await this.render();
  },

  /**
   * Set up event listeners for asset management.
   */
  setupEventListeners() {
    const addAstBtn = document.getElementById('addAstBtn');
    if (addAstBtn) {
      addAstBtn.addEventListener('click', () => this.handleAddAsset());
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

  async handleAddAsset() {
    const name = document.getElementById('astName').value.trim();
    const type = document.getElementById('astType').value;
    const date = document.getElementById('astDate').value;
    const value = parseFloat(document.getElementById('astValue').value);

    if (!name || !date || isNaN(value)) {
      alert('Please fill in Name, Date, and Value correctly.');
      return;
    }

    try {
      await assetRepository.add({
        name,
        type,
        date,
        currentBalance: value
      });
      
      // Clear form (except date)
      document.getElementById('astName').value = '';
      document.getElementById('astValue').value = '';
      
      await this.render();
    } catch (error) {
      console.error('Failed to add asset:', error);
      alert('Failed to add asset: ' + error.message);
    }
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
        <td class="r">
          <button class="sm danger" onclick="deleteAsset(${asset.id})">✕</button>
        </td>
      </tr>
    `).join('');
  }
};
