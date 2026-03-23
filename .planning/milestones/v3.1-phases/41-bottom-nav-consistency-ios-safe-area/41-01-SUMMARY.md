---
phase: 41-bottom-nav-consistency-ios-safe-area
plan: "01"
subsystem: mobile-nav
tags: [ios, safe-area, bottom-nav, html-structure, css]
dependency_graph:
  requires: []
  provides: [viewport-fit-cover, nav-container-body-child, shell-safe-area-padding]
  affects: [index.html, css/main.css]
tech_stack:
  added: []
  patterns: [env(safe-area-inset-bottom), viewport-fit=cover, fixed-position-body-child]
key_files:
  created: []
  modified:
    - index.html
    - css/main.css
decisions:
  - "viewport-fit=cover added to meta viewport — activates env(safe-area-inset-bottom) on iOS; previously returned 0 on all iPhones with home indicator"
  - ".nav-container moved to direct body child after .shell — eliminates fixed-position containment trap; JavaScript ID lookups unaffected"
  - ".shell mobile padding-bottom now calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 8px) — mirrors nav height including safe-area clearance"
  - "Kept , 0px fallback in .shell safe-area calc for non-iOS compatibility"
metrics:
  duration: "22 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
requirements_satisfied:
  - BOTNAV-01
  - BOTNAV-02
  - BOTNAV-03
---

# Phase 41 Plan 01: Bottom Nav Containment Fix and iOS Safe Area Summary

**One-liner:** Fixed-position containment trap eliminated by moving .nav-container to direct body child; viewport-fit=cover activates ~34px iOS safe-area inset on iPhones with home indicator.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Add viewport-fit=cover and move .nav-container to direct body child | 3203ded | index.html |
| 2 | Update .shell mobile padding-bottom to include env(safe-area-inset-bottom, 0px) | fef6793 | css/main.css |

## What Was Built

### Task 1 — index.html (3203ded)

Two changes to `index.html`:

1. Meta viewport updated from:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0" />
   ```
   To:
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
   ```
   This is the single highest-impact change in the v3.1 milestone — without it, `env(safe-area-inset-bottom)` returned 0 on every iPhone with a home indicator.

2. `<nav class="nav-container">` block moved from inside `.shell` to a direct child of `<body>`, placed after the `.shell` closing `</div>` and before the modals. The nav's `position: fixed; bottom: 0; left: 0; right: 0` CSS means visual position is viewport-relative regardless of DOM location. JavaScript tab switching uses `document.getElementById('mainTabs')` — ID-based lookup, unaffected by DOM position.

### Task 2 — css/main.css (fef6793)

Inside `@media (max-width: 768px)`, the `.shell` padding-bottom rule updated from:
```css
.shell { padding-bottom: calc(var(--bottom-bar-height) + 8px); }
```
To:
```css
.shell { padding-bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 8px); }
```

The `.nav-container` already had a correct `padding-bottom: calc(env(safe-area-inset-bottom) + 8px)` rule (present but inert without `viewport-fit=cover`). Once activated, the nav bar grows taller by ~34px on modern iPhones. The `.shell` padding must mirror this to keep the last content item visible above the nav bar.

## Verification Results

- `grep -n "viewport-fit=cover" index.html` → line 5 (meta viewport)
- `grep -n "nav-container" index.html` → line 394 (after shell `</div>` on line 391)
- `grep -n "env(safe-area-inset-bottom, 0px)" css/main.css` → line 241 (inside @media block)
- `npx vitest run` → 40 test files, 715 tests, all passed

## Decisions Made

1. **viewport-fit=cover in meta viewport:** Required to unlock `env(safe-area-inset-bottom)` on iOS Safari. Without it, the CSS safe-area rule in `.nav-container` (already present) was silently no-op on all real iPhones.

2. **nav outside .shell:** The containment trap occurs when a `position: fixed` element is inside a container with `transform`, `will-change`, `filter`, or `contain` applied. Moving the nav to a direct body child permanently eliminates the risk regardless of future `.shell` changes.

3. **0px fallback in .shell calc:** `env(safe-area-inset-bottom, 0px)` is the correct form inside `calc()` on non-iOS browsers which do not support the env() function — a unitless `0` would be invalid in this context.

## Deviations from Plan

None — plan executed exactly as written.

## Notes for Phase 41 Verification

iOS safe-area fixes must be verified on a real iPhone or Safari Simulator — Chrome DevTools does not expose the `viewport-fit=cover` behavior gap. Expected behavior on iPhone with home indicator: nav bar becomes ~34px taller (safe-area padding visible), content scrolls fully above nav without clipping.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| index.html exists | FOUND |
| css/main.css exists | FOUND |
| 41-01-SUMMARY.md exists | FOUND |
| Commit 3203ded exists | FOUND |
| Commit fef6793 exists | FOUND |
| 715 tests pass | VERIFIED |
