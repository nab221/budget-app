# Phase 09: Tax-Free Childcare Tracker - Research

**Researched:** 2026-03-01
**Domain:** UK Tax-Free Childcare (TFC) tracking and budget integration
**Confidence:** HIGH

## Summary

This phase implements a dedicated tracker for UK Tax-Free Childcare accounts. The system must handle the "£8 for every £2" government top-up mechanism, enforce quarterly caps (£500 standard, £1,000 disabled), and predict funding gaps based on a user-defined "Target Monthly Spend".

Integration with the main budget is two-fold: deposits into the childcare account are treated as one-off or recurrent expenses (with a "Tax-free Childcare" badge), and the account balance is tracked as an asset contributing to the user's total Net Worth.

**Primary recommendation:** Use a dedicated ledger for each childcare account to ensure an audit trail of deposits, top-ups, and provider payments, calculating the gov bonus at the point of deposit based on a rolling 3-month "entitlement period" window.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Account Identity**: Accounts are identified by the child's name (e.g., "Alice", "Bob").
- **Ledger Representation**:
    - **Transaction Rows**: Deposits from the user's bank account and the 20% government top-up are recorded as **two separate entries** ("Deposit" and "Gov Top-up") to ensure clarity on funding sources.
    - **Balance**: Every transaction entry includes a **running balance** for the account.
    - **History**: The ledger is a **full historical list** (not month-filtered) to provide a complete audit trail of the childcare fund.
- **Metadata**:
    - **Status**: Transactions are assumed "Cleared" by default upon entry.
    - **Categories**: Payments to providers use a single "Provider/Description" field; no complex categorization is required within the childcare silo.
    - **Withdrawals**: Manual withdrawals (moving money back to the bank) are not prioritized; the focus is on deposits and spending.
- **Budget Impact**:
    - **Deposits**: A deposit into a childcare account is treated as an **expense** in the main budget (reducing the "Net Position" for the month).
    - **Badge**: A new **"Tax-free Childcare"** badge is added to the expense list to identify these transfers.
- **Net Worth Impact**:
    - **Asset Inclusion**: The balance of each childcare account is included in the **Total Assets** and **Net Worth** calculations on the dashboard.
    - **Value Gain**: Net worth increases by the amount of the 20% government top-up upon deposit.
- **Cost Modeling**:
    - **Target Spend**: The app uses a manual **"Target Monthly Spend"** setting per child to define predicted future outgoings.
- **Gap Analysis**:
    - **Funding Window**: The app looks ahead **1 month** to compare the current account balance against the predicted monthly spend.
    - **"Missing" Funds**: If the balance is less than the target spend, the dashboard shows the "funding gap."
- **Top-up Suggestions**:
    - **User Action**: The app suggests the exact amount the **user** needs to deposit (e.g., "Deposit £400 to reach your £500 target") to clear the gap.
- **Quarterly Cap**:
    - **Warning**: The app monitors the £500/quarter government top-up limit.
    - **Feedback**: If a deposit would exceed the quarterly cap, the app displays a **"No more top-ups available this quarter"** warning.
- **Reset Logic**: Tracking is focused on the quarterly limit as the primary constraint for user top-up planning.

### Claude's Discretion
- (No discretion areas explicitly listed in 09-CONTEXT.md; followed standard project patterns for implementation details)

### Deferred Ideas (OUT OF SCOPE)
- *No deferred ideas captured during this discussion.*
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHILD-01 | User can track 2 independent Tax-free Childcare accounts with balances | Data schema supports multiple accounts; Dexie v7 migration plan provided. |
| CHILD-02 | App calculates and displays government top-up (20%) for every deposit | Verified UK TFC rules: 25% bonus on parent's deposit (20% of total) up to cap. |
| CHILD-03 | User can log weekly/monthly outgoings from childcare accounts | Ledger schema supports 'spend' transactions with running balance. |
| CHILD-04 | App suggests top-up values to cover predicted future childcare expenses | Prediction logic based on (Target Spend - Balance) * 0.8 defined. |
| CHILD-05 | Dashboard shows current balances and "missing" funds needed to cover predicted outgoings | Dashboard integration plan includes a new Childcare summary card. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | 4.x | IndexedDB Wrapper | Project standard for data persistence and schema migrations. |
| Vanilla JS | ES2022 | Logic & UI | Project standard for lightweight, dependency-free implementation. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| DOMPurify | 3.x | XSS Protection | Used in `render.js` for `safeHTML` to ensure secure UI updates. |

## Architecture Patterns

### Recommended Data Schema (v7)
Adding dedicated tables for Childcare ensures separation from main budget ledger while allowing asset integration.

```javascript
// src/db/schema.js
db.version(7).stores({
  // ... existing ...
  childcareAccounts: '++id, childName, targetMonthlySpend, entitlementStart, isDisabled',
  childcareLedger: '++id, accountId, date, type, amount, runningBalance'
});
```

### Pattern 1: TFC Bonus Calculation
The "£8 for £2" rule means the government adds 25% of the parent's contribution.

**Logic:**
1. Identify the 3-month window from `entitlementStart`.
2. Sum existing `top-up` entries in that window.
3. Calculate remaining capacity: `CAP (500 or 1000) - sum`.
4. Bonus: `min(0.25 * deposit, capacity)`.

### Pattern 2: Budget & Net Worth Integration
- **Budget**: When a 'deposit' is added to the childcare ledger, an entry is created in `oneOffExpenses` with the label "Tax-free Childcare: [Child Name]".
- **Net Worth**: `getDashboardData` must query `childcareLedger` for the latest `runningBalance` of all accounts and add it to `totalAssets`.

### Anti-Patterns to Avoid
- **Floating Point Math**: Always use `toPence` and `formatGBP` utilities.
- **Fixed Quarters**: Don't use calendar quarters (Jan-Mar). TFC quarters are specific to the user's `entitlementStart` date.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date manipulation | Complex offset math | Native `Date` | Simple 3-month increments are sufficient for entitlement periods. |
| Money formatting | `number.toFixed(2)` | `formatGBP()` utility | Ensures consistent currency display across the app. |

## Common Pitfalls

### Pitfall 1: The "20%" vs "25%" Confusion
**What goes wrong:** Calculating top-up as 20% of the deposit.
**Why it happens:** The scheme is called "20% top-up" because the gov pays 20% of the *total* (£2 out of £10).
**How to avoid:** Always calculate as `deposit * 0.25` (e.g., £80 deposit * 0.25 = £20 top-up).

### Pitfall 2: Quarterly Cap Reset
**What goes wrong:** Forgetting to check the remaining cap for the *specific* quarter the deposit falls into.
**How to avoid:** The repository should have a `getRemainingCap(accountId, date)` function that sums top-ups in the relevant 3-month entitlement period.

## Code Examples

### Calculating Remaining Capacity
```javascript
// Source: UK Gov TFC Rules / Project Pattern
async function getRemainingCap(accountId, date) {
  const account = await db.childcareAccounts.get(accountId);
  const cap = account.isDisabled ? 100000 : 50000; // in pence
  
  // Calculate quarter start for the given date
  const start = new Date(account.entitlementStart);
  const target = new Date(date);
  const diffMonths = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
  const quarterIndex = Math.floor(diffMonths / 3);
  
  const qStart = new Date(start);
  qStart.setMonth(start.getMonth() + (quarterIndex * 3));
  const qEnd = new Date(qStart);
  qEnd.setMonth(qStart.getMonth() + 3);
  
  const topUps = await db.childcareLedger
    .where('accountId').equals(accountId)
    .and(entry => entry.type === 'top-up' && entry.date >= qStart.toISOString() && entry.date < qEnd.toISOString())
    .toArray();
    
  const used = topUps.reduce((sum, t) => sum + t.amount, 0);
  return Math.max(0, cap - used);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tracking total childcare spend as an expense | Tracking TFC account balance as an asset | Phase 09 | Provides a more accurate Net Worth and visibility into "tax-free" benefits. |

## Open Questions

1. **Reconfirmation Alerts?**
   - What we know: Users must reconfirm every 3 months.
   - What's unclear: Should the app prompt for this?
   - Recommendation: Add a "Reconfirmation Due" indicator if the current date is near the end of an entitlement period.

## Sources

### Primary (HIGH confidence)
- `09-CONTEXT.md` - Implementation decisions for Phase 09.
- `src/db/schema.js` - Existing database structure.
- `src/ui/expenses.js` - Reference for badge rendering and expense management.
- [GOV.UK Tax-Free Childcare](https://www.gov.uk/tax-free-childcare) - Official rules on 20% top-up and quarterly caps.

### Secondary (MEDIUM confidence)
- [MoneySavingExpert TFC Guide](https://www.moneysavingexpert.com/family/tax-free-childcare/) - Verified "£8 for £2" math and entitlement period details.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using established project libraries.
- Architecture: HIGH - Fits into existing repository/UI module pattern.
- Pitfalls: HIGH - UK TFC rules are well-documented.

**Research date:** 2026-03-01
**Valid until:** 2026-04-01
