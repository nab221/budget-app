# Phase 10 Context: Advanced Debt & Payoff

## Overview
This phase enhances the debt management and payoff planning capabilities. It moves from simple "add/delete" debt tracking to a full life-cycle model including 0% promotional periods and interactive, persisted payoff strategies.

## Implementation Decisions

### 1. Debt Editing & Promo Life-cycle (DEBT-07, DEBT-08)
- **Edit Trigger**: Clicking a debt card in the "Debts" tab opens a comprehensive "Edit Debt" view (modal or dedicated section).
- **Versioning**: APR and Credit Limit changes are **not retroactive**. They apply only to simulations and future statement calculations.
- **0% Promos**: 
  - Tracked via `promoEndDate` (ISO date string).
  - Requires a `postPromoApr` field to handle the rate "jump" after the promo ends.
  - UI will display "Promo ends: [Date]" on the debt card.

### 2. Interactive Strategy Selection (PAY-06)
- **Persistence**: The user's choice of strategy (`avalanche`, `snowball`, or `min`) and their `extraMonthlyPayment` amount are saved to `localStorage`.
- **Dashboard Impact**: The "Debt-free Countdown" (DASH-03) on the dashboard will always use the persisted strategy and extra payment.
- **Selection UI**: A simple radio toggle or button group in the Payoff Planner to "Lock in" the active strategy.

### 3. Payment Breakdown Details (PAY-07, PAY-08)
- **Scope**: A **12-month rolling snapshot** of the projected payment schedule.
- **Granularity**: Each month must show the split between **Principal Paid** and **Interest Charged** per debt.
- **Promo Handling**: Projections must account for the `postPromoApr` jump. The month where the jump occurs should be visually highlighted (e.g., "Rate Jump").
- **Tie-breaker**: When priority is equal (e.g., same APR), the simulation will use **Smallest Balance** as the tie-breaker.

### 4. Dashboard Repayment Panel (DEBT-09)
- **Metric**: Display the "Debt Impact" as a **% of total monthly income**.
- **Calculation**: (Total Minimum Payments + Extra Monthly Payment) / Total Income.
- **Alerts**: Include a "Promo Expiring" warning if any 0% period ends within the next 2 months (60 days).
- **Navigation**: The "Debt-free Countdown" card will link directly to the Payoff Planner tab.

## Deferred Ideas
- **Multi-strategy Comparison Chart**: Showing different strategy curves on one chart (staying with the single-strategy chart for now to reduce clutter).
- **Manual Tie-breaker Selection**: Letting the user choose between "Smallest Balance" vs "Largest Balance" as a sub-setting (hardcoded to Smallest Balance for now).
