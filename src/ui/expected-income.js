import { expectedIncomeRepository, incomeRepository, categoryRepository } from '../db/repository.js';
import { generateExpectedIncomePredictions } from '../utils/cashflow.js';
import { toPounds, toPence, formatCurrency } from '../utils/currency.js';
import { showModal, closeModal } from './templates.js';

/**
 * Expected Income UI
 * 
 * Manages the display and lifecycle of predicted income.
 * Predictions can be confirmed (moved to real income), edited, or deleted.
 */
export const expectedIncomeUI = {
  /**
   * Main entry point for rendering the Cash Flow Planner panel.
   */
  async render() {
    const container = document.getElementById('cashflowPlannerContainer');
    if (!container) return;

    const [expected, categories] = await Promise.all([
      expectedIncomeRepository.getAll(),
      categoryRepository.getCategories()
    ]);

    // Sort by date ascending
    expected.sort((a, b) => a.date.localeCompare(b.date));

    let html = `
      <div class="card-hd">
        <h3>Expected Income</h3>
        <div style="display:flex; gap:8px">
          <button id="genPredictionsBtn" class="ghost sm">🪄 Generate Predictions</button>
          <button id="addExpectedBtn" class="primary sm">+ Add Expected</button>
        </div>
      </div>
      <div class="hint" style="margin-bottom:12px">
        Manage predicted income payments. Confirm them when they arrive to update your actual balance.
      </div>
    `;

    if (expected.length === 0) {
      html += `
        <div class="empty-state" style="padding:40px; text-align:center; background:var(--bg-alt); border-radius:8px">
          <div style="font-size:2rem; margin-bottom:10px">📅</div>
          <p>No expected income recorded.</p>
          <p class="hint">Click "Generate Predictions" to auto-fill based on history.</p>
        </div>
      `;
    } else {
      html += `
        <table class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Source</th>
              <th class="r">Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${expected.map(item => {
              const cat = categories.find(c => c.id === item.categoryId);
              const statusPill = item.status === 'predicted' 
                ? '<span class="pill" style="background:var(--bg-alt); border:1px solid var(--border)">Predicted</span>'
                : '<span class="pill" style="background:var(--success-bg); color:var(--success)">Manual</span>';
              
              return `
                <tr>
                  <td>${item.date}</td>
                  <td>
                    <div style="font-weight:600">${item.source}</div>
                    <div class="hint">${cat ? cat.name : 'Uncategorized'}</div>
                  </td>
                  <td class="r">${formatCurrency(item.amount)}</td>
                  <td>${statusPill}</td>
                  <td class="r">
                    <button class="confirm-btn ghost sm" data-id="${item.id}" title="Confirm Arrival">✓</button>
                    <button class="edit-btn ghost sm" data-id="${item.id}">Edit</button>
                    <button class="delete-btn danger sm" data-id="${item.id}">✖</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    container.innerHTML = html;
    this.attachEventListeners();
  },

  /**
   * Attach event listeners to the rendered panel.
   */
  attachEventListeners() {
    const container = document.getElementById('cashflowPlannerContainer');

    // Generate Predictions
    container.querySelector('#genPredictionsBtn')?.addEventListener('click', async () => {
      const predictions = await generateExpectedIncomePredictions();
      if (predictions.length === 0) {
        alert('Not enough historical data to generate predictions (needs 1-3 months of income history).');
        return;
      }
      
      if (confirm(`Generate ${predictions.length} income predictions based on last 3 months?`)) {
        for (const p of predictions) {
          await expectedIncomeRepository.add(p);
        }
        this.render();
      }
    });

    // Add Manual Expected
    container.querySelector('#addExpectedBtn')?.addEventListener('click', () => {
      this.showEditModal();
    });

    // Confirm (Move to Income)
    container.querySelectorAll('.confirm-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const item = await expectedIncomeRepository.get(id);
        if (item && confirm(`Confirm arrival of ${formatCurrency(item.amount)} from ${item.source}?`)) {
          // 1. Create real income record
          await incomeRepository.add({
            date: new Date().toISOString().split('T')[0], // Use today's date
            source: item.source,
            amount: toPounds(item.amount), // Repository.add expects pounds if using createBaseRepository? No, incomeRepository.add uses toPence.
            // Wait, incomeRepository.add uses toPence(data.amount).
            // item.amount is already in pence.
            // So I should pass item.amount / 100 or fix repository.
            amount: item.amount / 100, 
            categoryId: item.categoryId
          });
          // 2. Delete expected record
          await expectedIncomeRepository.delete(id);
          this.render();
        }
      });
    });

    // Edit
    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        const item = await expectedIncomeRepository.get(id);
        if (item) this.showEditModal(item);
      });
    });

    // Delete
    container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        if (confirm('Delete this expected income?')) {
          await expectedIncomeRepository.delete(id);
          this.render();
        }
      });
    });
  },

  /**
   * Show modal to add or edit an expected income record.
   * @param {Object|null} item - Existing item for edit, or null for add.
   */
  async showEditModal(item = null) {
    const categories = (await categoryRepository.getCategories()).filter(c => c.group !== 'system');
    
    const title = item ? 'Edit Expected Income' : 'Add Expected Income';
    const body = `
      <form id="expectedIncomeForm" class="grid-form">
        <div class="form-row">
          <div>
            <label>Date</label>
            <input type="date" name="date" value="${item ? item.date : new Date().toISOString().split('T')[0]}" required />
          </div>
          <div>
            <label>Amount (£)</label>
            <input type="number" name="amount" step="0.01" value="${item ? toPounds(item.amount) : ''}" required />
          </div>
        </div>
        <div class="form-row">
          <div>
            <label>Source</label>
            <input type="text" name="source" value="${item ? item.source : ''}" placeholder="e.g. Salary" required />
          </div>
          <div>
            <label>Category</label>
            <select name="categoryId">
              ${categories.map(c => `<option value="${c.id}" ${item && item.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </form>
    `;

    showModal(title, body, [
      {
        label: 'Cancel',
        className: 'ghost',
        onClick: closeModal
      },
      {
        label: 'Save',
        className: 'primary',
        onClick: async () => {
          const form = document.getElementById('expectedIncomeForm');
          const formData = new FormData(form);
          const data = {
            date: formData.get('date'),
            amount: parseFloat(formData.get('amount')),
            source: formData.get('source'),
            categoryId: parseInt(formData.get('categoryId'), 10),
            status: item ? item.status : 'manual'
          };

          if (item) {
            await expectedIncomeRepository.update(item.id, data);
          } else {
            await expectedIncomeRepository.add(data);
          }
          
          closeModal();
          this.render();
        }
      }
    ]);
  }
};
