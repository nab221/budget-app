import { subscriptionRepository, categoryRepository } from '../db/repository.js';
import { formatGBP, toPence, fromPence } from '../utils/currency.js';
import { safeHTML } from './render.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';

/**
 * Subscription UI Module
 * Handles rendering and event handling for Subscriptions.
 */
export const subscriptionUI = {
  /**
   * Initialize Subscription UI.
   */
  async init() {
    this.setupEventListeners();
    window.addEventListener('app:refresh', () => this.render());
    await this.render();
  },

  /**
   * Set up event listeners for subscription management.
   */
  setupEventListeners() {
    const addSubBtn = document.getElementById('addSubBtn');
    if (addSubBtn) {
      addSubBtn.addEventListener('click', () => this.handleAddSubscription());
    }

    window.deleteSubscription = async (id) => {
      if (!confirm('Are you sure you want to delete this subscription?')) return;
      try {
        await subscriptionRepository.delete(id);
        triggerHaptic('delete');
        await this.render();
      } catch (error) {
        console.error('Failed to delete subscription:', error);
        alertWithHaptic('Failed to delete subscription: ' + error.message);
      }
    };
  },

  async handleAddSubscription() {
    const name = document.getElementById('subName').value.trim();
    const categoryId = document.getElementById('subCat').value;
    const amountStr = document.getElementById('subAmt').value;
    const amount = parseFloat(amountStr);
    const frequency = document.getElementById('subFreq').value;
    const nextDate = document.getElementById('subNextDate').value;

    if (!name || isNaN(amount) || !nextDate) {
      alertWithHaptic('Please fill in Name, Amount, and Next Date.');
      return;
    }

    try {
      await subscriptionRepository.add({
        name,
        categoryId: categoryId === '__other' ? null : parseInt(categoryId),
        amount,
        frequency,
        nextDate
      });
      
      triggerHaptic('success');

      // Clear inputs
      document.getElementById('subName').value = '';
      document.getElementById('subAmt').value = '';
      document.getElementById('subNextDate').value = '';
      
      await this.render();
    } catch (error) {
      console.error('Failed to add subscription:', error);
      alertWithHaptic('Failed to add subscription: ' + error.message);
    }
  },

  /**
   * Calculate monthly equivalent cost based on frequency.
   * @param {number} amountPence 
   * @param {string} frequency 
   * @returns {number}
   */
  calculateMonthlyEquivalent(amountPence, frequency) {
    switch (frequency) {
      case 'monthly': return amountPence;
      case 'quarterly': return Math.round(amountPence / 3);
      case 'annual': return Math.round(amountPence / 12);
      default: return amountPence;
    }
  },

  /**
   * Render subscription list.
   */
  async render() {
    const items = await subscriptionRepository.getAll();
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));
    const body = document.getElementById('subBody');
    if (!body) return;

    if (items.length === 0) {
      body.innerHTML = '<tr><td colspan="7" class="hint" style="text-align:center">No subscriptions added.</td></tr>';
      return;
    }

    // Sort by name
    items.sort((a, b) => a.name.localeCompare(b.name));

    body.innerHTML = items.map(item => {
      const monthlyEq = this.calculateMonthlyEquivalent(item.amount, item.frequency);
      return safeHTML`
        <tr>
          <td>${item.name}</td>
          <td>${catMap[item.categoryId] || 'None'}</td>
          <td class="r">${formatGBP(item.amount)}</td>
          <td>${item.frequency}</td>
          <td>${item.nextDate}</td>
          <td class="r">${formatGBP(monthlyEq)}</td>
          <td class="r">
            <button class="sm danger" onclick="deleteSubscription(${item.id})">✕</button>
          </td>
        </tr>
      `;
    }).join('');
    
    const totalMonthly = items.reduce((sum, item) => sum + this.calculateMonthlyEquivalent(item.amount, item.frequency), 0);
    this.updateTotal(totalMonthly);
  },

  updateTotal(totalPence) {
    const panel = document.querySelector('[data-panel="subs"]');
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

    totalEl.innerHTML = `Total Monthly Equivalent: ${formatGBP(totalPence)}`;
  }
};
