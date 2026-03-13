import { categoryRepository } from '../db/repository.js';
import { safeHTML } from './render.js';
import { triggerHaptic } from '../utils/haptics.js';
import { notificationUI } from './notifications.js';

/**
 * Category UI Module
 * Handles rendering and event handling for category management.
 */
export const categoryUI = {
  /**
   * Initialize Category UI.
   * Sets up event listeners and performs initial render.
   */
  async init() {
    this.setupEventListeners();
    await this.render();
  },

  /**
   * Set up event listeners for category management.
   */
  setupEventListeners() {
    const addCatBtn = document.getElementById('addCatBtn');
    const seedCatsBtn = document.getElementById('seedCatsBtn');

    if (addCatBtn) {
      addCatBtn.addEventListener('click', async () => {
        const group = document.getElementById('catGroup').value;
        const nameInput = document.getElementById('catName');
        const name = nameInput.value.trim();

        if (!name) {
          notificationUI.warning('Please enter a category name.');
          return;
        }

        try {
          await categoryRepository.addCategory(group, name);
          triggerHaptic('success');
          nameInput.value = '';
          await this.render();
        } catch (error) {
          console.error('Failed to add category:', error);
          notificationUI.error('Failed to add category: ' + error.message);
        }
      });
    }

    if (seedCatsBtn) {
      seedCatsBtn.addEventListener('click', async () => {
        if (!confirm('This will add default categories. Continue?')) return;
        
        try {
          const seeded = await categoryRepository.seedDefaultCategories();
          if (seeded) {
            triggerHaptic('success');
            await this.render();
          } else {
            notificationUI.info('Categories already seeded or database not empty.');
          }
        } catch (error) {
          console.error('Failed to seed categories:', error);
          notificationUI.error('Failed to seed categories: ' + error.message);
        }
      });
    }

    // Export deleteCat to window for inline onclick handlers if needed, 
    // though it's better to use event delegation or direct attachment.
    // The legacy app used inline onclick.
    window.deleteCat = async (id) => {
      const inUse = await categoryRepository.isCategoryInUse(id);
      if (inUse) {
        if (!confirm('This category is currently used by transactions. Deleting it may cause issues in reports. Are you sure?')) {
          return;
        }
      } else {
        if (!confirm('Are you sure you want to delete this category?')) {
          return;
        }
      }

      try {
        await categoryRepository.deleteCategory(id);
        triggerHaptic('delete');
        await this.render();
      } catch (error) {
        console.error('Failed to delete category:', error);
        notificationUI.error('Failed to delete category: ' + error.message);
      }
    };
  },

  /**
   * Render categories in the settings view and update dropdowns.
   */
  async render() {
    const categories = await categoryRepository.getCategories();
    
    this.renderCategoryLists(categories);
    this.updateDropdowns(categories);
  },

  /**
   * Render income and expense category lists in settings.
   * @param {Array} categories
   */
  renderCategoryLists(categories) {
    const incomeList = document.getElementById('incomeCatList');
    const expenseList = document.getElementById('expenseCatList');

    if (incomeList) {
      const incomeCats = categories.filter(c => c.group === 'income');
      incomeList.innerHTML = incomeCats.map(c => this.getCategoryTagHTML(c)).join('');
    }

    if (expenseList) {
      const expenseCats = categories.filter(c => c.group === 'expenses');
      expenseList.innerHTML = expenseCats.map(c => this.getCategoryTagHTML(c)).join('');
    }
  },

  /**
   * Generate HTML for a category tag with a delete button.
   * Uses safeHTML for sanitization.
   * @param {Object} category 
   * @returns {string}
   */
  getCategoryTagHTML(category) {
    return safeHTML`
      <span class="tag" style="display:inline-flex;align-items:center;gap:4px;margin:2px">
        ${category.name}
        <button class="sm danger" onclick="deleteCat(${category.id})" style="border:none;background:none;color:#f87171;cursor:pointer;padding:0;font-size:.75rem">
          ✕
        </button>
      </span>
    `;
  },

  /**
   * Update category dropdowns in active views.
   * @param {Array} categories
   */
  updateDropdowns(categories) {
    // Emit a global event so tab modules can re-render any category filters on demand.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('categories:updated', { detail: { categories } }));
    }
    
    const testDropdown = document.getElementById('testDropdown');
    if (testDropdown) {
      this.populateDropdown(testDropdown, categories);
    }
  },

  /**
   * Populate a select element with category options.
   * @param {HTMLSelectElement} select 
   * @param {Array} items 
   */
  populateDropdown(select, items) {
    const currentValue = select.value;
    
    // Build options
    let optionsHTML = items.map(c => safeHTML`<option value="${c.id}">${c.name}</option>`).join('');
    optionsHTML += '<option value="__other">Other…</option>';
    
    select.innerHTML = optionsHTML;
    
    // Restore selection if it still exists
    if (currentValue && [...select.options].some(o => o.value === currentValue)) {
      select.value = currentValue;
    }
  }
};
