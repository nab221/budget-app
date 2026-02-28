const THEME_KEY = 'budget_app_theme';

/**
 * Initializes the theme based on saved preference or system settings.
 */
export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }
}

/**
 * Toggles the theme between light and dark.
 */
export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  localStorage.setItem(THEME_KEY, newTheme);
  return newTheme;
}

/**
 * Applies the theme to the document element.
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Gets the current theme.
 * @returns {string}
 */
export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}
