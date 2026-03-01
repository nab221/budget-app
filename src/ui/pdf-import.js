import { safeHTML, sanitize } from './render.js';
import { extractTextFromPdf, parsers } from '../utils/pdf-parser.js';
import { findDuplicates, suggestCategory, categoryRepository, updateCategorizationLearningRule, incomeRepository, variableSpendRepository } from '../db/repository.js';
import { formatGBP } from '../utils/currency.js';

export const pdfImportUI = {
  state: {
    transactions: [],
    conflicts: [],
    categories: [],
    rawPdfRows: [], // For manual mapping
  },

  async init() {
    this.state.categories = await categoryRepository.getCategories();
  },

  /**
   * Main entry point when a user selects a PDF file
   * @param {File} file 
   */
  async handleFileUpload(file) {
    if (!file || file.type !== 'application/pdf') {
      alert('Please upload a valid PDF file.');
      return;
    }

    try {
      this.showLoadingModal();
      
      const rows = await extractTextFromPdf(file);
      this.state.rawPdfRows = rows;
      
      // Try auto-parsing
      let parsedTransactions = this.attemptAutoParse(rows);
      
      if (parsedTransactions.length === 0) {
        // Fallback to manual mapping
        this.renderManualMappingUI();
        return;
      }

      await this.processAndRenderPreview(parsedTransactions);

    } catch (err) {
      if (err.message === "NO_TEXT_LAYER") {
        alert("This PDF appears to be a scanned image and cannot be read automatically. Please enter transactions manually.");
        window.templateUI.closeModal();
      } else {
        console.error(err);
        alert("Failed to parse PDF. Falling back to manual mapping.");
        this.renderManualMappingUI();
      }
    }
  },

  attemptAutoParse(rows) {
    // Try Lloyds/TSB Credit
    let txs = parsers.lloydsTsbCredit(rows);
    if (txs.length > 0) return txs;

    // Try Santander
    txs = parsers.santanderCurrent(rows);
    if (txs.length > 0) return txs;

    // Try Nationwide
    txs = parsers.nationwide(rows);
    if (txs.length > 0) return txs;

    // Try Amex
    txs = parsers.amex(rows);
    if (txs.length > 0) return txs;

    // Try MBNA
    txs = parsers.mbna(rows);
    if (txs.length > 0) return txs;

    // Try TSB Mortgage
    txs = parsers.tsbMortgage(rows);
    if (txs.length > 0) return txs;

    return [];
  },

  async processAndRenderPreview(transactions) {
    // 1. Suggest Categories
    for (const tx of transactions) {
      const catId = await suggestCategory(tx.description);
      if (catId) {
        tx.categoryId = catId;
        tx.suggested = true;
      }
    }

    // 2. Find Duplicates
    const withDups = await findDuplicates(transactions);
    
    // Split into normal and conflicts
    // Assign unique IDs for UI tracking
    this.state.conflicts = withDups.filter(t => t.isDuplicate).map((t, i) => ({ ...t, _id: `c_${i}`}));
    this.state.transactions = withDups.filter(t => !t.isDuplicate).map((t, i) => ({ ...t, _id: `t_${i}`}));

    this.renderPreviewModal();
  },

  showLoadingModal() {
    window.templateUI.showModal('Processing PDF...', '<p>Extracting text and identifying transactions...</p>', '');
  },

  renderPreviewModal() {
    const catOptions = this.getCategoryOptionsHTML();

    const renderTable = (txs, isConflict = false) => `
      <table class="tbl pdf-import-tbl" style="margin-bottom:15px; width:100%">
        <thead>
          <tr>
            <th style="width:40px"><input type="checkbox" onchange="window.pdfImportUI.toggleAll(event, ${isConflict})" ${isConflict ? '' : 'checked'}></th>
            <th style="width:100px">Date</th>
            <th>Description</th>
            <th style="width:200px">Category</th>
            <th class="r" style="width:100px">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${txs.map(tx => {
            const rowStyle = !tx.categoryId ? 'background-color: var(--warn); color: #000;' : '';
            return `
            <tr style="${rowStyle}" id="row_${tx._id}">
              <td><input type="checkbox" class="tx-cb" data-id="${tx._id}" ${isConflict ? '' : 'checked'}></td>
              <td>${sanitize(tx.date)}</td>
              <td>
                <input type="text" value="${sanitize(tx.description)}" onchange="window.pdfImportUI.updateTx('${tx._id}', 'description', this.value)" style="width:100%; border:none; background:transparent; padding:4px; ${!tx.categoryId ? 'color:#000' : ''}"/>
              </td>
              <td>
                <div style="display:flex; align-items:center; gap:4px">
                  <select onchange="window.pdfImportUI.updateTx('${tx._id}', 'categoryId', this.value)" style="width:100%; padding:4px">
                    <option value="">-- Select --</option>
                    ${this.getCategoryOptionsHTML(tx.categoryId)}
                  </select>
                  ${tx.suggested ? `<span class="pill" style="font-size:0.6rem; padding:2px 4px" title="Suggested based on past transactions">✨</span>` : ''}
                </div>
              </td>
              <td class="r">${formatGBP(tx.amount)}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    `;

    let content = '';

    if (this.state.transactions.length > 0) {
      content += `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
          <h3 style="font-size:1rem">New Transactions</h3>
          <div style="display:flex; gap:8px; align-items:center">
             <select id="bulkCatSelect" style="padding:4px">
               <option value="">-- Bulk Category --</option>
               ${catOptions}
             </select>
             <button class="ghost sm" onclick="window.pdfImportUI.applyBulkCategory()">Apply to Selected</button>
          </div>
        </div>
        <div style="max-height: 40vh; overflow-y: auto; border: 1px solid var(--border)">
          ${renderTable(this.state.transactions, false)}
        </div>
      `;
    }

    if (this.state.conflicts.length > 0) {
      content += `
        <h3 style="font-size:1rem; margin-top:20px; margin-bottom:10px; color: var(--danger)">Review Conflicts (Potential Duplicates)</h3>
        <div class="hint" style="margin-bottom:10px">These match existing transactions by Date and Amount. Check to force import anyway.</div>
        <div style="max-height: 30vh; overflow-y: auto; border: 1px solid var(--danger)">
          ${renderTable(this.state.conflicts, true)}
        </div>
      `;
    }

    const footer = `
      <div style="display:flex; justify-content:space-between; width:100%; align-items:center">
        <button class="ghost" onclick="window.pdfImportUI.renderManualMappingUI()">Manual Mapping</button>
        <div>
          <button class="ghost" onclick="window.templateUI.closeModal()">Cancel</button>
          <button class="primary" onclick="window.pdfImportUI.confirmImport()">Import Selected</button>
        </div>
      </div>
    `;

    window.templateUI.showModal('Review PDF Import', safeHTML`${content}`, safeHTML`${footer}`);
  },

  getCategoryOptionsHTML(selectedId = null) {
    const fixed = this.state.categories.filter(c => c.group === 'fixed');
    const variable = this.state.categories.filter(c => c.group === 'variable');
    
    let html = `<optgroup label="Fixed">`;
    fixed.forEach(c => html += `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${sanitize(c.name)}</option>`);
    html += `</optgroup><optgroup label="Variable">`;
    variable.forEach(c => html += `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${sanitize(c.name)}</option>`);
    html += `</optgroup>`;
    return html;
  },

  toggleAll(event, isConflict) {
    const checked = event.target.checked;
    // Ensure we handle both boolean and string "true"/"false" from inline HTML
    const conflictFlag = String(isConflict) === 'true';
    const prefix = conflictFlag ? 'c_' : 't_';
    
    document.querySelectorAll(`.tx-cb[data-id^="${prefix}"]`).forEach(cb => {
      cb.checked = checked;
    });
  },

  updateTx(id, field, value) {
    const list = id.startsWith('c_') ? this.state.conflicts : this.state.transactions;
    const tx = list.find(t => t._id === id);
    if (tx) {
      tx[field] = value;
      // Remove warning styling if category is set
      if (field === 'categoryId') {
        const tr = document.getElementById(`row_${id}`);
        if (value) {
          tr.style.backgroundColor = '';
          tr.style.color = '';
          const input = tr.querySelector('input[type="text"]');
          if(input) input.style.color = '';
        } else {
          tr.style.backgroundColor = 'var(--warn)';
          tr.style.color = '#000';
          const input = tr.querySelector('input[type="text"]');
          if(input) input.style.color = '#000';
        }
      }
    }
  },

  applyBulkCategory() {
    const catId = document.getElementById('bulkCatSelect').value;
    if (!catId) return;

    document.querySelectorAll('.tx-cb:checked').forEach(cb => {
      const id = cb.dataset.id;
      this.updateTx(id, 'categoryId', catId);
      // Update DOM select
      const tr = document.getElementById(`row_${id}`);
      const select = tr.querySelector('select');
      if (select) select.value = catId;
    });
  },

  async confirmImport() {
    const selectedIds = Array.from(document.querySelectorAll('.tx-cb:checked')).map(cb => cb.dataset.id);
    const toImport = [];
    let hasUncategorized = false;

    const processList = (list) => {
      list.forEach(tx => {
        if (selectedIds.includes(tx._id)) {
          if (!tx.categoryId) hasUncategorized = true;
          toImport.push(tx);
        }
      });
    };

    processList(this.state.transactions);
    processList(this.state.conflicts);

    if (toImport.length === 0) {
      alert("No transactions selected for import.");
      return;
    }

    if (hasUncategorized) {
      alert("Please assign a category to all selected transactions before importing.");
      return;
    }

    // Perform Import
    let count = 0;
    const learningData = [];

    for (const tx of toImport) {
      const category = this.state.categories.find(c => c.id == tx.categoryId);
      if (!category) continue;

      const txData = {
        date: tx.date,
        categoryId: parseInt(tx.categoryId),
        amount: Math.abs(tx.amount) // Store positive amounts, group dictates logic
      };

      if (category.group === 'fixed') {
        await fixedSpendRepository.add({ ...txData, label: tx.description, status: 'paid' });
      } else if (category.group === 'variable') {
        await variableSpendRepository.add({ ...txData, note: tx.description });
      } else {
          // Fallback if income mapping
          await incomeRepository.add({ ...txData, source: tx.description });
      }
      
      learningData.push({ description: tx.description, categoryId: tx.categoryId });
      count++;
    }

    // Update Learning Rule
    await updateCategorizationLearningRule(learningData);

    window.templateUI.closeModal();
    alert(`Successfully imported ${count} transactions.`);
    
    // Refresh main view
    if (window.app) window.app.renderAll();
  },

  renderManualMappingUI() {
    const rows = this.state.rawPdfRows.slice(0, 300); // Show up to 300 rows for preview
    
    if (rows.length === 0) {
      window.templateUI.showModal('Manual Mapping', '<p>No readable text rows found in PDF.</p>', '<button class="ghost" onclick="window.templateUI.closeModal()">Close</button>');
      return;
    }

    // Calculate max columns from ALL rows, not just the preview slice
    const maxCols = Math.max(...this.state.rawPdfRows.map(r => r.length));
    
    let content = `
      <p style="margin-bottom:10px">Auto-parse failed or skipped. Please map the columns below to extract transactions.</p>
      <div style="margin-bottom:15px; display:flex; gap:15px; align-items:center; background:var(--bg-alt); padding:10px; border-radius:4px">
        <div>
          <label style="font-size:0.8rem; display:block; margin-bottom:4px">Skip Header Rows</label>
          <input type="number" id="skipRows" value="0" min="0" style="width:80px; padding:4px"/>
        </div>
        <div class="hint">Identify the row where your transactions start and skip the ones above it.</div>
      </div>
      <div style="overflow-x: auto; max-height: 40vh; border: 1px solid var(--border)">
        <table class="tbl" style="min-width: 600px; white-space: nowrap;">
          <thead style="position: sticky; top: 0; background: var(--bg); z-index: 10">
            <tr>
              <th style="width:40px; background:var(--bg-alt); color:var(--text-soft)">#</th>
              ${Array.from({length: maxCols}).map((_, i) => `
                <th>
                  <select id="map_col_${i}" style="padding:4px; font-size:0.75rem">
                    <option value="">-- Ignore --</option>
                    <option value="date">Date</option>
                    <option value="description">Description</option>
                    <option value="amountOut">Amount Out</option>
                    <option value="amountIn">Amount In</option>
                  </select>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, idx) => `
              <tr>
                <td style="background:var(--bg-alt); color:var(--text-soft); font-size:0.7rem; text-align:center">${idx}</td>
                ${Array.from({length: maxCols}).map((_, i) => `
                  <td>${row[i] ? sanitize(row[i].text) : ''}</td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const footer = `
      <div style="display:flex; justify-content:space-between; width:100%">
        <button class="ghost" onclick="console.log(window.pdfImportUI.state.rawPdfRows); alert('Check browser console (F12) for raw row data. You can also click the Debug button to see it here.')">Log to Console</button>
        <div>
          <button class="ghost" onclick="window.pdfImportUI.showDebugRaw()">Debug: Show Raw Text</button>
          <button class="ghost" onclick="window.templateUI.closeModal()">Cancel</button>
          <button class="primary" onclick="window.pdfImportUI.executeManualMapping()">Extract Data</button>
        </div>
      </div>
    `;

    window.templateUI.showModal('Manual Column Mapping', safeHTML`${content}`, safeHTML`${footer}`);
  },

  showDebugRaw() {
    const raw = this.state.rawPdfRows.map((row, i) => `[Row ${i}] ${row.map(item => item.text).join(' | ')}`).join('\n');
    const content = `<textarea readonly style="width:100%; height:60vh; font-family:monospace; font-size:0.7rem; background:#000; color:#0f0; padding:10px">${sanitize(raw)}</textarea>`;
    window.templateUI.showModal('Debug: Raw PDF Text', safeHTML`${content}`, `<button class="primary" onclick="window.pdfImportUI.renderManualMappingUI()">Back to Mapping</button>`);
  },

  async executeManualMapping() {
    const maxCols = Math.max(...this.state.rawPdfRows.map(r => r.length));
    const skipCount = parseInt(document.getElementById('skipRows').value) || 0;
    
    const mapping = {};
    for (let i = 0; i < maxCols; i++) {
      const select = document.getElementById(`map_col_${i}`);
      if (select && select.value) {
        mapping[select.value] = i;
      }
    }

    if (mapping.date === undefined || mapping.description === undefined || (mapping.amountOut === undefined && mapping.amountIn === undefined)) {
      alert("You must map Date, Description, and at least one Amount column.");
      return;
    }

    const transactions = [];
    const currentYear = new Date().getFullYear();

    // Only process rows after the skip count
    const rowsToProcess = this.state.rawPdfRows.slice(skipCount);

    for (const row of rowsToProcess) {
      if (row.length === 0) continue;

      let dateStr = row[mapping.date] ? row[mapping.date].text.trim() : '';
      let desc = row[mapping.description] ? row[mapping.description].text.trim() : '';
      
      let amountOutStr = mapping.amountOut !== undefined && row[mapping.amountOut] ? row[mapping.amountOut].text.trim() : '';
      let amountInStr = mapping.amountIn !== undefined && row[mapping.amountIn] ? row[mapping.amountIn].text.trim() : '';

      if (!dateStr || !desc) continue;

      let amountPence = 0;
      if (amountOutStr) {
        amountPence = toPence(amountOutStr) * -1;
      } else if (amountInStr) {
        amountPence = toPence(amountInStr);
      }

      if (isNaN(amountPence) || amountPence === 0) continue;

      // Basic Date attempt
      let dateObj = new Date(dateStr);
      if (isNaN(dateObj.getTime())) {
          dateObj = new Date(`${dateStr} ${currentYear}`);
      }

      if (!isNaN(dateObj.getTime())) {
        transactions.push({
          date: dateObj.toISOString().split('T')[0],
          description: desc,
          amount: amountPence
        });
      }
    }

    if (transactions.length === 0) {
      alert("Could not extract any valid transactions based on that mapping. Check the Date and Amount formats.");
      return;
    }

    await this.processAndRenderPreview(transactions);
  }
};

window.pdfImportUI = pdfImportUI;
