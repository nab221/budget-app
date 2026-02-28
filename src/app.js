import { initTheme, toggleTheme } from './ui/theme';
import { ensurePersistence } from './utils/storage';

/**
 * Main application entry point.
 * Initializes core services: Theme and Storage Persistence.
 */
async function init() {
  console.log('Budget App initializing...');

  // 1. Initialize Theme
  initTheme();
  
  // 2. Bind UI elements
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const newTheme = toggleTheme();
      console.log(`Theme changed to: ${newTheme}`);
    });
  }

  // 3. Ensure Storage Persistence (Safari/Mobile mitigation)
  const isPersisted = await ensurePersistence();
  if (!isPersisted) {
    const warning = document.getElementById('persistence-warning');
    if (warning) {
      warning.classList.remove('hidden');
    }
  }

  // 4. Initial render placeholder
  const appContainer = document.getElementById('app');
  if (appContainer) {
    appContainer.innerHTML = '<p>Shell loaded. Ready for data modules.</p>';
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
