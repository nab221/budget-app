import { initTheme, toggleTheme } from './ui/theme';
import { modalUI } from './ui/render';
import { ensurePersistence } from './utils/storage';
import { categoryUI } from './ui/categories';
import { categoryRepository, netWorthRepository } from './db/repository';
import { transactionUI } from './ui/transactions';
import { expensesUI } from './ui/expenses';
import { debtUI } from './ui/debts';
import { assetUI } from './ui/assets';
import { templateUI } from './ui/templates';
import { targetsUI } from './ui/targets';
import { backupUI } from './ui/backup';
import { renderDashboard } from './ui/dashboard';
import { renderPayoffPlanner } from './ui/payoff';
import { initPWA, installApp, checkExportReminder } from './ui/pwa-ux';
import { pdfImportUI } from './ui/pdf-import';
import { initFileSyncUI } from './ui/file-sync';
import { childcareUI } from './ui/childcare.js';
import { expectedIncomeUI } from './ui/expected-income.js';
import { calculateBalanceChain } from './utils/finance.js';
import { balanceSnapshotRepository } from './db/repository.js';
import { BALANCE_START_DATE_KEY, BALANCE_OPENING_AMOUNT_KEY } from './utils/storage.js';
import { RecurrenceManager } from './utils/recurrence.js';

export { BALANCE_START_DATE_KEY };

/**
 * Main application entry point.
 */
async function init() {
  console.log('Budget App initializing...');

  // 0. Initialize PWA (service worker registration + install prompt interception)
  initPWA();

  // Check export reminder (shows banner if last backup was > 7 days ago)
  checkExportReminder();

  // 1. Initialize Theme
  initTheme();
  
  // 2. Bind Global UI elements
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const newTheme = toggleTheme();
      console.log(`Theme changed to: ${newTheme}`);
    });
  }

  // 3. Recurrence: Check and generate instances for the current horizon
  try {
    const recResults = await RecurrenceManager.checkAndGenerate();
    console.log('Recurrence check complete:', recResults);
  } catch (err) {
    console.error('Failed to run recurrence check:', err);
  }

  // 4. Month Picker, View Select and Tab Navigation
  const monthPicker = document.getElementById('monthPicker');
  const viewSelect = document.getElementById('viewSelect');

  const refreshDashboard = () => {
    if (monthPicker && viewSelect) {
      renderDashboard('summaryGrid', viewSelect.value, monthPicker.value);
    }
  };

  window.app = { 
    renderAll: () => {
      refreshDashboard();
      window.app.refreshApp();
    },
    refreshApp: () => window.dispatchEvent(new CustomEvent('app:refresh'))
  };

  window.addEventListener('app:refresh', () => {
    refreshDashboard();
  });

  if (monthPicker) {
    if (!monthPicker.value) {
      monthPicker.value = new Date().toISOString().slice(0, 7);
    }
    monthPicker.addEventListener('change', () => {
      console.log(`Month changed to: ${monthPicker.value}`);
      transactionUI.render(monthPicker.value);
      // expensesUI.render removed here in Phase 28 — Expenses manages its own month
      refreshDashboard();
    });
  }

  if (viewSelect) {
    viewSelect.addEventListener('change', () => {
      console.log(`Period changed to: ${viewSelect.value}`);
      refreshDashboard();
    });
  }

  const mainTabs = document.getElementById('mainTabs');
  if (mainTabs) {
    mainTabs.addEventListener('click', async (e) => {
      const t = e.target.closest('.tab');
      if (!t) return;
      
      document.querySelectorAll('#mainTabs .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      
      const panelId = t.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.panel === panelId);
      });

      // Refresh data when switching tabs
      if (panelId === 'income') await transactionUI.render();
      if (panelId === 'expenses') await expensesUI.render();
      if (panelId === 'debts') await debtUI.render();
      if (panelId === 'assets') await assetUI.render();
      if (panelId === 'payoff') await renderPayoffPlanner();
      if (panelId === 'childcare') await childcareUI.render();
      if (panelId === 'cashflow') await expectedIncomeUI.render();
      if (panelId === 'settings') {
        await categoryUI.render();
        // templateUI.renderTemplates() removed in v1.5
        await targetsUI.renderTargetSettings();
        // cloudBackupUI.render() removed in v1.5
        // Populate balance configuration from localStorage
        const balanceStartInput = document.getElementById('balanceStartDate');
        if (balanceStartInput) {
          balanceStartInput.value = localStorage.getItem(BALANCE_START_DATE_KEY) || '';
        }
        const balanceOpeningInput = document.getElementById('balanceOpeningAmount');
        if (balanceOpeningInput) {
          const savedAmountPence = parseInt(localStorage.getItem(BALANCE_OPENING_AMOUNT_KEY) || '0', 10);
          balanceOpeningInput.value = (savedAmountPence / 100).toFixed(2);
        }
      }
      
      // Always refresh dashboard in case totals changed
      refreshDashboard();
    });
  }

  // 4. Ensure Storage Persistence (Safari/Mobile mitigation)
  const isPersisted = await ensurePersistence();
  if (!isPersisted) {
    const warning = document.getElementById('persistence-warning');
    if (warning) {
      warning.classList.remove('hidden');
    }
  }

  // 5. Initialize UI Modules
  // First seed defaults if necessary
  await categoryRepository.seedDefaultCategories();

  // Take monthly snapshot
  await netWorthRepository.checkAndTakeSnapshot();

  // Trigger balance chain calculation on startup (fire-and-forget to avoid blocking)
  const savedBalanceStart = localStorage.getItem(BALANCE_START_DATE_KEY);
  if (savedBalanceStart) {
    calculateBalanceChain(savedBalanceStart, 3).catch(err =>
      console.warn('[init] Background balance recalc failed:', err)
    );
  }

  // Then init all modules
  modalUI.init();
  await categoryUI.init();
  await transactionUI.init();
  await expensesUI.init();
  await debtUI.init();
  await assetUI.init();
  // templateUI.init() removed in v1.5 - handled by automatic recurrence logic
  await backupUI.init();
  await pdfImportUI.init();
  // cloudBackupUI.init() removed in v1.5
  await childcareUI.init();

  // Milestone v1.4: Initialize File Sync
  await initFileSyncUI();

  // Initial dashboard render
  refreshDashboard();

  // 6. Balance Start Date: Save button handler
  const saveBalanceStartBtn = document.getElementById('saveBalanceStartBtn');
  if (saveBalanceStartBtn) {
    saveBalanceStartBtn.addEventListener('click', async () => {
      const input = document.getElementById('balanceStartDate');
      const statusEl = document.getElementById('balanceStartStatus');
      const monthValue = input ? input.value.trim() : '';

      if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) {
        if (statusEl) statusEl.textContent = 'Please enter a valid month.';
        return;
      }

      // Persist to localStorage
      localStorage.setItem(BALANCE_START_DATE_KEY, monthValue);

      const openingInput = document.getElementById('balanceOpeningAmount');
      if (openingInput) {
        const amount = parseFloat(openingInput.value) || 0;
        localStorage.setItem(BALANCE_OPENING_AMOUNT_KEY, Math.round(amount * 100).toString());
      }

      // Invalidate all snapshots and recalculate from new start date
      try {
        if (statusEl) statusEl.textContent = 'Recalculating...';
        await balanceSnapshotRepository.deleteFrom('0000-00'); // delete all snapshots
        await calculateBalanceChain(monthValue, 3);
        if (statusEl) statusEl.textContent = `Balance chain recalculated from ${monthValue}.`;
        // Refresh the dashboard to reflect new data
        refreshDashboard();
      } catch (err) {
        console.error('[saveBalanceStartBtn] Recalc failed:', err);
        if (statusEl) statusEl.textContent = 'Recalculation failed. See console for details.';
      }
    });
  }

  // Install App button & PDF Import
  const installBtn = document.getElementById('installAppBtn');
  if (installBtn) {
    installBtn.addEventListener('click', () => installApp());
  }

  const pdfInput = document.getElementById('pdfImportFile');
  if (pdfInput) {
    pdfInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        pdfImportUI.handleFileUpload(e.target.files[0]);
        // Reset input to allow selecting same file again
        e.target.value = '';
      }
    });
  }

  console.log('Budget App ready');
}

// Start the application
init().catch(err => {
  console.error('Fatal initialization error:', err);
  
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.innerHTML = `
      <div class="card" style="border-color: var(--danger)">
        <h2 class="red">Initialization Error</h2>
        <p>Something went wrong while starting the app.</p>
        <pre style="font-size: 0.7rem; overflow: auto; margin-top: 10px;">${err.stack || err.message}</pre>
      </div>
    `;
  }
});
