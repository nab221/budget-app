import { childcareRepository, categoryRepository } from '../db/repository.js';
import { formatGBP, fromPence } from '../utils/currency.js';
import { calculateFundingGap, getEntitlementPeriod, monthlyEquivalentFromProvider } from '../utils/childcare.js';
import { safeHTML, modalUI, renderTabSummary } from './render.js';
import { triggerHaptic } from '../utils/haptics.js';
import { notificationUI } from './notifications.js';

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
   */
  _bindEvents() {
    const addAccountBtn = document.getElementById('childcareAddAccountBtn');
    if (addAccountBtn) {
      addAccountBtn.addEventListener('click', () => this._showAccountModal());
    }

    window.childcareViewLedger = (accountId) => {
      this._activeAccountId = accountId;
      this.render();
    };

    window.childcareEditAccount = async (accountId) => {
      const account = await childcareRepository.getAccount(accountId);
      if (account) this._showAccountModal(account);
    };

    window.childcareAddProvider = (accountId) => this._showProviderModal(accountId);
    window.childcareEditProvider = async (providerId, accountId) => {
      const providers = await childcareRepository.getAccountProviders(accountId);
      const provider = providers.find(p => p.id === providerId);
      if (provider) this._showProviderModal(accountId, provider);
    };
    window.childcareDeleteProvider = async (providerId, accountId, providerName) => {
      if (!confirm(`Remove provider "${providerName}"?`)) return;
      try {
        await childcareRepository.deleteProvider(providerId);
        triggerHaptic('delete');
        await this.render();
      } catch (err) {
        console.error('Failed to delete provider:', err);
        notificationUI.error('Failed to remove provider: ' + err.message);
      }
    };

    window.childcareDeleteAccount = async (accountId, childName) => {
      if (!confirm(
        `Delete childcare account for "${childName}"?\n\nThis will permanently delete ALL ledger history for this account. This cannot be undone.`
      )) return;
      try {
        await childcareRepository.deleteAccount(accountId);
        triggerHaptic('delete');
        if (this._activeAccountId === accountId) {
          this._activeAccountId = null;
        }
        await this.render();
        if (window.app) window.app.renderAll();
      } catch (err) {
        console.error('Failed to delete childcare account:', err);
        notificationUI.error('Failed to delete account: ' + err.message);
      }
    };
  },

  /**
   * Shows the modal to add or edit a childcare account.
   */
  async _showAccountModal(account = null) {
    const isEdit = !!account;
    const content = `
      <div class="form-row">
        <div><label>Child's Name</label><input id="modalChildcareChildName" type="text" value="${account?.childName || ''}" placeholder="e.g. Alice"/></div>
      </div>
      <div class="form-row">
        <div><label>Target Monthly Spend (£)</label><input id="modalChildcareTargetSpend" type="number" step="0.01" value="${account ? fromPence(account.targetMonthlySpend) : ''}" placeholder="e.g. 500"/></div>
      </div>
      <div class="form-row">
        <div><label>Opening Balance (£)</label><input id="modalChildcareOpeningBalance" type="number" step="0.01" value="${account ? fromPence(account.openingBalance || 0) : ''}" placeholder="0.00"/></div>
      </div>
      <div class="form-row">
        <div><label>Entitlement Start Date</label><input id="modalChildcareEntitlementStart" type="date" value="${account?.entitlementStart || ''}"/></div>
      </div>
      <div class="form-row">
        <div style="display:flex;align-items:center;gap:6px;padding-top:10px">
          <input id="modalChildcareIsDisabled" type="checkbox" ${account?.isDisabled ? 'checked' : ''}/>
          <label for="modalChildcareIsDisabled" style="margin:0">Disabled child (£1k cap)</label>
        </div>
      </div>
    `;
    const footer = `
      <button class="ghost" onclick="modalUI.close()">Cancel</button>
      <button class="primary" id="modalChildcareSaveAccountBtn">Save Account</button>
    `;

    modalUI.show(isEdit ? 'Edit Childcare Account' : 'Add Childcare Account', content, footer);

    document.getElementById('modalChildcareSaveAccountBtn').onclick = () => this._handleSaveAccount(account?.id);
  },

  /**
   * Shows the modal to log a deposit.
   */
  async _showLogDepositModal(accountId) {
    const categories = await categoryRepository.getCategories();
    const today = new Date().toISOString().slice(0, 10);
    const childcareCat = categories.find(c => c.name.toLowerCase().includes('childcare'));

    const content = `
      <div class="form-row">
        <div><label>Date</label><input id="modalChildcareDepositDate" type="date" value="${today}"/></div>
      </div>
      <div class="form-row">
        <div><label>Amount (£)</label><input id="modalChildcareDepositAmount" type="number" step="0.01" placeholder="0.00"/></div>
      </div>
      <div class="form-row">
        <div><label>Budget Category</label><select id="modalChildcareDepositCategory">
          <option value="">— Category (optional) —</option>
          ${categories.map(c => `<option value="${c.id}" ${childcareCat?.id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select></div>
      </div>
      <p class="hint" style="font-size:.75rem;margin-top:10px">A deposit will also create a "Tax-free Childcare" one-off expense in your budget and apply the 20% government top-up.</p>
    `;
    const footer = `
      <button class="ghost" onclick="modalUI.close()">Cancel</button>
      <button class="primary" id="modalChildcareLogDepositSaveBtn">Log Deposit</button>
    `;

    modalUI.show('Log Childcare Deposit', content, footer);
    document.getElementById('modalChildcareLogDepositSaveBtn').onclick = () => this._handleLogDeposit(accountId);
  },

  /**
   * Shows the modal to log spending.
   */
  _showLogSpendModal(accountId) {
    const today = new Date().toISOString().slice(0, 10);
    const content = `
      <div class="form-row">
        <div><label>Date</label><input id="modalChildcareSpendDate" type="date" value="${today}"/></div>
      </div>
      <div class="form-row">
        <div><label>Amount (£)</label><input id="modalChildcareSpendAmount" type="number" step="0.01" placeholder="0.00"/></div>
      </div>
      <div class="form-row">
        <div><label>Provider / Description</label><input id="modalChildcareSpendDescription" type="text" placeholder="e.g. Sunshine Nursery"/></div>
      </div>
    `;
    const footer = `
      <button class="ghost" onclick="modalUI.close()">Cancel</button>
      <button class="primary" id="modalChildcareLogSpendSaveBtn">Log Spend</button>
    `;

    modalUI.show('Log Childcare Spend', content, footer);
    document.getElementById('modalChildcareLogSpendSaveBtn').onclick = () => this._handleLogSpend(accountId);
  },

  /**
   * Main render entry point.
   */
  async render() {
    const accountList = document.getElementById('childcareAccountList');
    const ledgerSection = document.getElementById('childcareLedgerSection');
    if (!accountList || !ledgerSection) return;

    // --- Tab Summary ---
    const accounts = await childcareRepository.getAccounts();
    const summaryCards = [];
    for (const acc of accounts) {
      const balance = await childcareRepository.getBalance(acc.id);
      const { gap } = calculateFundingGap(acc.targetMonthlySpend || 0, balance);
      summaryCards.push({
        label: acc.childName,
        value: balance,
        color: 'var(--info)',
        note: gap > 0 ? `Gap: ${formatGBP(gap)}` : 'Funded'
      });
    }
    renderTabSummary('childcareSummary', summaryCards);
    // --- End Tab Summary ---

    if (this._activeAccountId !== null) {
      accountList.style.display = 'none';
      ledgerSection.style.display = '';
      await this._renderLedger(this._activeAccountId);
    } else {
      accountList.style.display = '';
      ledgerSection.style.display = 'none';
      await this._renderAccounts(accounts);
    }
  },

  /**
   * Render the account cards list.
   * @param {Array} accounts (optional) - Already fetched accounts
   */
  async _renderAccounts(accounts) {
    const container = document.getElementById('childcareAccountList');
    if (!container) return;

    if (!accounts) accounts = await childcareRepository.getAccounts();

    let headerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3 style="font-size:.9rem;font-weight:600">Childcare Accounts</h3>
        <button id="childcareAddAccountBtn" class="primary">+ Add Account</button>
      </div>
    `;

    if (accounts.length === 0) {
      container.innerHTML = headerHTML + '<p class="hint" style="text-align:center;padding:20px">No childcare accounts yet. Add one above.</p>';
      this._rebindStaticButtons();
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const cardPromises = accounts.map(async (account) => {
      const balance = await childcareRepository.getBalance(account.id);
      const providers = await childcareRepository.getAccountProviders(account.id);
      const topUpResult = await childcareRepository.getRequiredTopUpForAccount(account.id);
      const { gap } = calculateFundingGap(account.targetMonthlySpend || 0, balance);

      // --- Entitlement period display (CHILD-03) ---
      let entitlementSection = '';
      let reconfirmAlert = '';
      if (account.entitlementStart) {
        try {
          const period = getEntitlementPeriod(account.entitlementStart, today);
          const periodStartStr = period.start.toISOString().slice(0, 10);
          const periodEndStr = period.end.toISOString().slice(0, 10);
          entitlementSection = `
            <div style="font-size:.82rem;color:var(--text-soft);margin-top:8px">
              <span style="font-weight:600;color:var(--text)">Entitlement period:</span>
              ${periodStartStr} – ${periodEndStr}
              (Period ${period.periodIndex + 1})
            </div>`;

          const msUntilEnd = period.end.getTime() - new Date(today).getTime();
          const daysUntilEnd = Math.ceil(msUntilEnd / (1000 * 60 * 60 * 24));
          if (daysUntilEnd >= 0 && daysUntilEnd <= 7) {
            reconfirmAlert = `
              <div style="background:var(--warn);color:#000;border-radius:6px;padding:8px 12px;font-size:.8rem;margin-top:10px">
                <strong>Reconfirmation Due:</strong> Period ends in ${daysUntilEnd}d (${periodEndStr}).
              </div>`;
          }
        } catch (e) {}
      }

      // --- Providers subsection (CHILD-01) ---
      let providersSection = '';
      if (providers.length > 0) {
        const providerRows = providers.map(p => {
          const monthly = monthlyEquivalentFromProvider(p);
          const freqLabel = p.frequency === 'termly' ? 'termly' : 'monthly';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:.8rem;padding:3px 0;border-bottom:1px solid var(--border-light)">
              <span>${p.name} <span class="hint">(${freqLabel})</span></span>
              <span style="font-weight:600">${formatGBP(monthly)}/mo
                <button class="sm ghost" style="padding:0 4px;font-size:.7rem" onclick="event.stopPropagation();childcareEditProvider(${p.id},${account.id})" title="Edit">✏️</button>
                <button class="sm danger" style="padding:0 4px;font-size:.7rem" onclick="event.stopPropagation();childcareDeleteProvider(${p.id},${account.id},'${p.name.replace(/'/g, "\\'")}')" title="Remove">×</button>
              </span>
            </div>`;
        }).join('');

        providersSection = `
          <div style="margin-top:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:.82rem;font-weight:600;color:var(--text)">Providers</span>
              <button class="sm ghost" style="font-size:.75rem" onclick="event.stopPropagation();childcareAddProvider(${account.id})">+ Add</button>
            </div>
            ${providerRows}
          </div>`;
      } else {
        providersSection = `
          <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
            <span class="hint" style="font-size:.78rem">No providers added yet</span>
            <button class="sm ghost" style="font-size:.75rem" onclick="event.stopPropagation();childcareAddProvider(${account.id})">+ Add Provider</button>
          </div>`;
      }

      // --- Required top-up this period (CHILD-01) ---
      const requiredTopUp = topUpResult.requiredTopUpPence;
      const topUpSection = requiredTopUp > 0 ? `
        <div style="background:var(--bg-alt);border-radius:6px;padding:10px 12px;margin-top:10px;font-size:.85rem">
          <div style="color:var(--warn);font-weight:700">Required top-up this period: ${formatGBP(requiredTopUp)}</div>
          <div class="hint" style="font-size:.75rem;margin-top:2px">Based on provider costs minus current balance</div>
        </div>` : `
        <div style="background:var(--accent-soft);border-radius:6px;padding:8px 12px;margin-top:10px;font-size:.85rem;color:var(--accent)">
          Fully funded this period
        </div>`;

      const gapSection = gap > 0 && requiredTopUp === 0 ? `
        <div style="background:var(--bg-alt);border-radius:6px;padding:10px 12px;margin-top:6px;font-size:.82rem">
          <div style="color:var(--text-soft)">Funding Gap (target): ${formatGBP(gap)}</div>
        </div>` : '';

      return `
        <div class="card clickable-card" onclick="childcareViewLedger(${account.id})" style="border:1px solid var(--border);padding:16px;margin-bottom:14px;cursor:pointer">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <h3 style="font-size:1rem;font-weight:700;margin:0">${account.childName}</h3>
              <div class="hint" style="font-size:.75rem">${account.isDisabled ? '£1,000/qtr' : '£500/qtr'} cap</div>
            </div>
            <div style="display:flex; gap:8px">
              <div style="text-align:right">
                <div style="font-size:1.4rem;font-weight:700;color:var(--accent)">${formatGBP(balance)}</div>
              </div>
              <div style="display:flex; flex-direction:column; gap:4px">
                <button class="sm ghost" onclick="event.stopPropagation(); childcareEditAccount(${account.id})" title="Edit Account">✏️</button>
                <button class="sm danger" onclick="event.stopPropagation(); childcareDeleteAccount(${account.id}, '${account.childName.replace(/'/g, "\\'")}')" title="Delete Account">🗑</button>
              </div>
            </div>
          </div>
          ${entitlementSection}
          <div style="font-size:.85rem;color:var(--text-soft);margin-top:6px">
            Target monthly spend: <strong style="color:var(--text)">${formatGBP(account.targetMonthlySpend || 0)}</strong>
          </div>
          ${providersSection}
          ${topUpSection}
          ${gapSection}
          ${reconfirmAlert}
          <div class="hint" style="font-size:.7rem;margin-top:10px;text-align:right">Click card to view history</div>
        </div>
      `;
    });

    const cards = await Promise.all(cardPromises);
    container.innerHTML = headerHTML + cards.join('');
    this._rebindStaticButtons();
  },

  /**
   * Render the ledger view.
   */
  async _renderLedger(accountId) {
    const container = document.getElementById('childcareLedgerSection');
    if (!container) return;

    const account = await childcareRepository.getAccount(accountId);
    if (!account) {
      this._activeAccountId = null;
      await this.render();
      return;
    }

    const ledger = await childcareRepository.getLedger(accountId);
    const balance = await childcareRepository.getBalance(accountId);

    const typeLabel = { deposit: 'Deposit', 'top-up': 'Gov Top-up', spend: 'Spend' };
    const typeColor = { deposit: 'var(--accent)', 'top-up': 'var(--info)', spend: 'var(--danger)' };

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
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px">
          <button id="childcareBackBtn" class="ghost sm">← Back</button>
          <h3 style="font-size:1rem;font-weight:700;margin:0">${account.childName} — Ledger</h3>
        </div>
        <button class="sm ghost" onclick="childcareEditAccount(${account.id})">Edit Account</button>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="display:flex; gap:8px;">
          <button id="childcareLogDepositBtn" class="primary sm">Log Deposit</button>
          <button id="childcareLogSpendBtn" class="ghost sm">Log Spend</button>
        </div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--accent)">${formatGBP(balance)}</div>
      </div>

      <table class="tbl">
        <thead>
          <tr><th>Date</th><th>Type</th><th>Description</th><th class="r">Amount</th><th class="r">Balance</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;

    this._rebindLedgerButtons(accountId);
  },

  _rebindStaticButtons() {
    const btn = document.getElementById('childcareAddAccountBtn');
    if (btn) btn.onclick = () => this._showAccountModal();
  },

  _rebindLedgerButtons(accountId) {
    const backBtn = document.getElementById('childcareBackBtn');
    if (backBtn) backBtn.onclick = () => { this._activeAccountId = null; this.render(); };
    const logDepBtn = document.getElementById('childcareLogDepositBtn');
    if (logDepBtn) logDepBtn.onclick = () => this._showLogDepositModal(accountId);
    const logSpendBtn = document.getElementById('childcareLogSpendBtn');
    if (logSpendBtn) logSpendBtn.onclick = () => this._showLogSpendModal(accountId);
  },

  /**
   * Shows the modal to add or edit a provider for an account.
   * @param {number} accountId
   * @param {Object|null} provider - Existing provider for edit, null for add
   */
  async _showProviderModal(accountId, provider = null) {
    const isEdit = !!provider;
    const content = `
      <div class="form-row">
        <div><label>Provider Name</label><input id="modalProviderName" type="text" value="${provider?.name || ''}" placeholder="e.g. Sunshine Nursery"/></div>
      </div>
      <div class="form-row">
        <div>
          <label>Billing Frequency</label>
          <select id="modalProviderFrequency">
            <option value="monthly" ${(!provider || provider.frequency === 'monthly') ? 'selected' : ''}>Monthly</option>
            <option value="termly" ${provider?.frequency === 'termly' ? 'selected' : ''}>Termly</option>
          </select>
        </div>
      </div>
      <div class="form-row" id="modalProviderMonthlyRow" style="${provider?.frequency === 'termly' ? 'display:none' : ''}">
        <div><label>Monthly Cost (£)</label><input id="modalProviderMonthlyAmount" type="number" step="0.01" value="${provider ? fromPence(provider.monthlyEquivalentPence || 0) : ''}" placeholder="0.00"/></div>
      </div>
      <div class="form-row" id="modalProviderTermlyRow" style="${provider?.frequency !== 'termly' ? 'display:none' : ''}">
        <div><label>Termly Cost (£)</label><input id="modalProviderTermlyAmount" type="number" step="0.01" value="${provider ? fromPence(provider.termlyAmountPence || 0) : ''}" placeholder="0.00"/></div>
      </div>
      <p class="hint" style="font-size:.75rem;margin-top:8px">Termly cost is divided by 3 to calculate monthly equivalent.</p>
    `;
    const footer = `
      <button class="ghost" onclick="modalUI.close()">Cancel</button>
      <button class="primary" id="modalProviderSaveBtn">${isEdit ? 'Update Provider' : 'Add Provider'}</button>
    `;
    modalUI.show(isEdit ? 'Edit Provider' : 'Add Provider', content, footer);

    // Toggle visibility on frequency change
    const freqSelect = document.getElementById('modalProviderFrequency');
    if (freqSelect) {
      freqSelect.onchange = () => {
        const monthlyRow = document.getElementById('modalProviderMonthlyRow');
        const termlyRow = document.getElementById('modalProviderTermlyRow');
        if (freqSelect.value === 'termly') {
          if (monthlyRow) monthlyRow.style.display = 'none';
          if (termlyRow) termlyRow.style.display = '';
        } else {
          if (monthlyRow) monthlyRow.style.display = '';
          if (termlyRow) termlyRow.style.display = 'none';
        }
      };
    }

    document.getElementById('modalProviderSaveBtn').onclick = () =>
      this._handleSaveProvider(accountId, provider?.id);
  },

  /**
   * Handle provider form submission.
   * @param {number} accountId
   * @param {number|undefined} existingId
   */
  async _handleSaveProvider(accountId, existingId) {
    const name = (document.getElementById('modalProviderName')?.value || '').trim();
    const frequency = document.getElementById('modalProviderFrequency')?.value || 'monthly';
    const monthlyAmount = parseFloat(document.getElementById('modalProviderMonthlyAmount')?.value || '0');
    const termlyAmount = parseFloat(document.getElementById('modalProviderTermlyAmount')?.value || '0');

    if (!name) {
      notificationUI.warning('Please enter a provider name.');
      return;
    }

    const providerData = {
      accountId,
      name,
      frequency,
      monthlyEquivalentPence: frequency === 'monthly' ? Math.round((isNaN(monthlyAmount) ? 0 : monthlyAmount) * 100) : 0,
      termlyAmountPence: frequency === 'termly' ? Math.round((isNaN(termlyAmount) ? 0 : termlyAmount) * 100) : 0
    };

    try {
      if (existingId) {
        await childcareRepository.updateProvider(existingId, providerData);
      } else {
        await childcareRepository.addProvider(providerData);
      }
      triggerHaptic('success');
      modalUI.close();
      await this.render();
    } catch (err) {
      console.error('Failed to save provider:', err);
      notificationUI.error('Error: ' + err.message);
    }
  },

  /**
   * Handle account form submission.
   */
  async _handleSaveAccount(existingId) {
    const childName = (document.getElementById('modalChildcareChildName')?.value || '').trim();
    const targetSpend = parseFloat(document.getElementById('modalChildcareTargetSpend')?.value || '0');
    const openingBalance = parseFloat(document.getElementById('modalChildcareOpeningBalance')?.value || '0');
    const entitlementStart = document.getElementById('modalChildcareEntitlementStart')?.value || '';
    const isDisabled = document.getElementById('modalChildcareIsDisabled')?.checked || false;

    if (!childName || !entitlementStart) {
      notificationUI.warning('Please enter Name and Entitlement Start Date.');
      return;
    }

    try {
      await childcareRepository.saveAccount({
        id: existingId,
        childName,
        targetMonthlySpend: isNaN(targetSpend) ? 0 : targetSpend,
        openingBalance: isNaN(openingBalance) ? 0 : openingBalance,
        entitlementStart,
        isDisabled
      });

      triggerHaptic('success');
      modalUI.close();
      await this.render();
      if (window.app) window.app.renderAll();
    } catch (err) {
      console.error('Failed to save childcare account:', err);
      notificationUI.error('Error: ' + err.message);
    }
  },

  /**
   * Handle "Log Deposit" form submission.
   */
  async _handleLogDeposit(accountId) {
    const date = document.getElementById('modalChildcareDepositDate')?.value;
    const amount = parseFloat(document.getElementById('modalChildcareDepositAmount')?.value || '0');
    const categoryIdRaw = document.getElementById('modalChildcareDepositCategory')?.value;
    const categoryId = categoryIdRaw ? parseInt(categoryIdRaw) : null;

    if (!date || isNaN(amount) || amount <= 0) {
      notificationUI.warning('Please enter valid date and amount.');
      return;
    }

    try {
      const result = await childcareRepository.addDeposit(accountId, date, amount, categoryId);
      const topUpMsg = result.topUpId ? ` Government top-up of ${formatGBP(result.topUpAmount)} applied.` : ' No top-up available.';
      
      triggerHaptic('success');
      modalUI.close();
      await this.render();
      if (window.app) window.app.renderAll();
      notificationUI.success(`Deposit logged.${topUpMsg}`);
    } catch (err) {
      console.error('Failed to log deposit:', err);
      notificationUI.error('Error: ' + err.message);
    }
  },

  /**
   * Handle "Log Spend" form submission.
   */
  async _handleLogSpend(accountId) {
    const date = document.getElementById('modalChildcareSpendDate')?.value;
    const amount = parseFloat(document.getElementById('modalChildcareSpendAmount')?.value || '0');
    const description = (document.getElementById('modalChildcareSpendDescription')?.value || '').trim();

    if (!date || isNaN(amount) || amount <= 0) {
      notificationUI.warning('Please enter valid date and amount.');
      return;
    }

    try {
      await childcareRepository.addSpend(accountId, date, amount, description);
      triggerHaptic('success');
      modalUI.close();
      await this.render();
      if (window.app) window.app.renderAll();
    } catch (err) {
      console.error('Failed to log spend:', err);
      notificationUI.error('Error: ' + err.message);
    }
  }
};
