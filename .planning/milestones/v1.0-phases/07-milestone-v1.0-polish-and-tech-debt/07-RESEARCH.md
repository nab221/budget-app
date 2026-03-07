# Phase 07 Research: Milestone v1.0 Polish & Tech Debt

## Context
Phase 7 is the final milestone for v1.0. It aims to resolve technical debt accumulated during the rapid development of Phases 1-6 and perform final verification.

## Audit Summary (from v1.0-MILESTONE-AUDIT.md)
The audit performed on 2026-03-01 found:
- **Technical Debt**:
  - `innerHTML` usage in `dashboard.js` line 47.
  - Dead code in `onedrive.js` (`getOneDriveUserEmail`).
  - Duplicated `CLOUD_LAST_BACKUP_KEY` literal.
  - Parallel/duplicated database restoration logic.
  - Missing documentation for Dexie schema version 3 skip.
- **Documentation Gaps**:
  - `ROADMAP.md` marks Phase 5 as "Not started" despite being completed.
  - `REQUIREMENTS.md` marks PDF requirements as "Pending".
  - Phase 5 SUMMARY files lack standard frontmatter.
- **UX Gaps**:
  - PDF import doesn't refresh transaction tables immediately.

## Verified Items
- Phase 5 is actually complete and has `05-VERIFICATION.md` (audit was slightly outdated on this point).
- Critical ReferenceErrors in PDF import were addressed in Phase 5.1.

## Strategy
1. **Execute 07-01-PLAN.md**: Address the core code tech debt (UI hardening, dead code, logic unification).
2. **Create 07-02-PLAN.md**: Address documentation inconsistencies and the PDF refresh UX issue.
3. **Manual Verification**: Perform the human-only verification steps listed in the audit.
4. **Sign-off**: Formal v1.0 sign-off.

## Outstanding Human Verifications
- PWA install prompt.
- Offline functionality.
- Update bar appearance.
- Chart responsiveness.
- Cloud provider OAuth popups and state persistence.
- Offline guards on backup buttons.
