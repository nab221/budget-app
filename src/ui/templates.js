import { recurringTemplateRepository, fixedSpendRepository, incomeRepository, categoryRepository } from '../db/repository.js';
import { formatGBP as formatCurrency, toPence } from '../utils/currency.js';
import { safeHTML } from './render.js';

export const templateUI = {
  elements: {
    tplName: document.getElementById('tplName'),
    tplCat: document.getElementById('tplCat'),
    tplAmt: document.getElementById('tplAmt'),
    tplType: document.getElementById('tplType'),
    addTplBtn: document.getElementById('addTplBtn'),
    tplBody: document.getElementById('tplBody'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalFooter: document.getElementById('modalFooter'),
    modalClose: document.getElementById('modalClose')
  },

  async init() {
    this.setupEventListeners();
    await this.renderTemplates();
    await this.renderCategoryDropdown();
    await this.checkStartOfMonth();
  },

  setupEventListeners() {
    this.elements.addTplBtn.addEventListener('click', () => this.handleAddTemplate());
    this.elements.modalClose.addEventListener('click', () => this.closeModal());
  },

  async renderCategoryDropdown() {
    const categories = await categoryRepository.getCategories();
    const fixedCats = categories.filter(c => c.group === 'fixed');
    
    this.elements.tplCat.innerHTML = safeHTML`
      <option value="">-- Select Category --</option>
      ${fixedCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
    `;
  },

  async renderTemplates() {
    const templates = await recurringTemplateRepository.getAll();
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    this.elements.tplBody.innerHTML = safeHTML`
      ${templates.map(tpl => `
        <tr>
          <td>${tpl.name}</td>
          <td>${catMap[tpl.categoryId] || 'Unknown'}</td>
          <td class="r">${formatCurrency(tpl.amount)}</td>
          <td><span class="pill">${tpl.type}</span></td>
          <td class="r">
            <button class="danger sm" onclick="window.templateUI.deleteTemplate(${tpl.id})">Delete</button>
          </td>
        </tr>
      `).join('')}
    `;
  },

  async handleAddTemplate() {
    const name = this.elements.tplName.value.trim();
    const categoryId = parseInt(this.elements.tplCat.value);
    const amount = parseFloat(this.elements.tplAmt.value);
    const type = this.elements.tplType.value;

    if (!name || !categoryId || isNaN(amount)) {
      alert('Please fill in all required fields');
      return;
    }

    await recurringTemplateRepository.add({
      name,
      categoryId,
      amount,
      type,
      frequency: 'monthly'
    });

    this.elements.tplName.value = '';
    this.elements.tplAmt.value = '';
    await this.renderTemplates();
  },

  async deleteTemplate(id) {
    if (confirm('Are you sure you want to delete this template?')) {
      await recurringTemplateRepository.delete(id);
      await this.renderTemplates();
    }
  },

  showModal(title, content, footer = '') {
    this.elements.modalTitle.textContent = title;
    this.elements.modalBody.innerHTML = content;
    this.elements.modalFooter.innerHTML = footer;
    this.elements.modalOverlay.classList.remove('hidden');
  },

  closeModal() {
    this.elements.modalOverlay.classList.add('hidden');
  },

  async checkStartOfMonth() {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const lastPrompted = localStorage.getItem('lastPromptedMonth');

    if (currentMonth !== lastPrompted) {
      const templates = await recurringTemplateRepository.getAll();
      if (templates.length === 0) return;

      // Check if any of these templates have already been added this month
      // This is a simplified check: we just see if the user has been prompted for this month yet.
      // If not, we show the modal.
      
      this.promptRecurring(templates, currentMonth);
    }
  },

  async promptRecurring(templates, monthStr) {
    const categories = await categoryRepository.getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    const content = safeHTML`
      <p style="margin-bottom:15px">Welcome to ${new Date(monthStr + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}! Would you like to add your recurring items for this month?</p>
      <table class="tbl">
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAllTpls" checked /></th>
            <th>Name</th>
            <th class="r">Amount</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          ${templates.map(tpl => `
            <tr>
              <td><input type="checkbox" class="tpl-select" data-id="${tpl.id}" checked /></td>
              <td>${tpl.name}</td>
              <td class="r">${formatCurrency(tpl.amount)}</td>
              <td>${tpl.type}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const footer = safeHTML`
      <button class="ghost" onclick="window.templateUI.closeModal()">Skip</button>
      <button class="primary" onclick="window.templateUI.generateFromSelected('${monthStr}')">Add Selected</button>
    `;

    this.showModal('Start of Month: Recurring Items', content, footer);

    document.getElementById('selectAllTpls').addEventListener('change', (e) => {
      document.querySelectorAll('.tpl-select').forEach(cb => cb.checked = e.target.checked);
    });
  },

  async generateFromSelected(monthStr) {
    const selectedIds = Array.from(document.querySelectorAll('.tpl-select:checked'))
      .map(cb => parseInt(cb.dataset.id));
    
    if (selectedIds.length === 0) {
      this.closeModal();
      localStorage.setItem('lastPromptedMonth', monthStr);
      return;
    }

    const templates = await recurringTemplateRepository.getAll();
    const toGenerate = templates.filter(t => selectedIds.includes(t.id));

    // Default date to 1st of the month
    const date = `${monthStr}-01`;

    for (const tpl of toGenerate) {
      if (tpl.type === 'fixed') {
        await fixedSpendRepository.add({
          date,
          categoryId: tpl.categoryId,
          label: tpl.name,
          amount: tpl.amount / 100, // Repository expects float for currency.js toPence
          status: 'pending'
        });
      } else if (tpl.type === 'income') {
        await incomeRepository.add({
          date,
          categoryId: tpl.categoryId,
          source: tpl.name,
          amount: tpl.amount / 100
        });
      }
    }

    localStorage.setItem('lastPromptedMonth', monthStr);
    this.closeModal();
    
    // Refresh the current view if it's the dashboard
    if (window.app) {
      window.app.renderAll();
    }
  }
};

// Make it globally accessible for inline onclick handlers (simpler for this scale)
window.templateUI = templateUI;
