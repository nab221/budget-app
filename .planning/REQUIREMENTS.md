# Milestone v2.3 Requirements: Advanced Analytics & Mobile Polish

## Goal
Transform the app from a tracking tool to a proactive financial partner through formal reconciliation (Integrity), advanced visualizations (Insights), and a thumb-friendly mobile interface (Mobile Polish).

## 1. Integrity: Reconciliation
Maintain a perfect match between digital records and bank statements.

- **RECO-01**: Schema Migration: Add `isCleared` (boolean) and `isReconciled` (boolean) fields to Income and Expenses repositories.
- **RECO-02**: Provide a "Reconciliation Mode" toggle in Income and Expenses transaction lists.
- **RECO-03**: In Reconciliation Mode, each transaction shows a "Clear" checkbox or icon for quick toggling.
- **RECO-04**: Display a reconciliation header showing: "Cleared Balance" (sum of all cleared) vs. "Statement Balance" (sum of all).
- **RECO-05**: Implement a "Finalize Reconciliation" workflow that marks all cleared items as `isReconciled`.
- **RECO-06**: Prevent editing or deletion of items marked `isReconciled` (require unlocking).
- **RECO-07**: Visually lock reconciled items in the transaction table with a padlock icon.

## 2. Insights: Analytics
Provide deep financial clarity through interactive visualizations.

- **ANAL-01**: Dashboard: Add an **Expenses Breakdown Doughnut Chart** showing top 5 categories + "Other".
- **ANAL-02**: Dashboard: Add a **Savings Rate KPI** (Total Income - Total Expenses / Total Income) as a prominent metric.
- **ANAL-03**: Dashboard: Add a **Net Worth Trend Chart** (12-month historical) combining Assets - Debts + current Account Balances.
- **ANAL-04**: Implement interactive tooltips for all charts showing exact monetary values on hover/touch.
- **ANAL-05**: Dashboard: Add a "Monthly Spending Heatmap" or Year-over-Year comparison widget for total monthly spend.
- **DASH-04**: Enhanced Rolling Financial Overview: Replace income/expense lines with a bar chart (green/red) and add Daily/Weekly/Monthly binning via a modern radio button group.

## 3. Mobile Polish: UX
Refine the PWA experience for thumb-zone navigation and private public use.

- **UX-01**: Bottom Navigation Bar: Move primary tab navigation (Dashboard, Income, Expenses, Debts, Assets, Settings) to the bottom of the viewport on mobile screens (< 768px).
- **UX-02**: Privacy Mode: Implement a "Privacy Toggle" (eye icon) in the header that blurs or masks all sensitive currency values.
- **UX-03**: Gesture Support: Implement swipe-to-clear or swipe-to-delete interactions for transaction list rows.
- **UX-04**: Interaction Haptics: Trigger tactile feedback (`navigator.vibrate`) on key actions like clearing a transaction or successfully saving a form.
- **UX-05**: PWA Installation: Ensure high-resolution icons (192, 512) and splash screens are correctly configured for iOS/Android install prompts.

## Success Criteria
- [ ] Users can toggle "Reconciliation Mode" and clear transactions to match their bank statement.
- [ ] Users can "Finalize Reconciliation" to lock items from accidental changes.
- [ ] The Dashboard includes a Doughnut Chart of category spending and a Net Worth trend chart.
- [ ] Savings Rate is displayed as a percentage of income.
- [ ] On mobile devices, navigation is easily accessible at the bottom of the screen.
- [ ] Users can mask sensitive financial data with one tap (Privacy Mode).
- [ ] Transaction rows support swipe actions on touch devices.

## Traceability
| Requirement | Phase | Status |
|-------------|-------|--------|
| RECO-01 | 1 | Completed |
| RECO-02 | 1 | Completed |
| RECO-03 | 1 | Completed |
| RECO-04 | 1 | Completed |
| RECO-05 | 1 | Completed |
| RECO-06 | 1 | Completed |
| RECO-07 | 1 | Completed |
| ANAL-01 | 2 | Completed |
| ANAL-02 | 2 | Completed |
| ANAL-03 | 2 | Completed |
| ANAL-04 | 2, 6 | Completed |
| ANAL-05 | 2 | Pending |
| UX-01 | 3, 4 | Completed |
| UX-02 | 3 | Completed |
| UX-03 | 3 | Pending |
| UX-04 | 3 | Pending |
| UX-05 | 3 | Completed |
| DASH-04 | 6 | Pending |
