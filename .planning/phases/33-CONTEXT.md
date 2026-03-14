
# Phase 33 Context: Childcare Providers & Ledger Enhancements

## Objective
Extend the childcare module to support multiple childcare providers per account. Add a balance-forward ledger model. Add a weekly spend summary. This phase adds the provider layer that Phase 35 (childcare reporting) depends on.

## Background

### Current Model
The childcare module has:
- `childcareAccounts` — one account per child (e.g. "Nursery for Child A")
- `childcareLedger` — entries against an account (deposits, charges, adjustments)

Missing:
- Multiple providers per account (e.g. a nursery Monday–Wednesday, a childminder Thursday–Friday)
- Weekly spend breakdown
- Running balance per account

### Provider Model (New)
```js
// New store: childcareProviders
{
  id: auto,
  accountId: FK → childcareAccounts.id,
  name: string,           // e.g. "Happy Days Nursery"
  type: 'nursery' | 'childminder' | 'au-pair' | 'other',
  daysOfWeek: number[],   // 0=Sun, 1=Mon, ..., 6=Sat
  hourlyRate: number,     // pence per hour (optional)
  weeklyHours: number,    // optional
  startDate: string,      // ISO date
  endDate: string | null  // null = still active
}
```

Validation rules:
- `daysOfWeek` is required, must be a non-empty array, and each value must be an integer in the range 0–6
- `type` must match one of the documented enum values
- `hourlyRate` and `weeklyHours`, if provided, must be positive numbers
- If both `startDate` and `endDate` are set, `startDate <= endDate`

### Ledger Balance-Forward
Each childcare account now maintains a running balance:
- `currentBalance` = sum of all deposits − sum of all charges for the account
- Display the balance on the account card header
- "Low balance" warning: if `currentBalance < lowBalanceThreshold` (user-configurable per account, default £50), show a warning badge

### Weekly Spend Summary
Add a weekly view to the childcare tab:
- Show total spend per provider per week (Mon–Sun)
- Show total spend across all providers per week
- 4-week rolling view by default
- Navigation arrows for previous/next week

### Cloud Sync Registration
The new `childcareProviders` store must be registered in the cloud sync module (`src/ui/cloud-sync.js`) store list. Without this, provider records will not be pushed to or pulled from Supabase.

## Schema Changes (Dexie)
```js
// New store:
childcareProviders: '++id, accountId, name, type'

// Updated store:
childcareAccounts: '++id, name, lowBalanceThreshold'
// lowBalanceThreshold: number (pence), default 5000 (= £50.00)
```
Dexie version bump required. Migration: no data migration needed for existing accounts (new field defaults to 5000 pence).

## Files to Change
- `src/db/schema.js` — add `childcareProviders` store, add `lowBalanceThreshold` to `childcareAccounts`, bump version
- `src/db/repository.js` — CRUD for `childcareProviders`, `lowBalanceThreshold` default, running balance query
- `src/ui/childcare.js` — provider list/add/edit/delete UI, running balance display, low balance warning, weekly spend summary
- `src/ui/childcare.test.js` — extend tests for provider model and balance logic
- `src/ui/cloud-sync.js` — register `childcareProviders` store in sync list

## Acceptance Criteria
- [ ] Multiple providers can be added to a childcare account
- [ ] Provider fields (name, type, days of week, hourly rate, weekly hours, start/end date) are saved and displayed
- [ ] Provider validation rejects `daysOfWeek` values outside 0–6 and rejects empty `daysOfWeek` arrays
- [ ] Provider validation rejects invalid `type` values, rejects non-positive `hourlyRate` or `weeklyHours`, and rejects `endDate` earlier than `startDate`
- [ ] Each account card shows current running balance (sum of deposits − charges)
- [ ] Low balance warning badge shown when balance < `lowBalanceThreshold`
- [ ] `lowBalanceThreshold` is user-configurable per account (default £50)
- [ ] Weekly spend summary shows spend per provider per week (4-week rolling view)
- [ ] Navigation arrows advance/retreat by 1 week
- [ ] `childcareProviders` store is registered in cloud sync
- [ ] All 354+ existing Vitest tests pass
- [ ] New provider tests achieve ≥ 85% branch coverage

## Technical Notes
- The `daysOfWeek` array should be validated to ensure values are 0–6 and that the array is not empty
- `currentBalance` must be computed on-the-fly from the ledger, not stored, to avoid sync issues
- The weekly spend view should use `date-fns` or the existing date utility for week boundary calculation
- Provider CRUD follows the same pattern as existing `childcareAccounts` CRUD in `repository.js`
- Validate `type`, `hourlyRate`, `weeklyHours`, and `startDate`/`endDate` consistently in both the repository and UI layers
