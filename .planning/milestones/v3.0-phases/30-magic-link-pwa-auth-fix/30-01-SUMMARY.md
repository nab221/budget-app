---
phase: 30-magic-link-pwa-auth-fix
plan: 01
subsystem: auth
tags: [supabase, pwa, magic-link, pkce, workbox, service-worker, ios]

# Dependency graph
requires:
  - phase: 27-critical-bug-fixes
    provides: cloud-sync hardening baseline (supabase-sync.js, cloud-sync.js patterns)
provides:
  - VITE_SUPABASE_REDIRECT_URL env-var-driven emailRedirectTo for magic link auth
  - URL cleanup (history.replaceState) after PKCE SIGNED_IN to prevent stale-code errors
  - iOS PWA standalone guidance message in sign-in modal
  - Workbox navigateFallbackDenylist preventing SW from intercepting ?code= auth callbacks
  - 30-MANUAL-TEST.md test script covering all four device/browser scenarios
affects: [31-banking-calendar-recurrence-upgrade, auth, cloud-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VITE_SUPABASE_REDIRECT_URL ?? window.location.origin for configurable redirectTo"
    - "navigateFallbackDenylist regex to exclude auth callback URLs from SW navigation fallback"
    - "window.navigator.standalone check for iOS PWA context-sensitive UI"
    - "history.replaceState after auth event to clean PKCE code from URL bar"

key-files:
  created:
    - .planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md
  modified:
    - src/utils/supabase-sync.js
    - src/ui/cloud-sync.js
    - vite.config.js
    - .env.example
    - src/utils/supabase-sync.test.js

key-decisions:
  - "emailRedirectTo uses VITE_SUPABASE_REDIRECT_URL ?? window.location.origin (not origin+pathname) — origin alone is the correct PKCE redirect target"
  - "navigateFallbackDenylist regex /[?&]code=/ placed in workbox block (generateSW default strategy) — injectManifest would require a different approach"
  - "iOS guidance shown as inline HTML in _showSignInModal body string (matches existing string-template pattern) rather than DOM insertion after modal render"
  - "URL cleanup via history.replaceState inside SIGNED_IN handler (additive change, does not replace existing auto-pull logic)"

patterns-established:
  - "Pattern: navigateFallbackDenylist — any future auth flows using query-param codes should add their regex here"
  - "Pattern: iOS standalone check — window.navigator.standalone === true for PWA-only UI branches"

requirements-completed: [MOB-07, SYNC-01]

# Metrics
duration: 25min
completed: 2026-03-15
---

# Phase 30 Plan 01: Magic Link PWA Auth Fix Summary

**Hardened Supabase PKCE magic link auth for iOS and Android PWA contexts: configurable redirectTo, SW auth-URL bypass, URL cleanup after sign-in, and iOS standalone guidance message**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-15T11:00:38Z
- **Completed:** 2026-03-15T11:25:00Z
- **Tasks:** 4 completed (+ 1 checkpoint)
- **Files modified:** 5 source files

## Accomplishments

- `signIn()` now resolves `emailRedirectTo` from `VITE_SUPABASE_REDIRECT_URL ?? window.location.origin`, allowing deployed PWA URL to be configured without code changes
- Workbox `navigateFallbackDenylist` prevents the service worker from serving the cached app shell for URLs containing `?code=`, fixing auth callbacks being intercepted in Android PWA
- `onAuthStateChange` SIGNED_IN handler cleans up the PKCE `?code=` from the URL via `history.replaceState`, preventing stale-code errors on page refresh
- iOS PWA standalone mode (`navigator.standalone === true`) shows a guidance notice in the sign-in modal informing users to use Safari for magic links
- `30-MANUAL-TEST.md` (224 lines) documents all four device/browser test scenarios with step-by-step instructions, known limitations, and a sign-off table

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify and fix emailRedirectTo in supabase-sync.js** - `b671a16` (feat)
2. **Task 2: Add URL cleanup and iOS guidance in cloud-sync.js** - `6c7b94b` (feat)
3. **Task 3: Add navigateFallbackDenylist to vite.config.js** - `4d03869` (feat)
4. **Task 4: Create 30-MANUAL-TEST.md** - `7545e41` (docs)
5. **Deviation fix: supabase-sync.test.js test update** - `01a2e37` (fix)

## Files Created/Modified

- `src/utils/supabase-sync.js` — `signIn()` emailRedirectTo now uses `VITE_SUPABASE_REDIRECT_URL ?? window.location.origin`
- `src/ui/cloud-sync.js` — Added URL cleanup (replaceState) in SIGNED_IN handler; iOS standalone notice in `_showSignInModal`
- `vite.config.js` — Added `navigateFallbackDenylist: [/[?&]code=/]` to workbox config
- `.env.example` — Added `VITE_SUPABASE_REDIRECT_URL` with documentation comment
- `src/utils/supabase-sync.test.js` — Updated signIn test to assert `window.location.origin` fallback; added test for env var case
- `.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md` — 224-line manual test script for all four device/browser scenarios

## Decisions Made

- `emailRedirectTo` uses `window.location.origin` (not `origin + pathname`) as the fallback — the PKCE redirect target should be the origin only, not include a path segment
- iOS guidance rendered as inline HTML inside the existing `_showSignInModal` body string template (consistent with how other modal content is composed in cloud-sync.js)
- `navigateFallbackDenylist` placed in the existing `workbox` block; confirmed `generateSW` is the active strategy (no `strategies` key = default)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated supabase-sync.test.js signIn assertion after redirectTo logic change**
- **Found during:** Post-task verification (test run after Task 1)
- **Issue:** Existing test asserted `emailRedirectTo: 'http://localhost:3000/'` (origin + pathname). New code uses `VITE_SUPABASE_REDIRECT_URL ?? window.location.origin` — the expected value changed from `'http://localhost:3000/'` to `'http://localhost:3000'` (no trailing slash), and new env-var path needed coverage.
- **Fix:** Updated existing test to assert `window.location.origin`; added a second test for the `VITE_SUPABASE_REDIRECT_URL` env var path
- **Files modified:** `src/utils/supabase-sync.test.js`
- **Verification:** `npx vitest run src/utils/supabase-sync.test.js` → 28/28 pass
- **Committed in:** `01a2e37`

---

**Total deviations:** 1 auto-fixed (Rule 1 — test correctness)
**Impact on plan:** Test update was required for correctness; no scope creep. All 393 tests pass.

## Issues Encountered

- Vitest output piping to background tasks produced empty files — ran tests directly to confirm results. All 393 tests pass (28 in supabase-sync.test.js specifically verified post-change).

## User Setup Required

**External service configuration required for production.** After deploying:

1. Set `VITE_SUPABASE_REDIRECT_URL=https://your-deployed-pwa-url.example.com` in your deployment environment (GitHub Pages / Netlify / Vercel secret)
2. Add that same URL to: Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
3. Complete device testing per `.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md`

## Next Phase Readiness

- Phase 30 code changes are complete and verified. The checkpoint requires physical device testing before phase sign-off.
- Phase 31 (Banking Calendar & Recurrence Upgrade) has no dependency on Phase 30 auth changes and can proceed.
- The `navigateFallbackDenylist` pattern should be extended if Phase 31+ introduces any other auth flows with query-param codes.

---
*Phase: 30-magic-link-pwa-auth-fix*
*Completed: 2026-03-15*
