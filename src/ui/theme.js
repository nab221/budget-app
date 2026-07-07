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
