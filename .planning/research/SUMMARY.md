# Project Research Summary

**Project:** Budget App — UK Personal Finance PWA
**Domain:** Browser-only, offline-first personal budget tracker (UK-specific, no backend)
**Researched:** 2026-02-28
**Confidence:** HIGH (stack + architecture) / MEDIUM (features + pitfalls)

## Executive Summary

This is a rebuild of an existing single-file vanilla-JS budget app into a properly modularised, offline-first PWA targeting UK users. Research confirms the local-first, no-backend architecture is the right approach: IndexedDB via Dexie.js handles all persistence, Vite + vite-plugin-pwa generates the service worker and precache manifest, and ES6 modules replace the current monolith. The transition from no-build to Vite is mandatory — not optional — because a proper service worker precache manifest cannot be maintained manually, and pdfjs-dist requires bundler-handled worker resolution. The build overhead is minimal (one npm install, one config file).

The recommended approach is a dependency-ordered rebuild across six phases: foundation (Money utility, db schema, shared utils), core budget features (income/expenses/subscriptions/debts), enhanced features (payoff planner, budget targets, recurring templates), PWA and charts, PDF bank statement import, then cloud sync. This order is dictated by hard feature dependencies: category management and the Money arithmetic module must exist before anything financial is written; the debt payoff planner must exist before the debt-free countdown and timeline chart can be built; JSON export must exist before encrypted export or cloud backup.

The two highest risks are (1) floating-point arithmetic silently corrupting financial calculations across the entire app and (2) Safari's 7-day IndexedDB eviction wiping user data without warning. Both must be addressed in the foundation phase, not deferred. A third risk — the Google Drive OAuth flow — is poorly documented for static sites and should be isolated in its own phase to avoid cross-contamination of debugging. The competitive position is strong: no existing UK budgeting tool is simultaneously local-first, offline, privacy-preserving, free, and covers debt payoff planning, PDF import, and balance-transfer modelling.

---

## Key Findings

### Recommended Stack

The stack is deliberately minimal. Vanilla JS ES6 modules satisfy the project constraint against React/Vue and have zero runtime overhead. Dexie.js 4.3.0 (already in use at 4.0.8) is the only serious IndexedDB wrapper still actively maintained and provides schema versioning, typed queries, and clean async/await. Vite 6.3.0 with vite-plugin-pwa 1.2.0 replaces the no-build approach to enable a proper precache manifest, bundled pdfjs-dist worker, and tree-shaken Chart.js. All library versions were verified against GitHub releases as of 2026-02-28.

DOMPurify 3.3.1 is required immediately — the existing codebase has stored XSS risk throughout its innerHTML rendering. Chart.js 4.5.1 replaces the Plotly.js reference in PROJECT.md (Plotly is ~3.5 MB vs Chart.js ~60 KB tree-shaken; no scientific chart types are needed). pdfjs-dist 5.4.624 handles UK bank PDF extraction client-side. Web Crypto API (SubtleCrypto, native) covers encrypted export with no added dependency.

**Core technologies:**
- **Vanilla JS ES6 modules**: Application logic — project constraint; no framework overhead; native in target browsers
- **Dexie.js 4.3.0**: IndexedDB abstraction — schema versioning, typed queries, already in use
- **Vite 6.3.0 + vite-plugin-pwa 1.2.0**: Build tooling + PWA — required for precache manifest and PDF.js worker bundling
- **Chart.js 4.5.1**: Charting — 60 KB tree-shaken vs Plotly's 3.5 MB; sufficient for 3-4 chart types
- **pdfjs-dist 5.4.624**: Client-side PDF parsing — Mozilla's browser-first library; handles UK bank text-layer PDFs
- **DOMPurify 3.3.1**: XSS sanitisation — required due to existing innerHTML vulnerability throughout codebase
- **Web Crypto API (SubtleCrypto)**: Encrypted export — native browser, no dependency, AES-256-GCM + PBKDF2
- **dropbox SDK 10.34.0**: Dropbox backup — PKCE browser flow, refresh token persistence; preferred over Google Drive for static apps
- **Google Identity Services (GIS) + gapi**: Google Drive backup — token model bypasses client_secret requirement; access tokens are session-only

See `.planning/research/STACK.md` for full rationale and alternatives considered.

### Expected Features

The MVP (v1) is a clean rebuild of what the current prototype attempts plus the features it is missing. The goal is not to add new capabilities — it is to make existing capabilities reliable. Category management is the linchpin dependency for four other features and must be built first.

**Must have (table stakes — v1 launch):**
- Category management (add/delete/seed defaults) — foundational dependency
- Income, fixed expense, and variable expense tracking — core budget data
- Subscriptions tab with monthly-equivalent calculation (quarterly/annual frequency required for TV Licence)
- Credit/debt tracker with UK minimum payment rules (FCA CONC 6.7: `max(1% balance + interest, floor £5–£25)`)
- Debt payoff planner — Avalanche + Snowball side-by-side; UK overdraft EAR handled correctly
- Assets snapshot — required for net worth
- Dashboard summary — income/fixed/variable/net position/total debt/net worth
- JSON export/import (replace, not merge) with import confirmation dialog
- Recurring transaction templates (monthly, quarterly, annual)
- Budget targets per category with progress bars
- Dark/light theme toggle (CSS custom properties, persisted to localStorage)
- PWA manifest + service worker (offline, installable)
- Modular ES6 structure (prerequisite for maintainability)

**Should have (v1.x — after core is stable):**
- Spending trend charts, debt payoff timeline chart, net worth over time chart (Chart.js)
- PDF bank statement import (auto-parse Barclays, HSBC, NatWest, Lloyds, Santander + manual fallback)
- Multi-currency accounts (isolated from GBP budget — no FX conversion)
- Debt-free date countdown on dashboard (low effort once planner exists)
- Encrypted export (AES-256-GCM wrapper over existing JSON export)
- Balance-transfer modelling (0% transfer fee/period/revert APR calculator)

**Defer (v2+):**
- Google Drive / Dropbox cloud backup (requires OAuth app registration; valuable but not blocking)
- Investment/brokerage tracking (separate product category)
- Open banking sync (requires FCA authorisation — out of scope by design)

See `.planning/research/FEATURES.md` for full dependency graph and UK-specific rules.

### Architecture Approach

The architecture is a three-layer separation: UI controllers (DOM-only, one per tab), service layer (pure business logic, no DOM), and data layer (single Dexie instance, nothing else touches IndexedDB). This directly corrects the existing monolith's core failure — debt calculation logic is currently embedded inside innerHTML template literals and implemented twice with diverging results. The service layer produces a single shared `calcMinPayment()` function consumed by both display and simulation.

**Major components:**
1. **db/db.js** — Single Dexie instance; all CRUD access; schema versioning; the only file that imports Dexie
2. **services/** — `budgetService.js` (totals, ratios, period filtering), `payoffService.js` (Avalanche/Snowball simulation, min payment), `syncService.js` (Drive/Dropbox OAuth), `pdfParser.js` (text extraction + bank-specific parsers), `currencyService.js` (GBP formatting, FX isolation)
3. **controllers/** — One per tab (dashboard, income, fixed, variable, subscriptions, debts, payoff, assets, categories, charts); read form → call service → render DOM
4. **utils/** — `date.js`, `format.js`, `validation.js`, `constants.js`; shared stateless helpers; eliminate duplication across monolith
5. **ui/** — `router.js` (tab switching), `modal.js` (reusable modal), `theme.js` (dark/light toggle)
6. **Service Worker** — Workbox via vite-plugin-pwa; cache-first for all precached assets; app shell fully offline

Key patterns: Repository Pattern (all DB access through db.js only), Event Delegation (no `onclick=` in templates), Offline-First with Manual Sync (user-triggered backup, not background sync — Background Sync API has no Firefox/Safari support), Dexie Schema Versioning (all prior versions retained permanently).

See `.planning/research/ARCHITECTURE.md` for data flow diagrams, OAuth implementation examples, and PDF parsing pipeline.

### Critical Pitfalls

1. **Floating-point arithmetic in financial calculations** — `0.1 + 0.2 !== 0.3` in JavaScript; errors compound across hundreds of transactions and 600-month debt simulations. Avoid by storing all monetary values as pence integers; divide by 100 for display only. Define a `Money` utility module in the foundation phase before any financial code is written. Consider `currency.js` for transparent integer-pence arithmetic.

2. **Safari ITP evicts IndexedDB after 7 days of inactivity** — A user who hasn't opened the app in a week on iPhone/iPad/Safari loses all data silently. Mitigate by calling `navigator.storage.persist()` in onboarding and showing a persistent banner if it returns false. Show export-reminder badge after 14+ days without export. Document this prominently in first-run UX.

3. **Dexie schema migrations blocking open tabs** — If the user has two tabs open when a schema version bump deploys, the new tab's `db.open()` hangs indefinitely. Register `db.on('versionchange')` to call `db.close()` and show a "Please reload this tab" toast. Register `db.on('blocked')` for the blocked-upgrade case. Never remove past `db.version(N)` blocks.

4. **Debt payoff simulation silent edge cases** — Zero-balance not terminated, minimum payment exceeding balance, and divergent debts (interest > payment) all produce wrong output without errors. Add `if (balance <= 0) break` at each iteration, cap payment at `Math.min(payment, balance)`, and explicitly flag divergent debts as "cannot pay off" rather than returning month 600. Write unit tests against these scenarios before building the UI.

5. **Google Drive OAuth is fragile for static sites** — Implicit flow is deprecated (OAuth 2.1 removes it); PKCE for Google requires a `client_secret` inconsistently; `drive` scope triggers unverified-app warning. Use GIS token model with `drive.file` scope only; register all origins (production + localhost) in Cloud Console before development; store tokens in memory only (not localStorage); detect 401 and re-auth silently. Isolate this work to its own phase.

---

## Implications for Roadmap

Based on research, suggested phase structure (6 phases):

### Phase 1: Foundation — Money Utility, DB Schema, Shared Infrastructure
**Rationale:** Everything financial depends on correct arithmetic. Every controller depends on utils and db. The existing codebase's core failures (floating-point errors, scattered DB calls, XSS) must be solved at the foundation before any feature is built on top. Category management belongs here because four P1 features depend on it.
**Delivers:** Vite build setup, Dexie schema with all tables (including net-worth snapshot structure), Money utility (pence-integer arithmetic), DOMPurify integration, shared utils (date, format, validation, constants), category management CRUD, `navigator.storage.persist()` call + onboarding warning, `db.on('versionchange')` and `db.on('blocked')` handlers, router/modal/theme infrastructure.
**Addresses:** Category management, dark/light theme, PWA manifest baseline, data persistence warning.
**Avoids:** Floating-point pitfall (Money module), Dexie migration blocking pitfall (versionchange handlers), Safari ITP pitfall (storage.persist call), stored XSS pitfall (DOMPurify from day one).
**Research flag:** Standard patterns — no research phase needed. Dexie, Vite, and Web Crypto are well-documented.

### Phase 2: Core Budget Features
**Rationale:** Income, fixed/variable expenses, subscriptions, and debt tracker are the functional core. They all depend on Phase 1 (categories, db, Money module). The debt tracker must precede the payoff planner. The dashboard depends on all of these. Recurring templates belong here because they enhance fixed expenses and subscriptions which are built in this phase.
**Delivers:** Income tracking, fixed expense tracking, variable expense tracking, subscriptions tab (monthly-equivalent, quarterly/annual frequency), credit/debt tracker with UK minimum payment rules (single `calcMinPayment()` in payoffService), assets snapshot, JSON export/import (replace-not-merge with confirmation dialog), recurring transaction templates (monthly/quarterly/annual), export-reminder nudge (last export badge).
**Addresses:** All P1 table-stakes features. Fixes the duplicate `calcMinPayment()` bug from the prototype.
**Avoids:** Debt simulation edge cases (single calcMinPayment function), import-merges-instead-of-replaces bug, date-field-defaults-to-empty UX pitfall.
**Research flag:** Standard patterns. UK minimum payment rules fully documented in FEATURES.md. No research phase needed.

### Phase 3: Enhanced Budget Features — Dashboard, Payoff Planner, Budget Targets
**Rationale:** Dashboard requires Phase 2 data to be complete. Payoff planner requires the debt tracker. Budget targets require categories and expense tracking. These features are grouped because they are all computation-heavy display features that build on Phase 2's stable data model.
**Delivers:** Dashboard summary (income/fixed/variable/net position/total debt/net worth/fixed-to-income ratio), debt payoff planner (Avalanche + Snowball side-by-side, UK overdraft EAR handled, divergent debt detection), balance-transfer modelling, budget targets per category with progress bars, debt-free date countdown.
**Addresses:** Debt payoff planner, balance-transfer modelling, budget targets, dashboard, debt-free countdown.
**Avoids:** Debt simulation edge cases (zero-balance termination, capped final payment, divergent debt flagged — write unit tests first), `refreshAll()` performance trap (targeted re-render from Phase 1 architecture).
**Research flag:** Standard patterns. Avalanche/Snowball algorithms are well-documented. UK overdraft EAR treatment documented in FEATURES.md. No research phase needed.

### Phase 4: PWA, Charts, and Multi-Currency
**Rationale:** Charts are purely presentational and depend on Phase 2-3 data being stable. PWA service worker generation is handled by vite-plugin-pwa (zero-config). Multi-currency accounts are a schema extension isolated from the main budget. Grouping these avoids mixing complex integration work (PDF, OAuth) with the visual layer.
**Delivers:** Spending trend charts (income vs spend last 12 months), debt payoff timeline chart, net worth over time chart (requires per-month snapshot — designed into schema at Phase 1), multi-currency accounts (isolated, no FX conversion), PWA install prompt + offline capability, iOS Safari "Add to Home Screen" instruction banner, encrypted export (AES-256-GCM wrapper over JSON export).
**Addresses:** All P2 features except PDF import and cloud backup.
**Avoids:** Plotly bundle-size trap (use Chart.js partial import), CDN-loaded charting not in precache (bundle with Vite), PWA iOS limitation (custom banner — no `beforeinstallprompt` on iOS Safari).
**Research flag:** Standard patterns for PWA and Chart.js. Multi-currency isolation is straightforward schema work. No research phase needed.

### Phase 5: PDF Bank Statement Import
**Rationale:** PDF parsing is the highest-complexity self-contained feature. It has no dependencies on cloud sync. Isolating it in its own phase limits risk and allows time for fixture PDF testing across all 5 UK banks. It must be built after the data model (Phase 1-2) is stable so imported transactions insert into the correct tables.
**Delivers:** PDF text extraction via pdfjs-dist, bank detection + per-bank parsers (Barclays, HSBC, NatWest, Lloyds, Santander), manual column-mapping fallback UI, transaction preview + confirm before bulk insert, scanned/image PDF detection with clear error message, "X of Y transactions imported, Z skipped" confidence indicator.
**Addresses:** PDF bank statement import (P2 differentiator).
**Avoids:** Hard-coded PDF column pixel values (detect from header row each parse), CDN-loaded pdfjs in PWA (bundle with Vite), naive line-by-line extraction (group by y-coordinate band ±3px).
**Research flag:** NEEDS research-phase during planning. Bank-specific PDF formats are fragile and empirically tested only against known fixture PDFs. Allocate time to capture and anonymise real PDFs from each bank. Auto-parse accuracy should be verified before declaring this phase complete.

### Phase 6: Cloud Backup (Dropbox + Google Drive)
**Rationale:** Cloud backup is the most complex integration due to OAuth requirements, HTTPS-only constraints, and per-service debugging overhead. Isolating it last means all other features are stable and testable independently. It is a P3 feature by priority — valuable for cross-device use but not blocking the core app. JSON export (Phase 2) must exist first as backup wraps that export.
**Delivers:** Dropbox PKCE backup (preferred — refresh token persistence survives sessions), Google Drive GIS token model backup (re-auth each session), upload/download backup file, last-backup timestamp on dashboard.
**Addresses:** Google Drive / Dropbox backup (P3).
**Avoids:** Deprecated `gapi.auth2` (use GIS), `drive` scope unverified-app warning (use `drive.file` only), storing access tokens in IndexedDB (memory-only for access tokens, localStorage for Dropbox refresh token only), token expiry mid-operation (detect 401, re-auth, retry).
**Research flag:** NEEDS research-phase during planning. Google Drive OAuth for static sites is documented but has known edge cases (implicit flow deprecation, PKCE client_secret inconsistency). Register all origins in Cloud Console before development starts. Test 401 refresh cycle explicitly.

### Phase Ordering Rationale

- **Foundation before features:** The Money utility and versionchange handlers must exist before any financial logic is written. There is no safe way to retrofit pence-integer arithmetic after financial values have been stored as floats.
- **Categories before expenses:** Four P1 features depend on categories. This is a hard dependency from FEATURES.md.
- **Debt tracker before payoff planner:** The planner simulates debts — no debts = nothing to plan.
- **Data model before charts:** Charts are presentational; they cannot be built before the services they visualise are stable.
- **PDF import before cloud sync:** PDF is self-contained; cloud sync is an integration. PDF failure is recoverable (fallback to manual entry); OAuth misconfiguration causes more opaque errors.
- **Net worth snapshot schema designed in Phase 1:** The net worth over time chart (Phase 4) requires per-month historical snapshots, not just current values. This is a schema decision that cannot be retrofitted cheaply. Design the `netWorthSnapshots` table in Phase 1 even though the chart comes in Phase 4.

### Research Flags

**Needs `/gsd:research-phase` during planning:**
- **Phase 5 (PDF Import):** Bank-specific PDF formats must be tested against real fixture PDFs. Auto-parse heuristics are empirical — cannot be determined from documentation alone.
- **Phase 6 (Cloud Backup):** Google Drive OAuth for static sites has documented instability (implicit flow deprecated, PKCE client_secret inconsistency). Test OAuth flow against real credentials before planning implementation details.

**Standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Vite, Dexie, DOMPurify, Web Crypto are all well-documented with official sources.
- **Phase 2 (Core Budget):** UK minimum payment rules fully documented. JSON export/import is standard. Recurring templates are standard scheduler logic.
- **Phase 3 (Dashboard + Planner):** Avalanche/Snowball algorithms are textbook. UK overdraft EAR distinction is documented in research.
- **Phase 4 (PWA + Charts):** Chart.js, vite-plugin-pwa, and PWA manifest patterns are all well-documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against GitHub releases as of 2026-02-28; official docs confirmed for all libraries; Vite vs no-build rationale is definitive |
| Features | MEDIUM | Core categorisation is HIGH; UK minimum payment rules are MEDIUM (FCA handbook confirmed, but lender-specific formulas vary); bank PDF formats are LOW-MEDIUM (evidence of parseability from commercial services, not first-party bank docs) |
| Architecture | HIGH | Core patterns (repository layer, controller/service split, Dexie schema design) are from official Dexie docs and established PWA patterns; OAuth implementation details are MEDIUM (verified but have known edge cases) |
| Pitfalls | MEDIUM | Critical pitfalls (floating-point, Safari ITP, schema migration blocking) verified via official sources; UK bank PDF format fragility is MEDIUM (community evidence); Google OAuth static-site edge cases are MEDIUM (partially verified) |

**Overall confidence:** HIGH for build approach, architecture, and stack decisions. MEDIUM for UK-specific rules and external integrations.

### Gaps to Address

- **UK bank PDF column coordinates:** Cannot determine bank-specific x-coordinate thresholds from documentation. Must be derived empirically from real fixture PDFs. Capture and anonymise at least 2-3 statements per bank (different dates) before starting Phase 5.
- **Google PKCE + client_secret inconsistency:** Google's PKCE implementation for web apps inconsistently requires a `client_secret` as of early 2026. The GIS token model is the recommended workaround, but its implicit-flow characteristics (no refresh token, 1-hour expiry) create UX friction. Validate the re-auth flow against a real Google Cloud project before Phase 6 planning.
- **Net worth snapshot storage strategy:** The research recommends storing one snapshot per month for the net worth over time chart. The exact trigger (user-initiated vs. automatic on month end) and retention policy need a decision in Phase 1 schema design.
- **Plotly vs Chart.js alignment:** PROJECT.md references Plotly.js but research strongly recommends Chart.js 4 (~60 KB vs ~3.5 MB). This substitution should be confirmed with the project owner before Phase 4.
- **Dropbox app registration:** Dropbox PKCE requires an app key registered in the Dropbox App Console with the exact redirect URI. This registration must happen before Phase 6 development begins — it cannot be done mid-sprint.

---

## Sources

### Primary (HIGH confidence)
- [Dexie.js GitHub Releases](https://github.com/dexie/Dexie.js/releases) — v4.3.0 latest stable; schema versioning; versionchange/blocked events
- [Dexie.js Documentation](https://dexie.org/docs/) — indexing strategy, transaction rules, best practices
- [Chart.js GitHub Releases](https://github.com/chartjs/Chart.js/releases) — v4.5.1 latest stable
- [PDF.js GitHub Releases](https://github.com/mozilla/pdf.js/releases) — v5.4.624 latest stable
- [vite-plugin-pwa GitHub](https://github.com/vite-pwa/vite-plugin-pwa/releases) — v1.2.0 latest stable; Vite 6 support confirmed
- [Vite GitHub](https://github.com/vitejs/vite/releases/tag/v6.3.0) — v6.3.0 stable
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) — v3.3.1 latest stable
- [FCA CONC 6.7](https://handbook.fca.org.uk/handbook/CONC/6/7.html) — UK minimum payment regulatory requirements
- [TV Licence Fee GOV.UK](https://www.gov.uk/government/news/cost-of-tv-licence-fee-set-for-202627) — £180/year from April 2026; quarterly payment confirmed
- [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model) — GIS token model for static apps
- [Google Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) — `drive.file` vs `drive` scope distinction
- [Dropbox PKCE documentation](https://dropbox.tech/developers/pkce--what-and-why-) — PKCE browser flow confirmed
- [Dropbox SDK PKCE example](https://github.com/dropbox/dropbox-sdk-js/blob/main/examples/javascript/pkce-browser/index.html) — browser PKCE flow confirmed
- [MDN SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) — AES-GCM + PBKDF2
- [MDN PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) — service worker, manifest, offline patterns
- [WebKit ITP storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) — 7-day eviction behaviour confirmed
- [Workbox / vite-plugin-pwa docs](https://vite-pwa-org.netlify.app/) — generateSW strategy; precache manifest generation

### Secondary (MEDIUM confidence)
- [Experian UK — minimum payment](https://www.experian.co.uk/consumer/credit-cards/guides/minimum-payment-credit-card.html) — lender-specific minimum payment formulas
- [currency.js](https://currency.js.org/) — integer-pence arithmetic library
- [Dropbox npm package](https://www.npmjs.com/package/dropbox/v/10.34.0) — v10.34.0 latest; stable API
- [Background Sync browser support](https://rishikc.com/articles/advanced-pwa-features-offline-push-background-sync/) — no Firefox/Safari support confirmed
- [Google PKCE client_secret inconsistency](https://ktaka.blog.ccmp.jp/2025/07/oogle-oauth2-and-pkce-understanding.html) — edge case documented

### Tertiary (LOW confidence — needs validation during implementation)
- [csvbankconverter.com](https://www.csvbankconverter.com/uk-banks/barclays) — UK bank PDF layout notes (commercial service; evidence of parseability but no structural spec)
- [ukstatementconverter.co.uk](https://ukstatementconverter.co.uk/) — Santander three-column format observation

---
*Research completed: 2026-02-28*
*Ready for roadmap: yes*
