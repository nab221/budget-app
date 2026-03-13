# Legacy Phase 26 Plan: Documentation & Requirements Alignment

> Legacy/conflicting artifact: this file is not the execution source for roadmap Phase 26 in milestone v2.7.
>
> Canonical Phase 26 plan: `.planning/phases/26-milestone-v2.7-verification-polish/26-PLAN.md`

## Objective
Back-port all requirement IDs and specifications from Phases 16-25 to the central `.planning/REQUIREMENTS.md` file to ensure the master documentation remains the single source of truth for the codebase's capabilities.

## Context
The project has rapidly evolved through 10 additional phases since the last major update to `REQUIREMENTS.md`. This phase formalizes those features into the requirements traceability matrix.

## Tasks

### Task 1: Audit Phase Documentation for Requirements
- **Goal**: Collect all requirement IDs and success criteria from the following phases:
  - Phase 16: Debt History UX (EDIT-04, HIST-01 to 03)
  - Phase 17: Dashboard Invariants (DASH-INV-01 to 07)
  - Phase 18: Loan Setup & Guards (PART-A to E)
  - Phase 19: GitHub Pages Deployment (DEPLOY-01 to 04)
  - Phase 21: Unified Merge Logic (MERGE-01)
  - Phase 22: Export Settings Warning (EXPORT-01 to 03)
  - Phase 23/27: Node 24 Support (NODE24-01 to 02)
  - Phase 24: Manual UAT (UAT-01 to 02)
  - Phase 25: Technical Polish (TECH-01 to 02)

### Task 2: Update REQUIREMENTS.md
- **Goal**: Reconstruct `REQUIREMENTS.md` with:
  - A new "v2.6 Requirements" section for Phases 16-25.
  - Updated "Traceability" table mapping all new requirements to their respective phases.
  - Final status updates (marking all as completed).

## Success Criteria
1. `.planning/REQUIREMENTS.md` contains every requirement ID mentioned in Phase 16-25 plans.
2. The Traceability table accurately reflects the current state of the project (100% mapped and complete).

## Rollback Plan
- If the file becomes too large or disorganized, revert to the v2.5 version and split it into `REQUIREMENTS-v2.5.md` and `REQUIREMENTS-v2.6.md`.
