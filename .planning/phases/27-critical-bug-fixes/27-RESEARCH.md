# Phase 27: Critical Bug Fixes, Cloud-Sync Hardening & Data Integrity Validator - Research

**Researched:** 2026-03-14
**Domain:** Vanilla JS / Dexie.js IndexedDB / CSS Flexbox / DOM event management / XSS sanitization
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

**CRITICAL:** CONTEXT.md exists for Phase 27. Locked decisions are copied verbatim below and MUST be honored by the planner.

### Locked Decisions

- Fix only the five confirmed bugs listed (cloud-sync event listener accumulation, XSS in cloud snapshot modal, missing init guard / duplicate auth listeners, heatmap cross-year split, header save-dot layout on mobile)
- Deliver the new `src/utils/data-integrity.js` module with `validateDataIntegrity()` and `cleanOrphanedRecords()` public API
- All fixes are surgical and targeted — no refactoring beyond the specific bug surface
- No new npm packages; use only existing stack (Dexie.js, Vitest, Vite, vanilla JS)
- No UI redesign
- No schema changes
- Existing 354+ Vitest tests must remain green

### Claude's Discretion

- Internal implementation details of the data-integrity module (iteration strategy, issue object shape details beyond the specified fields)
- Whether to use `onclick` assignment or `addEventListener` + explicit removal for the event listener fix (either is acceptable as long as accumulation is prevented)
- CSS specificity approach for the mobile header fix (inline rule, existing rule amendment, or new rule block)

### Deferred Ideas (OUT OF SCOPE)

- `childcareProviders.accountId` → `childcareAccounts.id` FK validation (deferred to Phase 35)
- Any UI redesign or new features beyond the integrity validator
- Schema version bump or migrations
</user_constraints>

<research_summary>
## Summary

Phase 27 is a pure bug-fix and hardening phase within an existing vanilla JS + Dexie.js budget application. No external research for new libraries is required — the entire implementation surface is the existing codebase. Research was conducted by directly auditing the affected source files: `src/ui/cloud-sync.js` (~1447 lines), `src/ui/heatmap.js` (279 lines), `css/main.css`, `src/db/schema.js`, and `src/app.js`.

The three cloud-sync bugs (Bug 1, 2, 3) are all contained within `cloud-sync.js`. Bug 1 (event listener accumulation) exists in the modal's `addEventListener` calls at lines 1179 and 1197; the settings panel already safely uses `.onclick =` assignment. Bug 2 (XSS) is a real risk: `_renderSignedIn` at line 1237 interpolates `session.user.email` directly into innerHTML without escaping, while the `escHtml` utility already exists in the same file and is used elsewhere. Bug 3 (duplicate auth listeners) is already largely mitigated by the `this._initialized` guard at line 84, but `_bindAuthListener` and `_bindPreviewListener` lack their own idempotency flags, so the defence-in-depth fix is still warranted. Bug 4 (heatmap cross-year) requires pre-filtering `dailyData` at the call sites in `dashboard.js` and `transactions.js` before passing to `renderSpendingHeatmap()`, since the inner loop already has a `yearNum` guard but the scale calculation at line 57 uses unfiltered data. Bug 5 (mobile header dot) requires a targeted CSS fix to prevent the save-dot from wrapping.

The new Data Integrity Validator (Bug 6) is a net-new `src/utils/data-integrity.js` module. Dexie's `bulkGet()` API is the right batch-lookup primitive — load all child-table records, collect unique referenced IDs, call `bulkGet()` on the parent table, and flag any record whose parent entry comes back `undefined`.

**Primary recommendation:** Implement all fixes surgically using existing patterns already present in the codebase. Use `escHtml` (already defined) for XSS fixes. Use `bulkGet()` (Dexie built-in) for FK validation. Use `.onclick =` assignment (already the pattern in `_renderSignedIn`) for the listener accumulation fix.
</research_summary>

<standard_stack>
## Standard Stack

No new libraries are introduced in Phase 27. The relevant existing stack is:

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | (project version) | IndexedDB ORM | Provides `bulkGet()`, `toArray()`, transaction support |
| Vitest | (project version) | Unit testing | All existing tests use Vitest; new data-integrity tests must use it too |
| Vite | (project version) | Build tool | Dev server, HMR, production bundling |

### Supporting (already in use)
| Utility | Location | Purpose | When to Use |
|---------|---------|---------|-------------|
| `escHtml()` | `src/ui/cloud-sync.js` (inline) | HTML entity escaping | All innerHTML interpolations of user-controlled strings |
| `templateUI.showModal()` | `src/ui/cloud-sync.js` | Modal rendering via innerHTML | Cloud snapshot preview modal |
| `db` (Dexie instance) | `src/db/` | IndexedDB access | All FK validation queries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `escHtml()` inline | `safeHTML()` from `src/ui/render.js` | CONTEXT.md references `safeHTML()` as an option; either works — prefer `escHtml()` since it already exists in the same file, avoiding an extra import |
| Dexie `bulkGet()` | Individual `get()` per record | `bulkGet()` is a single IDB transaction; individual `get()` calls create N transactions and are O(N) round-trips |
| `.onclick =` assignment | `addEventListener` + `removeEventListener` | `.onclick` is simpler and guarantees no accumulation; `removeEventListener` requires a stable function reference |

**Installation:** None required.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended File Structure (Phase 27 changes)
```
src/
├── ui/
│   ├── cloud-sync.js       # Bugs 1, 2, 3: listener fix + XSS fix + init guard
│   ├── heatmap.js          # Bug 4: scale calculation fix
│   ├── dashboard.js        # Bug 4: pre-filter dailyData before calling heatmap
│   └── transactions.js     # Bug 4: pre-filter dailyData if heatmap called here
├── utils/
│   └── data-integrity.js   # Bug 6: NEW MODULE
│   └── data-integrity.test.js  # Bug 6: NEW TESTS
└── app.js                  # Bug 6: call validateDataIntegrity() on startup
css/
└── main.css                # Bug 5: save-dot flex layout fix
```

### Pattern 1: Event Listener Idempotency via `.onclick` Assignment
**What:** Replace `addEventListener('click', handler)` on modal buttons with direct `.onclick = handler` assignment. Each assignment overwrites the previous one — no accumulation possible.
**When to use:** Any element re-rendered into the DOM (modal buttons, dynamically created elements) where accumulating listeners would cause multi-fire.
**Example:**
```js
// BEFORE (accumulates on each modal open):
document.getElementById('cloudPushBtn').addEventListener('click', () => this._handlePush());

// AFTER (safe — overwrites previous assignment):
document.getElementById('cloudPushBtn').onclick = () => this._handlePush();
```

### Pattern 2: Defence-in-Depth Init Guards
**What:** Each method that registers external listeners (auth state, preview events) carries its own boolean flag, checked at entry and set before registration.
**When to use:** Any method that registers Supabase auth callbacks, event listeners, or subscriptions, and that may theoretically be reached more than once.
**Example:**
```js
_bindAuthListener() {
  if (this._authListenerBound) return;
  this._authListenerBound = true;
  supabase.auth.onAuthStateChange((event, session) => {
    this._handleAuthChange(event, session);
  });
}

_bindPreviewListener() {
  if (this._previewListenerBound) return;
  this._previewListenerBound = true;
  // ... register listener
}
```
Reset flags in cleanup / sign-out if the listener lifetime should match the session.

### Pattern 3: innerHTML Sanitization Using Existing `escHtml`
**What:** Wrap every user-controlled string in `escHtml()` before interpolating into an innerHTML template literal. The function already exists in `cloud-sync.js`.
**When to use:** Every `.innerHTML = \`...\`` or `.innerHTML +=` that includes data from Supabase payloads, user session objects, or imported file content.
**Example:**
```js
// BEFORE (XSS risk — raw email interpolated):
container.innerHTML = `<p>Signed in as ${session.user.email}</p>`;

// AFTER (safe):
container.innerHTML = `<p>Signed in as ${escHtml(session.user.email)}</p>`;
```
Audit checklist: grep `cloud-sync.js` for every `innerHTML` assignment and verify each interpolated expression is wrapped in `escHtml()`.

### Pattern 4: Heatmap Data Pre-Filtering at Call Site
**What:** Filter `dailyData` to only entries whose date falls within the target `year` before passing the map to `renderSpendingHeatmap()`. This isolates the scale calculation (line 57) from cross-year noise.
**When to use:** Wherever `renderSpendingHeatmap()` is called in `dashboard.js` or `transactions.js`.
**Example:**
```js
// Pre-filter at call site before invoking heatmap:
const filteredData = Object.fromEntries(
  Object.entries(dailyData).filter(([dateStr]) => {
    return new Date(dateStr).getFullYear() === year;
  })
);
renderSpendingHeatmap(containerId, year, filteredData, options);
```
The inner loop guards inside `heatmap.js` (lines 134-135) remain as a secondary safety net but the root fix lives at the call site.

### Pattern 5: Dexie FK Validation via `bulkGet()`
**What:** Load all records from the child table, extract the set of unique referenced IDs, call `db.table(parentStore).bulkGet(ids)` to retrieve them all in one transaction, then flag any record whose referenced ID returned `undefined`.
**When to use:** `validateDataIntegrity()` in `src/utils/data-integrity.js` for each of the 7 FK relationships.
**Example:**
```js
// Source: Dexie.js docs — Table.bulkGet()
async function checkForeignKey(db, childStore, field, parentStore) {
  const issues = [];
  const children = await db.table(childStore).toArray();

  // Collect non-null referenced IDs
  const ids = [...new Set(
    children
      .map(r => r[field])
      .filter(id => id != null)
  )];

  if (ids.length === 0) return issues;

  const parents = await db.table(parentStore).bulkGet(ids);
  const parentMap = new Map(ids.map((id, i) => [id, parents[i]]));

  for (const record of children) {
    const refId = record[field];
    if (refId != null && parentMap.get(refId) === undefined) {
      issues.push({
        store: childStore,
        recordId: record.id,
        field,
        referencedStore: parentStore,
        missingId: refId
      });
    }
  }
  return issues;
}
```

### Pattern 6: CSS Flex Layout Fix for Save-Dot
**What:** Ensure the save-dot element is `display: inline-flex` (or `inline-block`), has `flex-shrink: 0`, and that the toolbar does not force a wrap for this element. If `flex-wrap: wrap` is required for other toolbar children, use `order` or a wrapping guard to keep the dot inline.
**When to use:** Mobile viewport where the toolbar wraps.
**Example:**
```css
/* In css/main.css — target the specific save-dot class */
.save-dot {          /* or whatever the actual class name is */
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
}

/* If the toolbar must allow wrapping for other elements but not the dot: */
.toolbar .save-dot {
  order: -1;   /* pull to start of flex row, before wrappable items */
}
```

### Anti-Patterns to Avoid
- **`addEventListener` on re-rendered modal buttons:** Each modal open accumulates a new listener even if the element was freshly created, if the element reference is reused. Use `.onclick =` instead.
- **Raw string interpolation into innerHTML:** Any string from Supabase, user session, or imported data must go through `escHtml()` before innerHTML insertion.
- **Individual Dexie `get()` calls in a loop:** This creates N separate IDB transactions. Use `bulkGet()` for batch parent-existence checks.
- **Filtering heatmap data inside `heatmap.js` scale calculation:** The fix should be at the call site so `heatmap.js` remains a pure rendering function that trusts its input is pre-filtered.
- **Registering Supabase `onAuthStateChange` without a guard:** Each call registers a new subscription. Without a guard, navigating away and back multiplies auth callbacks.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batch parent-record existence check | Loop of `await db.table(store).get(id)` per record | `db.table(parentStore).bulkGet(ids)` | Single IDB transaction, O(1) round-trips instead of O(N); Dexie handles the batching |
| HTML entity escaping | Custom regex replace chain | `escHtml()` already in `cloud-sync.js` | Already handles `&`, `<`, `>` edge cases; consistent with the rest of the file |
| Modal DOM listener cleanup | Manual `removeEventListener` with stored function refs | `.onclick =` assignment | No reference storage needed; assignment semantics guarantee single handler |
| FK relationship registry | Hard-coded switch/case per store pair | Array of `{ childStore, field, parentStore }` descriptor objects iterated by `checkForeignKey()` | Adding a new FK check in Phase 35 becomes a one-line array push |
| Date string year extraction | Custom date parser | `new Date(dateStr).getFullYear()` | ISO date strings parse correctly with native `Date`; no library needed |

**Key insight:** Every problem in Phase 27 has an existing solution already present in the codebase or in Dexie's API. The goal is to apply these consistently, not to introduce new utilities.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Assuming Modal DOM Replacement Cleans Up Listeners (Bug 1)
**What goes wrong:** Developer sees that `templateUI.showModal()` uses `innerHTML =` to replace the modal body and concludes that old listeners are garbage-collected, so no accumulation occurs. This reasoning is fragile.
**Why it happens:** If `showModal()` ever reuses the container element rather than replacing it, or if the element reference is held elsewhere, listeners accumulate silently. The bug is intermittently reproducible.
**How to avoid:** Use `.onclick =` assignment regardless of whether the DOM is replaced. It costs nothing and is unconditionally safe.
**Warning signs:** Push or pull firing N times after N modal opens, especially on slow connections where the modal is opened while a previous operation is pending.

### Pitfall 2: Partial XSS Audit (Bug 2)
**What goes wrong:** Only the reported `session.user.email` line is fixed, but other raw interpolations remain in the same file.
**Why it happens:** Point-fix without auditing the full file. The codebase already uses `escHtml(email)` correctly in some places (line 1157) but inconsistently in others (line 1237).
**How to avoid:** Grep `cloud-sync.js` for every `innerHTML` assignment: `grep -n 'innerHTML' src/ui/cloud-sync.js`. For each match, verify that every interpolated expression (`${...}`) is wrapped in `escHtml()`.
**Warning signs:** A snapshot modal or settings panel that renders raw angle brackets from a malformed cloud payload as visible HTML tags rather than escaped text.

### Pitfall 3: Async Dexie Operations Blocking UI Init (Bug 6)
**What goes wrong:** `validateDataIntegrity()` is called during `DOMContentLoaded` → `init()` with `await`, delaying the entire UI render until all FK checks complete. On large databases this can be 200–500 ms of visible blank screen.
**Why it happens:** The natural pattern for async validation is `await validateDataIntegrity()` at the top of `init()`. This blocks everything that follows.
**How to avoid:** Kick off validation after the initial UI render completes. In `src/app.js`, call `validateDataIntegrity()` without blocking the main init path — either fire-and-forget with `.then()`, or `await` it only after the first render paint. Show the warning toast asynchronously when the result arrives.
**Warning signs:** Noticeably delayed first paint on app load, especially with large transaction histories.

### Pitfall 4: Heatmap Scale Distortion from Cross-Year Data (Bug 4)
**What goes wrong:** The heatmap's colour scale is calibrated against the maximum daily spend in `dailyData`. If `dailyData` includes prior-year entries with large spend values, the current year's heatmap appears uniformly pale (all values look small relative to the cross-year maximum).
**Why it happens:** `const dataForScale = allYearsData || dailyData` at line 57 uses unfiltered data for scale calibration even when the render loop is year-guarded.
**How to avoid:** Pre-filter `dailyData` to the target year at the call site. The inner loop guards in `heatmap.js` are not sufficient because they affect rendering but not the scale calculation that runs before the loop.
**Warning signs:** Heatmap shows mostly the lightest colour band for the current year even though spending exists. Prior-year totals visible in the scale legend.

### Pitfall 5: CSS Specificity Conflict for Save-Dot Fix (Bug 5)
**What goes wrong:** A new `flex-shrink: 0` rule on the save-dot is overridden by an existing higher-specificity rule elsewhere in `main.css`.
**Why it happens:** `main.css` has 1400+ lines. Component-specific rules may have higher specificity than a new utility rule added at the bottom.
**How to avoid:** Add the fix within the existing `.toolbar` rule block, or use a selector with matching specificity to the overriding rule. Confirm in browser DevTools that the rule is not struck-through.
**Warning signs:** Fix applied in CSS but dot still wraps in mobile viewport test. DevTools shows rule is being overridden.

### Pitfall 6: `bulkGet()` Returning Sparse Array with `undefined` (Bug 6)
**What goes wrong:** Developer iterates the `bulkGet()` result with `.forEach()` expecting to only see found records, but `bulkGet()` returns an array parallel to the input `ids` array where missing entries are `undefined` (not omitted).
**Why it happens:** Misreading the Dexie `bulkGet()` contract. It returns `Promise<(T | undefined)[]>` — one entry per input ID, `undefined` if not found.
**How to avoid:** Map the result back to the input IDs array: `ids.map((id, i) => [id, results[i]])`. Check `=== undefined` to detect missing parents.
**Warning signs:** Validator reports 0 issues even on a known-dirty database. Check that the `undefined` entries in the result are being handled.
</common_pitfalls>

<code_examples>
## Code Examples

### Dexie `bulkGet()` for FK Validation (complete helper)
```js
// Source: Dexie.js docs — Table.bulkGet() returns (T | undefined)[]
// Pattern for src/utils/data-integrity.js

/**
 * Check one FK relationship.
 * @param {import('dexie').Dexie} db
 * @param {string} childStore    - e.g. 'statements'
 * @param {string} field         - FK field name, e.g. 'debtId'
 * @param {string} parentStore   - e.g. 'debts'
 * @param {boolean} nullable     - if true, skip null/undefined field values
 * @returns {Promise<Array<{store,recordId,field,referencedStore,missingId}>>}
 */
async function checkForeignKey(db, childStore, field, parentStore, nullable = false) {
  const issues = [];
  const children = await db.table(childStore).toArray();

  const ids = [...new Set(
    children
      .map(r => r[field])
      .filter(id => nullable ? id != null : true)
  )];

  if (ids.length === 0) return issues;

  const results = await db.table(parentStore).bulkGet(ids);
  const existsMap = new Map(ids.map((id, i) => [id, results[i] !== undefined]));

  for (const record of children) {
    const refId = record[field];
    if (nullable && refId == null) continue;
    if (!existsMap.get(refId)) {
      issues.push({
        store: childStore,
        recordId: record.id,
        field,
        referencedStore: parentStore,
        missingId: refId
      });
    }
  }
  return issues;
}
```

### `validateDataIntegrity()` Public API
```js
// src/utils/data-integrity.js
import { db } from '../db/db.js';  // adjust import to actual Dexie instance path

const FK_RULES = [
  { childStore: 'statements',          field: 'debtId',             parentStore: 'debts',              nullable: false },
  { childStore: 'childcareLedger',     field: 'accountId',          parentStore: 'childcareAccounts',  nullable: false },
  { childStore: 'recurrentExpenses',   field: 'linkedStatementId',  parentStore: 'statements',         nullable: true  },
  { childStore: 'recurrentExpenses',   field: 'categoryId',         parentStore: 'categories',         nullable: true  },
  { childStore: 'oneOffExpenses',      field: 'categoryId',         parentStore: 'categories',         nullable: true  },
  { childStore: 'income',              field: 'categoryId',         parentStore: 'categories',         nullable: true  },
  { childStore: 'categoryMappings',    field: 'categoryId',         parentStore: 'categories',         nullable: false },
];

export async function validateDataIntegrity() {
  const allIssues = [];
  for (const rule of FK_RULES) {
    const issues = await checkForeignKey(db, rule.childStore, rule.field, rule.parentStore, rule.nullable);
    allIssues.push(...issues);
  }
  return { valid: allIssues.length === 0, issues: allIssues };
}
```

### `cleanOrphanedRecords()` Public API
```js
// src/utils/data-integrity.js (continued)
export async function cleanOrphanedRecords(issues) {
  // Group by store to batch deletes
  const byStore = {};
  for (const issue of issues) {
    if (!byStore[issue.store]) byStore[issue.store] = [];
    byStore[issue.store].push(issue.recordId);
  }

  await db.transaction('rw', Object.keys(byStore).map(s => db.table(s)), async () => {
    for (const [storeName, ids] of Object.entries(byStore)) {
      await db.table(storeName).bulkDelete(ids);
    }
  });
}
```

### innerHTML Escaping Audit Pattern (Bug 2)
```js
// Existing escHtml already in cloud-sync.js — use consistently:
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');  // add quote escaping if not already present
}

// Every innerHTML template literal must escape all dynamic values:
container.innerHTML = `
  <div class="snapshot-header">
    <p>Signed in as <strong>${escHtml(session.user.email)}</strong></p>
    <p>Store: ${escHtml(storeName)}</p>
  </div>
`;
```

### Startup Integration in `src/app.js` (non-blocking)
```js
// src/app.js — call after initial UI render, not before
async function init() {
  // ... existing parallel inits (cloudSyncUI.init(), etc.)
  await renderInitialUI();

  // Fire-and-forget: validate after paint
  validateDataIntegrity().then(({ valid, issues }) => {
    if (!valid) {
      showWarningToast(`⚠️ ${issues.length} data integrity issue${issues.length !== 1 ? 's' : ''} found.`, {
        action: { label: 'Review', onClick: () => openIntegrityModal(issues) }
      });
    }
  });
}
```

### Heatmap Call-Site Pre-Filter (Bug 4)
```js
// In dashboard.js and/or transactions.js — filter before calling heatmap
function renderHeatmapForYear(containerId, year, allDailyData, options) {
  const filteredData = Object.fromEntries(
    Object.entries(allDailyData).filter(([dateStr]) =>
      new Date(dateStr).getFullYear() === year
    )
  );
  renderSpendingHeatmap(containerId, year, filteredData, options);
}
```

### CSS Save-Dot Fix (Bug 5)
```css
/* css/main.css — within or after the existing .toolbar rule block */
/* Prevent auto-save dot from wrapping in mobile header */
.save-dot,
.autosave-indicator,
[data-save-indicator] {    /* use the actual class/attribute from the DOM */
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  white-space: nowrap;
}
```
</code_examples>

<sota_updates>
## State of the Art (2026)

This phase fixes bugs in a stable vanilla JS codebase. No SotA library changes are relevant. For completeness:

| Topic | Status | Notes |
|-------|--------|-------|
| Dexie.js `bulkGet()` | Stable API since Dexie 3.x | No changes needed; API is production-stable |
| HTML sanitization | No new browser API needed | `escHtml()` inline is sufficient; `Sanitizer API` is not yet universally available and is overkill for this use case |
| CSS Flexbox wrapping | No changes | `flex-shrink: 0` and `white-space: nowrap` are established, widely supported CSS properties |
| Supabase `onAuthStateChange` | Stable | No changes to subscription pattern required |

**Not applicable:** SotA updates for new libraries, frameworks, or ecosystem shifts are not relevant to a bug-fix phase with no new dependencies.
</sota_updates>

<open_questions>
## Open Questions

1. **Is Bug 1 (event listener accumulation) reliably reproducible with the current modal implementation?**
   - What we know: `templateUI.showModal()` replaces the modal body via `innerHTML =`, which in practice garbage-collects the old DOM nodes and their attached listeners. The `addEventListener` calls at lines 1179 and 1197 attach to freshly created elements each time.
   - What's unclear: Whether `templateUI.showModal()` ever reuses the container element reference rather than replacing it entirely. If the container is reused, listeners accumulate.
   - Recommendation: Apply the `.onclick =` fix regardless — it is zero-risk and eliminates the question. The CONTEXT.md fix spec is to use `.onclick =`, so follow it without needing to confirm reproducibility.

2. **Is Bug 3 (duplicate auth listeners) already fully fixed?**
   - What we know: `init()` has `if (this._initialized) return;` at lines 84-85, which prevents `_bindAuthListener` and `_bindPreviewListener` from being called more than once in normal app flow.
   - What's unclear: Whether there is a code path (e.g. settings panel re-init, route change, hot module reload in dev) that bypasses the `init()` guard and calls `_bindAuthListener` or `_bindPreviewListener` directly.
   - Recommendation: Add `this._authListenerBound` and `this._previewListenerBound` flags as defence-in-depth per CONTEXT.md spec. Even if Bug 3 is currently latent, the guards are low-cost insurance.

3. **What is the actual CSS class/attribute name of the save-dot element in the mobile header?**
   - What we know: `header` (line 58) uses `display: flex; flex-wrap: wrap` and `.toolbar` (line 61) also uses `flex-wrap: wrap`. The dot is described as an auto-save indicator.
   - What's unclear: The exact selector targeting the dot element — whether it's `.save-dot`, `.autosave-dot`, an `id`, or a `data-*` attribute.
   - Recommendation: Before writing the CSS fix, grep `main.css` and the cloud-sync/header template HTML for the indicator element's selector. Apply the fix to the correct selector.

4. **Should `cleanOrphanedRecords()` require explicit user confirmation in its API, or should the confirmation be handled by the UI caller?**
   - What we know: CONTEXT.md says "removes orphaned records after user confirmation". The confirmation UX (modal) is part of the feature.
   - What's unclear: Whether the confirmation dialog is inside `cleanOrphanedRecords()` itself or in the settings panel code that calls it.
   - Recommendation: Keep `cleanOrphanedRecords()` as a pure async data function with no UI concerns. The caller (settings panel or integrity modal) is responsible for showing confirmation before calling it. This keeps the utility testable.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `src/ui/cloud-sync.js` (codebase) — audited lines 34, 84-85, 1140, 1157, 1179, 1197, 1229, 1237 for listener accumulation, init guards, and XSS risk
- `src/ui/heatmap.js` (codebase) — audited lines 35, 57, 134-135 for cross-year data and scale calculation
- `src/db/schema.js` (codebase) — schema v12, FK relationships across 7 table pairs
- `src/app.js` (codebase) — startup sequence: `DOMContentLoaded` → `init()` → parallel module inits
- `css/main.css` (codebase) — lines 58 (header), 61 (toolbar) flex layout
- Dexie.js documentation — `Table.bulkGet()`, `Table.toArray()`, transaction API (well-established stable API)

### Secondary (MEDIUM confidence)
- Phase 27 CONTEXT.md — fix specifications, scope, acceptance criteria, file list

### Tertiary (LOW confidence — needs validation during implementation)
- Exact CSS selector for the save-dot element — not confirmed from codebase audit; must be verified before writing the CSS fix
- Whether `templateUI.showModal()` reuses or replaces the modal container — affects Bug 1 severity assessment but not the fix approach
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Vanilla JS DOM event management, Dexie.js IndexedDB, CSS Flexbox
- Ecosystem: No new libraries; existing Dexie.js, Vitest, Vite
- Patterns: Event listener idempotency, innerHTML XSS sanitization, FK validation via bulkGet, CSS flex wrap control, async init sequencing
- Pitfalls: Listener accumulation on modal re-render, partial XSS audit, async blocking of UI init, heatmap scale vs data filtering, CSS specificity

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing stack is known
- Architecture: HIGH — all patterns derive from existing codebase conventions or Dexie's documented API
- Pitfalls: HIGH — identified from direct source code audit
- Code examples: HIGH — derived from Dexie docs and existing codebase patterns

**Research date:** 2026-03-14
**Valid until:** Indefinite — all findings are codebase-specific and library-API-stable; no external ecosystem drift expected
</metadata>

---

*Phase: 27-critical-bug-fixes*
*Research completed: 2026-03-14*
*Ready for planning: yes*
