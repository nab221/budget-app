# Requirements: Budget App

**Defined:** 2026-02-28
**Core Value:** A clear, reliable view of where the money goes each month — all in one place, accessible on any device, with no backend dependency.

## v1 Requirements

### Foundation

- [x] **FOUND-01**: App uses pence-integer arithmetic for all money calculations (no float rounding errors in debt simulations)
- [x] **FOUND-02**: Dexie schema includes versioned migrations with versionchange and blocked handlers (prevents tab deadlock and data loss)
- [x] **FOUND-03**: App calls storage.persist() at first load and shows export reminder if permission denied (prevents Safari ITP data loss after 7 days)
- [x] **FOUND-04**: All user-generated text rendered with textContent or DOMPurify — no innerHTML with unsanitised data (fixes XSS vulnerability)

### Categories

- [x] **CAT-01**: User can view default seeded categories for Fixed and Variable spending
- [x] **CAT-02**: User can add a custom category to Fixed or Variable group
- [x] **CAT-03**: User can delete a category (with warning if used by existing transactions)
- [x] **CAT-04**: Category dropdowns in all entry forms reflect current category list

### Income

- [x] **INC-01**: User can log an income entry with date (defaulting to today), source, and amount
- [x] **INC-02**: User can edit an existing income entry
- [x] **INC-03**: User can delete an income entry
- [x] **INC-04**: User can view all income entries filtered by month

### Fixed Spending

- [x] **FIXED-01**: User can log a fixed spend with date (defaulting to today), category, label, amount, and paid/pending status
- [x] **FIXED-02**: User can edit a fixed spend entry
- [x] **FIXED-03**: User can delete a fixed spend entry
- [x] **FIXED-04**: User can view fixed spends filtered by month

### Variable Spending

- [x] **VAR-01**: User can log a variable spend with date (defaulting to today), category, note, and amount
- [x] **VAR-02**: User can edit a variable spend entry
- [x] **VAR-03**: User can delete a variable spend entry
- [x] **VAR-04**: User can view variable spends filtered by month

### Subscriptions

- [x] **SUB-01**: User can add a subscription with name, amount, frequency (monthly/quarterly/annual), next date, and payment method
- [x] **SUB-02**: Subscription list shows monthly-equivalent cost for quarterly and annual items
- [x] **SUB-03**: User can edit a subscription entry
- [x] **SUB-04**: User can delete a subscription entry

### Recurring Templates

- [x] **REC-01**: User can create a recurring transaction template with name, amount, category, and frequency (monthly/quarterly/annual)
- [x] **REC-02**: App prompts user to confirm due recurring transactions at the start of a new period
- [x] **REC-03**: User can accept a prompted recurring transaction (creates the entry) or dismiss it
- [x] **REC-04**: User can edit or delete a recurring template

### Debt Tracker

- [x] **DEBT-01**: User can add a debt with name, type (credit card/loan/mortgage), credit limit, APR %, and minimum payment rule
- [x] **DEBT-02**: App calculates minimum payment using a single shared calcMinPayment() function with UK rules: max(1% balance + interest, 2.25% balance, £5 floor) — overridable per card
- [x] **DEBT-03**: Debt list shows current balance, credit utilisation %, and calculated minimum payment
- [x] **DEBT-04**: User can log a monthly statement for a debt (opening balance, purchases, payments, interest, fees, closing balance)
- [x] **DEBT-05**: Statement history is sorted chronologically (not lexicographically)
- [x] **DEBT-06**: User can edit or delete a debt entry

### Payoff Planner

- [x] **PAY-01**: User can view Avalanche (highest APR first) payoff simulation with months to clear, total interest, total paid
- [x] **PAY-02**: User can view Snowball (smallest balance first) payoff simulation with the same metrics
- [x] **PAY-03**: User can view minimum-payments-only baseline side-by-side with Avalanche and Snowball
- [x] **PAY-04**: User can enter an extra monthly payment amount and instantly see updated time/interest savings for each strategy
- [x] **PAY-05**: Payoff simulation uses the same calcMinPayment() as the debt tracker (no diverging logic)

### Balance-Transfer Modelling

- [x] **BT-01**: User can model a balance transfer by selecting a source debt, entering a 0% promotional period (months), transfer fee %, and optional fee cap
- [x] **BT-02**: App shows total cost (fee + any remaining interest after promo period) vs keeping current debt
- [x] **BT-03**: App shows recommended minimum monthly payment to clear balance within the 0% window

### Assets

- [x] **ASSET-01**: User can add an asset with name, value, and as-of date
- [x] **ASSET-02**: User can edit or delete an asset entry
- [x] **ASSET-03**: Asset values are included in net worth calculation on the dashboard

### Dashboard

- [x] **DASH-01**: Dashboard shows 9 summary cards: total income, total fixed expenses, total variable expenses, net position, total subscriptions, total debt, total assets, net worth, fixed-to-income ratio
- [x] **DASH-02**: All cards react to a month/period filter
- [x] **DASH-03**: Dashboard shows a debt-free date countdown based on the selected payoff strategy
- [x] **DASH-04**: Dashboard shows budget target progress bars per spending category (actual vs limit)
- [x] **DASH-05**: Dashboard shows a net worth over time chart using monthly snapshots

### Charts

- [x] **CHART-01**: User can view a monthly spending trends chart (income vs fixed vs variable bar/line — Chart.js)
- [x] **CHART-02**: User can view a debt payoff timeline chart (balance projection over time for each debt)

### Theme

- [x] **THEME-01**: User can toggle between dark and light theme
- [x] **THEME-02**: Selected theme persists across sessions (localStorage)

### Data Safety

- [x] **DATA-01**: User can export all data as a JSON backup file
- [x] **DATA-02**: User can import a JSON backup (replaces existing data, not merges — with confirmation prompt)
- [x] **DATA-03**: User can export an encrypted (password-protected) JSON backup using AES-GCM via SubtleCrypto
- [x] **DATA-04**: User can import an encrypted backup by entering the password
- [x] **DATA-05**: Reset button requires explicit typed confirmation before deleting all data

### Cloud Backup

- [x] **CLOUD-01**: User can connect a Microsoft OneDrive account (MSAL.js PKCE, no server required) and save their data file to OneDrive
- [x] **CLOUD-02**: User can load their data file from OneDrive to restore or sync across devices
- [x] **CLOUD-03**: User can connect a Google Drive account and save/load their data file (GIS token + Drive v3 appDataFolder)
- [x] **CLOUD-04**: Connected cloud account preference persists in localStorage; user can disconnect at any time

### PDF Import

- [x] **PDF-01**: User can upload a PDF bank statement and have the app attempt automatic parsing (Barclays, HSBC, NatWest, Lloyds, Santander)
- [x] **PDF-02**: If auto-parse succeeds, user sees a preview of detected transactions (date, description, amount) and can confirm or deselect individual rows before importing
- [x] **PDF-03**: If auto-parse fails or user selects manual mode, user can map PDF columns (date, description, amount, debit/credit) to fields
- [x] **PDF-04**: App clearly informs user if the PDF is image/scanned (not parseable) with guidance to use manual entry instead
- [x] **PDF-05**: Imported transactions are added to the appropriate tab (income or variable spending) based on user selection

### Income & Expenses Refinement

- [ ] **INC-05**: Income tab shows last 3 months of history for trend visibility
- [ ] **EXP-01**: Consolidate "Fixed", "Variable", and "Subscriptions" into "Recurrent" and "One-off" expense tabs
- [ ] **EXP-02**: Support "cancelable" labels for recurrent items to distinguish optional spending from obligations
- [ ] **EXP-03**: Support varying recurrent expenses (10-month cycles like Council Tax, quarterly like TV License)
- [ ] **EXP-04**: Expense list shows labels for things that can be cancelled

### Tax-free Childcare Tracking

- [ ] **CHILD-01**: User can track 2 independent Tax-free Childcare accounts with balances
- [ ] **CHILD-02**: App calculates and displays government top-up (20%) for every deposit
- [ ] **CHILD-03**: User can log weekly/monthly outgoings from childcare accounts
- [ ] **CHILD-04**: App suggests top-up values to cover predicted future childcare expenses
- [ ] **CHILD-05**: Dashboard shows current balances and "missing" funds needed to cover predicted outgoings

### Advanced Debt & Payoff

- [ ] **DEBT-07**: User can edit existing debt details (Name, Credit Limit, APR)
- [ ] **DEBT-08**: User can track 0% promotional APR period end dates and post-promo APR
- [ ] **DEBT-09**: Dashboard shows "Debts Repayment" panel with total monthly minimum payments and its impact on net position
- [ ] **PAY-06**: Payoff Planner supports interactive strategy selection (Avalanche/Snowball/Min Only) with corresponding chart/detail updates
- [ ] **PAY-07**: Payoff Planner shows detailed payment breakdown (exactly how much goes to each debt for the selected strategy)
- [ ] **PAY-08**: Payoff simulation correctly accounts for 0% promotional periods and subsequent APR jumps

### PWA

- [x] **PWA-01**: App has a valid PWA manifest (name, icons, theme colour, display: standalone)
- [x] **PWA-02**: App works fully offline after first load (service worker precaches all assets)
- ~~**PWA-03**: App shows a custom "Add to Home Screen" banner on iOS Safari (since beforeinstallprompt does not fire on iOS)~~ — **Deferred** (explicitly descoped in 04-CONTEXT.md; beforeinstallprompt works on Android/Windows/Chrome which covers the primary target platforms)
- [x] **PWA-04**: App prompts user to refresh when a new version is available (service worker update flow)

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

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Completed |
| FOUND-02 | Phase 1 | Completed |
| FOUND-03 | Phase 1 | Completed |
| FOUND-04 | Phase 1 | Completed |
| CAT-01 | Phase 1 | Completed |
| CAT-02 | Phase 1 | Completed |
| CAT-03 | Phase 1 | Completed |
| CAT-04 | Phase 1 | Completed |
| THEME-01 | Phase 1 | Completed |
| THEME-02 | Phase 1 | Completed |
| INC-01 | Phase 2 | Completed |
| INC-02 | Phase 2 | Completed |
| INC-03 | Phase 2 | Completed |
| INC-04 | Phase 2 | Completed |
| FIXED-01 | Phase 2 | Completed |
| FIXED-02 | Phase 2 | Completed |
| FIXED-03 | Phase 2 | Completed |
| FIXED-04 | Phase 2 | Completed |
| VAR-01 | Phase 2 | Completed |
| VAR-02 | Phase 2 | Completed |
| VAR-03 | Phase 2 | Completed |
| VAR-04 | Phase 2 | Completed |
| SUB-01 | Phase 2 | Completed |
| SUB-02 | Phase 2 | Completed |
| SUB-03 | Phase 2 | Completed |
| SUB-04 | Phase 2 | Completed |
| REC-01 | Phase 2 | Completed |
| REC-02 | Phase 2 | Completed |
| REC-03 | Phase 2 | Completed |
| REC-04 | Phase 2 | Completed |
| DEBT-01 | Phase 2 | Completed |
| DEBT-02 | Phase 2 | Completed |
| DEBT-03 | Phase 2 | Completed |
| DEBT-04 | Phase 2 | Completed |
| DEBT-05 | Phase 2 | Completed |
| DEBT-06 | Phase 2 | Completed |
| ASSET-01 | Phase 2 | Completed |
| ASSET-02 | Phase 2 | Completed |
| ASSET-03 | Phase 2 | Completed |
| DATA-01 | Phase 2 | Completed |
| DATA-02 | Phase 2 | Completed |
| DATA-03 | Phase 2 | Completed |
| DATA-04 | Phase 2 | Completed |
| DATA-05 | Phase 2 | Completed |
| PAY-01 | Phase 3 | Completed |
| PAY-02 | Phase 3 | Completed |
| PAY-03 | Phase 3 | Completed |
| PAY-04 | Phase 3 | Completed |
| PAY-05 | Phase 3 | Completed |
| BT-01 | Phase 3 | Completed |
| BT-02 | Phase 3 | Completed |
| BT-03 | Phase 3 | Completed |
| DASH-01 | Phase 3 | Completed |
| DASH-02 | Phase 3 | Completed |
| DASH-03 | Phase 3 | Completed |
| DASH-04 | Phase 3 | Completed |
| DASH-05 | Phase 3 | Completed |
| CHART-01 | Phase 4 | Complete |
| CHART-02 | Phase 4 | Complete |
| PWA-01 | Phase 4 | Complete |
| PWA-02 | Phase 4 | Complete |
| PWA-03 | Deferred | Out of Scope (v1) |
| PWA-04 | Phase 4 | Complete |
| PDF-01 | Phase 5 | Completed |
| PDF-02 | Phase 5 | Completed |
| PDF-03 | Phase 5 | Completed |
| PDF-04 | Phase 5 | Completed |
| PDF-05 | Phase 5 | Completed |
| CLOUD-01 | Phase 6 | Complete |
| CLOUD-02 | Phase 6 | Complete |
| CLOUD-03 | Phase 6 | Complete |
| CLOUD-04 | Phase 6 | Complete |
| INC-05 | Phase 8 | Pending |
| EXP-01 | Phase 8 | Pending |
| EXP-02 | Phase 8 | Pending |
| EXP-03 | Phase 8 | Pending |
| EXP-04 | Phase 8 | Pending |
| CHILD-01 | Phase 9 | Pending |
| CHILD-02 | Phase 9 | Pending |
| CHILD-03 | Phase 9 | Pending |
| CHILD-04 | Phase 9 | Pending |
| CHILD-05 | Phase 9 | Pending |
| DEBT-07 | Phase 10 | Pending |
| DEBT-08 | Phase 10 | Pending |
| DEBT-09 | Phase 10 | Pending |
| PAY-06 | Phase 10 | Pending |
| PAY-07 | Phase 10 | Pending |
| PAY-08 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 88 total (72 original + 16 new)
- Mapped to phases: 88
- Unmapped: 0

| Phase | Requirements |
|-------|-------------|
| Phase 1: Foundation | FOUND-01 to FOUND-04, CAT-01 to CAT-04, THEME-01 to THEME-02 (10 total) |
| Phase 2: Core Budget Features | INC-01 to INC-04, FIXED-01 to FIXED-04, VAR-01 to VAR-04, SUB-01 to SUB-04, REC-01 to REC-04, DEBT-01 to DEBT-06, ASSET-01 to ASSET-03, DATA-01 to DATA-05 (34 total) |
| Phase 3: Dashboard, Payoff Planner, Budget Targets | PAY-01 to PAY-05, BT-01 to BT-03, DASH-01 to DASH-05 (13 total) |
| Phase 4: PWA and Charts | CHART-01 to CHART-02, PWA-01 to PWA-04 (6 total) |
| Phase 5: PDF Bank Statement Import | PDF-01 to PDF-05 (5 total) |
| Phase 6: Cloud Backup | CLOUD-01 to CLOUD-04 (4 total) |
| Phase 8: Income & Expenses Refinement | INC-05, EXP-01 to EXP-04 (5 total) |
| Phase 9: Tax-free Childcare Tracker | CHILD-01 to CHILD-05 (5 total) |
| Phase 10: Advanced Debt & Payoff | DEBT-07 to DEBT-09, PAY-06 to PAY-08 (6 total) |

---
*Requirements defined: 2026-02-28*
*Last updated: 2026-03-01 — v1.0 milestone signed off. PWA-01, PWA-02, PWA-04, CHART-01, CHART-02, CLOUD-01 to CLOUD-04 human-verified PASS. Cloud backup OAuth classified as user setup requirement. Phase 7 complete.*
