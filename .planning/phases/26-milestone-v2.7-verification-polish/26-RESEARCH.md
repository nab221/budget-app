# Phase 26: Milestone v2.7 Verification & Polish - Research

**Researched:** 2026-03-12  
**Domain:** Cloud sync verification (auto-pull/auto-push) + UI polish  
**Confidence:** HIGH

## User Constraints

- Scope is strictly roadmap Phase 26 (v2.7):
  - 26.1 Comprehensive manual sync testing (cross-device simulation)
  - 26.2 Unit tests for auto-pull comparison logic
  - 26.3 Final UI polish (animations, loading states)
- Prior cloud-sync implementation from phases 23-25 should be leveraged, not replaced.
- Research/documentation only in this task; no production code edits.

## Current-State Findings

### Implementation status

- Auto-pull on app load exists in `src/ui/cloud-sync.js` (`_runAutoPullCheckOnLoad`).
- Auto-push on exit via `visibilitychange` exists in `src/ui/cloud-sync.js` (`_bindVisibilityAutoPush`, `_autoPushOnExit`).
- Post-auth auto-pull exists in `src/ui/cloud-sync.js` (`_runAutoPullAfterSignIn`, auth listener).
- Pull/push operational helpers exist with button state updates (`_executePullSync`, `_executePushSync`).
- Status indicators and animation hooks exist:
  - Cloud status dot (red/yellow/green) in `cloud-sync.js`
  - Pulse/notification keyframes in `css/main.css`

### Test status

- Focused suite passes: `npm test -- src/ui/cloud-sync.test.js --run` (27/27 passing).
- Existing auto-pull tests cover only two timestamp comparison paths:
  - cloud newer => pull
  - local up to date => skip pull
- Existing tests include auto-push dirty-state path and auth dedup path.

### Planning artifact conflict (explicit)

- **Conflict found:** `.planning/phases/26-PLAN.md` targets documentation back-porting and requirements alignment (legacy objective), not roadmap v2.7 verification/polish.
- `.planning/ROADMAP.md` defines Phase 26 as verification/polish work; therefore `.planning/phases/26-PLAN.md` is outdated for current roadmap intent.
- `PHASE-26-VERIFICATION.md` also reflects the old documentation-alignment phase and should not be used as v2.7 verification evidence.

## Gap Analysis Mapped to Roadmap Tasks

| Task | Requirement | Current State | Gap | Priority |
|------|-------------|---------------|-----|----------|
| 26.1 | Manual cross-device sync simulation | No dedicated v2.7 manual test protocol/evidence file under phase folder | Missing repeatable test matrix + pass/fail evidence capture | HIGH |
| 26.2 | Unit tests for auto-pull comparison logic | Only 2 comparison-path tests in `src/ui/cloud-sync.test.js` | Missing edge-case comparison coverage (invalid/missing timestamps, invalid cloud metadata, one-shot gate behavior) | HIGH |
| 26.3 | Final UI polish (animations/loading states) | Basic pulse + notification animations and text-based loading already present | No consistent loading affordance contract (class/ARIA), no reduced-motion fallback, limited tests for loading-state UX | MEDIUM |

## Recommended Implementation Approach (Minimal Changes)

### Task 26.1 — Comprehensive manual sync testing (cross-device simulation)

1. Add a dedicated manual verification spec for v2.7 under phase folder with deterministic scenarios:
   - Device A push then Device B auto-pull-on-load
   - Device B local newer than cloud (no auto-pull expected)
   - Dirty-on-exit auto-push success path
   - Offline/network-failure recovery path with retry + export fallback
2. Capture expected logs/UI markers per scenario (status dot state, notification content, last sync timestamp behavior).
3. Add a checklist-style evidence template to record run date/browser/account used.

### Task 26.2 — Unit tests for auto-pull comparison logic

1. Keep logic in `cloud-sync.js`; do not refactor architecture broadly.
2. Add focused unit cases around `_runAutoPullCheckOnLoad` only:
   - no local last-sync key => pull if cloud has valid timestamp
   - malformed local timestamp => treated as invalid => pull
   - invalid cloud `updated_at` => skip pull
   - no active session => skip pull
   - idempotency gate (`_didAutoPullCheckOnLoad` / `_autoPullTriggered`) prevents duplicate pulls
3. Optional micro-refactor (still minimal): extract pure helper (e.g., `shouldAutoPull`) for easier deterministic tests.

### Task 26.3 — Final UI polish (animations/loading states)

1. Standardize sync loading-state UX in `cloud-sync.js`:
   - consistent busy-state toggle for relevant sync buttons
   - add `aria-busy` and stable loading class hook
2. Add CSS polish in `css/main.css`:
   - lightweight loading affordance for sync buttons (non-invasive)
   - `prefers-reduced-motion: reduce` fallback for pulse/slide animations
3. Add test assertions in `cloud-sync.test.js` for loading-state transitions (text/disabled/restore and/or class/ARIA contract).

## Exact File Targets

### Primary implementation/test targets

- `src/ui/cloud-sync.js`
  - `_runAutoPullCheckOnLoad` comparison branches
  - sync busy/loading state helpers around `_executePushSync` and `_executePullSync`
- `src/ui/cloud-sync.test.js`
  - new auto-pull comparison edge-case tests
  - loading-state and accessibility state tests
- `css/main.css`
  - reduced-motion rules
  - optional standardized loading-class styling for sync buttons

### Documentation/verification targets

- `.planning/phases/26-milestone-v2.7-verification-polish/26-MANUAL-TESTS.md` (recommended new)
- `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md` (recommended new evidence report)
- `.planning/phases/26-PLAN.md` (should be superseded or explicitly marked legacy/conflicting)

## Test Strategy

### Automated (Task 26.2 + 26.3)

- Targeted run per change:
  - `npm test -- src/ui/cloud-sync.test.js --run`
- Full regression before phase sign-off:
  - `npm test -- --run`

### Manual (Task 26.1)

- Two-browser simulation (or browser + private window) using same account:
  1. Device A mutate data + push
  2. Device B load app and verify pull behavior based on timestamp relation
  3. Trigger `visibilitychange` exit path with dirty state
  4. Repeat under offline conditions and verify notification/fallback behavior
- Record each case: preconditions, expected result, actual result, evidence (timestamp/screenshot/log excerpt).

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timestamp parsing edge cases misclassified | Wrong auto-pull decision | Add explicit tests for malformed/missing values before any refactor |
| UI polish introduces flaky tests | Slower CI and false negatives | Assert stable semantic states (`disabled`, `aria-busy`, class presence), not animation timing |
| Motion polish affects accessibility | Poor UX for reduced-motion users | Add `prefers-reduced-motion` CSS guard |
| Legacy phase docs continue to confuse planning | Wrong task execution | Mark old `26-PLAN.md` as legacy and use milestone-scoped phase folder as canonical |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-device E2E harness for this phase | New framework-level E2E stack | Manual matrix + focused Vitest unit tests | Scope is verification/polish; avoid introducing tooling debt |
| Complex animation framework | New animation library | Existing CSS keyframes + minor class-based states | Existing stack already supports required polish |
| Custom conflict-resolution engine | New merge/conflict subsystem | Existing last-write-wins + preview/import flow | Out of Phase 26 scope |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + jsdom |
| Config file | `vitest.config.js` |
| Quick run command | `npm test -- src/ui/cloud-sync.test.js --run` |
| Full suite command | `npm test -- --run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| 26.1 | Cross-device sync verification scenarios documented and reproducible | manual | n/a (manual protocol) | ❌ (create in phase folder) |
| 26.2 | Auto-pull timestamp comparison edge-cases validated | unit | `npm test -- src/ui/cloud-sync.test.js --run` | ⚠️ partial coverage exists |
| 26.3 | Loading/animation polish and reduced-motion behavior verified | unit + manual UI check | `npm test -- src/ui/cloud-sync.test.js --run` | ⚠️ partial coverage exists |

### Sampling Rate

- **Per task commit:** `npm test -- src/ui/cloud-sync.test.js --run`
- **Per wave merge:** `npm test -- --run`
- **Phase gate:** full suite green + manual cross-device checklist complete

### Wave 0 Gaps

- [ ] Add manual protocol doc for Task 26.1 in phase folder
- [ ] Add missing auto-pull comparison edge-case tests in `src/ui/cloud-sync.test.js`
- [ ] Add loading/accessibility state assertions for sync actions
- [ ] Add reduced-motion CSS assertions (or manual verification checklist item)

## Sources

### Primary (HIGH confidence)

- Codebase inspection:
  - `src/ui/cloud-sync.js`
  - `src/ui/cloud-sync.test.js`
  - `src/utils/supabase-sync.js`
  - `css/main.css`
- Planning/spec artifacts:
  - `.planning/ROADMAP.md`
  - `.planning/phases/26-PLAN.md`
  - `PHASE-26-VERIFICATION.md`

### Secondary (MEDIUM confidence)

- Existing phase-25 research notes for verification patterns:
  - `.planning/phases/25-sync-visibility/25-RESEARCH.md`

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH (already present and stable in repository)
- Architecture: HIGH (cloud sync flow implemented and testable)
- Pitfalls: HIGH (gaps are directly observable in code/tests/docs)

**Research date:** 2026-03-12  
**Valid until:** 2026-04-11 (30 days)
