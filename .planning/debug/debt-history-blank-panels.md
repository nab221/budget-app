---
status: awaiting_human_verify
trigger: "Phase 16 (debt-history-ux-refinement) — 4 blank panels appear in the credit card debt history modal instead of graphs, even when more than 1 statement is logged."
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — DOMPurify in safeHTML strips <canvas> elements because 'canvas' is not in ALLOWED_TAGS
test: Verified by reading render.js ALLOWED_TAGS list and _buildHistoryModalHTML which uses safeHTML template tag
expecting: Adding 'canvas' to ALLOWED_TAGS in render.js will fix all 4 blank chart panels
next_action: Apply fix — add 'canvas' to ALLOWED_TAGS in safeHTML in src/ui/render.js

## Symptoms

expected: When more than 1 statement is logged for a credit card, the debt history modal should display graphs (charts) in the panels showing historical statement data.
actual: 4 blank panels appear in the modal without any graph/chart rendered.
errors: None specified — visual blank panels, no JS error mentioned.
reproduction: Open debt history modal for a credit card that has more than 1 statement logged.
started: Phase 16 (debt-history-ux-refinement) — likely always been broken since the phase was implemented.

## Eliminated

- hypothesis: Chart.js initialization fails or canvas elements not set up before chart init
  evidence: Chart functions correctly guard with document.getElementById returning null — the real issue is the canvas never exists in DOM at all
  timestamp: 2026-03-10

- hypothesis: Timing issue (charts init before DOM is ready)
  evidence: modalUI.show is synchronous, sets innerHTML immediately; timing is fine IF canvas elements survive DOMPurify
  timestamp: 2026-03-10

## Evidence

- timestamp: 2026-03-10
  checked: src/ui/render.js — safeHTML function ALLOWED_TAGS list (lines 31-36)
  found: 'canvas' is absent from ALLOWED_TAGS. List ends with 'section','header','footer','main','span','i'
  implication: DOMPurify strips every <canvas> element from the HTML produced by _buildHistoryModalHTML

- timestamp: 2026-03-10
  checked: src/ui/debts.js — _buildHistoryModalHTML (line 1008) and modalUI.show call (line 953)
  found: _buildHistoryModalHTML uses safeHTML template tag to build modal content including 4 <canvas> elements (stmt-chart-balance, stmt-chart-interest, stmt-chart-payments, stmt-chart-utilisation); modalUI.show sets body.innerHTML = content
  implication: All 4 canvas elements are stripped before the HTML reaches the DOM — document.getElementById returns null for each, chart functions return early, panels are blank

- timestamp: 2026-03-10
  checked: src/ui/charts.js — renderStatementBalanceChart (line 684) and siblings
  found: All 4 chart functions do `const canvas = document.getElementById(canvasId); if (!canvas) return;` — they silently return when canvas is null
  implication: No JS error, just a silent no-op, consistent with "blank panels, no error" symptom

## Resolution

root_cause: safeHTML in src/ui/render.js uses DOMPurify with an ALLOWED_TAGS list that does not include 'canvas'. The _buildHistoryModalHTML function in debts.js uses safeHTML to build modal content, causing DOMPurify to strip all <canvas> elements. The chart init functions find null for every canvas ID and return early, leaving blank panel divs.
fix: Added 'canvas' to the ALLOWED_TAGS array in the safeHTML function in src/ui/render.js (line 35)
verification: All 244 tests pass including 11 statement chart tests. Human verification of live UI needed.
files_changed: [src/ui/render.js]
