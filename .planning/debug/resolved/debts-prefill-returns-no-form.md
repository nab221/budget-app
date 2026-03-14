---
status: resolved
trigger: "in Debts, when the card is clicked, the statement history appear. If I click on import PDF, it correctly extract the values. However, when I press pre-fill form, it returns to the debts page, with no new form to fill/add the transaction. Can you indentify the error and plan how to fix it."
created: 2026-03-08T22:08:54.9216937+00:00
updated: 2026-03-08T22:20:30+00:00
---

## Current Focus

hypothesis: fixed by restoring history modal context before prefill and by adding fallback recovery when statement container is absent
test: execute statement prefill flow manually in app; check that form opens and populated fields are present
expecting: pre-fill opens statement form in history modal with extracted values
next_action: user to verify in real Debts -> Import PDF workflow

## Symptoms

expected: clicking pre-fill form after successful PDF import should open/create a transaction form populated with extracted values
actual: app returns to debts page/list view and no new populated transaction form appears
errors: no explicit runtime error reported
reproduction: open Debts card -> open statement history -> import PDF (values extracted) -> click pre-fill form -> app returns to debts page without new form
started: unknown (not yet provided)

## Eliminated

## Evidence

- timestamp: 2026-03-08T22:08:54.9216937+00:00
	checked: user symptom report
	found: extraction step works, failure occurs specifically on pre-fill form action
	implication: parsing pipeline likely succeeds; bug likely in UI state transition/navigation after prefill trigger

- timestamp: 2026-03-08T22:10:46.2145082+00:00
	checked: src/ui/pdf-import.js prefill flow + src/ui/debts.js statement form rendering + src/ui/templates.js modal bridge
	found: `pdfImportUI.renderStatementSummaryPreview` uses `window.templateUI.showModal(...)`, which delegates to shared `modalUI.show(...)`; clicking pre-fill runs `window.templateUI.closeModal()` before calling `debtUI.prefillStatementForm(summary)`. This closes the same modal overlay that previously held `stmtFormContainer-modal` from debt history, so `toggleStmtForm` cannot find a container and returns without rendering any form.
	implication: behavior matches symptom (user appears back on debts page with no prefilled form) because prefill target DOM is destroyed before fill attempt.

- timestamp: 2026-03-08T22:17:35+00:00
	checked: code changes in src/ui/pdf-import.js, src/ui/debts.js, and regression test in src/ui/debts.test.js
	found: prefill now closes summary modal, reopens debt history modal for active debt, then invokes debt prefill; debt prefill now self-recovers by reopening history if container is missing
	implication: prefill path no longer depends on stale modal DOM and should render populated statement form reliably

- timestamp: 2026-03-08T22:17:35+00:00
	checked: npx vitest run src/ui/dashboard.invariant.test.js tests/balance/dashboard-kpis.test.js
	found: both targeted baseline suites passed (5 tests)
	implication: no detected regression in those non-jsdom test areas

## Resolution

root_cause: statement-import preview and debt history share the same `modalUI` instance; `pdfImportUI.prefillStatementForm` closes that modal before invoking debt prefill, which removes `stmtFormContainer-modal` from the DOM so debt prefill has nowhere to render.
fix: planned (not yet applied): decouple statement-summary import preview from the shared modal lifecycle used by debt history. Preferred approach: keep debt history modal open and show PDF summary in an inline panel within that modal; alternate approach: capture `activeStmtDebtId`, close import modal, then immediately reopen `openHistoryModal(debtId)` and only after render completes call `prefillStatementForm(summary)`.
fix: implemented alternate approach. In `pdfImportUI.prefillStatementForm`, capture active debt id, close summary modal, reopen history modal (`openHistoryModal`), then await debt prefill. In `debtUI.prefillStatementForm`, add missing-container fallback that reopens history modal and retries before filling fields.
verification: automated regression for modified jsdom suite could not be executed locally because `jsdom` package is missing; added regression test case and passed baseline non-jsdom vitest suites.
files_changed: ["src/ui/pdf-import.js", "src/ui/debts.js", "src/ui/debts.test.js"]
