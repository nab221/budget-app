# Phase 33: Income & Spending Configuration - Research

**Researched:** 2026-03-15
**Domain:** Phase scope correction, income source configuration, spending bucket configuration, payday projection, Dexie migration planning
**Confidence:** MEDIUM

<user_constraints>
## User Constraints

- Phase 33 research must treat the prior "I personally have two income sources" statement as anecdotal, not as a product limit.
- Phase 33 must support an arbitrary number of income sources.
- The research must preserve the dependency on Phase 31 banking-calendar outputs.
- The research must preserve Phase 34 as the downstream consumer of Phase 33 outputs.
- The existing [33-CONTEXT.md](.planning/phases/33-income-spending-configuration/33-CONTEXT.md) must be evaluated for scope correctness and replaced conceptually if mis-scoped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-06 | Income configuration | Must be rewritten from exactly two sources to arbitrary row-based income source configuration. |
| PLAN-04 | Spending buckets | Remains in Phase 33; store and UI scope are valid with minor clarification. |
| TECH-06 | Cloud sync store registration | Current code snapshots all Dexie tables generically, so the phase needs sync verification/tests more than bespoke allowlist code. |
</phase_requirements>

## Summary

Phase 33 is currently misplanned in two different ways. First, the planning artifacts encode a hard maximum of two income sources even though the product requirement is now explicit: income sources must be unbounded. Second, the dedicated [33-CONTEXT.md](.planning/phases/33-income-spending-configuration/33-CONTEXT.md) is for childcare providers and ledger enhancements, which conflicts with the roadmap and belongs with Phase 35 childcare work, not Phase 33.

The corrected Phase 33 scope is: add sync-safe configuration for an arbitrary number of income sources plus configurable spending buckets, and expose banking-calendar-aware payday projection helpers that Phase 34 can consume. Phase 33 should not absorb pay-period calculation, current-balance entry, or childcare provider modeling.

**Primary recommendation:** Re-scope Phase 33 as a pure configuration-and-projection phase with row-based `incomeSources` and `spendingBuckets` stores, no source cap, and helper APIs that return the next upcoming income event(s) using Phase 31 banking-calendar adjustment.

## Assumptions To Remove

| Artifact | Current assumption | Correction |
|---------|--------------------|------------|
| [.planning/ROADMAP.md](.planning/ROADMAP.md) | "both income streams" | Replace with "all configured income sources". |
| [.planning/ROADMAP.md](.planning/ROADMAP.md) | "Add two configurable income sources" | Replace with arbitrary number of income sources. |
| [.planning/ROADMAP.md](.planning/ROADMAP.md) | "max 2 sources enforced in the UI" | Remove cap and any 3rd-source warning. |
| [.planning/ROADMAP.md](.planning/ROADMAP.md) | Acceptance criteria block source 3+ | Replace with add/edit/delete/reorder for 0..N sources. |
| [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) | PLAN-06 says "exactly two income sources" | Rewrite PLAN-06 to "one or more configurable income sources" or "arbitrary number of income sources". |
| [.planning/PROJECT.md](.planning/PROJECT.md) | Product model says "Two income sources" | Replace with arbitrary configured income sources. |
| [.planning/PROJECT.md](.planning/PROJECT.md) | Target features say "Income configuration (2 sources)" | Remove numeric cap. |
| [.planning/phases/34-pay-period-affordability-engine/34-CONTEXT.md](.planning/phases/34-pay-period-affordability-engine/34-CONTEXT.md) | Singular pay date/payDay from a salary entry | Replace with Phase 33 income-source collection and next-income-event helpers. |
| [.planning/phases/33-income-spending-configuration/33-CONTEXT.md](.planning/phases/33-income-spending-configuration/33-CONTEXT.md) | Childcare providers are Phase 33 | Entire file is mis-scoped; replace with actual Phase 33 income/spending configuration context. |
| [.planning/phases/35-childcare-top-up-planner/35-CONTEXT.md](.planning/phases/35-childcare-top-up-planner/35-CONTEXT.md) | Phase 35 builds on provider model from Phase 33 | Update to make provider model part of Phase 35 itself, or split Phase 35 if needed. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS ES modules | current repo | UI and business logic | Existing app architecture; no framework migration cost. |
| Dexie | 4.0.11 | IndexedDB schema/stores/migrations | Existing persistence layer and snapshot source for sync. |
| date-fns | 4.1.0 | Date math for payday derivation and prorating | Already used in repository code and planning. |
| Vitest | 3.0.7 | Unit/integration tests | Existing test framework across `src/**`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| [src/utils/banking-calendar.js](src/utils/banking-calendar.js) | Phase 31 shipped | Bank-holiday/weekend adjustment | Any next-payday or projected-payday calculation. |
| [src/utils/supabase-sync.js](src/utils/supabase-sync.js) | current repo | Cloud snapshot push/pull | Verification of new-store persistence through sync. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Row-based `incomeSources` store | Fixed `primaryIncome`/`secondaryIncome` fields | Simpler UI short-term, but it hard-codes the wrong product constraint and blocks future households. |
| Dexie-backed config stores | localStorage settings | Easier wiring, but not sync-safe and inconsistent with Phase 33 roadmap intent. |
| Derived next-payday helpers | Storing cached next payday in DB | Stored derived data goes stale and duplicates Phase 31 logic. |

**Installation:**
```bash
# No additional packages required for Phase 33
```

## Architecture Patterns

### Recommended Project Structure
```text
src/
├── db/
│   ├── schema.js                  # add incomeSources + spendingBuckets to next real Dexie version
│   └── repository.js              # CRUD, seed defaults, ordering helpers
├── utils/
│   └── income.js                  # payday derivation + upcoming income-event helpers
├── ui/
│   └── income-spending-settings.js # render Settings sections into existing Settings tab
├── app.js                         # mount settings renderer / save handlers
└── index.html                     # placeholders in existing Settings panel
```

### Pattern 1: Configuration Store Separate From Transaction Ledger
**What:** Keep `incomeSources` separate from the existing `income` and `expectedIncome` ledgers.
**When to use:** Always. Phase 33 is configuring future expected inflows, not recording posted income transactions.
**Example:**
```js
// Source: repo pattern from src/db/repository.js and src/db/schema.js
incomeSources: {
  id,
  name,
  monthlyAmount,
  payDateRule,     // 'nth-of-month' | 'last-day' | 'last-working-day'
  payDateDay,      // required only for nth-of-month
  isActive,
  displayOrder
}
```

### Pattern 2: Derive Payday, Do Not Persist It
**What:** Compute nominal and adjusted payday from source config plus a reference date; store only the rules.
**When to use:** For Settings display and for Phase 34 inputs.
**Example:**
```js
// Source: Phase 31 shipped banking-calendar module
getNextIncomeEvent(source, fromDate) -> {
  sourceId,
  sourceName,
  amount,
  nominalDate,
  adjustedDate
}
```

### Pattern 3: Phase 34 Should Consume Events, Not A Single `payDay`
**What:** Phase 33 should expose `getNextIncomeEvent()` and `getUpcomingIncomeEvents()` over the whole configured source set.
**When to use:** Always for downstream affordability logic.
**Example:**
```js
const events = getUpcomingIncomeEvents(activeSources, today, 3);
const nextPayday = events[0]?.adjustedDate ?? null;
```

### Anti-Patterns to Avoid
- **Two-slot schema:** Do not model `primaryIncome` and `secondaryIncome` fields anywhere.
- **Phase leakage into 34:** Do not add pay-period navigator or balance-entry logic to Phase 33.
- **Phase leakage into 35:** Do not move childcare provider or TFC work into Phase 33.
- **Stored derived dates:** Do not persist `nextPayday` in IndexedDB as authoritative data.

## UX Implications

| Area | Recommended UX |
|------|-----------------|
| Income sources | Repeating list in Settings with add/remove controls and no cap. Empty state is valid. |
| Source form | Fields: name, monthly amount, pay-date rule, conditional pay-date day, active toggle. |
| Payday display | Show the next nominal payday and the banking-calendar-adjusted payday when different. |
| Spending buckets | Seed defaults once on first creation; allow add/edit/delete; no transaction-level tracking implied. |
| Ordering | Support stable display order for sources and buckets; Phase 34 should consume that ordering only for presentation, not logic. |
| Validation messaging | Remove any warning about adding a 3rd income source. Keep only rule validation errors. |

## Migration Implications

| Topic | Recommendation |
|------|-----------------|
| Dexie versioning | Do not use the roadmap's synthetic "v15" literally. Current code is already at Dexie v19 after Phase 31; Phase 33 must bump from the actual runtime version that exists after Phase 32 lands. |
| Existing users | `incomeSources` should start empty. `spendingBuckets` should seed defaults only when the store is empty on first initialization. |
| Sync | Current [src/utils/supabase-sync.js](src/utils/supabase-sync.js) serializes `db.tables` generically; new stores will be included automatically if present in schema. Add verification tests instead of redundant allowlist code. |
| File backup/import | Current backup/export also iterates all DB tables generically. Verify import/export with the new stores; no separate file-format work should be needed. |
| Local settings boundary | Keep income source and bucket data in Dexie, not localStorage, so they participate in backup/sync consistently. |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bank-holiday payday shifting | New date-adjustment logic in Phase 33 | [src/utils/banking-calendar.js](src/utils/banking-calendar.js) | Phase 31 already solved weekend/bank-holiday adjustment and verified it. |
| Two-source UI cap | Custom warnings / blocked add flow | Unbounded list UI | The cap is a planning bug, not a product rule. |
| Store-specific sync registration | Manual per-store snapshot assembly | Existing generic `db.tables` snapshot path | Current cloud sync already serializes every Dexie table. |
| Shared pay-period config in Phase 33 | Global `payDay` preference in localStorage | Keep Phase 33 focused on source rules; let Phase 34 decide pay-period semantics | Prevents phase boundary drift and downstream rewrites. |

**Key insight:** The safest root fix is not "allow 3 instead of 2"; it is removing all slot-based assumptions and making income configuration collection-based from the start.

## Common Pitfalls

### Pitfall 1: Fixing The UI Cap But Keeping A Two-Source Mental Model
**What goes wrong:** The add button allows 3+ sources, but data structures, copy, or downstream logic still assume 2.
**Why it happens:** The cap exists in roadmap language, requirement text, project summary, and Phase 34 assumptions.
**How to avoid:** Replace every singular/two-source phrase with collection semantics before planning implementation tasks.
**Warning signs:** Variable names like `primaryIncome`, `secondaryIncome`, `bothIncomeStreams`, or `payDay` survive into the plan.

### Pitfall 2: Reusing The Historical `income` Store For Configuration
**What goes wrong:** Future expected paydays get mixed with posted income transactions.
**Why it happens:** The repo already has `income` and `expectedIncome` tables, so adding one more source-related concern looks superficially convenient.
**How to avoid:** Keep Phase 33 configuration in dedicated stores and derive events from config.
**Warning signs:** Plans mention adding `payDateRule` or `payDateDay` fields to the existing `income` table.

### Pitfall 3: Breaking The Phase 31 Dependency Accidentally
**What goes wrong:** Settings shows nominal dates only, while Phase 34 later assumes adjusted dates.
**Why it happens:** Payday logic is easy to implement with plain calendar math and forget the bank-holiday rule.
**How to avoid:** Route all projected payday display through Phase 31 adjustment helpers.
**Warning signs:** No explicit reference to `adjustedPaymentDate()` or `nextWorkingDay()` in Phase 33 tasks.

### Pitfall 4: Overcommitting Phase 33 To Pay-Period Semantics
**What goes wrong:** Phase 33 starts implementing pay-period bounds, navigator state, or balance entry.
**Why it happens:** Phase 34 context is currently written around a singular pay period and bleeds backward.
**How to avoid:** Limit Phase 33 outputs to configuration + projected income events.
**Warning signs:** Phase 33 tasks introduce `payFrequency`, navigator UI, or dashboard changes unrelated to settings.

### Pitfall 5: Following Stale Sync Instructions Literally
**What goes wrong:** Extra sync plumbing is added even though the current sync path already snapshots all tables.
**Why it happens:** ROADMAP/REQUIREMENTS still describe allowlist-style registration.
**How to avoid:** Verify actual implementation before planning store-registration work.
**Warning signs:** Tasks target nonexistent allowlist arrays in `supabase-sync.js`.

## Code Examples

Verified repo-aligned patterns:

### Add A Dedicated Config Repository
```js
// Source: repository pattern from src/db/repository.js
export const incomeSourceRepository = {
  ...createBaseRepository(db.incomeSources, ['monthlyAmount'], {
    isActive: true,
    displayOrder: 0,
  }),
};
```

### Compute Adjusted Paydays From Rules
```js
// Source: Phase 31 adjusted date pattern
import { adjustedPaymentDate } from './banking-calendar.js';

export function getNextIncomeEvent(source, fromDate) {
  const nominalDate = deriveNominalPayday(source, fromDate);
  return {
    sourceId: source.id,
    adjustedDate: adjustedPaymentDate(nominalDate, source.payDateRule === 'last-working-day'
      ? 'next-working-day'
      : 'none'),
  };
}
```

### Phase 34 Hand-off Shape
```js
// Source: corrected downstream contract for Phase 34
const nextEvent = getUpcomingIncomeEvents(sources, today, 1)[0] ?? null;
// Phase 34 consumes nextEvent.adjustedDate and can also include future income events in its timeline.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Exactly two income sources | Arbitrary row-based income sources | 2026-03-15 requirement clarification | Removes artificial product limit and fixes Phase 34 input model. |
| Store-specific sync registration assumption | Generic snapshot of `db.tables` in current sync code | Already true in current repo | Phase 33 sync work becomes verification-driven, not plumbing-driven. |
| Childcare providers treated as Phase 33 | Childcare providers belong to Phase 35 scope | Current roadmap vs misplaced context | Prevents phase collision and protects Phase 33 focus. |

**Deprecated/outdated:**
- Two-source acceptance criteria in [ROADMAP.md](.planning/ROADMAP.md): outdated and should be replaced before planning.
- PLAN-06 wording in [REQUIREMENTS.md](.planning/REQUIREMENTS.md): outdated and should be corrected before tasks are generated.
- [33-CONTEXT.md](.planning/phases/33-income-spending-configuration/33-CONTEXT.md): wrong domain, not safe to use for planning.

## Open Questions

1. **How should Phase 34 define a "pay period" when there are multiple income sources?**
   What we know: the current Phase 34 context assumes one pay date, but the roadmap headline already depends on multiple income streams.
   What's unclear: whether the period boundary should be the next upcoming income event, a user-selected anchor source, or a more general rolling cashflow window.
   Recommendation: For v3.0 planning, define the immediate affordability window as `today -> next upcoming income event` and let the navigator move across successive income-event windows.

2. **Should weekly/fortnightly income frequency be added in Phase 33?**
   What we know: current Phase 33 roadmap rules are monthly-only, while Phase 34 context mentions weekly and fortnightly pay.
   What's unclear: whether that was intended for v3.0 core or copied from a broader future requirement.
   Recommendation: Keep Phase 33 monthly-rule scope unless Phase 34 is explicitly widened in the same planning pass; otherwise the phase expands materially.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.7 |
| Config file | none detected |
| Quick run command | `npx vitest run src/utils/income.test.js src/db/repository.test.js src/utils/supabase-sync.test.js` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-06 | arbitrary number of income sources can be created/updated/deleted with payday-rule validation | unit + UI integration | `npx vitest run src/utils/income.test.js src/ui/income-spending-settings.test.js` | ❌ Wave 0 |
| PLAN-04 | spending buckets seed once and remain editable | repository + UI integration | `npx vitest run src/db/repository.test.js src/ui/income-spending-settings.test.js` | ❌ Wave 0 |
| TECH-06 | new stores survive cloud snapshot round-trip | unit | `npx vitest run src/utils/supabase-sync.test.js` | ✅ existing file, new cases needed |

### Sampling Rate
- **Per task commit:** `npx vitest run src/utils/income.test.js src/db/repository.test.js src/utils/supabase-sync.test.js`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/income.test.js` - payday derivation and banking-calendar-adjusted next-income-event helpers
- [ ] `src/ui/income-spending-settings.test.js` - add/edit/delete flows, validation, uncapped list behavior
- [ ] `src/db/repository.test.js` additions - default bucket seeding, ordering, empty-state migration coverage
- [ ] `src/utils/supabase-sync.test.js` additions - prove new Dexie tables are included in snapshot payload

## Sources

### Primary (HIGH confidence)
- Repo planning artifacts: [ROADMAP.md](.planning/ROADMAP.md), [REQUIREMENTS.md](.planning/REQUIREMENTS.md), [PROJECT.md](.planning/PROJECT.md), [STATE.md](.planning/STATE.md)
- Phase documents: [33-CONTEXT.md](.planning/phases/33-income-spending-configuration/33-CONTEXT.md), [34-CONTEXT.md](.planning/phases/34-pay-period-affordability-engine/34-CONTEXT.md), [35-CONTEXT.md](.planning/phases/35-childcare-top-up-planner/35-CONTEXT.md)
- Current implementation: [src/db/schema.js](src/db/schema.js), [src/db/repository.js](src/db/repository.js), [src/utils/supabase-sync.js](src/utils/supabase-sync.js), [src/app.js](src/app.js), [index.html](index.html), [package.json](package.json)
- Phase 31 verification: [31-VERIFICATION.md](.planning/phases/31-banking-calendar-recurrence-upgrade/31-VERIFICATION.md)

### Secondary (MEDIUM confidence)
- Existing testing patterns from [src/utils/supabase-sync.test.js](src/utils/supabase-sync.test.js) and repo-wide Vitest usage

### Tertiary (LOW confidence)
- None; this research was repository-scoped and did not require external ecosystem claims

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - derived directly from current code and package versions
- Architecture: MEDIUM - Phase 34 semantics need one explicit planning decision after Phase 33 is corrected
- Pitfalls: HIGH - contradictions are visible in current planning artifacts and implementation patterns

**Research date:** 2026-03-15
**Valid until:** 2026-04-14