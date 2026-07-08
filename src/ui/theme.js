/**
 * Theme + privacy application helpers (Phase 2, spec §4.7).
 *
 * Theme is applied by stamping a `data-theme` attribute on
 * `document.documentElement`; `styles.css` has `:root[data-theme="light"]` /
 * `:root[data-theme="dark"]` blocks that override the `prefers-color-scheme`
 * defaults. `'system'` clears the attribute so the media query wins again.
 *
 * Privacy mode toggles a `privacy` class on `document.body`; `body.privacy
 * .money` blurs every money value.
 */

/** @param {'system'|'light'|'dark'} theme */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
}

/** @param {boolean} on */
export function applyPrivacy(on) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('privacy', !!on);
}

// ---------------------------------------------------------------------------
// Chart tokens (dashboard plan §5)
// ---------------------------------------------------------------------------

/**
 * Categorical chart series, fixed order — recurring expenses, debt payments,
 * childcare. Both modes validated with the dataviz palette validator against
 * the app's panel surfaces (light #f4f5f7, dark #191f27):
 *   light: CVD separation PASS (worst adjacent ΔE 47.2); aqua/yellow sit below
 *          3:1 contrast, which obligates the always-present legend + the
 *          "view as table" affordance the chart panels ship with.
 *   dark:  all checks PASS.
 * Never cycle or generate extra hues — fold further series into these groups.
 */
export const CHART_SERIES = {
  light: ['#2a78d6', '#1baf7a', '#eda100'],
  dark: ['#3987e5', '#199e70', '#c98500'],
};

/** Is the app currently rendering its dark palette? */
export function isDarkMode() {
  if (typeof document === 'undefined') return false;
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit) return explicit === 'dark';
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolved colour tokens for chart rendering (canvas can't read CSS
 * variables). Read at render time so an explicit theme switch is picked up on
 * the next render.
 */
export function chartTokens() {
  const dark = isDarkMode();
  const css =
    typeof document !== 'undefined' && document.documentElement
      ? getComputedStyle(document.documentElement)
      : null;
  const v = (name, fallback) => {
    const value = css?.getPropertyValue(name).trim();
    return value || fallback;
  };
  return {
    series: CHART_SERIES[dark ? 'dark' : 'light'],
    text: v('--text', dark ? '#e6e9ee' : '#1a1d21'),
    muted: v('--muted', dark ? '#9aa4b2' : '#5c6470'),
    border: v('--border', dark ? '#2a323d' : '#d8dce2'),
    surface: v('--surface', dark ? '#191f27' : '#f4f5f7'),
  };
}
