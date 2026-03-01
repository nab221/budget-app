/**
 * Filtering Utilities
 */

/**
 * Filters a list of transactions based on a search query and selected categories.
 * 
 * @param {Array} items - List of transaction objects.
 * @param {string} query - Search string.
 * @param {Array<number>} categoryIds - List of selected category IDs.
 * @param {Array<string>} searchFields - Fields to search in (e.g. ['source', 'label', 'note']).
 * @param {Object} catMap - Mapping of category IDs to names.
 * @returns {Array} - The filtered list of transactions.
 */
export function filterTransactions(items, query, categoryIds = [], searchFields = [], catMap = {}) {
  const normalizedQuery = (query || '').toLowerCase().trim();
  
  return items.filter(item => {
    const matchesSearch = !normalizedQuery || searchFields.some(field => {
      const val = (item[field] || '').toLowerCase();
      // Also search within the category name if available
      const catName = (catMap[item.categoryId] || '').toLowerCase();
      return val.includes(normalizedQuery) || catName.includes(normalizedQuery);
    });

    // Handle both string and numeric category IDs
    const itemCatId = item.categoryId ? Number(item.categoryId) : null;
    const matchesCat = categoryIds.length === 0 || categoryIds.map(Number).includes(itemCatId);
    
    return matchesSearch && matchesCat;
  });
}
