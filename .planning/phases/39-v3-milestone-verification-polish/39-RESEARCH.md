# Phase 39: v3.0 Milestone Verification & Polish - Research

**Researched:** 2026-03-15
**Domain:** Milestone verification, requirement coverage audit, cross-phase integration risk, release signoff readiness
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Verify that every P0 and P1 requirement from the v3.0 milestone is implemented and meets its acceptance criteria.
- Apply visual and UX polish across all new Phase 31-38 components.
- Tag the release as v3.0.0.
- Phase 39 is the quality gate for v3.0. It does not introduce new features.
- Every Phase 31-38 deliverable is re-tested end-to-end to confirm all P0 and P1 requirements are met and all HUMAN-VERIFICATION-REQUIRED items are signed off.

### Claude's Discretion
- Consistent loading states across all new UI components
- Consistent empty-state messages (no blank white boxes)
- Consistent error messages (no raw error objects shown to user)
- Animation/transition review: no janky transitions on mobile
- Colour contrast review on new badges, chips, and status icons (WCAG AA)

### Deferred Ideas (OUT OF SCOPE)
- Performance & Bundle Optimisation work from the earlier draft is out of scope for Phase 39 and belongs in a future milestone.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAN-01 | Current balance entry | Planned in Phase 34 plan; verify implementation evidence and fixture outputs. |
| PLAN-02 | Pay-period affordability view | Planned in Phase 34; requires both automated and human fixture verification signoff. |
| PLAN-03 | Banking calendar awareness | Planned in Phase 31; verify forward six-month UK holiday cases in integrated flow. |
| PLAN-04 | Spending buckets | Planned in Phase 33; validate inclusion in affordability timeline and cloud round-trip. |
| PLAN-05 | Pay-period navigator | Planned in Phase 34; rechecked in Phase 36 redesign context for visibility behavior. |
| PLAN-06 | Income configuration | Planned in Phase 33; manual multi-source validation still required. |
| DEBT-01 | Loan/mortgage projection model | Planned in Phase 32; verify non-regression in affordability integration. |
| DEBT-03 | Debt snapshot confirmation | Planned in Phase 32; verify warning threshold and persist behavior in release build. |
| DEBT-04 | Debt-linked expense routing | Planned in Phase 29; validate still correct after later navigator/dashboard work. |
| CHILD-01 | Childcare required top-up planner | Planned in Phase 35; integration risk remains until affordability seam is confirmed in runtime code. |
| CHILD-02 | Childcare top-up in affordability view | Planned in Phase 35; high-risk seam with Phase 34 implementation reality. |
| CHILD-03 | Entitlement period display | Planned in Phase 35; needs human visual signoff. |
| MOB-01 | Fixed bottom tab bar | Planned in Phase 28; verify no regressions after Phases 36-37 changes. |
| MOB-02 | Fixed top nav/pay-period bar | Planned in Phase 28 and Phase 36; verify coexistence with mobile bottom bar and overlays. |
| MOB-03 | Segmented view toggle | Planned in Phase 36; manual mobile/accessibility checks required. |
| MOB-04 | Income tab mobile fixes | Planned in Phase 29; verify swipe and date formatting on narrow viewports. |
| MOB-05 | Expenses tab mobile fixes | Planned in Phase 29; verify debt-linked rows route to Debts. |
| MOB-06 | Header save-dot layout fix | Planned in Phase 27; visual regression check required. |
| MOB-07 | PWA magic link auth | Planned in Phase 30; Android + iOS manual evidence required. |
| NAV-01 | Tabs always visible | Planned in Phase 28; verify in long content pages. |
| NAV-02 | Navigator fixed/visible | Planned in Phase 28 and Phase 36; regression-prone seam. |
| NAV-03 | Heatmap year boundary fix | Planned in Phase 27 and guarded in Phase 36 planning. |
| NAV-04 | Cloud snapshot delta preview | Planned in Phase 37; verify first-sync fallback and no-change messaging. |
| SYNC-01 | Magic link PWA fix | Planned in Phase 30 (same seam as MOB-07). |
| SYNC-02 | Cloud sync init/listener safety | Planned in Phase 27; verify no duplicate handler regression. |
| TECH-01 | GitHub Actions Node 24 | Planned in Phase 38; likely already compliant, verify no drift. |
| TECH-02 | Banking calendar utility | Planned in Phase 31; verify API and holiday behavior in integrated flows. |
| TECH-03 | Recurrence working-day support | Planned in Phase 31; verify when generating upcoming obligations. |
| TECH-04 | >=80% coverage for new modules | Planned in Phase 38; currently at risk due coverage tooling/module availability mismatch. |
| TECH-06 | Cloud sync store registration/survival | Planned in Phases 33-35 and 34 verification path; verify round-trip for all v3 stores. |
| INTEGRITY-01 | Referential integrity validator | Planned in Phase 27 with closure plans; verify trigger points still active. |

### Missing Or Ambiguous Plan Coverage
| Requirement | Gap | Planning impact |
|------------|-----|-----------------|
| DEBT-02 | No explicit phase plan artifact in 27-38 for this requirement (retained behavior assumption only) | Add explicit verification checkpoint in Phase 39 signoff matrix to prove no regression in credit-card statement flow. |
| TECH-04 | Phase 38 research flags coverage tooling/module gaps | Phase 39 must require evidence artifact showing final module-level line coverage status and any formal defer notes. |
| CHILD-02 | Phase 35 plan depends on affordability integration seam that may not exist exactly as documented in runtime tree | Add integration test + manual path check as release blocker before signoff. |
| PLAN-02 | Human fixture validation called out as mandatory in 39-CONTEXT | Keep explicit human evidence artifact mandatory, not optional. |
</phase_requirements>

## Summary
Phase 39 should be executed as a verification-and-evidence phase, not as another implementation phase. Planning artifacts for Phases 33-38 are largely complete and requirement-linked, but several release-risk seams remain: affordability/childcare integration assumptions, dashboard navigator layering across mobile states, cloud-sync delta and store-survival semantics, and coverage evidence completeness.

The dominant risk is not missing intent in plans, but drift between planned seams and runtime realities (for example, module names/locations and schema-version expectations). The phase should therefore center on a verification matrix that binds each P0/P1 requirement to concrete automated commands plus human evidence artifacts.

**Primary recommendation:** Build Phase 39 around a requirement-to-evidence matrix and hard release gate checklist, where every P0/P1 requirement has either passing automated evidence, signed manual evidence, or a formal defer note recorded in STATE.md.

## Key Findings

1. P0/P1 planning coverage is broad across phases 27-38, with explicit requirement mappings in plan artifacts, but DEBT-02 has no explicit dedicated plan artifact and must be verified as retained behavior.
2. Phase 33-38 artifacts are plan-complete but contain known seam risks: Phase 35 depends on a Phase 34 affordability integration contract that may differ from runtime implementation shape.
3. TECH-06 intent is repeatedly expressed as explicit store registration, while repository behavior is generic db.tables snapshotting; verification must focus on survival tests, not allowlist edits.
4. TECH-04 remains a signoff risk because Phase 38 research reports coverage execution/tooling gaps and potentially missing phase modules in runtime tree.
5. Human verification is a first-class gate in Phase 39 (affordability fixture, mobile checks, browser/device checks, PWA install/offline, console cleanliness, accessibility scan).

## Assumptions To Carry Into Planning

- Phase 39 is fix-and-polish only; no new feature scope is introduced.
- Requirement coverage claims from prior phase plans are hypotheses until evidence is attached in Phase 39 artifacts.
- Runtime source-of-truth (current files and commands) overrides stale assumptions in earlier docs when they conflict.
- Cloud round-trip verification is store-survival evidence, not a code-style audit about allowlists.
- Any unresolved P1 item must be formally deferred in STATE.md with a v3.1 note to satisfy acceptance criteria.

## Anti-Patterns To Avoid

- Treating plan completion as implementation completion without evidence.
- Closing Phase 39 without module-level coverage evidence for TECH-04.
- Allowing manual checks to remain informal/verbal instead of producing reproducible artifacts.
- Mixing release tasks (version/tag) before quality gates are passed.
- Doing broad refactors while “polishing” and introducing regressions late in milestone.

## Verification Evidence Model (What Files/Reports To Produce)

| Artifact | Purpose | Evidence Type |
|---------|---------|---------------|
| `.planning/phases/39-v3-milestone-verification-polish/39-REQ-MATRIX.md` | Requirement-by-requirement status (P0/P1 + DEBT-02 sentinel) | Traceability matrix |
| `.planning/phases/39-v3-milestone-verification-polish/39-TEST-REPORT.md` | Automated command outputs and pass/fail summaries | Automated evidence |
| `.planning/phases/39-v3-milestone-verification-polish/39-MANUAL-VERIFICATION.md` | Human-check checklist with result, tester, date, environment | Human signoff evidence |
| `.planning/phases/39-v3-milestone-verification-polish/39-METRICS.md` | Lighthouse + coverage + test counts + accessibility summary | Quality metrics |
| `.planning/phases/39-v3-milestone-verification-polish/39-INTEGRATION-RISKS.md` | Risk seams, observed defects, fix references, closure proof | Risk register |
| `.planning/phases/39-v3-milestone-verification-polish/39-SIGNOFF.md` | Final go/no-go with blocked items and defer notes | Release gate |
| `.planning/STATE.md` | Formal P1 defer notes (if any) and milestone status updates | Governance evidence |

## Files To Change With Rationale

| File | Rationale |
|------|-----------|
| `.planning/phases/39-v3-milestone-verification-polish/39-RESEARCH.md` | Defines verification scope, risk seams, and evidence contract for planning. |
| `.planning/phases/39-v3-milestone-verification-polish/39-01-PLAN.md` | Converts research matrix into executable verification tasks and gates. |
| `.planning/phases/39-v3-milestone-verification-polish/39-REQ-MATRIX.md` | Single source of truth for requirement coverage and signoff evidence links. |
| `.planning/phases/39-v3-milestone-verification-polish/39-MANUAL-VERIFICATION.md` | Captures human-required checks from Phase 39 and earlier phase acceptance notes. |
| `.planning/phases/39-v3-milestone-verification-polish/39-METRICS.md` | Records Lighthouse, coverage, and quality metrics required by acceptance criteria. |
| `.planning/STATE.md` | Records defer decisions, milestone progression, and final release status. |
| `package.json` | Final version bump to 3.0.0 only after verification gates pass. |

## Cross-Phase Integration Risk Seams (33-38)

| Seam | Risk | Confidence |
|------|------|------------|
| 33 -> 34 income-event contract | Multi-source projected events may drift from actual affordability input contract at implementation time | HIGH |
| 34 -> 35 childcare top-up integration | Phase 35 plan references affordability seam that may differ or be absent in runtime module layout | HIGH |
| 34/36 navigator interaction | Sticky/fixed navigator and view toggle behavior can regress mobile layout, z-index, or month/year filtering | MEDIUM-HIGH |
| 37 cloud preview delta vs import flow | Diff logic must stay pre-import/read-only and preserve existing confirm/cancel semantics | HIGH |
| 38 legacy import mappings vs live schema | Planned mapping field names do not perfectly match observed current schema names | HIGH |
| 33-35 TECH-06 assumptions | Docs speak about allowlists; code pattern is generic snapshot enumeration | HIGH |
| 38 TECH-04 closure | Coverage tool/module gaps can leave requirement unresolved at signoff time | HIGH |

## Practical Verification Matrix

### P0/P1 Coverage Buckets
| Bucket | Planned? | Phase(s) | Phase 39 check |
|-------|----------|----------|----------------|
| Planning core (PLAN-01..06) | Yes | 31,33,34 | Fixture-driven affordability window checks + settings flow checks |
| Debt core (DEBT-01,03,04) | Yes | 29,32 | Debt-linked navigation + confirm-balance warning + amortisation outputs |
| Debt retained behavior (DEBT-02) | Ambiguous | none explicit | Add explicit non-regression test/manual proof |
| Childcare (CHILD-01..03) | Yes | 35 | Provider/top-up/entitlement + affordability inclusion checks |
| Mobile/nav/sync | Yes | 27-30,36,37 | Device/browser/PWA/offline + delta preview + no listener regressions |
| Technical (TECH-01..04,06) | Mostly | 31,33-35,38 | CI config verify + coverage report + store survival round-trip |
| Integrity | Mostly | 27,38 | Integrity validator trigger-point check + legacy import evidence |

### Human Verification Items And Required Evidence
| Item | Required Evidence |
|------|-------------------|
| Affordability engine fixture validation | Screenshot + expected-vs-actual table in 39-MANUAL-VERIFICATION.md |
| Mobile manual check (Phase 36) | iPhone SE screenshots/video with segmented control and fixed navigator behavior |
| Cross-device check (375px + 1440px) | Paired screenshots for each key tab/panel with checklist result |
| Cross-browser check (Chrome/Firefox/Safari desktop) | Browser matrix table with pass/fail and issue IDs |
| PWA install prompt on Android | Screen recording or screenshot sequence + environment details |
| Offline mode cache behavior | DevTools offline screenshot + reload evidence |
| Lighthouse >=90 | Lighthouse report exports + summarized scores in 39-METRICS.md |
| WCAG AA / axe scan | Axe report artifact + list of unresolved violations (must be zero critical) |
| No console errors on load | Console capture screenshots for key routes/tabs |
| Cloud sync round-trip for v3 stores | Before/after store counts + sampled record integrity report |
| Banking calendar next 6 months | Date-case table for known bank holidays and adjusted outputs |
| Legacy v2 import correctness | Import summary report with mapped/skipped/conflict counts |

## Test And Manual Validation Strategy With Concrete Commands/Checklist

### Automated Commands
```bash
npm ci
npm test -- --run
npm run build
npm run preview
npx vitest run --coverage
npx lhci autorun
npx @axe-core/cli http://localhost:4173 --exit
```

### Focused Regression Commands
```bash
npx vitest run tests/income.test.js
npx vitest run src/utils/pay-period.test.js
npx vitest run src/ui/childcare.test.js
npx vitest run src/ui/dashboard.view-toggle.test.js
npx vitest run tests/snapshot-diff.test.js
npx vitest run tests/legacy-import.test.js
npx vitest run src/utils/supabase-sync.test.js src/ui/cloud-sync.test.js
```

### Manual Checklist
- Verify PLAN-01/02 fixture output equals expected affordability numbers.
- Add >=3 income sources and confirm sorting/adjusted payday behavior.
- Validate childcare top-up appears in affordability committed-outgoings view.
- Confirm segmented toggle keyboard operation (ArrowLeft/ArrowRight + Enter/Space).
- Confirm mobile bottom nav + fixed top navigator do not occlude content.
- Perform Android magic-link and install-prompt verification.
- Perform offline reload verification in installed/mobile context.
- Confirm no console errors on initial load and key tab switches.
- Validate cloud push/pull round-trip and snapshot-delta preview messaging.
- Validate legacy import skip-on-conflict behavior and summary reporting.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.js` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run && npx vitest run --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-02 | Affordability correctness in pay-period window | integration + manual fixture | `npx vitest run src/utils/pay-period.test.js` | WARN: verify runtime file |
| CHILD-02 | Childcare top-up in affordability outputs | integration | `npx vitest run src/ui/childcare.test.js` | WARN: verify runtime file |
| NAV-04 | Snapshot delta preview behavior | unit + ui | `npx vitest run tests/snapshot-diff.test.js src/ui/cloud-sync.test.js` | WARN: verify runtime file |
| TECH-04 | >=80% module line coverage | coverage | `npx vitest run --coverage` | WARN: tooling/module gap risk |
| INTEGRITY-02 | Legacy import mapping/no-overwrite | unit/integration | `npx vitest run tests/legacy-import.test.js` | WARN: verify runtime file |
| DEBT-02 | Credit-card statement flow unchanged | regression | `npx vitest run src/ui/debts*.test.js` | WARN: add if absent |

### Sampling Rate
- Per verification task: run focused command(s) for the requirement under test.
- Per wave merge: `npm test -- --run`.
- Phase gate: full suite, coverage run, Lighthouse, axe, and manual checklist complete.

### Wave 0 Gaps
- [ ] Add explicit DEBT-02 non-regression check in requirement matrix.
- [ ] Confirm existence or create missing test files referenced by Phases 33-38 plans.
- [ ] Confirm coverage provider/tooling availability before final TECH-04 signoff.
- [ ] Create structured manual verification artifact templates before execution starts.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/39-v3-milestone-verification-polish/39-CONTEXT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/33-income-spending-configuration/33-CONTEXT.md`
- `.planning/phases/33-income-spending-configuration/33-RESEARCH.md`
- `.planning/phases/33-income-spending-configuration/33-01-PLAN.md`
- `.planning/phases/34-pay-period-affordability-engine/34-CONTEXT.md`
- `.planning/phases/34-pay-period-affordability-engine/34-RESEARCH.md`
- `.planning/phases/34-pay-period-affordability-engine/34-01-PLAN.md`
- `.planning/phases/35-childcare-top-up-planner/35-CONTEXT.md`
- `.planning/phases/35-childcare-top-up-planner/35-RESEARCH.md`
- `.planning/phases/35-childcare-top-up-planner/35-01-PLAN.md`
- `.planning/phases/36-navigator-view-toggle-redesign/36-CONTEXT.md`
- `.planning/phases/36-navigator-view-toggle-redesign/36-RESEARCH.md`
- `.planning/phases/36-navigator-view-toggle-redesign/36-01-PLAN.md`
- `.planning/phases/37-cloud-snapshot-delta-preview/37-CONTEXT.md`
- `.planning/phases/37-cloud-snapshot-delta-preview/37-RESEARCH.md`
- `.planning/phases/37-cloud-snapshot-delta-preview/37-01-PLAN.md`
- `.planning/phases/38-github-actions-node24-hygiene/38-CONTEXT.md`
- `.planning/phases/38-github-actions-node24-hygiene/38-RESEARCH.md`
- `.planning/phases/38-github-actions-node24-hygiene/38-01-PLAN.md`
- `package.json`

### Secondary (MEDIUM confidence)
- None (repository-scoped research only)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Requirement coverage map: HIGH - directly derived from phase plan requirement blocks and requirement definitions.
- Integration risk seams: HIGH - based on explicit cross-phase contract dependencies in planning artifacts.
- Human verification model: HIGH - directly tied to Phase 39 acceptance criteria and release steps.

**Research date:** 2026-03-15
**Valid until:** 2026-04-14
