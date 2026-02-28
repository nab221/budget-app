# Feature Research

**Domain:** Browser-based personal budget tracking PWA (UK-specific, local-first)
**Researched:** 2026-02-28
**Confidence:** MEDIUM — core feature categorisation is HIGH confidence from multiple sources; UK-specific rules are MEDIUM (FCA handbook confirmed); technical implementation details (encrypted export, Drive sync) are MEDIUM from official API docs.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Income tracking | Every budget tool starts here | LOW | Multiple income sources; monthly view |
| Fixed expense tracking | Rent, bills — non-negotiable | LOW | Label + amount + category + date |
| Variable expense tracking | Day-to-day spending | LOW | Same shape as fixed; separate tab for clarity |
| Category management | Without categories, reports are useless | LOW | Add/delete/seed defaults; user-defined |
| Monthly view / date filter | Budget is time-bounded | LOW | Anchor month selector; persist across tabs |
| Dashboard summary | "Where am I this month?" | MEDIUM | Income vs fixed vs variable; net position |
| JSON export / import | Data ownership and backup | LOW | Import must replace (not merge) existing data |
| Subscriptions tab | UK users track Netflix/Spotify/etc separately from bills | MEDIUM | Monthly-equivalent calculation for quarterly/annual subs |
| Net worth snapshot | Total assets minus total debts | LOW | Simple: sum asset values, sum debt balances |
| Credit/debt tracker | Any app tracking spending must also track debt | MEDIUM | UK minimum payment rules required (see below) |
| GBP as primary currency | UK context; all main budget in pounds | LOW | Hardcode GBP for main budget; no conversion needed |
| Responsive layout | Partner uses it too; must work on mobile | LOW | CSS responsive; no native app needed with PWA |
| Dark/light theme | Modern baseline expectation | LOW | CSS custom properties; toggle persisted to localStorage |
| Data persistence warning | IndexedDB can be wiped; user must know | LOW | Banner or onboarding note; "Export regularly" nudge |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| PDF bank statement import (UK banks) | Manual entry is the biggest friction point for UK users; no open banking here | HIGH | Auto-parse Barclays, HSBC, NatWest, Lloyds, Santander PDFs; manual column mapping fallback. PDF structure varies per bank and changes without notice. Use pdf.js for extraction; pattern-match known layouts. |
| Recurring transaction templates (monthly / quarterly / annual) | UK bills like TV Licence (£180/yr, payable quarterly) and council tax (10 monthly instalments) need flexible frequencies | MEDIUM | Templates generate entries each period. Must support: weekly, monthly, quarterly (e.g. every 3 months), annual. Quarterly is explicitly required for TV Licence. |
| Debt payoff planner (Avalanche + Snowball, side-by-side) | Saves real money; most UK-specific calculators treat overdraft EAR differently from standard APR | HIGH | Avalanche (highest APR first) vs Snowball (smallest balance first). Side-by-side comparison showing interest saved and debt-free date. UK overdraft EAR must not be treated as standard APR. |
| Balance-transfer modelling | 0% balance transfer deals are common UK debt strategy (Barclaycard, HSBC, TSB etc). Typical fee 0.75%–3.5% | MEDIUM | Inputs: transferred balance, transfer fee %, 0% period (months), revert APR. Output: effective cost, projected balance at end of 0% period, recommended action. |
| Budget targets per category with progress bars | Gives spending a goal, not just a tally | MEDIUM | Per-category monthly target; visual progress bar; over-budget alert. Requires category management already in place. |
| Spending trend charts (monthly) | Patterns invisible in tables become obvious in charts | MEDIUM | Plotly.js. Bar or line chart: income vs spend by month, last 12 months. |
| Debt payoff timeline chart | Motivation: seeing the line reach zero | MEDIUM | Line chart per debt; projected payoff date. Driven by payoff planner simulation data. |
| Net worth over time chart | Shows growth trajectory | LOW | Line chart; one data point per month from asset/debt snapshots. Requires snapshot-per-month storage (not just current values). |
| Multi-currency accounts (isolated, not mixed into GBP) | User holds EUR, USD, BRL accounts; needs to track them without polluting GBP budget | MEDIUM | Foreign accounts tracked separately in their own currency. No FX conversion. No mixing into main budget totals. Dashboard shows foreign accounts as a separate section. |
| Google Drive / Dropbox backup | Cross-device access without a backend; user already has Drive/Dropbox | HIGH | Google Drive: OAuth2 + Drive API (JavaScript browser SDK). Dropbox: Dropbox JavaScript SDK. Save/load a single JSON backup file. Requires OAuth app registration; adds external dependency but no server needed. |
| Encrypted export (password-protected JSON) | Financial data is sensitive; backup files should not be readable if leaked | MEDIUM | AES-256-GCM via Web Crypto API (native browser, no library needed). PBKDF2 key derivation from password. No plaintext JSON written to disk. Import prompts for password and decrypts before loading. |
| Debt-free date countdown on dashboard | Motivational; turns abstract payoff into a concrete date | LOW | Derived from payoff planner simulation. Refresh when debt data changes. |
| PWA install + offline | Must work offline after first load; installable on desktop and mobile | MEDIUM | Web App Manifest + Service Worker with cache-first strategy. Must work on Chrome, Edge, Firefox, Safari. Safari PWA support is partial (no push notifications, limited background sync) but install + offline works. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Open Banking / automatic bank sync | Removes manual entry friction | Requires FCA authorisation or third-party provider (e.g. TrueLayer, Plaid UK). Introduces a server backend, ongoing API costs, consent management, and data residency complexity. Defeats the local-first, no-backend constraint entirely. | PDF import (auto-parse UK bank statements) achieves 80% of the value with no backend dependency. |
| Real-time cloud sync (automatic background) | "Always up to date on all devices" | Conflict resolution across devices is hard. Requires either a backend or a CRDT library. Background sync on PWA is unreliable on iOS Safari. Budget data changes infrequently; real-time sync is overkill. | Manual Google Drive / Dropbox save/load covers the cross-device case without complexity. |
| AI spending categorisation | "Auto-sort my transactions" | Running an LLM requires a backend or expensive API calls. Client-side ML models large enough to be accurate are impractical in the browser. Adds ongoing cost and privacy risk. | Rule-based category mapping (learn from user's past assignments) + simple keyword matching achieves the core value. |
| Multi-user accounts with authentication | "My partner and I both edit" | Login systems require a backend, JWT handling, session management. Contradicts local-first architecture. | Partner is viewer only. PWA installable on partner's device; they open the same data (shared Drive backup). Read-only shared link is sufficient. |
| Native iOS / Android app | "I want it in the App Store" | Duplicates development; App Store review overhead; not needed when PWA covers install + offline. | PWA with manifest; Chrome/Edge "Add to Home Screen" on Android; Safari "Add to Home Screen" on iOS. |
| FX conversion in main budget | "Show my EUR account balance in GBP too" | Exchange rates fluctuate; stored GBP equivalents become stale; mixing creates misleading totals. | Keep foreign accounts in their native currency. Show separately. User can note approximate GBP value in account description if they want. |
| Investment/brokerage tracking | "Track my ISA performance" | Stock prices require API calls or manual updates. Portfolio tracking is a separate product category (Sharesight, Stockopedia). | Assets snapshot supports a line item "Stocks & Shares ISA — £12,000" without live tracking. |
| Automatic backup reminders / push notifications | "Remind me to back up" | PWA push notifications require a notification server (even for no-backend apps, a push service endpoint is needed). iOS Safari push PWA support is limited. | Show last-export date on dashboard. Nudge user if more than 30 days since last export. No push needed. |

---

## Feature Dependencies

```
[Category management]
    └──required by──> [Fixed expense tracking]
    └──required by──> [Variable expense tracking]
    └──required by──> [Budget targets per category]
    └──required by──> [PDF statement import] (categorisation of imported transactions)

[Income tracking]
    └──required by──> [Dashboard summary] (net position = income - expenses)

[Fixed + Variable expense tracking]
    └──required by──> [Dashboard summary]
    └──required by──> [Spending trend charts]
    └──required by──> [Budget targets per category]

[Credit/debt tracker]
    └──required by──> [Debt payoff planner]
    └──required by──> [Balance-transfer modelling]
    └──required by──> [Debt payoff timeline chart]
    └──required by──> [Debt-free date countdown]

[Debt payoff planner]
    └──required by──> [Debt payoff timeline chart]
    └──required by──> [Debt-free date countdown]
    └──enhances──> [Balance-transfer modelling] (show payoff impact after transfer)

[Assets snapshot]
    └──required by──> [Net worth snapshot]
    └──required by──> [Net worth over time chart]

[Net worth snapshot]
    └──required by──> [Net worth over time chart] (needs per-month historical values)

[JSON export / import]
    └──required by──> [Encrypted export] (encryption wraps the JSON export)
    └──required by──> [Google Drive / Dropbox backup] (saves the JSON file to cloud)

[Recurring transaction templates]
    └──enhances──> [Fixed expense tracking] (auto-generates recurring entries)
    └──enhances──> [Subscriptions tab] (quarterly/annual subs need frequency templates)

[PWA manifest]
    └──required by──> [Offline capability] (Service Worker caches app shell)

[Google Drive / Dropbox backup]
    └──conflicts with──> [Encrypted export as primary security] (both solve data safety; combine: encrypt then upload)
```

### Dependency Notes

- **Category management must be Phase 1**: Four other features depend on it. Build and seed defaults early.
- **Credit/debt tracker must precede payoff planner**: The planner simulates the debts; no debts = nothing to plan.
- **Assets snapshot + net worth**: Net worth over time requires storing a snapshot per month, not just current values. This is a schema decision that must be made at Phase 1 data model design.
- **Encrypted export wraps JSON export**: They are not separate features — implement JSON export first, then add an encryption layer on top.
- **Drive/Dropbox backup wraps JSON export**: Same pattern. Export produces the file; cloud save uploads it. Implement sequentially.
- **Payoff planner feeds multiple chart and dashboard features**: Build planner simulation logic as a pure function — no UI coupling — so charts and countdown can consume the same data.

---

## MVP Definition

### Launch With (v1 — core rebuild)

The goal of v1 is to replace the buggy prototype with a clean, reliable app that covers everything the current app tries to do, fixed.

- [x] Category management (add/delete/seed) — foundation for everything else
- [x] Income tracking — date defaults pre-populated
- [x] Fixed expense tracking — category dropdown resets correctly after custom entry
- [x] Variable expense tracking — same fixes as fixed
- [x] Subscriptions tab — monthly-equivalent calculation; quarterly/annual frequency
- [x] Credit/debt tracker — UK minimum payment rules (1% + interest/charges, or fixed floor £5–£25); single source of truth for calculation
- [x] Debt payoff planner — Avalanche + Snowball; side-by-side; UK overdraft EAR handled correctly
- [x] Assets snapshot — for net worth
- [x] Dashboard summary — income/fixed/variable/net position/subscriptions/total debt/total assets/net worth/fixed-to-income ratio
- [x] JSON export — replaces (not merges) on import; import confirmation dialog
- [x] Recurring transaction templates — monthly, quarterly, annual (TV Licence, council tax, etc.)
- [x] Budget targets per category — visual progress bars
- [x] Dark/light theme toggle
- [x] PWA manifest + Service Worker (offline, installable)
- [x] Modular ES6 structure (separate HTML/CSS/JS modules — prerequisite for maintainability)

### Add After v1 Core Works (v1.x)

- [ ] Charts: spending trends, debt payoff timeline, net worth over time (Plotly.js) — add after core data model is stable; charts are purely presentational
- [ ] PDF bank statement import — high value but high complexity; validate auto-parse against real PDFs from each bank
- [ ] Multi-currency accounts — schema addition; isolated from main budget
- [ ] Debt-free date countdown on dashboard — low effort once payoff planner exists
- [ ] Encrypted export — add encryption layer over existing JSON export
- [ ] Balance-transfer modelling — add to debt tracker after basic debt features are solid

### Future Consideration (v2+)

- [ ] Google Drive / Dropbox backup — requires OAuth app registration; adds external dependency; valuable for cross-device but not blocking for solo desktop use
- [ ] Statement history sorting fix (stable chronological sort) — already flagged as known bug; fix in v1 rebuild, not v2
- [ ] Net worth over time chart — requires per-month snapshot storage; design this into the schema at v1 even if chart comes later

---

## Feature Prioritisation Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Category management | HIGH | LOW | P1 |
| Income / fixed / variable tracking | HIGH | LOW | P1 |
| Credit/debt tracker (UK min payment) | HIGH | MEDIUM | P1 |
| Debt payoff planner | HIGH | HIGH | P1 |
| Dashboard summary | HIGH | MEDIUM | P1 |
| Recurring transaction templates | HIGH | MEDIUM | P1 |
| Budget targets per category | HIGH | MEDIUM | P1 |
| JSON export / import (replace, not merge) | HIGH | LOW | P1 |
| PWA manifest + offline | HIGH | MEDIUM | P1 |
| Dark/light theme | MEDIUM | LOW | P1 |
| Spending trend charts | HIGH | MEDIUM | P2 |
| Debt payoff timeline chart | HIGH | LOW | P2 |
| Net worth over time chart | MEDIUM | MEDIUM | P2 |
| PDF bank statement import | HIGH | HIGH | P2 |
| Multi-currency accounts (isolated) | MEDIUM | MEDIUM | P2 |
| Debt-free date countdown | MEDIUM | LOW | P2 |
| Encrypted export | MEDIUM | MEDIUM | P2 |
| Balance-transfer modelling | MEDIUM | MEDIUM | P2 |
| Google Drive / Dropbox backup | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch (v1)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+)

---

## UK-Specific Requirements Detail

### Credit Card Minimum Payment Rules (MEDIUM confidence — FCA CONC 6.7 + Experian UK)

UK regulations require minimum payments cover at least **1% of outstanding balance**. In practice, UK card issuers use one of these formulas:

| Formula | Description | When Used |
|---------|-------------|-----------|
| `pct_of_balance` | 1%–2.5% of balance | Simple cards; balance-only payments |
| `pct_plus_interest` | 1%–2.5% of balance + that month's interest + fees | Most major UK cards (Barclays, HSBC, etc.) |
| `fixed_floor` | Greater of formula above or £5–£25 | Applied when calculated payment is very small |
| `interest_only` | Pay interest only; no principal reduction | Some legacy agreements; persistent debt risk |

The FCA persistent debt rules (CONC 6.7) require lenders to intervene if a customer pays more in interest than principal over 18 months. The budget app's minimum payment calculator must implement `pct_plus_interest` as the default rule with a configurable floor, matching how the existing `calcMinPayment()` in the prototype works — but as a **single shared function** used by both display and payoff simulation (the current bug is that two diverging implementations exist).

### TV Licence and Quarterly Billing (HIGH confidence — GOV.UK + tvlicensing.co.uk)

TV Licence is £180/year from April 2026. Payment options:
- Annual (one payment)
- Quarterly via direct debit (£45/quarter + £5/year surcharge = £185/year total)
- Monthly via direct debit

This confirms the PROJECT.md requirement: recurring transaction templates **must support quarterly frequency**. The app must not force users into a "monthly only" model. Other UK quarterly bills: buildings/contents insurance premiums, some council tax arrangements, water rates for non-metered properties.

### Bank Statement PDF Formats (MEDIUM confidence — industry converters + csvbankconverter.com)

UK bank PDFs are not standardised. Key facts from research:

| Bank | PDF Format Notes |
|------|-----------------|
| Barclays | Tabular layout; date/description/amount columns consistent; debit and credit in separate columns |
| HSBC | Similar tabular; dedicated HSBC converter services suggest layout is parseable |
| NatWest | Mixed layout; some PDFs have merged cells |
| Lloyds | Tabular; some versions have running balance column |
| Santander | Varies by account type (current vs credit card) |

Third-party services (ukstatementconverter.co.uk, csvbankconverter.com) claim 99.4% accuracy — evidence the formats are parseable but require bank-specific rules. **Fallback to manual column mapping is mandatory** because:
1. PDFs change without notice when banks update their systems
2. Older statements use different layouts
3. Business accounts differ from personal

**Implementation recommendation:** Use pdf.js to extract raw text; write bank-specific parsers as a plugin registry (one per bank); test against real sample PDFs; manual mapping as universal fallback.

---

## Competitor Feature Analysis

| Feature | YNAB | Emma (UK) | MoneyDashboard | Our Approach |
|---------|------|-----------|----------------|--------------|
| UK bank sync | Open Banking | Open Banking | Open Banking | Not in scope; PDF import instead |
| Debt tracker | No | No | No | Full tracker with UK min payment rules |
| Payoff planner | No | No | No | Avalanche + Snowball side-by-side |
| Balance transfer modelling | No | No | No | Yes — UK-specific differentiator |
| Multi-currency | Partial (converts) | Partial | No | Yes — isolated, no mixing |
| PDF import | No | No | No | Yes — UK bank auto-parse + fallback |
| Offline / local-first | No (cloud-only) | No (cloud-only) | No | Yes — full IndexedDB |
| Encrypted export | No | No | No | Yes — AES-256-GCM |
| No subscription fee | No (£99/yr) | Freemium | Freemium | Yes — self-hosted static app |

The competitive gap is clear: no existing UK budgeting tool is local-first, offline, privacy-preserving, and free while also covering debt payoff planning, PDF import, and balance-transfer modelling. The combination of these is the differentiator.

---

## Sources

- [Best Budgeting Apps UK 2026 — Money To The Masses](https://moneytothemasses.com/quick-savings/tips/the-best-budgeting-apps-in-the-uk-how-to-budget-without-trying) — LOW confidence (overview only)
- [What Features Personal Finance App Must Have in 2026 — Devstree UK](https://www.devstree.co.uk/what-features-personal-finance-app/) — MEDIUM confidence (industry blog)
- [FCA CONC 6.7 Post-Contract Business Practices](https://handbook.fca.org.uk/handbook/CONC/6/7.html) — HIGH confidence (official regulator)
- [UK Credit Card Minimum Payment — Experian UK](https://www.experian.co.uk/consumer/credit-cards/guides/minimum-payment-credit-card.html) — MEDIUM confidence (major UK credit bureau)
- [TV Licence Cost and Payment Options — tvlicensing.co.uk](https://www.tvlicensing.co.uk/pay-for-your-tv-licence/ways-to-pay) — HIGH confidence (official)
- [TV Licence Fee Rise to £180 — GOV.UK](https://www.gov.uk/government/news/cost-of-tv-licence-fee-set-for-202627) — HIGH confidence (official)
- [UK Bank Statement PDF Converters — csvbankconverter.com](https://www.csvbankconverter.com/uk-banks/barclays) — LOW confidence (commercial service)
- [UK Statement Converter — ukstatementconverter.co.uk](https://ukstatementconverter.co.uk/) — LOW confidence (commercial service; evidence of parseability)
- [Google Drive JavaScript Quickstart — Google Developers](https://developers.google.com/workspace/drive/api/quickstart/js) — HIGH confidence (official)
- [Debt Payoff Calculator UK 2026 — MoneyMeister](https://www.moneymeister.co.uk/tools/debt-calculator) — LOW confidence (context for UK-specific calculator expectations)
- [Debt Payoff Methods Snowball vs Avalanche UK — yashdodia.org](https://yashdodia.org/2026-debt-payoff-methods-snowball-vs-avalanche-in-the-uk/) — LOW confidence (individual blog; UK overdraft EAR note verified separately)
- [Lunch Money Recurring Items](https://lunchmoney.app/features/recurring-expenses/) — MEDIUM confidence (SaaS competitor; feature reference)
- [Multi-Currency Budget Guide — Pennies](https://getpennies.com/ultimate-multi-currency-budget-tracker/) — LOW confidence (overview)
- [Progressive Web Apps — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) — HIGH confidence (authoritative)

---
*Feature research for: UK personal budget tracking PWA*
*Researched: 2026-02-28*
