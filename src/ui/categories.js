import { categoryRepository } from '../db/repository.js';
import { safeHTML } from './render.js';

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
          alert('Please enter a category name.');
          return;
        }

        try {
          await categoryRepository.addCategory(group, name);
          nameInput.value = '';
          await this.render();
        } catch (error) {
          console.error('Failed to add category:', error);
          alert('Failed to add category: ' + error.message);
        }
      });
    }

    if (seedCatsBtn) {
      seedCatsBtn.addEventListener('click', async () => {
        if (!confirm('This will add default categories. Continue?')) return;
        
        try {
          const seeded = await categoryRepository.seedDefaultCategories();
          if (seeded) {
            await this.render();
          } else {
            alert('Categories already seeded or database not empty.');
          }
        } catch (error) {
          console.error('Failed to seed categories:', error);
          alert('Failed to seed categories: ' + error.message);
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
        await this.render();
      } catch (error) {
        console.error('Failed to delete category:', error);
        alert('Failed to delete category: ' + error.message);
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
   * Render the fixed and variable category lists in settings.
   * @param {Array} categories 
   */
  renderCategoryLists(categories) {
    const fixedList = document.getElementById('fixedCatList');
    const varList = document.getElementById('varCatList');

    if (fixedList) {
      const fixedCats = categories.filter(c => c.group === 'fixed');
      fixedList.innerHTML = fixedCats.map(c => this.getCategoryTagHTML(c)).join('');
    }

    if (varList) {
      const varCats = categories.filter(c => c.group === 'variable');
      varList.innerHTML = varCats.map(c => this.getCategoryTagHTML(c)).join('');
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
   * Update all category dropdowns in the app.
   * @param {Array} categories 
   */
  updateDropdowns(categories) {
    const fixCatDropdown = document.getElementById('fixCat');
    const varCatDropdown = document.getElementById('varCat');

    if (fixCatDropdown) {
      const fixedCats = categories.filter(c => c.group === 'fixed');
      this.populateDropdown(fixCatDropdown, fixedCats);
    }

    if (varCatDropdown) {
      const varCats = categories.filter(c => c.group === 'variable');
      this.populateDropdown(varCatDropdown, varCats);
    }
    
    // Phase 1 Task 2.4: "Implement a way to populate the Fixed and Variable spending dropdowns 
    // across the app whenever categories change. Note: Since spending forms are in Phase 2, 
    // implement the logic in src/ui/categories.js and verify it by creating a small 
    // temporary 'test dropdown' in the settings view."
    
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
