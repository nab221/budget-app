import { categoryRepository, targetRepository } from '../db/repository.js';
import { safeHTML } from './render.js';
import { toPence, fromPence } from '../utils/currency.js';

/**
 * Targets UI Module
 * Handles rendering and event handling for budget targets.
 */
export const targetsUI = {
  /**
   * Initialize Targets UI.
   */
  async init() {
    // This will be called from app.js or settings UI
  },

  /**
   * Render target settings in the settings view.
   * This should be called by the settings tab renderer.
   */
  async renderTargetSettings() {
    const container = document.getElementById('targetSettingsContainer');
    if (!container) return;

    const [categories, targets] = await Promise.all([
      categoryRepository.getCategories(),
      targetRepository.getAll()
    ]);

    const targetMap = new Map(targets.map(t => [t.categoryId, t]));

    container.innerHTML = `
      <div style="margin-top:20px; padding-top:20px; border-top:1px solid var(--border)">
        <h3 style="font-size:.9rem;margin-bottom:8px">Monthly Budget Targets</h3>
        <div class="hint">Set monthly spending targets for your categories. These will show as progress bars on the dashboard.</div>
        <table class="tbl">
          <thead>
            <tr>
              <th>Category</th>
              <th>Group</th>
              <th class="r">Monthly Target (£)</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="targetsBody">
            ${categories.map(cat => {
              const target = targetMap.get(cat.id);
              const amount = target ? fromPence(target.amount) : '';
              return safeHTML`
                <tr>
                  <td>${cat.name}</td>
                  <td><span class="pill" style="font-size:0.6rem">${cat.group}</span></td>
                  <td class="r">
                    <input type="number" step="0.01" value="${amount}" 
                      class="target-input" data-category-id="${cat.id}" 
                      style="width:100px; text-align:right" />
                  </td>
                  <td class="r">
                    <button class="primary sm save-target-btn" data-category-id="${cat.id}">Save</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    this.setupEventListeners(container);
  },

  /**
   * Set up event listeners for the target settings UI.
   * @param {HTMLElement} container 
   */
  setupEventListeners(container) {
    container.querySelectorAll('.save-target-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const categoryId = Number(e.target.dataset.categoryId);
        const input = container.querySelector(`.target-input[data-category-id="${categoryId}"]`);
        const amount = parseFloat(input.value);

        try {
          const existing = await targetRepository.getByCategory(categoryId);
          
          if (isNaN(amount) || amount <= 0) {
            if (existing) {
              await targetRepository.delete(existing.id);
              input.value = '';
              console.log(`Deleted target for category ${categoryId}`);
            }
          } else {
            const amountPence = toPence(amount);
            if (existing) {
              await targetRepository.update(existing.id, { amount: amountPence });
              console.log(`Updated target for category ${categoryId} to ${amount}`);
            } else {
              await targetRepository.add({ categoryId, amount: amountPence });
              console.log(`Added target for category ${categoryId} to ${amount}`);
            }
          }
          
          // Visual feedback
          btn.textContent = 'Saved!';
          btn.classList.replace('primary', 'ghost');
          setTimeout(() => {
            btn.textContent = 'Save';
            btn.classList.replace('ghost', 'primary');
          }, 2000);

        } catch (error) {
          console.error('Failed to save target:', error);
          alert('Failed to save target: ' + error.message);
        }
      });
    });

    // Also save on Enter key
    container.querySelectorAll('.target-input').forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const categoryId = e.target.dataset.categoryId;
          container.querySelector(`.save-target-btn[data-category-id="${categoryId}"]`).click();
        }
      });
    });
  }
};
