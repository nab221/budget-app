---
phase: 28-mobile-navigation-overhaul
plan: "01"
subsystem: css
tags: [mobile, navigation, css, responsive, wcag, pwa]
dependency_graph:
  requires: []
  provides: [bottom-bar-height-var, safe-area-inset, wcag-tap-targets, narrow-breakpoints, sticky-header]
  affects: [css/main.css]
tech_stack:
  added: []
  patterns: [CSS custom properties, env() safe-area, media query cascade, position sticky]
key_files:
  created: []
  modified:
    - css/main.css
decisions:
  - "Used env(safe-area-inset-bottom) + 8px for iOS PWA home indicator clearance on .nav-container"
  - "Placed --bottom-bar-height: 72px inside 768px :root block (not global :root) to scope variable to mobile context"
  - "Header background uses var(--bg) which exists in global :root; no fallback needed"
  - "420px and 360px breakpoints target .tab-label class in anticipation of Plan 28-2 span wrapping"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-14"
  tasks_completed: 3
  files_modified: 1
requirements_satisfied: [MOB-01, MOB-02, NAV-01]
---

# Phase 28 Plan 01: Mobile Navigation CSS Fixes Summary

**One-liner:** Fixed conflicting `.tabs` rule in 768px query, added `--bottom-bar-height` variable, iOS safe-area padding, WCAG 44px tap targets, two narrow-viewport sub-breakpoints, and sticky header.

## What Was Built

The 768px mobile media query had a conflicting second `.tabs` block overriding the correct `justify-content: space-around` layout with `overflow-x: auto; justify-content: flex-start`. This broke the bottom nav bar layout on mobile.

Three targeted CSS changes were made to `css/main.css`:

1. **Task 1 — Fix conflicting rules + variable + safe-area:**
   - Removed the conflicting second `.tabs` block (was lines 273-278 in original)
   - Added `--bottom-bar-height: 72px` CSS variable inside 768px `:root`
   - Updated `.shell` padding-bottom to `calc(var(--bottom-bar-height) + 8px)`
   - Added `padding-bottom: calc(env(safe-area-inset-bottom) + 8px)` to `.nav-container` for iOS PWA
   - Added `min-height: 44px` to `.tab` for WCAG 2.1 minimum tap target

2. **Task 2 — Sub-breakpoints for narrow viewports:**
   - `@media (max-width: 420px)`: truncate tab labels with ellipsis, reduce font-size to 0.55rem
   - `@media (max-width: 360px)`: hide labels entirely (display: none), icon-only mode (font-size: 0)
   - Both target `.tab-label` class, safe no-op until Plan 28-2 adds the spans

3. **Task 3 — Sticky header:**
   - Added `position: sticky; top: 0; z-index: 100; background: var(--bg)` to `header` rule
   - Rule is outside all media queries — applies at all viewport sizes

## Verification Results

All plan verification checks passed:

- `overflow-x: auto` inside 768px query: 0 occurrences (removed)
- `--bottom-bar-height`: defined at line 222
- `safe-area-inset-bottom`: present at line 239
- `@media (max-width: 420px)`: present at line 279
- `@media (max-width: 360px)`: present at line 292
- `position: sticky` in header rule: present at line 58 (outside media queries)
- `min-height: 44px` in 768px `.tab`: present at line 263

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 00bfb62 | feat(28-01): fix conflicting CSS, add bottom-bar-height var and safe-area support |
| 2 | 29c500d | feat(28-01): add 420px and 360px sub-breakpoints for narrow mobile viewports |
| 3 | 4ebb547 | feat(28-01): make header sticky at all viewport sizes |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- `css/main.css` modified and verified ✓
- All 3 commits present in git log ✓
- All 7 verification checks passed ✓
