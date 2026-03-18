# Phase 35: Childcare Top-Up Planner - Research

**Researched:** 2026-03-15
**Domain:** Childcare top-up planning, Dexie schema evolution, affordability integration, cloud sync behavior
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Add childcare reporting features: monthly spend summary per provider, Tax-Free Childcare (TFC) top-up tracker, and export to CSV. This phase introduces the provider model for childcare accounts and integrates its output with the affordability flow from Phase 34.

### Claude's Discretion
```js
// Reuse childcareLedger with an entryType discriminator,
// or add a new tfcTransactions store with normalized entry types:
{
  id: auto,
  accountId: FK -> childcareAccounts.id,
  date: string,           // ISO date
  type: 'deposit' | 'top-up' | 'withdrawal',
  amount: number,         // pence
  quarterLabel: string    // e.g. 'Q1-2026' (computed on insert)
}
```

### Deferred Ideas (OUT OF SCOPE)
No explicit "Deferred Ideas" section exists in 35-CONTEXT.md.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHILD-01 | Recurring childcare expense tracking with provider list and required top-up formula | Confirms current childcare data model, missing provider store, available balance source, and required new formula helpers/UI loops |
| CHILD-02 | Top-up reminder in pay-period affordability calculation | Confirms contract source in ROADMAP: affordability input includes `childcareTopUps` array; identifies implementation gap (no affordability module yet in tree) |
| CHILD-03 | Entitlement period display per account | Confirms `getEntitlementPeriod()` exists and current UI only shows reconfirmation warning, not full period display |
| TECH-06 | Cloud sync store registration for new stores | Confirms current sync implementation uses generic `db.tables` snapshot, not explicit allowlist; identifies roadmap/requirements drift |
</phase_requirements>

## Summary
Phase 35 should be planned as a focused enhancement of the existing childcare account + ledger feature, not a net-new childcare subsystem. The current app already has childcare accounts, ledger transactions, balance calculation, and entitlement-period utility logic. What is missing is provider-level recurring cost modeling and a dedicated required top-up output that feeds affordability.

There is significant planning-document drift that must be resolved before coding tasks are finalized. The roadmap says Phase 35 is schema v16 and integrates into `src/utils/affordability.js`, but the current codebase schema ends at Dexie v19 and the affordability module is not present. The context doc also introduces `tfcTransactions` and CSV scope that are broader than the roadmap section for Phase 35.

**Primary recommendation:** Plan Phase 35 around roadmap scope (`childcareProviders` + top-up outputs + CHILD-02 integration), and explicitly defer `tfcTransactions`/CSV unless the user promotes them into Phase 35 scope.

## Key Findings (Research Questions)

1. Exact Dexie version to bump from:
- Current schema file ends at `db.version(19)`.
- Phase docs mention "Phase 34 sets v21", but that state is not present in this workspace.
- Planning truth from code: Phase 35 must currently bump from v19 to v20 unless Phase 34 schema changes are merged first.

2. Current `childcareAccounts` fields and `isTFCAccount`:
- Indexed fields: `childName`, `targetMonthlySpend`, `entitlementStart`, `isDisabled`, `openingBalance`.
- No `isTFCAccount` field exists currently.

3. `childcareLedger` existence and usable balance field:
- `childcareLedger` exists with fields/indexes: `accountId`, `date`, `type`, `amount`, `runningBalance`.
- There is no standalone `balance` column.
- `runningBalance` is recalculated and can be used as `currentAccountBalance` (latest entry), with fallback to account `openingBalance`.

4. Current `src/utils/childcare.js` capabilities:
- Has `calculateTopUp(depositAmountPence, remainingCapPence)` for gov top-up on deposits.
- Has `getEntitlementPeriod(entitlementStart, targetDate)` for rolling 3-month period.
- Has `calculateFundingGap(targetSpendPence, currentBalancePence)`.
- Does not have `monthlyEquivalent()` helper or CHILD-01 required top-up formula using providers and pending bonus.

5. Childcare UI rendering pattern:
- UI renders account list cards through an account loop in `_renderAccounts(accounts)`.
- Each card shows child name, cap hint, balance, target spend, and funding-gap badge.
- Ledger view is account-specific via `_renderLedger(accountId)`.
- This existing account-card loop is the correct insertion point for "Providers" and "Required top-up this period".

6. Cloud sync registration behavior:
- `src/ui/cloud-sync.js` does not define a cloud table allowlist; it uses `db.tables` for mutation hooks/dirty tracking.
- `src/utils/supabase-sync.js` push also snapshots all `db.tables` generically.
- Current implementation is generic table scan, not explicit `CLOUD_TABLES` allowlist.

7. `tfcTransactions` in 35-CONTEXT vs roadmap:
- `35-CONTEXT.md` introduces optional `tfcTransactions` (or reuse ledger) plus CSV and monthly reporting.
- `ROADMAP.md` Phase 35 section only requires `childcareProviders`, required top-up display, entitlement display, and affordability integration.
- Recommendation: treat `tfcTransactions`/CSV as future milestone unless user explicitly expands Phase 35 scope.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie | ^4.0.11 | IndexedDB schema/versioning and table APIs | Already established across all stores and migrations |
| Vitest | ^3.0.7 | Unit/integration tests | Existing test runner and config for this repo |
| date-fns | ^4.1.0 | Date manipulation | Already used in repository/business logic |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase JS | ^2.99.0 | Cloud snapshot storage/auth | For verifying TECH-06 sync persistence behavior |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing childcare ledger for provider planning | New `tfcTransactions` store | More normalized TFC reporting, but broader migration and UI scope than roadmap Phase 35 |

**Installation:**
```bash
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
src/
|-- db/
|   |-- schema.js          # Dexie versions and store declarations
|   `-- repository.js      # CRUD and calculation-adjacent data access
|-- ui/
|   `-- childcare.js       # account-list and ledger rendering
`-- utils/
    |-- childcare.js       # pure childcare calculations
    `-- supabase-sync.js   # cloud push/pull behavior
```

### Pattern 1: Account-Centric Childcare Rendering
**What:** Childcare tab has two modes: account-list cards and account ledger detail.
**When to use:** New per-account outputs (providers, required top-up, entitlement period) should be rendered in account card loop first.
**Example:**
```javascript
// Source: src/ui/childcare.js
const cardPromises = accounts.map(async (account) => {
  const balance = await childcareRepository.getBalance(account.id);
  const { gap } = calculateFundingGap(account.targetMonthlySpend || 0, balance);
  // render per-account card
});
```

### Pattern 2: Repository Owns Balance Truth
**What:** Balance is derived from ledger running balances and opening balance fallback.
**When to use:** CHILD-01 formula should consume repository balance, not duplicate balance computation in UI.
**Example:**
```javascript
// Source: src/db/repository.js
async getBalance(accountId) {
  const account = await db.childcareAccounts.get(accountId);
  const lastEntry = await db.childcareLedger
    .where('accountId').equals(accountId)
    .reverse()
    .sortBy('date')
    .then(entries => entries[0]);
  return lastEntry ? lastEntry.runningBalance : (account?.openingBalance || 0);
}
```

### Anti-Patterns to Avoid
- **Planning against stale phase docs only:** roadmap says v16 while code is v19; always derive migration target from schema file in branch.
- **Hardcoding cloud allowlist assumptions:** current sync captures all `db.tables`; adding manual registration logic without a deliberate refactor creates drift.
- **Duplicating balance math in UI:** use repository `getBalance()` and ledger recalculation path.
- **Coupling Phase 35 to speculative modules:** `src/utils/affordability.js` does not exist in this workspace.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entitlement period boundaries | New quarter/date math in UI | `getEntitlementPeriod()` in `src/utils/childcare.js` | Existing tested utility handles rolling 3-month periods |
| Account balance reconstruction in UI | Manual ledger summation in render methods | `childcareRepository.getBalance()` | Single source of truth and lower regression risk |
| Cloud snapshot table enumeration | Separate per-store serializer | Existing generic `db.tables` snapshot path | Current sync contract already serializes all stores |

**Key insight:** Phase 35 should extend established childcare and Dexie patterns, not introduce parallel data flow patterns unless scope is explicitly expanded.

## Common Pitfalls

### Pitfall 1: Version Drift Between Plan Docs and Code
**What goes wrong:** Migration number selected from roadmap (v16) conflicts with actual schema head (v19).
**Why it happens:** Planning docs lag code merges.
**How to avoid:** Use `src/db/schema.js` tail as source of truth at planning time.
**Warning signs:** Acceptance criteria mention older prior version than schema head.

### Pitfall 2: Mixing CHILD-01 and Older Funding Gap Logic
**What goes wrong:** UI continues using `targetMonthlySpend - balance` instead of provider-based formula with pending bonus.
**Why it happens:** Existing `calculateFundingGap()` is similar but not equivalent.
**How to avoid:** Introduce dedicated provider aggregation + required top-up helper.
**Warning signs:** Termly frequency and pending bonus are absent from calculations.

### Pitfall 3: Scope Creep from Context Additions
**What goes wrong:** `tfcTransactions` + CSV work consumes phase capacity.
**Why it happens:** Context file includes broader reporting goals than roadmap phase objective.
**How to avoid:** Treat roadmap requirement IDs as phase gate; explicitly defer extras.
**Warning signs:** New stores/utilities outside CHILD-01/02/03 and TECH-06 without requirement linkage.

## Assumptions to Carry Into Planning

1. Dexie schema head in this branch is v19; next migration is v20 unless upstream Phase 34 schema merge lands first.
2. `childcareProviders` is the only new store required by roadmap/requirements for Phase 35.
3. `childcareAccounts` currently has no `isTFCAccount`; planning should not rely on it without an explicit migration decision.
4. Current account balance for formula can be sourced from `childcareRepository.getBalance()` using latest `runningBalance` or `openingBalance` fallback.
5. Existing childcare utility module lacks provider monthly-equivalent aggregation and required-top-up formula; new helper(s) are needed.
6. Childcare UI already has per-account render loop suitable for adding provider list and top-up display.
7. Cloud snapshot currently uses generic `db.tables` scan, so new stores should sync automatically unless sync architecture is intentionally changed.

## Confirmed Phase 34 Integration Contract

From roadmap definition of Phase 34 engine inputs:
- Affordability engine accepts `childcareTopUps: [...]` (optional in Phase 34, default empty).
- Phase 35 responsibility is to produce per-account required top-up values and provide aggregate/top-up line items.
- Planner should define explicit output contract such as:
  - `[{ accountId, amountPence, description, date? }]` for timeline integration
  - aggregate `totalChildcareTopUpPence` for committed outgoing totals

Current-code caveat:
- `src/utils/affordability.js` is not present in this workspace. Integration target may be a future/new module or different implementation path in current branch.

## Files to Change With Rationale

- `src/db/schema.js`
  - Add `childcareProviders` store and migration at next valid version.
- `src/db/repository.js`
  - Add provider CRUD/query helpers and top-up aggregation entry points close to existing childcare repository patterns.
- `src/ui/childcare.js`
  - Add per-account Providers subsection, add/edit/delete controls, and "Required top-up this period" display in account loop.
- `src/utils/childcare.js`
  - Add pure helpers for provider monthly equivalent and required top-up formula including pending bonus handling.
- `src/ui/dashboard.js` (or active affordability rendering module)
  - Consume produced childcare top-up outputs as committed outgoings per CHILD-02.
- `src/utils/supabase-sync.js` (only if architecture changes)
  - Current generic table scan likely needs no explicit registration; if project chooses explicit allowlist pattern, this file is where to enforce it.
- `src/ui/cloud-sync.js` (likely no schema registration change required)
  - Uses `db.tables` hooks for dirty-state tracking; should naturally include new store.
- `src/ui/childcare.test.js` and/or `src/utils/childcare.test.js`
  - Add tests for termly monthly-equivalent conversion, required top-up floor-at-zero behavior, and UI account-card rendering outputs.

## Code Examples

Verified patterns from current codebase:

### Childcare Utility Pattern
```javascript
// Source: src/utils/childcare.js
export function calculateFundingGap(targetSpendPence, currentBalancePence) {
  const gap = Math.max(0, targetSpendPence - currentBalancePence);
  const suggestedDeposit = Math.round(gap * 0.8);
  return { gap, suggestedDeposit };
}
```

### Generic Cloud Snapshot Pattern
```javascript
// Source: src/utils/supabase-sync.js
const tableData = Object.fromEntries(
  await Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()]))
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Childcare top-up via target spend gap only | CHILD-01 provider-based periodic spend model | Required in v3.0 roadmap Phase 35 | More accurate top-up planning per account |
| Manual assumptions about sync registration | Generic table snapshot through `db.tables` | Present in current supabase-sync implementation | New tables likely sync without explicit allowlist edits |
| Roadmap schema sequence (v16 for Phase 35) | Codebase schema head at v19 | Current branch state | Planning must reconcile before migration tasks |

**Deprecated/outdated:**
- Roadmap version sequencing around Phase 35 (`v16`) is outdated relative to current schema file head (`v19`) in this workspace.

## Open Questions

1. **Schema baseline mismatch (v19 code vs v21 expectation)**
- What we know: `src/db/schema.js` currently ends at v19.
- What's unclear: whether unmerged/local Phase 34 work exists elsewhere that advances to v21.
- Recommendation: planner should include a pre-task to verify schema head immediately before implementation.

2. **Affordability integration target module**
- What we know: roadmap references `src/utils/affordability.js` contract.
- What's unclear: in this workspace, no affordability module currently exists.
- Recommendation: define integration point by current code owner before task decomposition.

3. **`tfcTransactions` and CSV in Phase 35 context**
- What we know: included in 35-CONTEXT but not in roadmap Phase 35 requirement mapping.
- What's unclear: whether these are promoted to required scope for this phase.
- Recommendation: keep out of Phase 35 plan unless explicitly approved.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.7 (`jsdom`) |
| Config file | `vitest.config.js` |
| Quick run command | `npm test -- src/utils/childcare.test.js` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHILD-01 | Provider monthly/termly aggregation and required top-up formula | unit | `npm test -- src/utils/childcare.test.js` | ❌ Wave 0 (new provider/top-up cases missing) |
| CHILD-02 | Top-up appears in affordability committed outgoings/timeline | integration | `npm test -- src/ui/dashboard.invariant.test.js` | ❌ Wave 0 (no childcare top-up assertions) |
| CHILD-03 | Entitlement period clearly displayed per account in childcare tab | ui/integration | `npm test -- src/ui/childcare.test.js` | ❌ Wave 0 (test file missing) |
| TECH-06 | New childcare provider store survives cloud push/pull | integration | `npm test -- src/utils/supabase-sync.test.js` | ⚠️ Partial (needs new assertions for added store) |

### Sampling Rate
- **Per task commit:** `npm test -- src/utils/childcare.test.js`
- **Per wave merge:** `npm test -- src/utils/childcare.test.js src/utils/supabase-sync.test.js src/ui/childcare.test.js`
- **Phase gate:** `npm test`

### Wave 0 Gaps
- [ ] `src/ui/childcare.test.js` - UI behavior for providers/top-up/entitlement display.
- [ ] Expand `src/utils/childcare.test.js` with provider frequency conversion + required top-up formula tests.
- [ ] Expand `src/utils/supabase-sync.test.js` to verify new store serialization/restoration behavior.
- [ ] Add/confirm repository tests in `src/db/repository.test.js` for `childcareProviders` CRUD and account-scoped queries.

## Sources

### Primary (HIGH confidence)
- `src/db/schema.js` - current schema head/version and childcare store definitions
- `src/db/repository.js` - childcare account/ledger CRUD and balance semantics
- `src/ui/childcare.js` - account rendering loop and current entitlement display behavior
- `src/utils/childcare.js` - existing TFC utility functions and missing helpers
- `src/utils/supabase-sync.js` - cloud snapshot table registration behavior
- `.planning/ROADMAP.md` - Phase 34/35 planned integration contract and scope
- `.planning/REQUIREMENTS.md` - CHILD-01/02/03 and TECH-06 normative requirements
- `.planning/phases/35-childcare-top-up-planner/35-CONTEXT.md` - expanded context scope including tfcTransactions option

### Secondary (MEDIUM confidence)
- None

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions verified in `package.json` and active code usage
- Architecture: HIGH - patterns verified directly in current repository/UI implementations
- Pitfalls: HIGH - derived from direct roadmap/code/context mismatches and concrete code behavior

**Research date:** 2026-03-15
**Valid until:** 2026-04-14
