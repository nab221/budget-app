# Phase 03 Research: Dashboard, Payoff Planner, and Budget Targets

## Research Goals

1. **Dashboard Architecture**: Design a robust, reactive dashboard system that can handle multiple periods (Month, YTD, All) and 9+ summary cards efficiently.
2. **Payoff Planner Logic**: Refine the simulation engine to accurately reflect UK minimum payment rules (reusing `src/utils/finance.js`) and handle side-by-side strategy comparisons.
3. **Balance Transfer Modeling**: Research and define the mathematical model for 0% promotional periods, including transfer fees and "time-to-clear" recommendations.
4. **Budget Targets**: Determine the best storage strategy and UI for per-category spending limits and progress visualization.
5. **Net Worth Snapshots**: Design a non-intrusive snapshot system for historical net worth tracking without a backend.

## Existing Prototype Analysis

### Dashboard
- **Current State**: `renderSummary()` is called after all individual renders. It receives totals as arguments.
- **Flaws**:
    - Tight coupling between individual table renders and the summary.
    - Filtering logic (`inRange`) is duplicated and manually applied in each render function.
    - No support for "net worth over time" snapshots.
- **Opportunity**: Centralize data aggregation in `src/db/repository.js` to provide a single "Dashboard State" object.

### Payoff Planner
- **Current State**: `simulate()` function inside `budget-app.html`.
- **Flaws**:
    - Divergent logic: Uses a simplified min-payment rule instead of the shared `calcMinPayment()`.
    - Manual loop for simulation (max 600 months).
    - No balance transfer modeling.
- **Opportunity**: Move simulation logic to `src/utils/finance.js`. Ensure it uses the exact same `calcMinPayment()` used by the UI.

### Budget Targets
- **Current State**: Completely missing.
- **Requirement**: Needs a new Dexie store `targets` (`++id, categoryId, amount`).
- **UI**: Dashboard needs a section for progress bars (Actual vs Target).

## Technical Spikes

### 1. Payoff Simulation Accuracy
The simulation must account for:
- Monthly interest application before or after payment? (UK cards usually apply interest on the statement date based on the *average daily balance*, but for simulation, applying to the *previous balance* is a standard approximation).
- The "Interest + 1% + Fees" rule vs "2.25%" rule.
- Snowball vs Avalanche priority handling when a debt is cleared (the "roll over" effect).

### 2. Balance Transfer Math
Formula for "Recommended Monthly Payment":
`Recommended = (Balance * (1 + Fee%)) / PromoMonths`
Comparison: `Total Cost (Current) = Sum of all projected interest until cleared` vs `Total Cost (BT) = Balance * Fee% + (Any remaining balance * Interest)`.

### 3. Net Worth Snapshots
Since there is no server-side "cron job", snapshots must be taken on the client side.
- **Option A**: Trigger on every app load (check if a snapshot for the current month exists).
- **Option B**: User-initiated "Snapshot" button.
- **Decision**: Option A is better for consistency. Store in `netWorthSnapshots` (`++id, month, totalAssets, totalDebt, netWorth`).

## Proposed Implementation Order

1. **Data Layer Expansion**: Add `targets` and `netWorthSnapshots` to Dexie schema.
2. **Finance Utilities**: Refine `src/utils/finance.js` with simulation and BT modeling logic.
3. **Dashboard UI**: Implement the 9-card summary and category progress bars.
4. **Payoff Planner UI**: Implement the side-by-side strategy viewer and BT modeler.

## Dependencies
- Phase 02 data layer (Income, Expenses, Debts, Assets) must be fully functional. (Verified)

## Risks
- **Performance**: Running multiple 600-month simulations on every input change in the Payoff Planner. (Mitigation: Use a debounce or a dedicated worker if needed; usually, 3 strategies with 10 debts is fast enough in JS).
- **Data Consistency**: Ensuring snapshots are taken accurately and handle manual balance adjustments.
