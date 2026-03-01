import { initTheme, toggleTheme } from './ui/theme';
import { ensurePersistence } from './utils/storage';
import { categoryUI } from './ui/categories';
import { categoryRepository, netWorthRepository } from './db/repository';
import { transactionUI } from './ui/transactions';
import { subscriptionUI } from './ui/subscriptions';
import { debtUI } from './ui/debts';
import { assetUI } from './ui/assets';
import { templateUI } from './ui/templates';
import { targetsUI } from './ui/targets';
import { backupUI } from './ui/backup';
import { renderDashboard } from './ui/dashboard';
import { renderPayoffPlanner } from './ui/payoff';
import { initPWA, installApp, checkExportReminder } from './ui/pwa-ux';
import { pdfImportUI } from './ui/pdf-import';
import { cloudBackupUI } from './ui/cloud-backup.js';

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

  // 3. Month Picker, View Select and Tab Navigation
  const monthPicker = document.getElementById('monthPicker');
  const viewSelect = document.getElementById('viewSelect');

  const refreshDashboard = () => {
    if (monthPicker && viewSelect) {
      renderDashboard('summaryGrid', viewSelect.value, monthPicker.value);
    }
  };

  window.app = { renderAll: refreshDashboard };

  if (monthPicker) {
    if (!monthPicker.value) {
      monthPicker.value = new Date().toISOString().slice(0, 7);
    }
    monthPicker.addEventListener('change', () => {
      console.log(`Month changed to: ${monthPicker.value}`);
      transactionUI.render(monthPicker.value);
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
      if (panelId === 'income' || panelId === 'fixed' || panelId === 'variable') await transactionUI.render();
      if (panelId === 'subs') await subscriptionUI.render();
      if (panelId === 'debts') await debtUI.render();
      if (panelId === 'assets') await assetUI.render();
      if (panelId === 'payoff') await renderPayoffPlanner();
      if (panelId === 'settings') {
        await categoryUI.render();
        await templateUI.renderTemplates();
        await targetsUI.renderTargetSettings();
        cloudBackupUI.render();
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
  
  // Then init all modules
  await categoryUI.init();
  await transactionUI.init();
  await subscriptionUI.init();
  await debtUI.init();
  await assetUI.init();
  await templateUI.init();
  await backupUI.init();
  await pdfImportUI.init();
  await cloudBackupUI.init();

  // Initial dashboard render
  refreshDashboard();

  // 6. Install App button & PDF Import
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
