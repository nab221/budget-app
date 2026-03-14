# Phase 02-03 SUMMARY: Debt & Asset Tracking

## Core Achievements
- **Debt & Statement Tracking**: Implemented a comprehensive debt tracker with statement logging. Statement entries (date, amount, interest, fees) automatically update the overall debt balance.
- **UK-Specific Calculations**: Integrated calculation logic for UK credit card minimum payments (max of 1% balance + interest, 2.25% balance, or £5 floor) and credit utilization percentages.
- **Asset Management**: Developed an asset tracker for recording bank balances, savings, and other assets over time.
- **Improved Navigation**: Enhanced the tab-switching logic to automatically refresh data when users switch between transaction, debt, and asset panels.

## Implementation Details
- **Financial Utilities**: Created `src/utils/finance.js` to centralize complex debt and utilization calculations.
- **Dynamic Balance Updates**: The `debtUI` ensures that logging a new statement immediately reflects in the main debt's current balance and utilization display.
- **Chronological Sorting**: Debt statements and assets are displayed in reverse chronological order for quick reference to the latest data.

## Verification Results
- Validated `calcMinPayment` against known UK banking scenarios (e.g., £1000 balance, 20% APR).
- Confirmed that credit utilization correctly reflects current balance vs. credit limit.
- Verified that adding an asset entry correctly populates the asset list and persists across sessions.

## State Transitions
- **Previous State**: Phase 02-02 complete.
- **Current State**: Phase 02-03 complete; balance sheet features are fully functional.
