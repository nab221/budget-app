# Phase 11 Context: Account Balance Carry-Forward

This document defines the implementation decisions for the running account balance and forecasting system. These decisions take precedence over general defaults and guide the research and planning phases.

## 1. Initial Setup & Starting Point
- **Hard Start Date**: The running balance begins on **January 1st of the current year** (defaulting to a balance of 0).
- **Opening Balance**: An "Opening Balance" transaction type (categorized as Income) will be provided to allow users to align the app with their actual bank balance on the start date.
- **Configurability**: Users can change this "Hard Start Date" in the settings. Transactions dated before this start date are ignored for balance calculations.
- **Carry-Forward**: The balance is continuous. The closing balance of one month/year is the opening balance of the next, following the single start date.
- **Year-to-Date (YTD)**: The system must track and display a "YTD Net" figure (Total Income - Total Expenses) alongside the running balance.

## 2. Forecast Depth & Logic
- **Scope**: 3 months into the future.
- **Data Sources**:
    - **Confirmed Transactions**: Actual entries in the database.
    - **Recurrent Templates**: If a recurrent item (e.g., Rent) isn't confirmed for a future month, use the template amount as a placeholder.
    - **Scheduled One-offs**: Include all one-off expenses scheduled for future dates.
    - **Variable Targets**: Use the "Target" (budget limit) for variable categories to project future spending.
- **Timing**: Future one-off expenses without a specific day are assumed to occur on the **1st of the month** for projection purposes.
- **Visuals**: Future/Projected balances must be visually distinct (e.g., a different color) from actual historical data.

## 3. UI & Dashboard Integration (Specialized Card)
- **Primary Metrics**:
    - **Today's Balance**: Total of all transactions up to the current moment.
    - **Projected Balance**: The expected balance at the end of the current month.
- **Risk Indicators**:
    - **Low Point Warning**: Show the lowest balance the user will hit during the month (accounting for the timing of bills vs. income).
    - **Negative Balance Alert**: If the projected balance drops below zero at any point, the card background must turn **Red**.
- **Visual Aid**: A **mini-chart** showing the 90-day balance trend.
- **Detail Level**: The card should show a breakdown of multiple income sources driving the balance.

## 4. Technical Logic & Consistency
- **Background Recalculation**: Any change to a transaction (addition, deletion, or date change) must trigger a background recalculation of the balance chain for all subsequent months.
- **"Cash" Only**: The balance tracks the net of **Income minus Expenses**. Transfers to/from the "Assets" ledger are excluded as they are tracked separately.
- **Snapshots**: To maintain performance as data grows, the system should utilize **Monthly Snapshots** for balance state rather than recalculating the entire history from the start date on every page load.
- **Untracked Cash**: Users are instructed to add untracked cash transactions as "Expenses" to keep the running balance accurate.

## 5. Deferred / Out of Scope
- Integration with the Assets ledger for a "Total Liquidity" view (revisit in a future phase if needed).
- Automated "Correction" transactions (users must add manual expenses for discrepancies).
