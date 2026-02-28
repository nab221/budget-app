# Pitfalls Research

**Domain:** Browser-only personal finance PWA (IndexedDB, PDF parsing, Google Drive sync, debt calculations, charting)
**Researched:** 2026-02-28
**Confidence:** MEDIUM — core pitfalls verified via official docs and multiple community sources; some UK bank format specifics are LOW confidence (limited direct sources)

---

## Critical Pitfalls

### Pitfall 1: Floating-Point Arithmetic in Financial Calculations

**What goes wrong:**
JavaScript's IEEE 754 floating-point representation means `0.1 + 0.2 !== 0.3`. In a budget app, this compounds across hundreds of transactions. A running total that should be £1,247.83 displays as £1,247.8299999999998. In debt simulations iterated over 600 months, rounding errors accumulate into materially wrong payoff dates and interest totals.

**Why it happens:**
The existing codebase uses raw `parseFloat()` throughout and passes raw float values into `calcMinPayment()` and the payoff simulation loop. The Avalanche/Snowball simulation subtracts interest and payments month-over-month; each subtraction accumulates error.

**How to avoid:**
Store all monetary values as integers (pence, not pounds). Divide by 100 only for display. Use `Math.round(value * 100) / 100` consistently when converting. For the payoff simulation, accumulate in pence integers. Consider `currency.js` (https://currency.js.org/) for arithmetic — it wraps integer-pence math transparently.

**Warning signs:**
- Dashboard totals differ by fractions of a penny from what the user calculated manually
- Payoff planner shows "debt-free month" that shifts by 1 month between refreshes for the same data
- `calcMinPayment()` and simulation loop produce results differing by small fractions on the same debt

**Phase to address:** Foundation phase — define a `Money` utility module (pence-integer arithmetic, format-to-GBP display) before any financial calculation is written. Every subsequent phase consumes this module.

---

### Pitfall 2: Dexie.js Schema Migrations Blocking Open Tabs

**What goes wrong:**
When a user has two browser tabs open and the app deploys a schema version bump, the new tab triggers a version upgrade. IndexedDB fires a `versionchange` event on the old tab. If the old tab does not close its connection, the upgrade is blocked indefinitely — the new tab's `db.open()` call hangs, the app appears frozen, and no data can be read or written.

**Why it happens:**
The default Dexie behaviour closes the connection and logs a `console.warn()` on versionchange, but if the old tab is backgrounded, the user never sees it. The existing codebase has no versionchange handling at all.

**How to avoid:**
Register a `db.on('versionchange')` handler that calls `db.close()` and then shows a UI toast: "App updated — please reload this tab." Also register `db.on('blocked')` to alert the user when a blocked upgrade is detected. Never rely on Dexie's default behaviour for production schema changes.

Keep all past `db.version(N).stores({...}).upgrade(tx => {...})` calls in the codebase permanently — removing them breaks upgrades for users still on old versions. Version N+1 only needs to declare changed stores, not the full schema; but upgrade functions for all prior versions must remain.

**Warning signs:**
- User reports the app "freezing" after a deployment
- DevTools IndexedDB shows version still at old number after deployment
- `db.open()` promise never resolves in production but works fine in fresh browser

**Phase to address:** Data foundation phase — establish the versioned schema structure and versionchange/blocked handlers before any schema-changing feature is built.

---

### Pitfall 3: Safari ITP Evicts IndexedDB After 7 Days of Inactivity

**What goes wrong:**
Safari's Intelligent Tracking Prevention (ITP) deletes all browser storage — including IndexedDB — for any origin that has not received a user interaction (tap/click) in the past 7 days. A user who hasn't opened the budget app in a week on iPhone/iPad/Safari Mac loses all their data silently. There is no warning and no recovery path unless the user had exported a backup.

**Why it happens:**
Safari targets origins without recent interaction to prevent tracker abuse of storage APIs. The budget app, opened once a month at payday, is squarely in the eviction window.

**How to avoid:**
1. In the app's onboarding/first-run screen, show a persistent warning: "This app stores data locally. On Safari, data may be deleted if you don't open the app for more than 7 days. Export a backup regularly or connect Google Drive sync."
2. Implement the `navigator.storage.persist()` API — calling this requests the "persistent" storage bucket, which is exempt from eviction. Prompt the user to grant permission. Show a banner if `navigator.storage.persisted()` returns false.
3. Add an export reminder: detect last export date from localStorage and nudge users who haven't exported in 14+ days.

Also: In private browsing mode, IndexedDB quota is 0 in Safari — the app will fail to open. Catch `QuotaExceededError` on `db.open()` and show a clear "Private browsing is not supported" message rather than a cryptic error.

**Warning signs:**
- iOS users report "all my data is gone" after returning from holiday
- App works on Chrome/Firefox but fails silently on Safari
- `navigator.storage.persisted()` returns `false` after first load

**Phase to address:** Foundation phase for storage.persist() and onboarding warnings; Google Drive sync phase adds the automatic backup escape hatch.

---

### Pitfall 4: UK Bank PDF Formats Are Unstable and Bank-Specific

**What goes wrong:**
UK banks generate PDFs with entirely different column layouts, font encoding tricks, and table structures. Barclays, HSBC, Lloyds, NatWest, Santander, and Nationwide each use a different PDF structure. More critically, banks silently change their statement format when they redesign their online banking or update their PDF renderer — with no versioning or announcement. A parser that works today breaks next quarter.

Specific problems seen in UK bank PDF parsing:
- Transactions span multiple text nodes in the PDF content stream (e.g., merchant name on one line, reference on the next), so naive line-by-line extraction merges or splits transactions
- Credit and debit columns are spatially separated; pdf.js `getTextContent()` returns a flat list of positioned text items, not a table — y-coordinate grouping is required to reconstruct rows
- Some banks use scanned-image PDFs (older statements) that are not machine-readable text at all; pdf.js returns empty text for these
- Balance figures are sometimes cumulative-running (post-transaction), sometimes opening/closing only
- Santander in particular uses a three-column layout (date | description | debit | credit | balance) where "debit" and "credit" are in separate columns — negatives are not used

**Why it happens:**
PDF is a presentation format, not a data format. Banks are under no obligation to maintain parseable structure. Any pixel-level layout change breaks positional parsing logic.

**How to avoid:**
Build a two-tier parser strategy from the start:
1. **Auto-parse tier**: Per-bank regex+position parsers for the 5 target banks. Each parser is isolated in its own module and has a version field. Tests run against fixture PDFs captured at known dates.
2. **Manual fallback tier**: When auto-parse fails or produces low-confidence output (transaction count is 0, amounts don't balance), drop into a column-mapping UI where the user identifies which column is date/debit/credit.

Never skip the fallback — it is the safety net that makes the whole feature production-worthy. Treat auto-parse as an optimisation over manual entry, not a replacement for it.

For scanned/image PDFs: detect when `getTextContent()` returns fewer than 5 text items for a multi-page PDF and show a clear error: "This statement appears to be a scanned image. Please download a digital statement from your bank's online banking."

**Warning signs:**
- Parser returns 0 transactions on a valid PDF
- Parsed amount totals don't match the statement's opening/closing balance
- User reports imported transactions with wrong sign (income showing as expense)
- Date fields parse as `Invalid Date`

**Phase to address:** PDF import phase. Allocate extra time. Build fixture PDF tests first (capture real statement PDFs, anonymise them, commit to test fixtures). Do not attempt to infer column positions without position-tolerance tolerances (±5px).

---

### Pitfall 5: Google Drive OAuth Is Broken for Static Sites Without Careful Scope and Origin Setup

**What goes wrong:**
The Google Drive OAuth flow for a static site (GitHub Pages, no backend) has several compounding problems:

1. **Origin must be registered**: The JavaScript origin (`https://yourdomain.github.io`) must be listed as an Authorized JavaScript Origin in the Google Cloud Console OAuth client. If not, the token flow silently returns an error or produces tokens that are rejected on API calls. Localhost during development requires a separate entry.

2. **Implicit flow is deprecated**: OAuth 2.1 eliminates the implicit flow entirely. Google's own docs still point SPAs to implicit flow as of early 2026, but this is being deprecated. Google's PKCE implementation for web apps inconsistently requires a `client_secret`, which a static site cannot safely hold. This creates an awkward middle ground: the implicit (token) flow works today but is marked insecure; the code+PKCE flow requires server-side components or an exposed client secret.

3. **Scope must be `drive.file` not `drive`**: Requesting full `drive` scope triggers Google's "sensitive scope" review — the app gets flagged as unverified and users see a scary security warning. The `drive.file` scope (access only to files created by this app) avoids review and is the correct scope for a backup/restore use case. The trade-off: the user must use the Picker to select an existing backup file; your app cannot search Drive for it.

4. **Token expiry is 1 hour**: Access tokens expire. Refresh tokens are not issued for the implicit flow. Users who leave the app open across an hour boundary will get silent 401 errors on Drive operations. The app must detect 401s, prompt re-auth, and retry the operation.

5. **CORS**: Drive API v3 supports CORS from browser origins, but only for the `Authorization` header. Some file download patterns (range requests) are blocked. For backup/restore of JSON files (<1MB), this is not a problem, but it must be confirmed before building.

**How to avoid:**
- Use Google Identity Services (GIS) library with the token model (`google.accounts.oauth2.initTokenClient`), not the deprecated `gapi.auth2`
- Request `https://www.googleapis.com/auth/drive.file` scope only
- Register all origins (production + localhost dev) in Cloud Console before starting development
- Implement 401 detection in the Drive API wrapper and auto-trigger token refresh
- Show the Google Picker for file selection (restore flow) — do not attempt to list Drive files directly
- Store access tokens in memory only, not localStorage (security)
- Document the client_id in the project's config but never commit client secrets

**Warning signs:**
- OAuth popup opens then closes with no token
- Drive API calls return 403 with "insufficient permissions" even after successful login
- Re-opening the app after an hour causes silent failures on Drive operations
- Security warning screen shown to users when they connect Drive

**Phase to address:** Google Drive sync phase. Do not combine with any other feature work — OAuth debugging is time-consuming and unrelated errors obscure the problem.

---

### Pitfall 6: Debt Payoff Simulation Has Silent Edge Cases

**What goes wrong:**
The Avalanche and Snowball simulations iterate month-by-month up to `maxMonths`. Several edge cases produce wrong output without errors:

1. **Zero balance not terminated**: If a debt reaches exactly £0.00 after a payment, the loop continues applying £0 minimum payment and compounding interest, producing `NaN` or negative balances that propagate into other debts' "freed payment" cascades.

2. **Minimum payment exceeds balance**: On the final payment, the minimum payment formula (`balance * 0.02 + interest`) may exceed the remaining balance. The simulation must cap the payment at the actual balance — otherwise the debt goes negative, and the freed payment for next month is wrong.

3. **Divergent simulation**: Very high APR + very low extra payment = the interest accrued each month exceeds the payment. The balance grows forever. With `maxMonths = 600`, the loop runs to the maximum and returns "never paid off" — but the existing code does not distinguish this case from "paid off at month 600."

4. **UK minimum payment rules vary by lender**: UK lenders each implement their own minimum payment formula. The FCA mandates at minimum: max(1% of balance + interest, £25) — but many lenders use 1–2.5% of balance plus interest, and the floor amount varies (£5–£25). A single formula will be wrong for some debts.

5. **Duplicate formula bug (existing)**: The existing codebase has `calcMinPayment()` and the simulation loop implementing minimum payment in two different ways. They will diverge for `pct_plus_interest` debt type.

**How to avoid:**
- Extract a single `calcMinPayment(debt, balance)` function used in both display and simulation — no duplication
- In the simulation loop: `if (balance <= 0) break;` at the top of each debt's iteration
- Cap each payment at `Math.min(payment, balance)` before subtracting
- After the loop, check `if (balance > 0)` — if so, flag as "cannot be paid off with current payments" rather than treating month 600 as payoff date
- Store lender-specific minimum payment rules as named constants: `MIN_PAYMENT_RULES = { 'pct_plus_interest': ..., 'fixed': ..., 'pct_of_balance': ... }`
- Unit test the simulation against known scenarios: a £1000 debt at 20% APR with £50/month should reach £0 within a calculable number of months

**Warning signs:**
- Payoff timeline shows "Month 600" for debts with manageable balances
- Total interest figure is `NaN` or negative
- Avalanche and Snowball produce identical results (suggests one strategy path is not sorting correctly)
- Debt-free date is earlier than mathematically possible

**Phase to address:** Debt calculation phase — write unit tests for `calcMinPayment()` and `simulate()` before building the UI. This is the highest-risk calculation in the app.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `innerHTML` string concatenation for table rows | Fast to write, easy to read | Stored XSS if any field contains `<script>` or `"` quotes; existing codebase already has this vulnerability | Never — use `textContent` + DOM construction or a sanitisation step |
| Single `refreshAll()` re-renders everything on any change | Simple state management | Noticeable lag at 500+ transactions; blocks UI thread during 8 parallel DB queries | Only acceptable for MVP with <100 transactions; add targeted re-render in later phase |
| `parseFloat()` without validation | Fewer lines of code | `parseFloat("")` returns `NaN`; `parseFloat("£12.50")` returns `NaN`; silent bad data in DB | Never for financial input — always validate and coerce explicitly |
| Hardcoded `maxMonths = 600` simulation cap | Prevents infinite loop | Silently caps payoff at 50 years; divergent debts look paid off | Acceptable as safety net only if accompanied by explicit "divergent" detection |
| Global `db` variable | Convenient access from anywhere | Untestable; hard to mock for unit tests; any module can corrupt state | Acceptable for single-module apps; problematic in modular rebuild |
| `import()` from CDN (Dexie, Plotly) | No build step needed | App fails completely if CDN is down; no offline guarantee; no SRI hash means supply-chain risk | Only acceptable with SRI hash + local fallback; prefer bundling for PWA |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Drive OAuth | Using deprecated `gapi.auth2` implicit flow | Use Google Identity Services (GIS) `initTokenClient` with `drive.file` scope |
| Google Drive OAuth | Not registering `localhost` as an authorized origin | Register both production URL and `http://localhost:5173` (dev server) in Cloud Console before starting |
| Google Drive API | Requesting `drive` (full access) scope | Request `drive.file` only — avoids Google's unverified app warning |
| Google Drive API | Assuming token persists across sessions | Tokens expire in 1 hour; detect 401 and re-auth silently; never store tokens in localStorage |
| Google Picker | Trying to list/search files without Picker | Use Google Picker UI for file selection — direct file listing requires broader scopes |
| pdf.js | Calling `getTextContent()` and treating result as lines | Text items have x/y coordinates — group by y-band (±3pt) to reconstruct rows before parsing columns |
| pdf.js | Assuming all PDFs are text-based | Check item count; if <10 items on a 10-page PDF, it is scanned/image — reject gracefully |
| Plotly.js | Including full `plotly.js` bundle (~3.5MB minified) | Use a partial bundle (`plotly-basic`, `plotly-finance`) or import only needed trace types — reduces to <1MB |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `db.table.toArray()` loads entire table | Page lag on tab switch; transactions table takes 1–2s to render | Add `.where('date').between(start, end)` filtering in DB query, not post-fetch | ~500 transactions in any single table |
| Payoff simulation runs synchronously on main thread | UI freezes for 1–2s when user clicks "Calculate Payoff" | Move simulation to a Web Worker; or break into `requestIdleCallback` chunks | ~10 debts × 600 months = 6000 iterations — noticeable at 5+ debts |
| `refreshAll()` runs 8 parallel DB queries on every input change | Dashboard flickers on every keypress if user is typing in a form | Debounce `refreshAll()` calls; use targeted per-table refresh | Immediately noticeable on low-end mobile |
| Plotly.js redraws entire chart on every data change | Chart animates slowly on each refresh | Use `Plotly.react()` (diff-based) rather than `Plotly.newPlot()` for updates | Any chart with >100 data points |
| IndexedDB transaction per record during import | Bulk import of 500 transactions takes 30+ seconds | Use `db.table.bulkAdd()` — one transaction for all records | >50 records in import |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Rendering user-entered text with `innerHTML` | Stored XSS: if a transaction description contains `<img src=x onerror=alert(1)>`, it executes on every render | Use `element.textContent = value` for all user data; never inject financial data into innerHTML; existing codebase has this bug throughout |
| Export backup without content validation on import | Malicious JSON with crafted field values (e.g., `"<script>..."`) re-introduces XSS on import | Validate and sanitise all string fields on import; check types and lengths; reject unexpected keys |
| Storing Google access tokens in localStorage | Token exposed to XSS; token persists after user closes app | Store tokens in memory only; tokens expire in 1 hour anyway; clear on page unload |
| Encrypted export using weak key derivation | User thinks data is safe with a short password; PBKDF2 with low iteration count is bruteforceable | Use PBKDF2 with ≥100,000 iterations or Argon2 (via wasm); document that password strength determines security |
| Single `confirm()` for Reset All Data | Accidentally dismissed; user loses all data | Require typing "DELETE" or similar; or require exporting a backup before reset is enabled |
| No `Content-Security-Policy` header | CDN-loaded scripts (Dexie, Plotly from CDN) bypass XSS protections | Set CSP header on GitHub Pages via `_headers` file; whitelist only the specific CDN domains used; use SRI hashes |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No warning that browser data can be lost | User clears cache / ITP evicts data; total surprise data loss | Show "your data lives in this browser" notice on first load; show export reminder badge after 7 days without export |
| Import merges instead of replaces | User restores a backup and ends up with double the data | Show "Replace existing data?" vs "Merge?" choice on import; default to Replace with prominent warning |
| Date fields default to empty | User adds every transaction without noticing blank date; data appears under wrong month | Pre-populate all date inputs with today's date on form open |
| Payoff planner doesn't explain its assumptions | User doesn't know if simulation uses UK minimum payment rules or assumes fixed minimum | Show calculation assumptions as a footnote: "Minimum payment = max(1% balance + interest, £25). Monthly compounding." |
| PDF import auto-parses but shows no confidence indicator | User doesn't notice that 3 of 47 transactions were skipped due to parse failure | Show "Imported 44 of 47 transactions — 3 skipped (could not parse)" with option to review skipped rows |
| Foreign currency amounts silently mixed into GBP totals | Net position is wrong; user can't trust the dashboard | Enforce currency isolation at the data layer: foreign-currency accounts have a `currency` field; any attempt to add them to GBP totals throws an error |
| No visual distinction between persistent storage granted vs not | User on Safari thinks data is safe; it isn't if `storage.persist()` was denied | Show a persistent banner: "Storage not protected — data may be deleted. [Request protection]" if `navigator.storage.persisted()` is false |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **PDF Import:** Parses Barclays correctly — verify the other 4 banks (HSBC, NatWest, Lloyds, Santander) with real fixture PDFs
- [ ] **Debt Payoff Planner:** Displays a debt-free date — verify the date is correct for a divergent debt (APR > monthly payment capacity) — should say "cannot pay off" not a date
- [ ] **Google Drive Sync:** "Connect Drive" flow completes — verify that the token refresh on 401 works correctly (test by waiting 61 minutes with Drive connected)
- [ ] **PWA Install:** App shows install prompt on Chrome — verify that iOS Safari shows the custom "Add to Home Screen" instruction banner (no `beforeinstallprompt` fires on iOS)
- [ ] **JSON Export/Import:** Round-trip works on same version — verify that a backup from version 1 imports correctly after a schema migration to version 2
- [ ] **Encrypted Export:** File downloads — verify decryption with wrong password shows a clear error, not a silent corrupt import
- [ ] **IndexedDB Persistence:** Works on Chrome — verify `navigator.storage.persist()` was called and granted; verify on Safari that the 7-day warning is shown
- [ ] **Recurring Transactions:** Monthly templates apply — verify quarterly and annual frequencies calculate the correct next-due date across year boundaries
- [ ] **Category Delete:** Category removed from list — verify that existing transactions referencing the deleted category do not break rendering (category name should show as "Deleted" or similar fallback)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Safari ITP evicts IndexedDB | HIGH | Restore from last JSON export; if no export, data is gone — communicate this clearly; add export reminder to prevent recurrence |
| Dexie schema upgrade blocked (tabs open) | LOW | Show "please close other tabs and reload" message; provide a force-reload button that calls `window.location.reload(true)` |
| Dexie version downgrade (rollback deployment) | HIGH | Cannot open DB — must increment version with no-op migration; document: never decrement version numbers |
| Floating-point accumulated error in stored data | MEDIUM | Re-run aggregation queries fresh from DB each time (do not store computed totals); rounding errors in display only, not in stored pence values |
| PDF parser breaks after bank format change | LOW | Fallback to manual column-mapping UI; update parser module with new fixture PDF; no data corruption risk |
| Import merges instead of replaces (existing bug) | MEDIUM | Detect duplicate records on import using a hash of (date + amount + description); offer dedup after import |
| Google Drive token expired mid-operation | LOW | Catch 401; re-trigger token flow; retry failed operation; show spinner not error |
| Plotly.js fails to load (CDN down, offline) | LOW | Catch script load error; show "Charts unavailable offline — data is safe" message; PWA should cache Plotly in service worker |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Floating-point money arithmetic | Foundation: Data layer and Money utility | Unit test: `money.add(0.1, 0.2)` equals `0.30` exactly; dashboard totals match manual calculation |
| Dexie schema migration/blocking | Foundation: DB schema and migrations | Test: open two tabs, deploy version bump, verify toast appears and old tab auto-closes |
| Safari ITP eviction | Foundation: Storage persistence + onboarding | Test: `navigator.storage.persisted()` returns `true` after onboarding; Safari storage warning visible |
| UK bank PDF format fragility | PDF import phase | Test: fixture PDFs for all 5 banks parse with >95% transaction accuracy; fallback UI works for unknown format |
| Google Drive OAuth scope/origin | Google Drive sync phase | Test: all origins registered; `drive.file` scope only; 401 refresh cycle works; no scary Google warning |
| Debt simulation edge cases | Debt calculation phase | Unit tests: zero-balance termination, capped final payment, divergent debt flagged as "cannot pay off" |
| Stored XSS via innerHTML | Foundation: Component architecture | Code review: no `innerHTML` used for user-supplied data; DOMPurify installed and used where innerHTML is unavoidable |
| Import merges instead of replaces | Data management phase | Integration test: import after existing data shows Replace/Merge choice; Replace produces clean state |
| Plotly.js bundle size | Build/PWA phase | Bundle audit: Plotly partial bundle used; service worker caches Plotly; offline chart load verified |
| PWA install on iOS | PWA phase | Manual test: iOS Safari shows custom "Add to Home Screen" banner; Android Chrome shows native prompt |
| Token expiry on Google Drive | Google Drive sync phase | Timed test: wait 61 min with Drive connected; trigger save; verify silent re-auth succeeds |
| Category delete leaves orphans | Category management phase | Integration test: delete category; transactions referencing it display fallback label, not crash |

---

## Sources

- Dexie.js version upgrade documentation: https://dexie.org/docs/Version/Version.upgrade()
- Dexie.js versionchange event: https://dexie.org/docs/Dexie/Dexie.on.versionchange
- Dexie.js blocked event: https://dexie.org/docs/Dexie/Dexie.on.blocked
- Dexie.js issue #1599 (version downgrade on rollback): https://github.com/dexie/Dexie.js/issues/1599
- MDN Storage quotas and eviction criteria: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- WebKit ITP storage policy update: https://webkit.org/blog/14403/updates-to-storage-policy/
- IndexedDB pain points (community): https://gist.github.com/pesterhazy/4de96193af89a6dd5ce682ce2adff49a
- IndexedDB max storage limits: https://rxdb.info/articles/indexeddb-max-storage-limit.html
- Google OAuth 2.0 implicit flow (current docs, being deprecated): https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
- Google Drive API scopes: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Google Drive Picker overview: https://developers.google.com/workspace/drive/picker/guides/overview
- OAuth 2.1 implicit flow removal: https://oauth.net/2/grant-types/implicit/
- Google OIDC PKCE client_secret inconsistency (2025): https://ktaka.blog.ccmp.jp/2025/07/oogle-oauth2-and-pkce-understanding.html
- JavaScript floating-point money calculations: https://dev.to/benjamin_renoux/financial-precision-in-javascript-handle-money-without-losing-a-cent-1chc
- currency.js library: https://currency.js.org/
- Honeybadger: Currency calculations in JavaScript: https://www.honeybadger.io/blog/currency-money-calculations-in-javascript/
- UK credit card minimum payments (FCA rules): https://www.experian.co.uk/consumer/credit-cards/guides/minimum-payment-credit-card.html
- FCA CONC 6/7 (minimum payment regulation PDF): https://www.handbook.fca.org.uk/handbook/CONC/6/7.pdf
- Debt Camel — minimum payment trap (UK): https://debtcamel.co.uk/credit-card-minimum-payment/
- UK bank PDF format fragility (LLM parsing article): https://medium.com/@mahmudulhoque/stop-writing-bank-statement-parsers-use-llms-instead-50902360a604
- Plotly.js bundle size issues: https://community.plotly.com/t/plotly-js-size-is-huge-3mb-in-production-build/45407
- PWA caching strategy pitfalls (MDN): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching
- PWA on iOS limitations 2025: https://brainhub.eu/library/pwa-on-ios
- iOS beforeinstallprompt workarounds: https://www.tutorialpedia.org/blog/install-to-home-screen-on-ios-for-pwa-enabled-app/
- Existing codebase concerns and bugs: `.planning/codebase/CONCERNS.md` (internal)

---
*Pitfalls research for: browser-only personal finance PWA (UK, GBP, IndexedDB, PDF import, Google Drive sync)*
*Researched: 2026-02-28*
