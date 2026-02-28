import { initTheme, toggleTheme } from './ui/theme';
import { ensurePersistence } from './utils/storage';
import { categoryUI } from './ui/categories';
import { categoryRepository } from './db/repository';
import { transactionUI } from './ui/transactions';
import { subscriptionUI } from './ui/subscriptions';
import { debtUI } from './ui/debts';
import { assetUI } from './ui/assets';

/**
 * Main application entry point.
 */
async function init() {
  console.log('Budget App initializing...');

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

  // 3. Month Picker and Tab Navigation
  const monthPicker = document.getElementById('monthPicker');
  if (monthPicker) {
    if (!monthPicker.value) {
      monthPicker.value = new Date().toISOString().slice(0, 7);
    }
    monthPicker.addEventListener('change', () => {
      console.log(`Month changed to: ${monthPicker.value}`);
      transactionUI.render(monthPicker.value);
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
      if (panelId === 'settings') await categoryUI.render();
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
  
  // Then init all modules
  await categoryUI.init();
  await transactionUI.init();
  await subscriptionUI.init();
  await debtUI.init();
  await assetUI.init();

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
