# Phase 22 Context: Export Reminder Includes Unsynced Settings Warning

## Overview
Phase 22 enhances the export reminder logic to warn users that while their transaction data may be synced to the cloud (if Supabase is active), their app settings (theme, privacy mode, etc.) are local-only and require a manual export to be backed up.

## Implementation Decisions

### 1. Scope of "Unsynced Settings"
The following `localStorage` keys are explicitly tracked and included in the manual `.json` export:
- `budget_balance_start_date` (Balance chain start)
- `budget_balance_opening_amount` (Initial balance)
- `budget_privacy_mode` (Privacy blur state)
- `budget_haptics_enabled` (Haptic feedback toggle)
- `budget_app_theme` (Light/Dark theme)
- `payoffExtra` (Debt payoff monthly extra amount)
- `budget_payoff_preference` (Debt payoff strategy: avalanche/snowball)
- `last_export_timestamp` (Recency of manual export)

Keys identified but excluded from export (UI state/Cache):
- `budget_cloud_last_sync`
- `bank-holidays-cache`
- `expenses_selected_month`
- `transaction_month`

### 2. Warning Trigger Logic
- The **7-day reminder trigger** remains unchanged (based on `last_export_timestamp`).
- The warning message is appended to the existing banner.
- **Conditional logic:** The "unsynced settings" warning is only appended if Cloud Sync is configured (`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present).

### 3. Messaging & Visuals
- **Placement:** Appended to the `#export-reminder` element in the header.
- **Phrasing:** "Your last data export was {days} days ago. Export now to keep your data safe. Your transactions are backed up, but app settings (theme, privacy mode) are stored locally only and not included in cloud sync."
- **Tone:** Factual nudge, not an alarm.

### 4. Technical Constants
All settings keys are centralized in `src/utils/storage.js`. Downstream agents should use these constants instead of literal strings:
- `BALANCE_START_DATE_KEY`
- `BALANCE_OPENING_AMOUNT_KEY`
- `PRIVACY_MODE_KEY`
- `HAPTICS_ENABLED_KEY`
- `THEME_KEY`
- `PAYOFF_EXTRA_KEY`
- `PAYOFF_STRATEGY_KEY`

## Out of Scope
- Syncing settings to Supabase (`pushSnapshot` parity) was explicitly deferred to maintain a simple, purely UI-driven phase.

## Verification Plan
- [ ] Manual export includes the expanded `settings` object.
- [ ] Manual import restores all settings (Theme, Haptics, etc.).
- [ ] Export reminder banner shows the extra sentence only when Supabase is configured.
- [ ] Export reminder banner shows only the default sentence when Supabase is unconfigured.
