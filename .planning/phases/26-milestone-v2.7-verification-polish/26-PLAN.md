# Phase 26: Milestone v2.7 Verification & Polish - Executable Plan

**Created:** 2026-03-12
**Canonical Plan:** `.planning/phases/26-milestone-v2.7-verification-polish/26-PLAN.md`
**Primary Research Input:** `.planning/phases/26-milestone-v2.7-verification-polish/26-RESEARCH.md`

## Objective
Complete roadmap Phase 26 with the smallest practical set of changes to finish v2.7: document and execute cross-device sync verification, close the unit-test gaps around auto-pull comparison logic, and apply final sync UX polish for loading and motion handling.

This phase must stay inside the existing architecture:
- Keep cloud sync logic centered in `src/ui/cloud-sync.js`
- Extend the existing Vitest/jsdom suite in `src/ui/cloud-sync.test.js`
- Use existing CSS in `css/main.css`
- Avoid new dependencies, major refactors, or new sync subsystems

## Scope
### In Scope
- Roadmap Task 26.1: comprehensive manual sync testing with cross-device simulation
- Roadmap Task 26.2: unit tests for auto-pull comparison logic
- Roadmap Task 26.3: final UI polish for sync loading states and motion handling
- Phase close-out documentation updates required to mark v2.7 complete

### Out of Scope
- New sync conflict-resolution features
- New automation frameworks or E2E tooling
- Reworking Supabase/Dexie architecture
- Non-sync UI redesign outside the cloud/local sync experience

### Legacy Artifact Rule
`.planning/phases/26-PLAN.md` is a legacy/conflicting artifact and is not the execution source for roadmap Phase 26.

Execution rule:
- Treat this file as the canonical plan for Phase 26 work
- Do not use `.planning/phases/26-PLAN.md` to drive implementation
- Explicitly note in `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md` that the root Phase 26 plan is superseded for v2.7 verification/polish
- If any legacy note is added later, keep it minimal and documentation-only

## Task Breakdown
### Task 26.1: Comprehensive Manual Sync Testing
**Goal:** Create a repeatable manual verification protocol, execute cross-device simulation, and capture evidence in phase-local verification docs.

**Execution steps**
1. Create `.planning/phases/26-milestone-v2.7-verification-polish/26-MANUAL-TESTS.md` with a deterministic scenario matrix covering:
   - Device A push -> Device B auto-pull on load
   - Device B local state newer than cloud -> no auto-pull
   - Dirty state + `visibilitychange` auto-push success path
   - Offline/failure path -> persistent error/notification/export fallback behavior
2. Include per-scenario preconditions, actions, expected UI markers, and evidence fields.
3. Run the matrix with two browser contexts using the same account.
4. Record actual outcomes in `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md`.
5. Include a short legacy-artifact note in `26-VERIFICATION.md` stating that `.planning/phases/26-PLAN.md` and any old root verification note are non-canonical for v2.7 close-out.

**Implementation rules**
- Prefer documentation and verification evidence over new tooling.
- Reuse the existing header indicators, notifications, and last-sync markers already implemented in Phases 23-25.
- Capture failures precisely enough to drive follow-up fixes without inventing extra scope.

### Task 26.2: Unit Tests for Auto-Pull Comparison Logic
**Goal:** Expand deterministic coverage around `_runAutoPullCheckOnLoad` without changing the sync architecture.

**Execution steps**
1. Add focused tests in `src/ui/cloud-sync.test.js` for:
   - no local last-sync value with valid cloud timestamp -> pull
   - malformed local last-sync value -> treat as invalid -> pull
   - invalid cloud `updated_at` -> skip pull
   - no active session -> skip pull
   - one-shot/idempotency guards prevent duplicate pull attempts
2. Run the targeted test file first.
3. Only if the new tests expose a real behavior gap, make the smallest production change in `src/ui/cloud-sync.js`.
4. Keep any production adjustment guard-based and local to the auto-pull logic. Do not introduce a broader refactor unless a tiny helper is clearly needed for clarity.

**Implementation rules**
- Tests first.
- Preserve current `cloudSyncUI` responsibilities and public behavior.
- No new library, no new test framework, no broad extraction unless the test delta proves it necessary.

### Task 26.3: Final UI Polish for Loading States and Motion
**Goal:** Standardize sync loading affordances and add reduced-motion-safe polish while keeping the current look and flow intact.

**Execution steps**
1. In `src/ui/cloud-sync.js`, standardize busy-state handling for push/pull actions:
   - stable disabled state
   - `aria-busy` contract
   - consistent loading text or class hook restoration after completion
2. In `css/main.css`, add minimal styling for the sync loading state using existing design tokens.
3. Add a `prefers-reduced-motion: reduce` block for pulse/notification/loading motion so sync UI remains accessible.
4. Extend `src/ui/cloud-sync.test.js` to assert stable UX contracts, not timing-sensitive animation behavior.
5. Run targeted tests and build validation after the polish changes.

**Implementation rules**
- Keep polish additive and small.
- Assert semantics like `disabled`, `aria-busy`, and class presence rather than animation timing.
- Do not redesign the header or modal structure.

### Task 26.4: Phase Close-Out Documentation
**Goal:** Close the phase cleanly once Tasks 26.1-26.3 pass, with milestone docs aligned to the roadmap and current project state.

**Execution steps**
1. Update `.planning/ROADMAP.md` to mark Phase 26 complete and reference the new verification doc.
2. Update `.planning/PROJECT.md` so v2.7 status moves from in-progress to complete, with the final Phase 26 outcomes summarized.
3. Update `.planning/STATE.md` with the new milestone/phase completion state, completion date, and next focus.
4. Finalize `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md` as the canonical verification record for this phase.
5. Keep all phase-close documentation references pointed at the milestone-scoped phase folder, not the legacy root plan.

**Implementation rules**
- Documentation updates happen after code and manual verification are complete.
- Keep wording factual and traceable to actual test/manual outcomes.

## File Map
| Path | Change Type | Purpose |
| --- | --- | --- |
| `.planning/phases/26-milestone-v2.7-verification-polish/26-PLAN.md` | create | Canonical execution plan for this phase |
| `.planning/phases/26-milestone-v2.7-verification-polish/26-MANUAL-TESTS.md` | create | Manual cross-device test matrix and evidence template |
| `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md` | create/update | Canonical verification report and legacy-artifact note |
| `src/ui/cloud-sync.test.js` | modify | Add auto-pull edge-case coverage and loading-state assertions |
| `src/ui/cloud-sync.js` | modify, only if needed for failing tests or loading-state polish | Minimal sync logic and busy-state adjustments |
| `css/main.css` | modify | Loading-state styling and reduced-motion safeguards |
| `.planning/ROADMAP.md` | modify at close-out | Mark Phase 26 complete and reference verification evidence |
| `.planning/PROJECT.md` | modify at close-out | Mark v2.7 complete and summarize finished milestone state |
| `.planning/STATE.md` | modify at close-out | Update live planning state and next milestone position |
| `.planning/phases/26-PLAN.md` | no implementation change expected | Legacy/conflicting artifact; treat as superseded and document that status |

## Commit Plan
Use one atomic commit per completed subtask. Do not batch unrelated docs, tests, and UI work together.

| Step | Files | Candidate Commit Message |
| --- | --- | --- |
| 26.1a | `.planning/phases/26-milestone-v2.7-verification-polish/26-MANUAL-TESTS.md` | `docs(phase-26): add cross-device sync verification matrix` |
| 26.1b | `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md` | `docs(phase-26): record manual sync verification evidence` |
| 26.2a | `src/ui/cloud-sync.test.js` | `test(phase-26): cover auto-pull comparison edge cases` |
| 26.2b | `src/ui/cloud-sync.js` | `fix(phase-26): harden auto-pull comparison guards` |
| 26.3a | `src/ui/cloud-sync.js` | `feat(phase-26): standardize sync loading states` |
| 26.3b | `css/main.css` | `style(phase-26): add reduced-motion sync polish` |
| 26.3c | `src/ui/cloud-sync.test.js` | `test(phase-26): verify sync loading state contracts` |
| 26.4 | `.planning/ROADMAP.md`, `.planning/PROJECT.md`, `.planning/STATE.md`, `.planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md` | `docs(phase-26): close out v2.7 verification and milestone status` |

**Commit sequencing rules**
- `26.2b` is conditional and should only be created if `26.2a` exposes a real product gap.
- `26.3a` should land before `26.3b` and `26.3c`.
- `26.4` is the final commit after all validation gates pass.

## Validation Plan
### Per-Step Validation
| Step | Command(s) | Pass Condition |
| --- | --- | --- |
| 26.1a | `Select-String -Path ".planning/phases/26-milestone-v2.7-verification-polish/26-MANUAL-TESTS.md" -Pattern "Device A|Device B|offline|visibilitychange|legacy"` | Manual test doc contains the required scenarios and legacy note criteria |
| 26.1b | `npm run dev` | Local app starts for two-browser manual simulation and evidence capture |
| 26.2a | `npm test -- src/ui/cloud-sync.test.js --run` | New auto-pull comparison tests pass |
| 26.2b | `npm test -- src/ui/cloud-sync.test.js --run` | Minimal production fix closes any failing edge-case coverage |
| 26.3a | `npm test -- src/ui/cloud-sync.test.js --run` | Loading-state logic passes existing and new targeted tests |
| 26.3b | `npm run build` | CSS polish and reduced-motion changes build cleanly |
| 26.3c | `npm test -- src/ui/cloud-sync.test.js --run` | Busy-state and accessibility assertions pass consistently |
| 26.4 | `Select-String -Path ".planning/ROADMAP.md", ".planning/PROJECT.md", ".planning/STATE.md", ".planning/phases/26-milestone-v2.7-verification-polish/26-VERIFICATION.md" -Pattern "Phase 26|v2.7|26-VERIFICATION|complete|legacy"` | Close-out docs are updated and point at the canonical phase artifacts |

### Final Gate
Run all of the following before marking Phase 26 complete:

```bash
npm test -- src/ui/cloud-sync.test.js --run
npm test -- --run
npm run build
```

Manual gate:
- All scenarios in `26-MANUAL-TESTS.md` have recorded outcomes
- `26-VERIFICATION.md` shows pass/fail for each roadmap task
- Legacy artifact note is present and unambiguous

## Risks
| Risk | Impact | Mitigation |
| --- | --- | --- |
| Manual sync runs are not reproducible | Weak verification evidence | Use a deterministic scenario matrix with explicit preconditions and expected UI markers |
| New tests expose real comparison bugs | Targeted failures in existing behavior | Keep fixes local to `_runAutoPullCheckOnLoad` and rerun the focused suite before any broader regression run |
| UI polish introduces flaky tests | False negatives in CI/local runs | Assert `disabled`, `aria-busy`, and stable class/text contracts, not animation timing |
| Reduced-motion rules drift from current styling | UX inconsistency | Reuse existing CSS variables and only add minimal overrides |
| Legacy root Phase 26 plan causes confusion during close-out | Wrong artifact referenced later | Treat milestone-scoped docs as canonical and call out the root plan as superseded in `26-VERIFICATION.md` |

## Exit Criteria
Phase 26 is complete only when all of the following are true:

1. `26-MANUAL-TESTS.md` exists with the full cross-device scenario matrix.
2. `26-VERIFICATION.md` exists and records actual manual verification outcomes for Tasks 26.1-26.3.
3. `src/ui/cloud-sync.test.js` covers the missing auto-pull comparison edge cases.
4. Any production change in `src/ui/cloud-sync.js` is minimal, justified by failing tests, and validated.
5. Sync loading states have a stable disabled and `aria-busy` contract.
6. `css/main.css` includes reduced-motion-safe sync polish.
7. `npm test -- --run` passes.
8. `npm run build` passes.
9. `.planning/ROADMAP.md`, `.planning/PROJECT.md`, and `.planning/STATE.md` are updated for phase close-out.
10. `.planning/phases/26-PLAN.md` is explicitly treated as a legacy/conflicting artifact, with the milestone-scoped Phase 26 docs used as the canonical record.

