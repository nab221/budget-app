# Stack Research

**Domain:** Browser-only personal finance PWA (no server, IndexedDB storage)
**Researched:** 2026-02-28
**Confidence:** HIGH (all versions verified against GitHub releases; architecture verified against official docs)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vanilla JS (ES6 modules) | Native | Application logic | No framework overhead; project constraint confirmed in PROJECT.md; ES modules work natively in all target browsers without bundling |
| Dexie.js | 4.3.0 | IndexedDB abstraction | Already in use (4.0.8); 4.3.0 is latest stable; provides clean async/await API, schema versioning, and typed queries; only serious IndexedDB wrapper still actively maintained as of 2026 |
| Vite | 6.3.0 | Build tooling, dev server, PWA bundling | Enables ES module tree-shaking, bundled service worker via vite-plugin-pwa, and eliminates CDN runtime dependency; no-build approach cannot generate a proper service worker precache manifest — see rationale below |
| vite-plugin-pwa | 1.2.0 | PWA manifest + service worker generation | Zero-config Workbox integration; handles precache manifest, offline fallback, install prompt; v0.21.1+ supports Vite 6 |

### Storage and Security

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Dexie.js | 4.3.0 | Primary data store | All CRUD operations against IndexedDB; already in schema; do not replace with idb (lower-level) or raw IDB (too verbose) |
| Web Crypto API (SubtleCrypto) | Native browser | Encrypted export | AES-GCM + PBKDF2 key derivation from user password; zero dependencies; use for "Encrypted export" feature — no external library needed |
| DOMPurify | 3.3.1 | XSS output sanitization | Anywhere user-entered text is rendered via innerHTML; ~30 KB minified; CONCERNS.md documents stored XSS risk throughout the codebase |

### Charts and Visualisation

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Chart.js | 4.5.1 | Spending trends, net worth over time, debt payoff timeline | Default choice for framework-agnostic PWA; Canvas-based so mobile-performant; tree-shakeable when bundled with Vite; far smaller than ECharts (~60 KB vs ~1 MB); PROJECT.md already references Plotly.js but Chart.js is lighter — see alternatives |

### PDF Parsing

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pdfjs-dist | 5.4.624 | Client-side PDF text extraction | UK bank statement import; use `page.getTextContent()` to extract raw text then apply per-bank regex parsers; handles Barclays/HSBC/NatWest/Lloyds/Santander PDF text layers; does NOT work on scanned (image-only) PDFs |

### Cloud Backup (Google Drive)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Google Identity Services (GIS) | Current (CDN) | OAuth 2.0 token acquisition | Replace deprecated `gapi.auth2`; use `google.accounts.oauth2.initTokenClient()` for popup-based consent; no redirect needed |
| Google API JS Client (gapi) | Current (CDN) | Drive REST API calls after auth | Load via `https://apis.google.com/js/api.js`; use `gapi.client.drive` to upload/download JSON backup files; still required alongside GIS for API call management |

### Cloud Backup (Dropbox)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dropbox SDK | 10.34.0 | Dropbox file upload/download | Official Dropbox JS SDK; supports PKCE browser flow (example in SDK repo at `examples/javascript/pkce-browser/`); last published ~3 years ago but API is stable; works in browser without Node |

---

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite 6 | Dev server, bundling, asset hashing | `npm create vite@latest` with vanilla-js template; run `vite` in dev, `vite build` for production |
| vite-plugin-pwa | Service worker + manifest generation | `strategies: 'generateSW'` for zero-config; auto-precaches all assets so app works fully offline |
| Workbox (via vite-plugin-pwa) | Runtime caching strategies | Bundled inside vite-plugin-pwa; no direct install needed |

---

## Installation

```bash
# Core
npm install dexie@4.3.0 chart.js@4.5.1 dompurify@3.3.1

# PDF parsing (large — ~3 MB; import only the worker + API)
npm install pdfjs-dist@5.4.624

# Cloud backup
npm install dropbox@10.34.0

# Dev dependencies
npm install -D vite@6.3.0 vite-plugin-pwa@1.2.0
```

**Note on Google Drive:** GIS and gapi are loaded from Google CDN at runtime (not npm packages). This is Google's current recommended approach — no npm package exists for GIS.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Chart.js 4 | Plotly.js (PROJECT.md default) | Plotly is ~3.5 MB and framework-agnostic but overkill for 3-4 chart types; Chart.js is ~60 KB tree-shaken; switch to Plotly only if scientific/statistical chart types are needed |
| Chart.js 4 | Apache ECharts | ECharts excels at millions of data points and WebGL rendering; unnecessary for a personal budget app with <10K records |
| Vite 6 | No-build (CDN-only) | No-build is viable if the feature set stays minimal AND PWA offline is not required. Once you add a service worker with precache manifest, a build step becomes necessary — the manifest lists every asset hash, which cannot be generated manually |
| pdfjs-dist | pdf-parse | pdf-parse is Node.js only; pdfjs-dist is the browser-first option from Mozilla |
| pdfjs-dist | unpdf | unpdf is optimised for edge runtimes; pdfjs-dist is the right choice for pure browser use |
| Web Crypto API | CryptoJS | CryptoJS is unmaintained since 2021 and uses a weaker key derivation approach; browser SubtleCrypto is native, audited, and supports PBKDF2 + AES-GCM |
| DOMPurify | Manual escaping | Manual HTML entity escaping is error-prone under the volume of innerHTML rendering in this codebase; DOMPurify is purpose-built and 30 KB |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Plotly.js | ~3.5 MB bundle; overkill for 3-4 chart types; no meaningful advantage over Chart.js for this use case | Chart.js 4 |
| React / Vue / Svelte | PROJECT.md explicitly requires "no React/Vue complexity"; adds build complexity and runtime overhead that vanilla JS with ES modules avoids | Vanilla JS ES6 modules |
| idb (Google's IDB wrapper) | Lower-level than Dexie; requires more boilerplate; schema migration less ergonomic; Dexie is already in the codebase | Dexie.js 4 |
| CryptoJS | Last meaningful release 2021; uses MD5-based key derivation by default; not recommended for new projects | Web Crypto API (SubtleCrypto) |
| pdf-parse | Node.js only; will not work in a browser | pdfjs-dist |
| gapi.auth2 (old Google Sign-In) | Deprecated; Google discontinued authorization support for the platform.js library | Google Identity Services (GIS) |
| Workbox CLI (standalone) | vite-plugin-pwa wraps Workbox and integrates it with the build; using Workbox CLI separately requires manual manifest synchronisation | vite-plugin-pwa |
| localStorage for app data | 5-10 MB limit; synchronous blocking API; Dexie/IndexedDB already handles data correctly | Dexie.js |

---

## Vite vs No-Build: Decision Rationale

The existing codebase is a no-build CDN-loaded single file. The rebuild should add Vite. Here is why:

**No-build works when:**
- All libraries can be loaded from CDN at runtime
- No service worker precache manifest is needed
- The offline requirement is informal (not strict PWA install)

**No-build breaks down because:**
1. **PWA precache manifest** — A service worker must list every asset with a content hash to enable reliable offline caching. This list cannot be maintained manually and must be generated at build time (Workbox does this automatically inside vite-plugin-pwa).
2. **pdfjs-dist worker** — PDF.js requires a Web Worker file path. Bundlers handle this automatically; CDN loading of pdfjs-dist from a module worker is messy and version-coupling-prone.
3. **Tree-shaking** — Chart.js ships as ES modules; without bundling, you load the entire 200 KB+ file from CDN. Vite tree-shakes it to ~60 KB for the 3-4 chart types needed.
4. **SRI / security** — CONCERNS.md flags the CDN dependency risk. Bundling eliminates runtime CDN dependency and removes the need for SRI hash maintenance.

**Verdict:** Add Vite 6. The DX overhead is minimal (`npm run dev` / `npm run build`). The PWA + PDF feature requirements make a build step effectively mandatory.

---

## Stack Patterns by Variant

**If PDF import is deferred to a later phase:**
- Skip pdfjs-dist in the initial install
- pdfjs-dist is ~3 MB; separating it keeps the initial bundle small

**If Google Drive integration is deferred:**
- Skip GIS + gapi CDN scripts entirely; they are 100% optional and can be added per-feature
- Dropbox SDK can be npm-installed independently

**If encrypted export is deferred:**
- No extra library needed at all — Web Crypto API is always available in the browser
- Can be added as a pure JS feature without new dependencies

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| vite-plugin-pwa@1.2.0 | vite@6.x | v0.21.1+ added Vite 6 support; v1.2.0 is current stable |
| pdfjs-dist@5.4.624 | All target browsers (Chrome 80+, Edge 80+, Firefox 78+, Safari 15+) | PDF.js 5.x requires modern browser; check worker URL configuration in Vite build |
| dexie@4.3.0 | Chrome 80+, Edge 80+, Firefox 78+, Safari 15+ | Same browser targets; 4.x is stable and backward-compatible with existing 4.0.8 schema |
| chart.js@4.5.1 | All target browsers | Canvas API; no IE support needed per project constraints |
| dropbox@10.34.0 | Browser + Node | Works in browser without modification; PKCE example in SDK repo |

---

## Sources

- [Dexie.js GitHub Releases](https://github.com/dexie/Dexie.js/releases) — confirmed v4.3.0 latest stable (January 2026)
- [Chart.js GitHub Releases](https://github.com/chartjs/Chart.js/releases) — confirmed v4.5.1 latest stable (October 2024)
- [PDF.js GitHub Releases](https://github.com/mozilla/pdf.js/releases) — confirmed v5.4.624 latest stable (February 2026)
- [vite-plugin-pwa GitHub Releases](https://github.com/vite-pwa/vite-plugin-pwa/releases) — confirmed v1.2.0 latest stable
- [Vite GitHub Releases](https://github.com/vitejs/vite/releases/tag/v6.3.0) — confirmed v6.3.0 stable (April 2025)
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) — confirmed v3.3.1 latest stable
- [Dropbox npm package](https://www.npmjs.com/package/dropbox/v/10.29.0) — confirmed 10.34.0 is latest; no new releases in ~3 years (API stable)
- [Google Drive JS Quickstart](https://developers.google.com/workspace/drive/api/quickstart/js) — GIS + gapi two-library approach confirmed as current pattern
- [Google GIS Migration Guide](https://developers.google.com/identity/oauth2/web/guides/migration-to-gis) — confirmed gapi.auth2 deprecated; GIS is replacement
- [Dropbox PKCE Browser Example](https://github.com/dropbox/dropbox-sdk-js/blob/main/examples/javascript/pkce-browser/index.html) — PKCE flow confirmed for browser use
- [MDN SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) — AES-GCM + PBKDF2 native browser approach confirmed
- [vite-plugin-pwa Docs](https://vite-pwa-org.netlify.app/) — Vite 6 support confirmed; generateSW strategy documented

---

*Stack research for: Browser-only personal finance PWA*
*Researched: 2026-02-28*
