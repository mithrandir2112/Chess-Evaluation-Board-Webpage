/* Optional host theme ownership; no site assets or controller are required. */
(() => {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const key = 'chess-ui-theme';
  let preference;
  let nativeTheme;
  function readPreference() {
    try { const value = localStorage.getItem(key); return ['light', 'dark'].includes(value) ? value : 'system'; }
    catch (_) { return 'system'; }
  }
  function isHosted() { return root.dataset.chessThemeSource === 'host'; }
  function syncControl() {
    const toggle = document.querySelector('#themeToggle');
    const label = document.querySelector('#themeLabel');
    if (!toggle) return;
    toggle.hidden = isHosted();
    const dark = root.dataset.chessColorScheme === 'dark';
    toggle.setAttribute('aria-checked', String(dark));
    if (label) label.textContent = dark ? 'Light' : 'Dark';
  }
  function applyNative() {
    nativeTheme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    root.dataset.theme = nativeTheme;
    root.dataset.chessColorScheme = nativeTheme;
    syncControl();
  }
  function syncHost() {
    // Named palettes keep their name; the optional scheme chooses native fallbacks.
    if (!['light', 'dark'].includes(root.dataset.chessColorScheme)) {
      root.dataset.chessColorScheme = root.dataset.theme === 'dark' ? 'dark' : 'light';
    }
    syncControl();
  }
  preference = readPreference();
  if (!root.dataset.chessThemeSource) root.dataset.chessThemeSource = root.hasAttribute('data-theme') ? 'host' : 'native';
  if (isHosted()) syncHost(); else applyNative();
  let lastTheme = root.dataset.theme;
  let lastSource = root.dataset.chessThemeSource;
  new MutationObserver(() => {
    const source = root.dataset.chessThemeSource;
    if (source !== lastSource && source !== 'host') {
      preference = readPreference();
      applyNative();
    } else if (!isHosted() && root.dataset.theme !== nativeTheme) {
      root.dataset.chessThemeSource = 'host';
    }
    if (isHosted()) {
      if (root.dataset.theme !== lastTheme && ['light', 'dark'].includes(root.dataset.theme)) {
        root.dataset.chessColorScheme = root.dataset.theme;
      }
      syncHost();
    }
    lastTheme = root.dataset.theme;
    lastSource = root.dataset.chessThemeSource;
  }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-chess-theme-source', 'data-chess-color-scheme'] });
  media.addEventListener('change', () => { if (!isHosted() && preference === 'system') applyNative(); });
  window.addEventListener('storage', event => {
    if (!isHosted() && (event.key === key || event.key === null)) { preference = readPreference(); applyNative(); }
  });
  window.ChessTheme = Object.freeze({
    syncControl,
    setPreference(value) {
      if (isHosted() || !['light', 'dark', 'system'].includes(value)) return;
      preference = value;
      try { if (value === 'system') localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (_) {}
      applyNative();
    },
    toggle() { this.setPreference(root.dataset.chessColorScheme === 'dark' ? 'light' : 'dark'); }
  });
  document.addEventListener('DOMContentLoaded', syncControl);
})();
