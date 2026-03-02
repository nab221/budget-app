import { recurringTemplateRepository, recurrentExpenseRepository, incomeRepository, categoryRepository } from '../db/repository.js';
import { formatGBP as formatCurrency, toPence } from '../utils/currency.js';
import { safeHTML, modalUI } from './render.js';

export const templateUI = {
  elements: {
    tplName: document.getElementById('tplName'),
    tplCat: document.getElementById('tplCat'),
    tplAmt: document.getElementById('tplAmt'),
    tplType: document.getElementById('tplType'),
    addTplBtn: document.getElementById('addTplBtn'),
    tplBody: document.getElementById('tplBody')
  },

  async init() {
    this.setupEventListeners();
    await this.renderTemplates();
    await this.renderCategoryDropdown();
    await this.checkStartOfMonth();
  },

  setupEventListeners() {
    if (this.elements.addTplBtn) {
      this.elements.addTplBtn.addEventListener('click', () => this.handleAddTemplate());
    }
  },

  async renderCategoryDropdown() {
    if (!this.elements.tplCat) return;
    const categories = await categoryRepository.getCategories();
    const fixedCats = categories.filter(c => c.group === 'fixed');
    
    this.elements.tplCat.innerHTML = safeHTML`
      <option value="">-- Select Category --</option>
      ${fixedCats.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
    `;
  },

  async renderTemplates() {
    if (!this.elements.tplBody) return;
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

  async checkStartOfMonth() {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const lastPrompted = localStorage.getItem('lastPromptedMonth');

    if (currentMonth !== lastPrompted) {
      const templates = await recurringTemplateRepository.getAll();
      if (templates.length === 0) return;
      
      this.promptRecurring(templates, currentMonth);
    }
  },

  async manualTrigger(monthStr) {
    const templates = await recurringTemplateRepository.getAll();
    if (templates.length === 0) {
      alert('No recurring templates found. Create some in Settings first!');
      return;
    }
    
    // Logic: Reuse promptRecurring but without updating lastPromptedMonth
    // so the automatic prompt still works as expected if they haven't run it.
    this.promptRecurring(templates, monthStr);
  },

  async promptRecurring(templates, monthStr) {
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

    modalUI.show('Start of Month: Recurring Items', content, footer);

    const selectAll = document.getElementById('selectAllTpls');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
        document.querySelectorAll('.tpl-select').forEach(cb => cb.checked = e.target.checked);
      });
    }
  },

  showModal(title, content, footer) {
    modalUI.show(title, content, footer);
  },

  closeModal() {
    modalUI.close();
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
        await recurrentExpenseRepository.add({
          date,
          categoryId: tpl.categoryId,
          label: tpl.name,
          amount: tpl.amount / 100, // Repository expects float for currency.js toPence
          status: 'pending',
          frequency: 'monthly',
          nextDate: date,
          isEssential: true,
          cycleTotal: 0,
          cycleCurrent: 0
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
