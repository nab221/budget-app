---
phase: 41-bottom-nav-consistency-ios-safe-area
plan: "04"
subsystem: ui
tags: [css, mobile, bottom-nav, ios-safe-area, cloud-sync, webkit]

key-files:
  created: []
  modified:
    - css/main.css
    - index.html

requirements-completed:
  - BOTNAV-01
  - BOTNAV-02
  - BOTNAV-03
  - BOTNAV-04

duration: 2026-03-20
completed: 2026-03-20
---

# Phase 41 Plan 04: Gap Closure Summary

**Correct targeted fixes applied after reverting an incorrect 41-04 attempt. Human verified: phase passed with two known minor TODOs.**

## What Was Fixed

### 1. Remove -webkit-overflow-scrolling: touch (root cause of iOS nav jank)
Removed from 4 heatmap card inline styles in `index.html` (Income, Spending, TransactionsIncome, TransactionsSpending). This deprecated iOS property was creating GPU compositing layers that caused `position:fixed` elements to render incorrectly on Transactions and Payoff tabs.

### 2. will-change: transform on mobile .nav-container
Added to `css/main.css` mobile block. Forces the nav onto its own GPU compositing layer, isolating it from other page compositing.

### 3. Move nav back inside .shell (restores desktop horizontal layout)
41-01 had moved the nav outside `.shell` as a "containment trap" fix — that was incorrect. `.shell` has no overflow/transform/filter properties and cannot trap fixed-position children. With the real trap (webkit-overflow-scrolling) removed, the nav belongs back inside `.shell` before `<section class="card">`, which restores the v3.0 desktop horizontal tab bar position (below header).

### 4. Equal tab button sizing
Changed `.tab { flex: 1 }` to `flex: 1 1 0; min-width: 0` to guarantee equal distribution across all 8 nav buttons regardless of content width.

### 5. Local-only header elements hidden on mobile
CSS hides `#headerLocalMenuBtn`, `#localFileSyncDot`, `#localFileSyncText` at `max-width: 768px`. Cloud sync button and traffic-light dot remain visible on both mobile and desktop. The "📁 Local" (auto-save to file) feature requires the File System Access API which is desktop-only.

## What Was Reverted (Wrong Approach)

The original 41-04 executor made three incorrect changes (now reverted via `d999baf`):
- `@media (min-width: 769px) { .nav-container { display: none; } }` — incorrectly hid the desktop nav entirely (desktop should show horizontal tab bar)
- `@media (max-width: 768px) { .sync-status-indicator { display: none; } #cloudSyncActionsHeader { display: none !important; } }` — wrongly hid ALL cloud sync UI on mobile
- `_renderHeaderActions` early-return on mobile — wrongly prevented cloud sync from initializing on mobile

Root cause of the mistake: the verification agent flagged "nav visible on desktop" as a bug. It is NOT a bug — desktop shows the nav as a horizontal bar below the header (v3.0 behaviour). Similarly, cloud sync should remain visible on mobile.

## Human Verification Results

**Verified by user 2026-03-20:**

| Requirement | Result | Notes |
|-------------|--------|-------|
| BOTNAV-01 Desktop nav | ✓ PASS | Horizontal bar appears below header on desktop |
| BOTNAV-01 Mobile fixed nav | ✓ PASS (with TODO) | Fixed on most tabs; Transactions/Payoff still have minor jank — accepted as known TODO |
| BOTNAV-02 Content clearance | ✓ PASS | Content clears nav bar |
| BOTNAV-03 iOS safe-area | ✓ PASS | env(safe-area-inset-bottom) padding in place |
| BOTNAV-04 PWA update bar | ✓ PASS | Update bar appears above nav |
| Cloud sync on mobile | ✓ PASS | Cloud sync button and dot visible on mobile |
| Local button desktop-only | ✓ PASS | 📁 Local hidden on mobile |

## Known TODOs (Accepted, Not Blocking)

### TODO-1: Desktop nav disappears on scroll
Desktop horizontal tab bar disappears when scrolling (it is not sticky). On desktop it renders `position: relative` inside `.shell`, so it scrolls with the page. User accepted as minor — to be addressed in a future phase.

### TODO-2: Mobile nav still janky on Transactions and Payoff tabs
Despite removing `-webkit-overflow-scrolling: touch` and adding `will-change: transform`, the nav position may still be imperfect on Transactions (large JS-rendered list with swipe transforms) and Payoff (Chart.js canvases). User accepted as minor — to be diagnosed and fixed in a future phase.

## Commits

- `d999baf` — Revert incorrect 41-04 fixes (display:none on desktop nav, hide-all cloud sync)
- `e6d1ddd` — Correct targeted fixes: remove webkit-overflow-scrolling, will-change, flex sizing, local-only CSS
- `23c83c0` — Move nav back inside .shell to restore desktop horizontal layout

## Tests
722/722 passing.
