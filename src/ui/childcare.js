import { childcareRepository, categoryRepository } from '../db/repository.js';
import { formatGBP } from '../utils/currency.js';
import { calculateFundingGap, getEntitlementPeriod } from '../utils/childcare.js';
import { safeHTML } from './render.js';

/**
 * Childcare UI Module
 *
 * Provides a dedicated "Childcare" tab for managing Tax-Free Childcare accounts,
 * logging deposits/spending, and viewing per-account ledgers.
 */
export const childcareUI = {
  /** Currently selected account id for ledger view (null = show account list) */
  _activeAccountId: null,

  /**
   * Initialize the module — bind event listeners and perform first render.
   */
  async init() {
    this._bindEvents();
    window.addEventListener('app:refresh', () => this.render());
    await this.render();
  },

  /**
   * Bind all static event listeners.
   * Dynamic row-level handlers are attached as window-scoped functions.
   */
  _bindEvents() {
    // Add Account form
    const addAccountBtn = document.getElementById('childcareAddAccountBtn');
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', () => this._handleAddAccount());
    }

    // Log Deposit button
    const logDepositBtn = document.getElementById('childcareLogDepositBtn');
    if (logDepositBtn) {
      logDepositBtn.addEventListener('click', () => this._handleLogDeposit());
    }

    // Log Spending button
    const logSpendBtn = document.getElementById('childcareLogSpendBtn');
    if (logSpendBtn) {
      logSpendBtn.addEventListener('click', () => this._handleLogSpend());
    }

    // Back to accounts list
    const backBtn = document.getElementById('childcareBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this._activeAccountId = null;
        this.render();
      });
    }

    // Window-scoped handlers for dynamically-rendered rows
    window.childcareViewLedger = (accountId) => {
      this._activeAccountId = accountId;
      this.render();
    };

    window.childcareDeleteAccount = async (accountId, childName) => {
      if (!confirm(
        `Delete childcare account for "${childName}"?\n\nThis will permanently delete ALL ledger history for this account. This cannot be undone.`
      )) return;
      try {
        await childcareRepository.deleteAccount(accountId);
        if (this._activeAccountId === accountId) {
          this._activeAccountId = null;
        }
        await this.render();
        // Refresh dashboard so Net Worth updates
        if (window.app) window.app.renderAll();
      } catch (err) {
        console.error('Failed to delete childcare account:', err);
        alert('Failed to delete account: ' + err.message);
      }
    };
  },

  /**
   * Main render entry point. Shows account list or ledger view depending on state.
   */
  async render() {
    const accountList = document.getElementById('childcareAccountList');
    const ledgerSection = document.getElementById('childcareLedgerSection');
    if (!accountList || !ledgerSection) return;

    if (this._activeAccountId !== null) {
      accountList.style.display = 'none';
      ledgerSection.style.display = '';
      await this._renderLedger(this._activeAccountId);
    } else {
      accountList.style.display = '';
      ledgerSection.style.display = 'none';
      await this._renderAccounts();
    }

    await this._populateCategoryDropdown();
  },

  /**
   * Render the account cards list.
   */
  async _renderAccounts() {
    const container = document.getElementById('childcareAccountList');
    if (!container) return;

    const accounts = await childcareRepository.getAccounts();

    // Header + Add Account form always visible
    let formHTML = `
      <div style="margin-bottom:20px">
        <h3 style="font-size:.9rem;margin-bottom:10px;font-weight:600">Add Childcare Account</h3>
        <div class="form-row" style="flex-wrap:wrap">
          <div>
            <label>Child's Name</label>
            <input id="childcareChildName" type="text" placeholder="e.g. Alice"/>
          </div>
          <div>
            <label>Target Monthly Spend (£)</label>
            <input id="childcareTargetSpend" type="number" step="0.01" placeholder="e.g. 500"/>
          </div>
          <div>
            <label>Entitlement Start Date</label>
            <input id="childcareEntitlementStart" type="date"/>
          </div>
          <div style="display:flex;align-items:center;gap:6px;padding-top:18px">
            <input id="childcareIsDisabled" type="checkbox"/>
            <label for="childcareIsDisabled" style="margin:0" title="Disabled children have a £1,000/quarter cap (vs £500)">Disabled child (£1k cap)</label>
          </div>
          <div style="display:flex;align-items:flex-end">
            <button id="childcareAddAccountBtn" class="primary">+ Add Account</button>
          </div>
        </div>
      </div>
    `;

    if (accounts.length === 0) {
      container.innerHTML = formHTML + '<p class="hint" style="text-align:center;padding:20px">No childcare accounts yet. Add one above.</p>';
      this._rebindStaticButtons();
      return;
    }

    // Render account cards
    const today = new Date().toISOString().slice(0, 10);
    const cardPromises = accounts.map(async (account) => {
      const balance = await childcareRepository.getBalance(account.id);
      const { gap, suggestedDeposit } = calculateFundingGap(account.targetMonthlySpend || 0, balance);

      // Check for reconfirmation alert (entitlement period ends within 7 days)
      let reconfirmAlert = '';
      if (account.entitlementStart) {
        try {
          const period = getEntitlementPeriod(account.entitlementStart, today);
          const endDate = period.end;
          const msUntilEnd = endDate.getTime() - new Date(today).getTime();
          const daysUntilEnd = Math.ceil(msUntilEnd / (1000 * 60 * 60 * 24));
          if (daysUntilEnd >= 0 && daysUntilEnd <= 7) {
            reconfirmAlert = `
              <div style="background:var(--warn);color:#000;border-radius:6px;padding:8px 12px;font-size:.8rem;margin-top:10px">
                <strong>Reconfirmation Due:</strong> Your entitlement period ends in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} (${endDate.toISOString().slice(0, 10)}). Log in to GOV.UK to reconfirm eligibility.
              </div>`;
          }
        } catch (e) {
          // Ignore date calculation errors
        }
      }

      const gapSection = gap > 0 ? `
        <div style="background:var(--bg-alt);border-radius:6px;padding:10px 12px;margin-top:10px;font-size:.85rem">
          <div style="color:var(--warn);font-weight:600">Funding Gap: ${formatGBP(gap)}</div>
          <div style="color:var(--text-soft);margin-top:2px">Deposit <strong>${formatGBP(suggestedDeposit)}</strong> to receive the 20% top-up and cover next month's costs.</div>
        </div>` : `
        <div style="background:var(--accent-soft);border:1px solid var(--accent-border);border-radius:6px;padding:8px 12px;margin-top:10px;font-size:.85rem;color:var(--accent)">
          Balance covers target spend
        </div>`;

      const capText = account.isDisabled ? '£1,000/qtr (disabled)' : '£500/qtr';

      return `
        <div class="card" style="border:1px solid var(--border);padding:16px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <h3 style="font-size:1rem;font-weight:700">${account.childName}</h3>
              <div class="hint" style="font-size:.75rem">Gov cap: ${capText}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:1.4rem;font-weight:700;color:var(--accent)">${formatGBP(balance)}</div>
              <div class="hint" style="font-size:.75rem">Current balance</div>
            </div>
          </div>
          <div style="font-size:.85rem;color:var(--text-soft)">
            Target monthly spend: <strong style="color:var(--text)">${formatGBP(account.targetMonthlySpend || 0)}</strong>
          </div>
          ${gapSection}
          ${reconfirmAlert}
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
            <button class="ghost sm" onclick="childcareViewLedger(${account.id})">View Ledger</button>
            <button class="danger sm" onclick="childcareDeleteAccount(${account.id}, '${account.childName.replace(/'/g, "\\'")}')">Delete</button>
          </div>
        </div>
      `;
    });

    const cards = await Promise.all(cardPromises);

    container.innerHTML = formHTML + cards.join('');
    this._rebindStaticButtons();
  },

  /**
   * Render the ledger view for a specific account.
   * @param {number} accountId
   */
  async _renderLedger(accountId) {
    const container = document.getElementById('childcareLedgerSection');
    if (!container) return;

    const accounts = await childcareRepository.getAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      this._activeAccountId = null;
      await this._renderAccounts();
      return;
    }

    const ledger = await childcareRepository.getLedger(accountId);
    const balance = await childcareRepository.getBalance(accountId);
    const today = new Date().toISOString().slice(0, 10);

    const typeLabel = { deposit: 'Deposit', 'top-up': 'Gov Top-up', spend: 'Spend' };
    const typeColor = {
      deposit: 'var(--accent)',
      'top-up': 'var(--info)',
      spend: 'var(--danger)'
    };

    const rows = ledger.length > 0
      ? ledger.map(entry => safeHTML`
          <tr>
            <td>${entry.date}</td>
            <td><span class="pill" style="background:${typeColor[entry.type]};color:#fff;font-size:.65rem">${typeLabel[entry.type] || entry.type}</span></td>
            <td>${entry.description || (entry.type === 'top-up' ? '20% government top-up' : '—')}</td>
            <td class="r" style="color:${entry.type === 'spend' ? 'var(--danger)' : 'var(--accent)'}">
              ${entry.type === 'spend' ? '-' : '+'}${formatGBP(entry.amount)}
            </td>
            <td class="r" style="font-weight:600">${formatGBP(entry.runningBalance)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" class="hint" style="text-align:center;padding:20px">No ledger entries yet.</td></tr>';

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <button id="childcareBackBtn" class="ghost sm">← Back to Accounts</button>
        <h3 style="font-size:1rem;font-weight:700">${account.childName} — Childcare Ledger</h3>
        <div style="margin-left:auto;font-size:1.2rem;font-weight:700;color:var(--accent)">${formatGBP(balance)}</div>
      </div>

      <!-- Log Deposit form -->
      <div style="background:var(--bg-alt);border-radius:8px;padding:14px;margin-bottom:16px">
        <h4 style="font-size:.85rem;font-weight:600;margin-bottom:10px">Log Deposit</h4>
        <div class="form-row" style="flex-wrap:wrap">
          <div>
            <label>Date</label>
            <input id="childcareDepositDate" type="date" value="${today}"/>
          </div>
          <div>
            <label>Amount (£)</label>
            <input id="childcareDepositAmount" type="number" step="0.01" placeholder="e.g. 400"/>
          </div>
          <div>
            <label>Budget Category</label>
            <select id="childcareDepositCategory">
              <option value="">— Category (optional) —</option>
            </select>
          </div>
          <div style="display:flex;align-items:flex-end">
            <button id="childcareLogDepositBtn" class="primary" data-account-id="${accountId}">Log Deposit</button>
          </div>
        </div>
        <div class="hint" style="font-size:.75rem;margin-top:6px">A deposit will also create a "Tax-free Childcare" one-off expense in your budget and apply the 20% government top-up.</div>
      </div>

      <!-- Log Spending form -->
      <div style="background:var(--bg-alt);border-radius:8px;padding:14px;margin-bottom:16px">
        <h4 style="font-size:.85rem;font-weight:600;margin-bottom:10px">Log Spending</h4>
        <div class="form-row" style="flex-wrap:wrap">
          <div>
            <label>Date</label>
            <input id="childcareSpendDate" type="date" value="${today}"/>
          </div>
          <div>
            <label>Amount (£)</label>
            <input id="childcareSpendAmount" type="number" step="0.01" placeholder="e.g. 250"/>
          </div>
          <div>
            <label>Provider / Description</label>
            <input id="childcareSpendDescription" type="text" placeholder="e.g. Sunshine Nursery"/>
          </div>
          <div style="display:flex;align-items:flex-end">
            <button id="childcareLogSpendBtn" class="ghost" data-account-id="${accountId}">Log Spend</button>
          </div>
        </div>
      </div>

      <!-- Ledger table -->
      <table class="tbl">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Description</th>
            <th class="r">Amount</th>
            <th class="r">Balance</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    // Re-bind dynamic buttons rendered inside innerHTML
    this._rebindLedgerButtons(accountId);

    // Populate category dropdown in ledger view
    await this._populateCategoryDropdown();

    // Default "Childcare" category selection for deposit form
    await this._preselectChildcareCategory();
  },

  /**
   * Re-bind static buttons that appear in account list view.
   */
  _rebindStaticButtons() {
    const addAccountBtn = document.getElementById('childcareAddAccountBtn');
    if (addAccountBtn) {
      addAccountBtn.onclick = () => this._handleAddAccount();
    }
  },

  /**
   * Re-bind ledger action buttons that were rendered via innerHTML.
   * @param {number} accountId
   */
  _rebindLedgerButtons(accountId) {
    const backBtn = document.getElementById('childcareBackBtn');
    if (backBtn) {
      backBtn.onclick = () => {
        this._activeAccountId = null;
        this.render();
      };
    }

    const logDepositBtn = document.getElementById('childcareLogDepositBtn');
    if (logDepositBtn) {
      logDepositBtn.onclick = () => this._handleLogDeposit();
    }

    const logSpendBtn = document.getElementById('childcareLogSpendBtn');
    if (logSpendBtn) {
      logSpendBtn.onclick = () => this._handleLogSpend();
    }
  },

  /**
   * Populate all childcare category <select> elements with the current categories.
   * Pre-selects any category matching "Childcare" by name.
   */
  async _populateCategoryDropdown() {
    const categories = await categoryRepository.getCategories();
    const selects = [
      document.getElementById('childcareDepositCategory')
    ].filter(Boolean);

    for (const sel of selects) {
      const current = sel.value;
      sel.innerHTML = '<option value="">— Category (optional) —</option>' +
        categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (current) sel.value = current;
    }
  },

  /**
   * Pre-select the "Childcare" category in the deposit form if it exists.
   */
  async _preselectChildcareCategory() {
    const sel = document.getElementById('childcareDepositCategory');
    if (!sel || sel.value) return; // already has a selection

    const categories = await categoryRepository.getCategories();
    const childcareCat = categories.find(c => c.name.toLowerCase().includes('childcare'));
    if (childcareCat) {
      sel.value = String(childcareCat.id);
    }
  },

  /**
   * Handle "Add Account" form submission.
   */
  async _handleAddAccount() {
    const childName = (document.getElementById('childcareChildName')?.value || '').trim();
    const targetSpend = parseFloat(document.getElementById('childcareTargetSpend')?.value || '0');
    const entitlementStart = document.getElementById('childcareEntitlementStart')?.value || '';
    const isDisabled = document.getElementById('childcareIsDisabled')?.checked || false;

    if (!childName) {
      alert("Please enter the child's name.");
      return;
    }
    if (!entitlementStart) {
      alert('Please enter the entitlement start date.');
      return;
    }

    try {
      await childcareRepository.saveAccount({
        childName,
        targetMonthlySpend: isNaN(targetSpend) || targetSpend <= 0 ? 0 : targetSpend,
        entitlementStart,
        isDisabled
      });

      // Clear form
      const nameInput = document.getElementById('childcareChildName');
      const spendInput = document.getElementById('childcareTargetSpend');
      const startInput = document.getElementById('childcareEntitlementStart');
      const disabledInput = document.getElementById('childcareIsDisabled');
      if (nameInput) nameInput.value = '';
      if (spendInput) spendInput.value = '';
      if (startInput) startInput.value = '';
      if (disabledInput) disabledInput.checked = false;

      await this.render();
      if (window.app) window.app.renderAll();
    } catch (err) {
      console.error('Failed to add childcare account:', err);
      alert('Failed to add account: ' + err.message);
    }
  },

  /**
   * Handle "Log Deposit" form submission.
   */
  async _handleLogDeposit() {
    const accountId = this._activeAccountId;
    if (!accountId) return;

    const date = document.getElementById('childcareDepositDate')?.value;
    const amount = parseFloat(document.getElementById('childcareDepositAmount')?.value || '0');
    const categoryIdRaw = document.getElementById('childcareDepositCategory')?.value;
    const categoryId = categoryIdRaw ? parseInt(categoryIdRaw) : null;

    if (!date) {
      alert('Please select a date.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid deposit amount.');
      return;
    }

    try {
      const result = await childcareRepository.addDeposit(accountId, date, amount, categoryId);

      // amount is in pounds; top-up = 25% of deposit in pence
      const depositPence = Math.round(amount * 100);
      const topUpMsg = result.topUpId
        ? ` Government top-up of ${formatGBP(Math.round(depositPence * 0.25))} applied.`
        : ' No top-up available (quarterly cap reached).';

      // Clear deposit amount
      const amtInput = document.getElementById('childcareDepositAmount');
      if (amtInput) amtInput.value = '';

      await this.render();
      // Refresh dashboard so Net Worth and expenses update
      if (window.app) window.app.renderAll();

      alert(`Deposit logged successfully.${topUpMsg}`);
    } catch (err) {
      console.error('Failed to log deposit:', err);
      alert('Failed to log deposit: ' + err.message);
    }
  },

  /**
   * Handle "Log Spend" form submission.
   */
  async _handleLogSpend() {
    const accountId = this._activeAccountId;
    if (!accountId) return;

    const date = document.getElementById('childcareSpendDate')?.value;
    const amount = parseFloat(document.getElementById('childcareSpendAmount')?.value || '0');
    const description = (document.getElementById('childcareSpendDescription')?.value || '').trim();

    if (!date) {
      alert('Please select a date.');
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid spend amount.');
      return;
    }

    try {
      await childcareRepository.addSpend(accountId, date, amount, description);

      // Clear form
      const amtInput = document.getElementById('childcareSpendAmount');
      const descInput = document.getElementById('childcareSpendDescription');
      if (amtInput) amtInput.value = '';
      if (descInput) descInput.value = '';

      await this.render();
      // Refresh dashboard so Net Worth updates
      if (window.app) window.app.renderAll();
    } catch (err) {
      console.error('Failed to log spend:', err);
      alert('Failed to log spend: ' + err.message);
    }
  }
};
