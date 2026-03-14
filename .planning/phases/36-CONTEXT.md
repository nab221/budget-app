
# Phase 36 Context: Asset Tracker Enhancements

## Objective
Extend the asset tracker with historical value snapshots, sparkline charts, a net-worth trend chart, and rebalance suggestions.

## Background

### Current Asset Tracker
The asset tracker (`src/ui/assets.js`) allows the user to record assets (property, investments, savings, vehicles) with a current value. It does not store historical values or trends.

### Value Snapshots
Add a `assetSnapshots` store:
```js
{
  id: auto,
  assetId: FK → assets.id,
  recordedAt: string,   // ISO 8601 datetime in UTC
  value: number   // pence
}
```
When the user edits an asset's value, the old value is written to `assetSnapshots` with the current UTC timestamp before the update is applied.

### Sparkline Charts
For each asset card, show a small sparkline chart (last 12 months of snapshots). Use the existing canvas/charting infrastructure from `src/ui/charts.js` (or equivalent). If fewer than 2 snapshots exist, show "Not enough data" text instead.

### Net-Worth Trend Chart
Add a full-width chart at the top of the Assets tab:
- X-axis: monthly intervals (last 12 months)
- Y-axis: total net worth (sum of all asset values at month-end)
- Uses the most recent snapshot per asset per month for the calculation

### Rebalance Suggestion
For investment assets, allow the user to set a `targetAllocation` (percentage, 0–100). The rebalance view:
- Shows current allocation % per investment asset
- Shows target allocation %
- Shows the difference (over/under weight)
- Suggests: "Buy £X of [asset]" or "Sell £X of [asset]" to reach target allocation
- Does not execute any trades — display only

### z-index Coordination
The sparkline canvas elements must not overlap the Phase 28 bottom nav bar on mobile. Ensure sparkline containers have `z-index` lower than `--bottom-bar-height` z-index (1000). Recommended: `z-index: 1` on chart containers.

## Schema Changes (Dexie)
```js
// New store:
assetSnapshots: '++id, assetId, recordedAt'

// Updated store:
assets: '++id, name, type, targetAllocation'
// targetAllocation: number | null (percentage)
```
Dexie version bump required.

## Files to Change
- `src/db/schema.js` — add `assetSnapshots` store, add `targetAllocation` to `assets`, bump version
- `src/db/repository.js` — snapshot CRUD, net-worth trend query, monthly rollup query
- `src/ui/assets.js` — sparkline rendering, net-worth chart, rebalance view
- `src/ui/assets.test.js` — extend tests
- `src/ui/cloud-sync.js` — register `assetSnapshots` store

## Acceptance Criteria
- [ ] Editing an asset value creates a snapshot of the previous value with today's date
- [ ] Asset card shows sparkline for assets with ≥ 2 snapshots
- [ ] "Not enough data" shown for assets with < 2 snapshots
- [ ] Net-worth trend chart renders correctly for last 12 months
- [ ] Snapshot ordering is deterministic when multiple edits happen on the same day because `recordedAt` stores a full UTC timestamp
- [ ] Rebalance view shows current vs target allocation for investment assets
- [ ] Rebalance suggestions (buy/sell amounts) are mathematically correct
- [ ] Sparkline z-index does not cause overlap with mobile bottom nav bar
- [ ] `assetSnapshots` store registered in cloud sync
- [ ] All 354+ existing Vitest tests pass
- [ ] New snapshot and chart tests achieve ≥ 85% branch coverage

## Technical Notes
- The net-worth trend chart must handle missing months (asset had no snapshots) by carrying forward the last known value
- Use `recordedAt` for all "most recent snapshot" selections and monthly rollups; do not rely on date-only strings
- `targetAllocation` applies only to assets with `type === 'investment'`
- Rebalance calculation: total investment portfolio value × target% − current value = buy(+)/sell(-) amount
- Snapshot auto-creation: triggered in `repository.js` `updateAsset()` method, not in the UI layer
