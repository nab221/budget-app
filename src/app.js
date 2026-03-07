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
import { 
  BALANCE_START_DATE_KEY, 
  BALANCE_OPENING_AMOUNT_KEY, 
  PRIVACY_MODE_KEY,
  HAPTICS_ENABLED_KEY
} from './utils/storage.js';
import { RecurrenceManager } from './utils/recurrence.js';
import { triggerHaptic } from './utils/haptics.js';

export { BALANCE_START_DATE_KEY };

/**
 * Main application entry point.
 */
async function init() {
  console.log('Budget App initializing...');

  // 0. Initializations that can run in parallel
  await Promise.all([
    (async () => {
      initPWA();
      checkExportReminder();
    })(),
    (async () => {
      initTheme();
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', () => {
          toggleTheme();
          // Re-render so chart colors (computed from data-theme at render time) update immediately.
          if (window.app) window.app.renderAll();
        });
      }
    })(),
    (async () => {
      initPrivacyMode();
      const privacyToggle = document.getElementById('privacyToggle');
      if (privacyToggle) {
        privacyToggle.addEventListener('click', () => togglePrivacyMode());
      }
    })(),
    (async () => {
      initHaptics();
      const hapticsCheckbox = document.getElementById('hapticsEnabledCheckbox');
      if (hapticsCheckbox) {
        hapticsCheckbox.addEventListener('change', (e) => {
          const isEnabled = e.target.checked;
          localStorage.setItem(HAPTICS_ENABLED_KEY, isEnabled.toString());
          if (isEnabled) triggerHaptic('tap');
        });
      }
    })(),
    (async () => {
      const installAppBtn = document.getElementById('installAppBtn');
      if (installAppBtn) {
        console.log('[app] Wiring install button click handler');
        installAppBtn.addEventListener('click', () => {
          console.log('[app] Install button clicked!');
          installApp();
        });
      } else {
        console.warn('[app] Install button not found!');
      }
    })(),
    (async () => {
      try {
        await RecurrenceManager.checkAndGenerate();
      } catch (err) {
        console.error('Failed to run recurrence check:', err);
      }
    })(),
    refreshPersistenceWarning()
  ]);

  // 1. Define Global App Object
  window.app = { 
    renderAll: async () => {
      const activeTab = document.querySelector('#mainTabs .tab.active');
      const panelId = activeTab ? activeTab.dataset.tab : 'dashboard';
      
      console.log(`[app] Rendering active panel: ${panelId}`);

      const renderTasks = [];
      
      if (panelId === 'dashboard') renderTasks.push(renderDashboard());
      if (panelId === 'income') renderTasks.push(transactionUI.render());
      if (panelId === 'expenses') renderTasks.push(expensesUI.render());
      if (panelId === 'debts') renderTasks.push(debtUI.render());
      if (panelId === 'assets') renderTasks.push(assetUI.render());
      if (panelId === 'payoff') renderTasks.push(renderPayoffPlanner());
      if (panelId === 'childcare') renderTasks.push(childcareUI.render());
      if (panelId === 'settings') {
        renderTasks.push(categoryUI.render());
        renderTasks.push(targetsUI.renderTargetSettings());
      }

      await Promise.all(renderTasks);
    },
    refreshApp: () => window.dispatchEvent(new CustomEvent('app:refresh'))
  };

  window.addEventListener('app:refresh', () => window.app.renderAll());

  // 2. Tab Navigation & Mobile Menu
  const mainTabs = document.getElementById('mainTabs');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');

  if (mobileMenuBtn && mainTabs) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mainTabs.classList.toggle('open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (mainTabs.classList.contains('open') && !mainTabs.contains(e.target) && e.target !== mobileMenuBtn) {
        mainTabs.classList.remove('open');
      }
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

      // Close mobile menu
      mainTabs.classList.remove('open');

      // Special handling for settings population
      if (panelId === 'settings') {
        const balanceStartInput = document.getElementById('balanceStartDate');
        if (balanceStartInput) {
          balanceStartInput.value = localStorage.getItem(BALANCE_START_DATE_KEY) || '';
        }
        const balanceOpeningInput = document.getElementById('balanceOpeningAmount');
        if (balanceOpeningInput) {
          const savedAmountPence = parseInt(localStorage.getItem(BALANCE_OPENING_AMOUNT_KEY) || '0', 10);
          balanceOpeningInput.value = (savedAmountPence / 100).toFixed(2);
        }
        const hapticsCheckbox = document.getElementById('hapticsEnabledCheckbox');
        if (hapticsCheckbox) {
          hapticsCheckbox.checked = localStorage.getItem(HAPTICS_ENABLED_KEY) !== 'false';
        }
      }

      await window.app.renderAll();
    });
  }

  // 3. Settings Save Handlers
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
        localStorage.setItem(BALANCE_START_DATE_KEY, date);
        const amountPence = Math.round(amount * 100);
        localStorage.setItem(BALANCE_OPENING_AMOUNT_KEY, amountPence.toString());

        await triggerBalanceRecalc(date + '-01');
        if (statusDiv) statusDiv.textContent = 'Recalculation complete.';
        window.app.refreshApp();
        
        setTimeout(() => { if (statusDiv) statusDiv.textContent = ''; }, 3000);
      } catch (err) {
        console.error('Failed to save balance configuration:', err);
        if (statusDiv) statusDiv.textContent = 'Error: ' + err.message;
      }
    });
  }

  // 4. Parallel Module Initialization
  await Promise.all([
    categoryRepository.seedDefaultCategories(),
    netWorthRepository.checkAndTakeSnapshot(),
    initFileSyncUI(),
    transactionUI.init(),
    expensesUI.init(),
    debtUI.init(),
    assetUI.init(),
    childcareUI.init(),
    templateUI.init(),
    pdfImportUI.init(),
    categoryUI.init(),
    targetsUI.init(),
    backupUI.init(),
    initDashboard()
  ]);

  console.log('Budget App initialized successfully.');
}

/**
 * Initialize Privacy Mode from localStorage.
 */
function initPrivacyMode() {
  const isEnabled = localStorage.getItem(PRIVACY_MODE_KEY) === 'true';
  document.body.classList.toggle('privacy-enabled', isEnabled);
  const btn = document.getElementById('privacyToggle');
  if (btn) btn.classList.toggle('active', isEnabled);
}

/**
 * Toggle Privacy Mode and persist.
 */
function togglePrivacyMode() {
  const isEnabled = !document.body.classList.contains('privacy-enabled');
  document.body.classList.toggle('privacy-enabled', isEnabled);
  localStorage.setItem(PRIVACY_MODE_KEY, isEnabled.toString());
  const btn = document.getElementById('privacyToggle');
  if (btn) btn.classList.toggle('active', isEnabled);
  
  // Add haptic feedback for security state change
  triggerHaptic('tap');
}

/**
 * Initialize Haptics from localStorage.
 */
function initHaptics() {
  const isEnabled = localStorage.getItem(HAPTICS_ENABLED_KEY) !== 'false';
  const checkbox = document.getElementById('hapticsEnabledCheckbox');
  if (checkbox) checkbox.checked = isEnabled;
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
