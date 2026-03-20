---
phase: 41-bottom-nav-consistency-ios-safe-area
verified: 2026-03-20T00:00:00Z
status: passed
score: 4/4 BOTNAV requirements verified
re_verification: true
re_verified: 2026-03-20T09:00:00Z
gaps:
  - truth: "The mobile bottom nav bar is structurally free from any fixed-position containment trap — it is a direct child of <body>, not inside .shell"
    status: partial
    reason: "Nav is correctly a direct body child (index.html line 394), but fixed positioning is still broken on Transactions, Payoff, and Settings tabs on real device — a per-tab scroll container or ancestor context is trapping the fixed nav inside those panels"
    artifacts:
      - path: "index.html"
        issue: "Structure is correct (nav outside .shell), but on-device behavior fails for 3 of 8 tabs — containment trap source not yet identified"
    missing:
      - "Audit JS-rendered content inside .tab-panel[data-panel='transactions'], [data-panel='payoff'], [data-panel='settings'] for overflow:auto/scroll or transform ancestors that break fixed positioning on those specific tabs"
      - "Fix or remove the containment-causing property in those panels"

  - truth: "Bottom nav is mobile-only — hidden on desktop and tablet viewports"
    status: failed
    reason: "No display:none rule exists for .nav-container above the 768px mobile breakpoint. At desktop, nav-container has position:relative (line 173) and renders inline after .shell, appearing as a scrollable tab bar at the bottom of the page content"
    artifacts:
      - path: "css/main.css"
        issue: "Line 173: .nav-container { position: relative; } — no @media (min-width: 769px) { .nav-container { display: none; } } rule exists anywhere in the file"
    missing:
      - "Add a media query rule hiding .nav-container on tablet and desktop: @media (min-width: 769px) { .nav-container { display: none; } }"

  - truth: "Tab content on all tabs does not scroll behind the bottom nav bar (BOTNAV-02)"
    status: failed
    reason: "BOTNAV-02 was never confirmed — it is contingent on BOTNAV-01 passing. Human verification of Task 1 was aborted when Issue 1 and Issue 2 were found. Content clearance cannot be confirmed while the nav bar is broken on multiple tabs and visible on desktop."
    artifacts:
      - path: "css/main.css"
        issue: "The .shell padding-bottom formula calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 8px) is correctly implemented (line 241), but cannot be confirmed to prevent content cut-off while BOTNAV-01 is failing"
    missing:
      - "Re-verify after BOTNAV-01 is fixed: scroll to bottom of Transactions on mobile and confirm last item is fully visible above the nav bar"

  - truth: "On an iPhone with a home indicator, the nav bar does not overlap the home indicator (BOTNAV-03)"
    status: failed
    reason: "iOS/Safari verification (Plan 03 Task 2) was never attempted — Task 1 (Chrome DevTools) failed first and verification was halted. BOTNAV-03 cannot be confirmed without Safari or real iPhone test."
    artifacts:
      - path: "index.html"
        issue: "viewport-fit=cover is present (line 5) — structural prerequisite is correct. But on-device confirmation is absent."
      - path: "css/main.css"
        issue: "padding-bottom: calc(env(safe-area-inset-bottom) + 8px) on .nav-container (line 254) is correct CSS but not confirmed to render correctly on iOS."
    missing:
      - "Perform BOTNAV-03 verification on Safari Responsive Design Mode (iPhone 15 Pro) or real iPhone after BOTNAV-01 fixes are applied"

  - truth: "PWA update bar appears above the bottom nav bar, not overlapping it (BOTNAV-04 — CSS + JS)"
    status: partial
    reason: "The update bar CSS override and JS implementation are code-verified, but the DevTools console simulation test (Plan 03 Task 1 step 3) was never completed because Task 1 failed at issues 1 and 2 before reaching the update bar check. Auto-save UI (cloud-sync button, traffic-light indicator) is confirmed visible on mobile with no mobile-hiding rule in CSS — this is a related header space issue."
    artifacts:
      - path: "src/ui/pwa-ux.js"
        issue: "VERIFIED: _showUpdateBar, _hideUpdateBar, onNeedRefresh all implemented and wired correctly"
      - path: "css/main.css"
        issue: "VERIFIED: .update-bar { bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px)) } present at line 300 inside @media (max-width: 768px)"
    missing:
      - "Re-run DevTools update bar simulation after BOTNAV-01 and desktop nav fixes are applied"
      - "Decision required: whether to hide cloudSyncActionsHeader and .sync-status-indicator at mobile breakpoints (no display:none rule currently exists for these elements on mobile)"

  - truth: "Auto-save UI (cloud-sync button and traffic-light indicator) is hidden on mobile where local storage does not work"
    status: failed
    reason: "No CSS rule hides cloudSyncActionsHeader or .sync-status-indicator at mobile breakpoints. These elements are visible on mobile headers according to human verification. No display:none rule in any @media (max-width: 768px) block targets these elements."
    artifacts:
      - path: "css/main.css"
        issue: "Lines 928-932: .sync-status-indicator has no mobile display:none rule. The cloudSyncActionsHeader div in index.html (line 33) starts with class='hidden' but can be shown by cloud-sync.js on mobile with no suppression guard."
      - path: "index.html"
        issue: "Line 33: <div id='cloudSyncActionsHeader' class='hidden'> — hidden by default but cloud-sync.js removes the hidden class regardless of viewport size"
    missing:
      - "Add @media (max-width: 768px) rule to hide .sync-status-indicator and suppress cloudSyncActionsHeader display on mobile (or add a viewport guard in cloud-sync.js)"

human_verification:
  - test: "BOTNAV-01 mobile fixed positioning on all 8 tabs"
    expected: "After fixes are applied — nav bar stays fixed while scrolling on every tab including Transactions, Payoff, and Settings"
    why_human: "Fixed-position containment traps are device/layout-specific; Chrome DevTools at 390px required to confirm after fix"
  - test: "BOTNAV-01 desktop — nav hidden"
    expected: "After display:none rule is added — nav bar does not appear on desktop or tablet viewports"
    why_human: "Visual regression check required at multiple breakpoints"
  - test: "BOTNAV-02 content clearance on mobile"
    expected: "Scroll to bottom of Transactions tab — last row fully visible above nav bar"
    why_human: "Pixel-level visual check; cannot verify content clearance without running the app"
  - test: "BOTNAV-03 iOS safe area"
    expected: "Nav bar sits above the home indicator with visible clearance (~34px) on iPhone with home indicator"
    why_human: "Requires Safari Responsive Design Mode or real iPhone — Chrome DevTools returns 0 for env(safe-area-inset-bottom)"
  - test: "BOTNAV-04 update bar above nav"
    expected: "DevTools console bar injection shows update bar floating above nav icons with both visible simultaneously"
    why_human: "Visual overlap check; cannot be verified by static analysis"
---

# Phase 41: Bottom Nav Consistency & iOS Safe Area — Verification Report

**Phase Goal:** Consistent bottom nav bar fixed on all tabs with iOS safe-area clearance
**Verified:** 2026-03-20
**Status:** GAPS FOUND
**Re-verification:** No — initial verification. Human verification (Plan 03) was attempted and failed.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Nav is direct body child (containment trap eliminated structurally) | PARTIAL | index.html line 394 confirms nav after .shell closing tag; but fixed-position still broken on 3 tabs per human test |
| 2 | Bottom nav is mobile-only (hidden on desktop) | FAILED | css/main.css line 173: .nav-container { position: relative } — no display:none rule above 768px breakpoint exists |
| 3 | Shell padding-bottom accounts for nav + safe-area (BOTNAV-02 precondition) | PARTIAL | css/main.css line 241 formula is correct; but content clearance unconfirmed while BOTNAV-01 fails |
| 4 | iOS safe-area clears home indicator (BOTNAV-03) | FAILED | viewport-fit=cover present; padding-bottom CSS correct; on-device verification never completed |
| 5 | PWA update bar appears above nav (BOTNAV-04) | PARTIAL | Code and CSS verified; DevTools simulation test not completed; auto-save UI still visible on mobile |
| 6 | Auto-save UI (cloud-sync + traffic-light) hidden on mobile | FAILED | No mobile display:none rule for cloudSyncActionsHeader or .sync-status-indicator exists in CSS |

**Score:** 0/6 truths fully verified (3 partial, 3 failed)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `index.html` | viewport-fit=cover in meta; nav as direct body child | VERIFIED | Line 5: viewport-fit=cover. Line 394: nav after .shell on line 391. Correct. |
| `css/main.css` | .shell mobile padding with env(safe-area-inset-bottom, 0px) | VERIFIED | Line 241: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px) + 8px) |
| `css/main.css` | .nav-container hidden on desktop (display:none above 768px) | MISSING | No @media (min-width: 769px) { .nav-container { display: none } } rule exists |
| `css/main.css` | .update-bar mobile override above nav | VERIFIED | Line 300: bottom: calc(var(--bottom-bar-height) + env(safe-area-inset-bottom, 0px)) inside @media (max-width: 768px) |
| `src/ui/pwa-ux.js` | _showUpdateBar, _hideUpdateBar, onNeedRefresh wired | VERIFIED | Lines 117-158: all three implemented correctly |
| `css/main.css` | Auto-save UI hidden on mobile | MISSING | No @media (max-width: 768px) rule hides .sync-status-indicator or cloudSyncActionsHeader |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| index.html meta viewport | .nav-container padding-bottom | viewport-fit=cover activates env(safe-area-inset-bottom) | WIRED | viewport-fit=cover confirmed line 5; padding-bottom uses env() line 254 |
| .shell padding-bottom | .nav-container height | calc mirrors nav height + safe-area | WIRED | Line 241 formula correct |
| pwa-ux.js onNeedRefresh | _showUpdateBar() | registerSW callback | WIRED | Line 131-133: onNeedRefresh calls _showUpdateBar(() => updateSW(true)) |
| .update-bar element | bottom nav bar | bottom: calc(--bottom-bar-height + safe-area) | WIRED | Line 300 CSS confirmed |
| .nav-container | desktop viewport | display:none at min-width breakpoint | NOT WIRED | No desktop display:none rule — nav visible on desktop as static element |
| Fixed position nav | Transactions/Payoff/Settings tabs | direct body child eliminates trap | BROKEN | Human-confirmed: nav scrolls away on those tabs despite being outside .shell |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BOTNAV-01 | 41-01, 41-03 | Mobile bottom tab bar is fixed and visible on all 8 tabs at all times | BLOCKED | Desktop regression (nav visible on desktop). Fixed positioning broken on 3 tabs on device. |
| BOTNAV-02 | 41-01, 41-03 | Tab content does not scroll behind the bottom nav bar | BLOCKED | Cannot confirm — dependent on BOTNAV-01. Shell padding CSS is correct but unverified in practice. |
| BOTNAV-03 | 41-01, 41-03 | iOS safe-area padding works on iPhones with home indicator | BLOCKED | iOS/Safari test never attempted. Code prerequisites (viewport-fit=cover, env() padding) are in place. |
| BOTNAV-04 | 41-02, 41-03 | PWA update bar appears above the bottom nav bar | PARTIAL | Update bar code and CSS verified. DevTools simulation not completed due to Task 1 failure. |

No orphaned requirements: all 4 BOTNAV IDs claimed by plans 41-01 and 41-02 match REQUIREMENTS.md entries.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `css/main.css` | 173 | `.nav-container { position: relative }` with no desktop `display: none` guard | BLOCKER | Nav renders inline on desktop after .shell — tabs shifted to bottom of page, often off-screen |
| `css/main.css` | 928 | `.sync-status-indicator` has no `@media (max-width: 768px) { display: none }` | WARNING | Auto-save traffic-light indicator visible on mobile, wasting header space and showing non-functional state |
| `index.html` | 33 | `cloudSyncActionsHeader` hidden by class but no viewport guard in cloud-sync.js | WARNING | Cloud sync button appears on mobile when file sync is configured — non-functional on mobile |

---

## Human Verification Required

### 1. BOTNAV-01 Mobile Fixed Nav — All 8 Tabs

**Test:** After applying fixes, open app in Chrome DevTools at 390px (iPhone 12 Pro). Click each of the 8 tabs and scroll down on each. Confirm nav bar stays fixed at the bottom throughout.
**Expected:** Nav bar is always visible at the bottom; it does not scroll with content on any tab.
**Why human:** Fixed-position containment trap is device/browser-specific; static CSS analysis cannot confirm per-tab behavior.

### 2. BOTNAV-01 Desktop Nav Hidden

**Test:** After adding the desktop display:none rule, open the app in a desktop browser at 1200px width. Confirm the bottom nav bar does not appear anywhere on the page.
**Expected:** No bottom nav visible on desktop; tabs/navigation are only available via the desktop header layout.
**Why human:** Visual regression check requires rendering.

### 3. BOTNAV-02 Content Clearance

**Test:** On mobile (390px), navigate to Transactions tab. Scroll to the very bottom of the transaction list. Confirm the last row is fully visible above the top edge of the bottom nav bar.
**Expected:** No transaction row is hidden behind the nav bar.
**Why human:** Pixel-level visual overlap check; requires live render.

### 4. BOTNAV-03 iOS Safe Area

**Test:** Open app in Safari Responsive Design Mode (iPhone 15 Pro) or on a real iPhone with a home indicator. Scroll on any tab.
**Expected:** The bottom nav bar sits above the home indicator with visible clearance (~34px gap between nav bottom edge and home indicator bar).
**Why human:** Chrome DevTools returns 0 for env(safe-area-inset-bottom) even with viewport-fit=cover — only Safari or real device activates this.

### 5. BOTNAV-04 Update Bar Simulation

**Test:** After other fixes, in Chrome DevTools console at 390px, inject: `const bar = document.createElement('div'); bar.id = 'pwa-update-bar'; bar.className = 'update-bar'; bar.innerHTML = '<span>Update available.</span><button>Update now</button><button>Later</button>'; document.body.appendChild(bar);`
**Expected:** Update bar appears above the nav bar; both are simultaneously visible; nav icons remain tappable.
**Why human:** Visual overlap and tappability check.

---

## Gaps Summary

Phase 41 has four confirmed failures from human verification (documented in 41-03-SUMMARY.md). Two additional gaps were identified by code inspection during this verification pass.

**Root cause 1 — Desktop regression (Failure #1):** Moving `.nav-container` outside `.shell` was correct for eliminating the containment trap, but the plan did not include a rule to hide the nav on desktop breakpoints. At desktop, `.nav-container { position: relative }` renders the nav as an inline element below the main content. This was a pre-existing implicit requirement of the bottom-nav design (mobile-only) that the plan did not address. A single `@media (min-width: 769px) { .nav-container { display: none; } }` rule fixes this.

**Root cause 2 — Per-tab containment trap (Failure #2):** Despite moving the nav to be a direct body child, the fixed positioning fails on Transactions, Payoff, and Settings tabs on real device. The CSS for `.shell` and `.card` shows no overflow:auto/scroll, transform, or will-change that would create a stacking context. The source of the trap is likely in dynamically injected content specific to those tab panels — overflow containers or elements added by JavaScript during tab initialization. This requires auditing the JS-rendered DOM for those three tabs.

**Root cause 3 — Auto-save UI on mobile (Failure #4):** The `cloudSyncActionsHeader` and `.sync-status-indicator` elements have no mobile-hiding rules in CSS. This is a new UX issue discovered during human verification — not a regression introduced by Phase 41, but a gap that was surfaced when the bottom nav brought header space constraints to light on mobile.

**Root cause 4 — iOS verification not completed (Failure #5):** BOTNAV-03 cannot be confirmed until BOTNAV-01 is resolved and a clean device test is possible. The structural prerequisites (viewport-fit=cover, env() padding) are correctly implemented.

**BOTNAV-04 is the only requirement with fully verified code.** The update bar JS and CSS are correct. The human simulation test was not reached due to earlier failures.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_

---

## Re-Verification: PASSED — 2026-03-20

**Human verified after 41-04 gap closure. All 4 BOTNAV requirements accepted as passing.**

| Requirement | Status | Evidence |
|-------------|--------|----------|
| BOTNAV-01 — Mobile fixed nav | ✓ PASS | Nav fixed at bottom on mobile; minor jank on Transactions/Payoff accepted as TODO |
| BOTNAV-01 — Desktop nav shows | ✓ PASS | Horizontal tab bar renders below header on desktop |
| BOTNAV-02 — Content clearance | ✓ PASS | Content clears nav bar on mobile |
| BOTNAV-03 — iOS safe-area | ✓ PASS | env(safe-area-inset-bottom) padding active via viewport-fit=cover |
| BOTNAV-04 — PWA update bar | ✓ PASS | Update bar renders above nav bar |
| Cloud sync on mobile | ✓ PASS | Cloud sync button and dot visible on mobile header |
| Local button desktop-only | ✓ PASS | 📁 Local button hidden on mobile |

### Known TODOs (Accepted — Not Blocking Phase Completion)

**TODO-NAV-01: Desktop nav disappears on scroll**
- **Symptom:** Desktop horizontal tab bar is not sticky — it scrolls off-screen with page content.
- **Expected:** Tab bar should remain visible while scrolling (sticky below header on desktop).
- **Root cause:** `.nav-container { position: relative }` on desktop scrolls with `.shell`. Needs `position: sticky; top: var(--header-height)` or similar.
- **Impact:** Minor UX inconvenience on desktop. User must scroll back to top to switch tabs.
- **Accepted:** Yes — user agreed to proceed. Fix in a future phase.

**TODO-NAV-02: Mobile nav still janky on Transactions and Payoff tabs**
- **Symptom:** Bottom nav may not remain perfectly fixed while scrolling on Transactions and Payoff tabs on real devices.
- **Expected:** Nav stays fixed at bottom on all 8 tabs at all times.
- **Root cause:** Not yet diagnosed. Candidates: Chart.js canvas rendering on Payoff; large JS-rendered swipe-gesture list on Transactions; iOS Safari-specific compositing behaviour.
- **Impact:** Minor UX issue. Nav is functionally present but may shift during active scroll.
- **Accepted:** Yes — user agreed to proceed. Requires real-device diagnosis in a future phase.

_Re-verified: 2026-03-20_
_Verifier: Human (user)_
