
# Phase 35 Context: Childcare Reporting & Tax-Free Childcare Tracker

## Objective
Add childcare reporting features: monthly spend summary per provider, Tax-Free Childcare (TFC) top-up tracker, and export to CSV. This phase builds on the provider model from Phase 33.

## Background

### Tax-Free Childcare (TFC)
The UK government's TFC scheme pays £2 for every £8 the parent deposits into a TFC account (up to £500 per quarter top-up / £2,000/year per child). Parents need to track:
- How much they've deposited this quarter
- How much top-up they've received
- How much more they can deposit to maximise the top-up before the quarter ends

### Quarter Boundaries
- Q1: 1 Jan – 31 Mar
- Q2: 1 Apr – 30 Jun
- Q3: 1 Jul – 30 Sep
- Q4: 1 Oct – 31 Dec

### TFC Store (New)
```js
// New ledger entry type: 'tfc-deposit' | 'tfc-top-up'
// Reuse childcareLedger with an entryType discriminator
// OR add a new tfcTransactions store:
{
  id: auto,
  accountId: FK → childcareAccounts.id,
  date: string,           // ISO date
  type: 'deposit' | 'top-up' | 'withdrawal',
  amount: number,         // pence
  quarterLabel: string    // e.g. 'Q1-2026' (computed on insert)
}
```

### Monthly Spend Report
- Group childcare ledger charges by provider, by month
- Show: provider name, total charges for month, number of sessions
- Compare against budget (if a monthly budget is set per provider)

### CSV Export
Export the full childcare ledger (or filtered by date range / provider) as a CSV file:
- Columns: Date, Account, Provider, Type (charge/deposit/adjustment), Amount, Notes
- Use the browser `Blob` + `URL.createObjectURL()` download pattern

### Cloud Sync Registration
If a new `tfcTransactions` store is added, it must be registered in `src/ui/cloud-sync.js`.

## Files to Change
- `src/db/schema.js` — add `tfcTransactions` store (if separate), bump version
- `src/db/repository.js` — TFC CRUD, quarterly summary query, monthly spend query
- `src/ui/childcare.js` — monthly report section, TFC tracker UI, CSV export button
- `src/ui/childcare.test.js` — extend tests
- `src/ui/cloud-sync.js` — register `tfcTransactions` store
- `src/utils/childcare-export.js` — new CSV export utility

## Acceptance Criteria
- [ ] Monthly spend report shows total charges per provider per month
- [ ] TFC tracker shows: deposits this quarter, top-ups received, remaining deposit allowance
- [ ] Progress bar shows % of quarterly TFC allowance used
- [ ] "Remaining to deposit" figure shown (£2,000/year limit ÷ 4 quarters = £500/quarter max deposit for £500 top-up)
- [ ] CSV export downloads a file with all ledger entries for the selected account/date range
- [ ] CSV columns: Date, Account, Provider, Type, Amount (£), Notes
- [ ] `tfcTransactions` store registered in cloud sync
- [ ] All 354+ existing Vitest tests pass
- [ ] New TFC and report tests achieve ≥ 85% branch coverage

## Technical Notes
- TFC top-up ratio: £2 government top-up for every £8 deposited (i.e. 25% top-up on deposits)
- Maximum government top-up: £500 per quarter per child (= £2,000 deposit to get full top-up)
- Quarter boundary: use existing date utilities or `date-fns` startOfQuarter/endOfQuarter
- CSV export: use `encodeURIComponent` for field values to handle commas and special characters
- The TFC tracker only applies to accounts where `isTFCAccount: true` — add this boolean field to `childcareAccounts`
