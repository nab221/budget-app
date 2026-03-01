# Phase 09: Tax-Free Childcare Tracker - Context

This document captures the implementation decisions for Phase 09. These choices guide the downstream research and planning agents.

## 1. Account & Ledger Structure

- **Account Identity**: Accounts are identified by the child's name (e.g., "Alice", "Bob").
- **Ledger Representation**:
    - **Transaction Rows**: Deposits from the user's bank account and the 20% government top-up are recorded as **two separate entries** ("Deposit" and "Gov Top-up") to ensure clarity on funding sources.
    - **Balance**: Every transaction entry includes a **running balance** for the account.
    - **History**: The ledger is a **full historical list** (not month-filtered) to provide a complete audit trail of the childcare fund.
- **Metadata**:
    - **Status**: Transactions are assumed "Cleared" by default upon entry.
    - **Categories**: Payments to providers use a single "Provider/Description" field; no complex categorization is required within the childcare silo.
    - **Withdrawals**: Manual withdrawals (moving money back to the bank) are not prioritized; the focus is on deposits and spending.

## 2. Expense Integration

- **Budget Impact**:
    - **Deposits**: A deposit into a childcare account is treated as an **expense** in the main budget (reducing the "Net Position" for the month).
    - **Badge**: A new **"Tax-free Childcare"** badge is added to the expense list to identify these transfers.
- **Net Worth Impact**:
    - **Asset Inclusion**: The balance of each childcare account is included in the **Total Assets** and **Net Worth** calculations on the dashboard.
    - **Value Gain**: Net worth increases by the amount of the 20% government top-up upon deposit.

## 3. Prediction & Funding Logic

- **Cost Modeling**:
    - **Target Spend**: The app uses a manual **"Target Monthly Spend"** setting per child to define predicted future outgoings.
- **Gap Analysis**:
    - **Funding Window**: The app looks ahead **1 month** to compare the current account balance against the predicted monthly spend.
    - **"Missing" Funds**: If the balance is less than the target spend, the dashboard shows the "funding gap."
- **Top-up Suggestions**:
    - **User Action**: The app suggests the exact amount the **user** needs to deposit (e.g., "Deposit £400 to reach your £500 target") to clear the gap.

## 4. Gov Limit Awareness

- **Quarterly Cap**:
    - **Warning**: The app monitors the £500/quarter government top-up limit.
    - **Feedback**: If a deposit would exceed the quarterly cap, the app displays a **"No more top-ups available this quarter"** warning.
- **Reset Logic**: Tracking is focused on the quarterly limit as the primary constraint for user top-up planning.

## Deferred Ideas
- *No deferred ideas captured during this discussion.*
