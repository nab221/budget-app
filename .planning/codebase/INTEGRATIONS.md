# External Integrations

**Analysis Date:** 2026-02-28

## APIs & External Services

**CDN:**
- jsDelivr (cdn.jsdelivr.net)
  - Purpose: Host Dexie.js library
  - URL: `https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.js`
  - Size: ~45 KB (cached by browser after first load)
  - Fallback: Optional - user can download and host locally

**No other external APIs:**
- No backend server integration
- No third-party API calls
- No authentication services
- Fully self-contained application

## Data Storage

**Primary Database:**
- Browser IndexedDB (built-in Web API)
  - Database name: `BudgetConsoleDB`
  - Capacity: Hundreds of MB
  - Persistence: Browser-level (cleared with site data)

**Tables:**
- `income` - Salary and income records
- `fixedSpends` - Recurring bills with paid/pending status
- `variableSpends` - Day-to-day expenses
- `subscriptions` - Monthly/annual subscriptions
- `debts` - Credit cards, loans, mortgages with APR tracking
- `statements` - Monthly debt statements (balance snapshots)
- `assets` - House, investments, savings values
- `categories` - User-defined spending categories (fixed/variable)

**File Storage:**
- Local filesystem only (no cloud sync)
- HTML file location is the single source of truth

**Caching:**
- Browser cache for CDN-loaded Dexie.js
- IndexedDB provides in-browser caching

## Authentication & Identity

**Auth Provider:**
- None - Application is client-side only
- No user accounts or authentication required
- No multi-device sync
- Data isolation per browser/profile

**Access Control:**
- None - All data stored locally
- Export/import handled client-side
- Password protection: Not implemented (roadmap item in README line 88)

## Monitoring & Observability

**Error Tracking:**
- None - No error reporting service
- Browser console logs available for debugging

**Logs:**
- Application has no logging system
- Relies on browser DevTools for debugging

**Usage Tracking:**
- None - No analytics or telemetry

## CI/CD & Deployment

**Hosting:**
- Static file hosting only (any web server)
- Suggestions: GitHub Pages, Netlify, Vercel, traditional web server
- No backend required

**CI Pipeline:**
- None detected - Single HTML file, no build process

**Deployment:**
- Copy `budget-app.html` to hosting location
- Ensure `.` is served with correct MIME type (`text/html`)

## Environment Configuration

**Required env vars:**
- None - Application has no environment variables

**Secrets location:**
- No secrets management needed
- All data stored locally in browser
- Private to browser profile

## Webhooks & Callbacks

**Incoming:**
- None - No webhook endpoints

**Outgoing:**
- None - No external API calls

## Browser APIs Used

**Core Web APIs:**
- IndexedDB (data persistence)
- File API (export/import)
- URL API (blob URL creation for downloads)
- Date API (date formatting and calculations)
- localStorage is NOT used

**Optional (for offline mode):**
- Service Worker (PWA) - Planned but not implemented
- Application Cache - Not used

## Known Limitations & Future Integrations

**Currently Missing:**
- CSV/Excel import from bank statements (roadmap)
- Multi-currency support (GBP/BRL planned)
- Encrypted export (password-protected JSON)
- PWA manifest for desktop/mobile installation
- Dark/Light theme toggle
- Recurring transaction templates

**No Third-Party Integrations Planned:**
- No planned bank API integrations
- No payment service integrations
- No budgeting app sync
- Privacy-first design: intentionally local-only

## Data Privacy & Security Notes

**Data Residency:**
- All data stays in user's browser
- No server-side storage
- No data transmission to external services (except CDN load of Dexie.js)

**Backup Strategy:**
- User manual: Click "Export" to download JSON backup
- Recommended: Export regularly before clearing browser data
- Import: Click "Import" to restore from JSON file

**Security Considerations:**
- Password protection for exports: Not yet implemented
- Clear browser data wipes all records (no recovery)
- HTTPS recommended for deployed instances
- XSS protection: Limited (inline scripts, no CSP)

---

*Integration audit: 2026-02-28*
