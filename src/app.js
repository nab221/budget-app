import { initTheme, toggleTheme } from './ui/theme';
import { modalUI } from './ui/render';
import { categoryUI } from './ui/categories';
import { 
  categoryRepository, 
  netWorthRepository, 
  balanceSnapshotRepository,
  triggerBalanceRecalc 
} from './db/repository.js';
import { transactionUI } from './ui/transactions';
import { expensesUI } from './ui/expenses';
import { debtUI } from './ui/debts';
import { assetUI } from './ui/assets';
import { templateUI } from './ui/templates';
import { pdfImportUI } from './ui/pdf-import';
import { targetsUI } from './ui/targets';
import { backupUI } from './ui/backup';
import { initDashboard, renderDashboard } from './ui/dashboard';
import { renderPayoffPlanner } from './ui/payoff';
import { initPWA, installApp, checkExportReminder } from './ui/pwa-ux';
import { initFileSyncUI, refreshPersistenceWarning } from './ui/file-sync';
import { childcareUI } from './ui/childcare.js';
import { calculateBalanceChain } from './utils/finance.js';
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

  // 4. Tab Navigation & Global Refresh
  window.app = { 
    renderAll: async () => {
      const activeTab = document.querySelector('#mainTabs .tab.active');
      const panelId = activeTab ? activeTab.dataset.tab : 'dashboard';
      
      if (panelId === 'dashboard') await renderDashboard();
      if (panelId === 'income') await transactionUI.render();
      if (panelId === 'expenses') await expensesUI.render();
      if (panelId === 'debts') await debtUI.render();
      if (panelId === 'assets') await assetUI.render();
      if (panelId === 'payoff') await renderPayoffPlanner();
      if (panelId === 'childcare') await childcareUI.render();
      if (panelId === 'settings') {
        await categoryUI.render();
        await targetsUI.renderTargetSettings();
      }
    },
    refreshApp: () => window.dispatchEvent(new CustomEvent('app:refresh'))
  };

  window.addEventListener('app:refresh', async () => {
    await window.app.renderAll();
  });

  const mainTabs = document.getElementById('mainTabs');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');

  if (mobileMenuBtn && mainTabs) {
    mobileMenuBtn.addEventListener('click', () => {
      mainTabs.classList.toggle('open');
    });
  }

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

      // Close mobile menu if open
      mainTabs.classList.remove('open');

      // Refresh data when switching tabs
      if (panelId === 'dashboard') await renderDashboard();
      if (panelId === 'income') await transactionUI.render();
      if (panelId === 'expenses') await expensesUI.render();
      if (panelId === 'debts') await debtUI.render();
      if (panelId === 'assets') await assetUI.render();
      if (panelId === 'payoff') await renderPayoffPlanner();
      if (panelId === 'childcare') await childcareUI.render();
      if (panelId === 'settings') {
        await categoryUI.render();
        await targetsUI.renderTargetSettings();
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
    });
  }

  // Balance Start Configuration Save Logic
  const saveBalanceBtn = document.getElementById('saveBalanceStartBtn');
  if (saveBalanceBtn) {
    saveBalanceBtn.addEventListener('click', async () => {
      const dateInput = document.getElementById('balanceStartDate');
      const amountInput = document.getElementById('balanceOpeningAmount');
      const statusDiv = document.getElementById('balanceStartStatus');

      if (!dateInput || !amountInput) return;

      const date = dateInput.value;
      const amount = parseFloat(amountInput.value) || 0;

      if (!date) {
        alert('Please select a start month.');
        return;
      }

      if (statusDiv) statusDiv.textContent = 'Saving...';

      try {
        // Save to localStorage
        localStorage.setItem(BALANCE_START_DATE_KEY, date);
        const amountPence = Math.round(amount * 100);
        localStorage.setItem(BALANCE_OPENING_AMOUNT_KEY, amountPence.toString());

        // Trigger Recalculation
        // Append -01 to YYYY-MM to create a valid ISO date for the trigger
        await triggerBalanceRecalc(date + '-01');

        if (statusDiv) statusDiv.textContent = 'Recalculation complete.';
        
        // Dispatch refresh
        if (window.app && window.app.refreshApp) {
          window.app.refreshApp();
        }
        
        // Clear status after delay
        setTimeout(() => {
          if (statusDiv) statusDiv.textContent = '';
        }, 3000);

      } catch (err) {
        console.error('Failed to save balance configuration:', err);
        if (statusDiv) statusDiv.textContent = 'Error: ' + err.message;
      }
    });
  }

  // 4. Ensure Storage Persistence (Safari/Mobile mitigation)
  await refreshPersistenceWarning();

  // 5. Initialize UI Modules
  await categoryRepository.seedDefaultCategories();
  await netWorthRepository.checkAndTakeSnapshot();

  // Initialize UI components
  await initFileSyncUI();
  await transactionUI.init();
  await expensesUI.init();
  await debtUI.init();
  await assetUI.init();
  await childcareUI.init();
  await templateUI.init();
  await pdfImportUI.init();

  await categoryUI.init();
  await targetsUI.init();
  await backupUI.init();
  
  await initDashboard();

  console.log('Budget App initialized successfully.');
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => {
    console.error('Failed to initialize app:', err);
    document.body.innerHTML = `
      <div class="card" style="margin: 20px; padding: 20px; border: 1px solid var(--danger);">
        <h2 class="red">Initialization Error</h2>
        <p>Something went wrong while starting the app.</p>
        <pre style="font-size: 0.7rem; overflow: auto; margin-top: 10px;">${err.stack || err.message}</pre>
      </div>
    `;
  });
});
