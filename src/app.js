import { initTheme, toggleTheme } from './ui/theme';
import { ensurePersistence } from './utils/storage';
import { categoryUI } from './ui/categories';
import { categoryRepository } from './db/repository';

/**
 * Main application entry point.
 * Initializes core services: Theme, Storage Persistence, and UI Modules.
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

  // 3. Tab Navigation
  const mainTabs = document.getElementById('mainTabs');
  if (mainTabs) {
    mainTabs.addEventListener('click', e => {
      const t = e.target.closest('.tab');
      if (!t) return;
      
      document.querySelectorAll('#mainTabs .tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      
      document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.panel === t.dataset.tab);
      });
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

  // 5. Initialize Category Module
  // First seed defaults if necessary
  await categoryRepository.seedDefaultCategories();
  // Then init UI
  await categoryUI.init();

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
