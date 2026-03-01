# Phase 10: Advanced Debt & Payoff - Research

**Researched:** 2026-03-01
**Domain:** Financial Math, Debt Payoff Algorithms, PWA Data Persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Edit Trigger**: Clicking a debt card in the "Debts" tab opens a comprehensive "Edit Debt" view (modal or dedicated section).
- **Versioning**: APR and Credit Limit changes are **not retroactive**. They apply only to simulations and future statement calculations.
- **0% Promos**: 
  - Tracked via `promoEndDate` (ISO date string).
  - Requires a `postPromoApr` field to handle the rate "jump" after the promo ends.
  - UI will display "Promo ends: [Date]" on the debt card.
- **Strategy Persistence**: The user's choice of strategy (`avalanche`, `snowball`, or `min`) and their `extraMonthlyPayment` amount are saved to `localStorage`.
- **Dashboard Impact**: The "Debt-free Countdown" (DASH-03) on the dashboard will always use the persisted strategy and extra payment.
- **Payment Breakdown Details**: 12-month rolling snapshot showing split between Principal Paid and Interest Charged per debt.
- **Promo Handling**: Projections must account for the `postPromoApr` jump. The month where the jump occurs should be visually highlighted.
- **Tie-breaker**: When priority is equal, the simulation uses **Smallest Balance**.
- **Dashboard Repayment Panel**: Metric: (Total Minimum Payments + Extra Monthly Payment) / Total Income. Include "Promo Expiring" warning for < 60 days.

### Claude's Discretion
- [Implicitly: Design of the edit modal and the layout of the 12-month breakdown table.]
- [Implicitly: Algorithm for "Promo-Priority" sorting if needed, though Avalanche/Snowball are explicitly named.]

### Deferred Ideas (OUT OF SCOPE)
- **Multi-strategy Comparison Chart**: Showing different strategy curves on one chart.
- **Manual Tie-breaker Selection**: Letting the user choose between "Smallest Balance" vs "Largest Balance" as a sub-setting.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-07 | User can edit existing debt details (Name, Credit Limit, APR) | Verified edit modal pattern and non-retroactive data modeling. |
| DEBT-08 | Track 0% promotional APR period end dates and post-promo APR | Researched UK 0% promo patterns and "post-promo jump" logic. |
| DEBT-09 | Dashboard shows "Debts Repayment" panel with total monthly minimum payments and its impact on net position | Researched calculation formula: (Total Min + Extra) / Income. |
| PAY-06 | Payoff Planner supports interactive strategy selection (Avalanche/Snowball/Min Only) | Verified localStorage persistence and reactive UI patterns. |
| PAY-07 | Payoff Planner shows detailed payment breakdown (exactly how much goes to each debt) | Designed the iterative simulation loop to capture monthly history. |
| PAY-08 | Payoff simulation correctly accounts for 0% promotional periods and subsequent APR jumps | Implemented month-by-month APR recalculation logic in research. |
</phase_requirements>

## Summary

Phase 10 transforms the Debt Tracker from a simple ledger into a proactive planning tool. The core challenge is evolving the static simulation logic into a dynamic, time-aware engine that handles 0% promotional windows and rate "jumps." 

The primary recommendation is to stick with the existing **Iterative Simulation Loop** (month-by-month) rather than using a closed-form formula. This is the only way to accurately handle UK minimum payment rules (which change as the balance drops) and mid-simulation APR changes. We will extend `src/utils/finance.js` to return a `history` object that powers both the chart and the new detailed breakdown table.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Vite** | ^6.2.0 | Build Tool | Standard for PWA asset management and fast HMR. |
| **Dexie.js** | ^4.0.11 | IndexedDB Wrapper | Proven choice for local-first apps; handles schema migrations safely. |
| **Chart.js** | ^4.5.1 | Data Visualization | Already used for net worth and spending trends. Lightweight and flexible. |
| **date-fns** | ^4.1.0 | Date Manipulation | Used for handling `promoEndDate` comparisons and month increments. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| **finance.js** | N/A | Financial Math | *NOT RECOMMENDED* - Our math (pence-integer) is specialized enough that hand-rolling prevents floating point errors. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled simulation | `node-debt-snowball` | Package is too opinionated; doesn't handle 0% promo "jumps" or UK-specific min payment rules. |

## Architecture Patterns

### Iterative Simulation Loop
The simulation should follow this pattern to handle time-based changes:

```javascript
while (hasBalance && months < maxMonths) {
  months++;
  const currentDate = addMonths(startDate, months);
  
  // 1. Determine effective APR for each debt based on currentDate
  // 2. Sort debts based on selected Strategy (Avalanche/Snowball)
  // 3. Pay Minimums first using current APR
  // 4. Apply Rollover (Extra Budget) to top priority debt
  // 5. Apply Interest AFTER payment to remaining balance
  // 6. Push SNAPSHOT to history array
}
```

### Strategy Persistence Pattern
Store both the strategy key and the extra payment in a single `localStorage` key to ensure dashboard/planner sync:
`const PREF_PAYOFF_KEY = 'budget_payoff_preference';`
`{ strategy: 'avalanche', extraPayment: 5000 }`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Charting | Custom SVG graphs | **Chart.js** | Handles axes, tooltips, and responsiveness out of the box. |
| Date Math | Raw `Date` arithmetic | **date-fns** | Handles leap years, month-end edge cases correctly. |
| Persistence | Raw IndexedDB | **Dexie.js** | Native IndexedDB is notoriously complex and error-prone. |

## Common Pitfalls

### Pitfall 1: APR "Jump" month
**What goes wrong:** Calculating interest in the jump month using the old rate or only the new rate.
**How to avoid:** Standard practice is to use the rate that applies on the **Statement Date**. If the promo ends on the 15th and the statement is on the 30th, the bank might apply a blended rate or just the new rate. For the app, we will use the **new rate** if the `promoEndDate` has passed by the monthly simulation tick.

### Pitfall 2: Negative Balances
**What goes wrong:** Applying a minimum payment or extra payment that exceeds the remaining balance, resulting in negative debt.
**How to avoid:** Always use `Math.min(calculatedPayment, remainingBalance)` before deducting.

### Pitfall 3: Floating Point Errors
**What goes wrong:** Using `0.1 + 0.2 === 0.30000000000000004` logic for money.
**How to avoid:** ALREADY HANDLED - Project uses **Pence Integers**. Ensure all interest calculations use `Math.round()` or `Math.floor()` to keep results in integer pence.

## Code Examples

### Refined Simulation Logic (Pattern)
```javascript
// Inside simulatePayoff in finance.js
currentDebts.forEach(debt => {
  // Determine if promo is active
  const isPromoActive = debt.promoEndDate && isBefore(currentMonthDate, parseISO(debt.promoEndDate));
  const effectiveApr = isPromoActive ? 0 : (debt.postPromoApr || debt.apr);
  
  // Calculate min payment based on effective APR
  const min = calcMinPayment(debt.balance, effectiveApr);
  // ... apply payments ...
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static Simulation | Dynamic Iteration | 2024+ | Allows handling variable rates and promo expirations which are common in the current UK market. |
| Floating Point Math | Integer (Pence) Math | Always | Prevents 0.00000001 rounding errors in debt schedules. |

## Open Questions

1. **Deferred Interest?**
   - What we know: Some store cards (rare in UK) charge interest from day 1 if not paid in full by promo end.
   - What's unclear: Should we support a "Deferred Interest" flag?
   - Recommendation: **Omit for now.** Most UK balance transfer cards (0% promo) just "jump" to the new rate without back-dating interest.

2. **Statement Dates?**
   - What we know: Real interest is calculated daily or monthly based on a statement date.
   - What's unclear: Should the simulation support specific statement days (e.g., "15th of the month")?
   - Recommendation: **Keep it simple.** Assume all debts are processed on the same monthly tick for simulation purposes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.7 |
| Config file | vite.config.js |
| Quick run command | `npx vitest run src/utils/finance.test.js` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-08 | 0% promo handling in simulation | unit | `npx vitest run src/utils/finance.test.js` | ❌ New Test Cases |
| PAY-07 | 12-month history output | unit | `npx vitest run src/utils/finance.test.js` | ❌ New Test Cases |
| PAY-08 | APR jumps after promo end | unit | `npx vitest run src/utils/finance.test.js` | ❌ New Test Cases |

### Wave 0 Gaps
- [ ] Update `src/utils/finance.test.js` to include 0% promo simulation cases.
- [ ] Add tests for strategy persistence in a mock storage environment.

## Sources

### Primary (HIGH confidence)
- **FCA Handbook (CONC 6.7.5)** - Verified the "1% + interest" minimum payment floor for UK credit cards.
- **Barclays/Lloyds Terms & Conditions (2024)** - Verified the trend toward the 1% floor.
- **Dexie.js Documentation** - Confirmed schema versioning and migration patterns.

### Secondary (MEDIUM confidence)
- **Financial Planning Community Patterns** - Verified "Avalanche" vs "Snowball" vs "Promo-Priority" (Jump) strategy logic.

## Metadata
**Confidence breakdown:**
- Standard stack: HIGH - Minimal changes to existing proven stack.
- Architecture: HIGH - Iterative simulation is the only robust way to handle the requirements.
- Pitfalls: HIGH - Floating point and promo-jump issues are well-documented.

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (Stable domain)
