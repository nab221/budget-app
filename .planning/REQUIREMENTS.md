# Requirements: Budget App

**Defined:** 2026-02-28
**Core Value:** A clear, reliable view of where the money goes each month — all in one place, accessible on any device, with no backend dependency.

## v1 Requirements

### Foundation

- [ ] **FOUND-01**: App uses pence-integer arithmetic for all money calculations (no float rounding errors in debt simulations)
- [ ] **FOUND-02**: Dexie schema includes versioned migrations with versionchange and blocked handlers (prevents tab deadlock and data loss)
- [ ] **FOUND-03**: App calls storage.persist() at first load and shows export reminder if permission denied (prevents Safari ITP data loss after 7 days)
- [ ] **FOUND-04**: All user-generated text rendered with textContent or DOMPurify — no innerHTML with unsanitised data (fixes XSS vulnerability)

### Categories

- [ ] **CAT-01**: User can view default seeded categories for Fixed and Variable spending
- [ ] **CAT-02**: User can add a custom category to Fixed or Variable group
- [ ] **CAT-03**: User can delete a category (with warning if used by existing transactions)
- [ ] **CAT-04**: Category dropdowns in all entry forms reflect current category list

### Income

- [ ] **INC-01**: User can log an income entry with date (defaulting to today), source, and amount
- [ ] **INC-02**: User can edit an existing income entry
- [ ] **INC-03**: User can delete an income entry
- [ ] **INC-04**: User can view all income entries filtered by month

### Fixed Spending

- [ ] **FIXED-01**: User can log a fixed spend with date (defaulting to today), category, label, amount, and paid/pending status
- [ ] **FIXED-02**: User can edit a fixed spend entry
- [ ] **FIXED-03**: User can delete a fixed spend entry
- [ ] **FIXED-04**: User can view fixed spends filtered by month

### Variable Spending

- [ ] **VAR-01**: User can log a variable spend with date (defaulting to today), category, note, and amount
- [ ] **VAR-02**: User can edit a variable spend entry
- [ ] **VAR-03**: User can delete a variable spend entry
- [ ] **VAR-04**: User can view variable spends filtered by month

### Subscriptions

- [ ] **SUB-01**: User can add a subscription with name, amount, frequency (monthly/quarterly/annual), next date, and payment method
- [ ] **SUB-02**: Subscription list shows monthly-equivalent cost for quarterly and annual items
- [ ] **SUB-03**: User can edit a subscription entry
- [ ] **SUB-04**: User can delete a subscription entry

### Recurring Templates

- [ ] **REC-01**: User can create a recurring transaction template with name, amount, category, and frequency (monthly/quarterly/annual)
- [ ] **REC-02**: App prompts user to confirm due recurring transactions at the start of a new period
- [ ] **REC-03**: User can accept a prompted recurring transaction (creates the entry) or dismiss it
- [ ] **REC-04**: User can edit or delete a recurring template

### Debt Tracker

- [ ] **DEBT-01**: User can add a debt with name, type (credit card/loan/mortgage), credit limit, APR %, and minimum payment rule
- [ ] **DEBT-02**: App calculates minimum payment using a single shared calcMinPayment() function with UK rules: max(1% balance + interest, 2.25% balance, £5 floor) — overridable per card
- [ ] **DEBT-03**: Debt list shows current balance, credit utilisation %, and calculated minimum payment
- [ ] **DEBT-04**: User can log a monthly statement for a debt (opening balance, purchases, payments, interest, fees, closing balance)
- [ ] **DEBT-05**: Statement history is sorted chronologically (not lexicographically)
- [ ] **DEBT-06**: User can edit or delete a debt entry

### Payoff Planner

- [ ] **PAY-01**: User can view Avalanche (highest APR first) payoff simulation with months to clear, total interest, total paid
- [ ] **PAY-02**: User can view Snowball (smallest balance first) payoff simulation with the same metrics
- [ ] **PAY-03**: User can view minimum-payments-only baseline side-by-side with Avalanche and Snowball
- [ ] **PAY-04**: User can enter an extra monthly payment amount and instantly see updated time/interest savings for each strategy
- [ ] **PAY-05**: Payoff simulation uses the same calcMinPayment() as the debt tracker (no diverging logic)

### Balance-Transfer Modelling

- [ ] **BT-01**: User can model a balance transfer by selecting a source debt, entering a 0% promotional period (months), transfer fee %, and optional fee cap
- [ ] **BT-02**: App shows total cost (fee + any remaining interest after promo period) vs keeping current debt
- [ ] **BT-03**: App shows recommended minimum monthly payment to clear balance within the 0% window

### Assets

- [ ] **ASSET-01**: User can add an asset with name, value, and as-of date
- [ ] **ASSET-02**: User can edit or delete an asset entry
- [ ] **ASSET-03**: Asset values are included in net worth calculation on the dashboard

### Dashboard

- [ ] **DASH-01**: Dashboard shows 9 summary cards: total income, total fixed expenses, total variable expenses, net position, total subscriptions, total debt, total assets, net worth, fixed-to-income ratio
- [ ] **DASH-02**: All cards react to a month/period filter
- [ ] **DASH-03**: Dashboard shows a debt-free date countdown based on the selected payoff strategy
- [ ] **DASH-04**: Dashboard shows budget target progress bars per spending category (actual vs limit)
- [ ] **DASH-05**: Dashboard shows a net worth over time chart using monthly snapshots

### Charts

- [ ] **CHART-01**: User can view a monthly spending trends chart (income vs fixed vs variable bar/line — Chart.js)
- [ ] **CHART-02**: User can view a debt payoff timeline chart (balance projection over time for each debt)

### Theme

- [ ] **THEME-01**: User can toggle between dark and light theme
- [ ] **THEME-02**: Selected theme persists across sessions (localStorage)

### Data Safety

- [ ] **DATA-01**: User can export all data as a JSON backup file
- [ ] **DATA-02**: User can import a JSON backup (replaces existing data, not merges — with confirmation prompt)
- [ ] **DATA-03**: User can export an encrypted (password-protected) JSON backup using AES-GCM via SubtleCrypto
- [ ] **DATA-04**: User can import an encrypted backup by entering the password
- [ ] **DATA-05**: Reset button requires explicit typed confirmation before deleting all data

### Cloud Backup

- [ ] **CLOUD-01**: User can connect a Dropbox account (PKCE OAuth, no server required) and save their data file to Dropbox
- [ ] **CLOUD-02**: User can load their data file from Dropbox to restore or sync across devices
- [ ] **CLOUD-03**: User can connect a Google Drive account and save/load their data file (GIS + gapi OAuth)
- [ ] **CLOUD-04**: Connected cloud account preference persists in localStorage; user can disconnect at any time

### PDF Import

- [ ] **PDF-01**: User can upload a PDF bank statement and have the app attempt automatic parsing (Barclays, HSBC, NatWest, Lloyds, Santander)
- [ ] **PDF-02**: If auto-parse succeeds, user sees a preview of detected transactions (date, description, amount) and can confirm or deselect individual rows before importing
- [ ] **PDF-03**: If auto-parse fails or user selects manual mode, user can map PDF columns (date, description, amount, debit/credit) to fields
- [ ] **PDF-04**: App clearly informs user if the PDF is image/scanned (not parseable) with guidance to use manual entry instead
- [ ] **PDF-05**: Imported transactions are added to the appropriate tab (income or variable spending) based on user selection

### PWA

- [ ] **PWA-01**: App has a valid PWA manifest (name, icons, theme colour, display: standalone)
- [ ] **PWA-02**: App works fully offline after first load (service worker precaches all assets)
- [ ] **PWA-03**: App shows a custom "Add to Home Screen" banner on iOS Safari (since beforeinstallprompt does not fire on iOS)
- [ ] **PWA-04**: App prompts user to refresh when a new version is available (service worker update flow)

---

## v2 Requirements

### Multi-currency

- **CURR-01**: User can add a foreign currency account (EUR, USD, BRL, and others) with a name and currency
- **CURR-02**: Foreign currency accounts are tracked separately from the main GBP budget
- **CURR-03**: Foreign currency transactions are displayed in their own currency — not converted to GBP or included in main budget totals
- **CURR-04**: User can view a separate foreign accounts summary tab

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time cloud sync | Adds backend dependency; Google Drive/Dropbox manual backup chosen instead |
| Multi-user accounts / login | Personal tool; no authentication needed |
| Native iOS/Android app | PWA covers mobile use case |
| Open Banking / bank feeds | Requires backend, FCA authorisation; out of scope for local-first app |
| AI transaction categorisation | Backend/API dependency; manual categories sufficient |
| Mixing foreign currencies into GBP main budget | User confirmed: foreign accounts are incidental, not part of main budget |
| CSV/Excel import | PDF import covers bank statements; CSV adds complexity for minimal extra value |

---

## Traceability

*Populated during roadmap creation.*

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 to FOUND-04 | Phase 1 | Pending |
| CAT-01 to CAT-04 | Phase 1 | Pending |
| INC-01 to INC-04 | Phase 2 | Pending |
| FIXED-01 to FIXED-04 | Phase 2 | Pending |
| VAR-01 to VAR-04 | Phase 2 | Pending |
| SUB-01 to SUB-04 | Phase 2 | Pending |
| REC-01 to REC-04 | Phase 2 | Pending |
| DEBT-01 to DEBT-06 | Phase 2 | Pending |
| PAY-01 to PAY-05 | Phase 3 | Pending |
| BT-01 to BT-03 | Phase 3 | Pending |
| ASSET-01 to ASSET-03 | Phase 2 | Pending |
| DASH-01 to DASH-05 | Phase 3 | Pending |
| CHART-01 to CHART-02 | Phase 4 | Pending |
| THEME-01 to THEME-02 | Phase 4 | Pending |
| DATA-01 to DATA-05 | Phase 2 | Pending |
| CLOUD-01 to CLOUD-04 | Phase 6 | Pending |
| PDF-01 to PDF-05 | Phase 5 | Pending |
| PWA-01 to PWA-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 63 total
- Mapped to phases: 63
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-02-28 after initial definition*
