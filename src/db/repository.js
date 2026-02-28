import { db } from './schema.js';

/**
 * Category Repository
 * Handles all database operations for budget categories.
 */
export const categoryRepository = {
  /**
   * Get all categories.
   * @returns {Promise<Array>}
   */
  async getCategories() {
    return await db.categories.toArray();
  },

  /**
   * Add a new category.
   * @param {string} group - 'fixed' or 'variable'
   * @param {string} name - Category name
   * @returns {Promise<number>} - The ID of the new category
   */
  async addCategory(group, name) {
    if (!name || !name.trim()) {
      throw new Error('Category name is required');
    }
    if (!['fixed', 'variable'].includes(group)) {
      throw new Error('Invalid category group');
    }
    return await db.categories.add({
      group,
      name: name.trim()
    });
  },

  /**
   * Delete a category by ID.
   * @param {number} id - Category ID
   * @returns {Promise<void>}
   */
  async deleteCategory(id) {
    await db.categories.delete(id);
  },

  /**
   * Seed default categories if the table is empty.
   * @returns {Promise<boolean>} - True if seeded, false if already has data.
   */
  async seedDefaultCategories() {
    const count = await db.categories.count();
    if (count > 0) return false;

    const DEFAULT_CATS = {
      fixed: [
        'Housing', 'Utilities', 'Credit Cards & Loans', 'Insurance', 
        'Health', 'Childcare', 'Professional Subscriptions', 'Savings', 'Other Fixed'
      ],
      variable: [
        'Groceries', 'Eating Out / Takeaway', 'Clothing', 'Fuel / Transport', 
        'Miscellaneous', 'Entertainment', 'Gifts', 'Home / Garden'
      ]
    };

    const toAdd = [];
    for (const [group, names] of Object.entries(DEFAULT_CATS)) {
      for (const name of names) {
        toAdd.push({ group, name });
      }
    }

    await db.categories.bulkAdd(toAdd);
    return true;
  },

  /**
   * Check if a category is in use by any transactions.
   * @param {number|string} categoryId - Category ID (or name if legacy)
   * @returns {Promise<boolean>}
   */
  async isCategoryInUse(categoryId) {
    const fixedCount = await db.fixedSpends.where('categoryId').equals(categoryId).count();
    const varCount = await db.variableSpends.where('categoryId').equals(categoryId).count();
    const subCount = await db.subscriptions.where('categoryId').equals(categoryId).count();
    const incCount = await db.income.where('categoryId').equals(categoryId).count();

    return (fixedCount + varCount + subCount + incCount) > 0;
  }
};

