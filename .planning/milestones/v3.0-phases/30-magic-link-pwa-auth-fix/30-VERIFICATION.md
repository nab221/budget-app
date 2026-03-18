---
phase: 30-magic-link-pwa-auth-fix
verified: 2026-03-15T12:00:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "iOS Safari browser (non-standalone): request magic link, tap in Mail, verify sign-in and URL cleanup"
    expected: "App signs in and ?code= is removed from the URL bar"
    why_human: "Requires physical iPhone, real email inbox, and deployed PWA URL"
  - test: "Android Chrome browser (non-standalone): request magic link, tap in email app, verify sign-in and URL cleanup"
    expected: "App signs in and ?code= is removed from the URL bar"
    why_human: "Requires physical Android device, real email inbox, and deployed PWA URL"
  - test: "iOS PWA standalone mode: install app to home screen, open, navigate to sign-in"
    expected: "iOS guidance notice is visible above the email input: 'iOS tip: Magic links open in Safari, not this app.'"
    why_human: "window.navigator.standalone === true only fires on real iOS home screen installs; cannot be simulated in browser dev tools"
  - test: "Android Chrome PWA standalone mode: install app, request magic link, tap link in email"
    expected: "Installed PWA opens and completes sign-in; ?code= is gone from URL after auth"
    why_human: "Requires physical Android device with app installed as PWA and a real email inbox"
  - test: "Stale-code prevention: after signing in via magic link, refresh the page"
    expected: "No auth error ('Invalid grant' / PKCE error); user stays signed in"
    why_human: "Requires completing a real auth flow first, then refreshing"
---

# Phase 30: Magic Link PWA Auth Fix — Verification Report

**Phase Goal:** Harden the Supabase magic link authentication flow for PWA contexts on iOS and Android.
**Verified:** 2026-03-15T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Magic link emailRedirectTo uses VITE_SUPABASE_REDIRECT_URL or window.location.origin | VERIFIED | `src/utils/supabase-sync.js` line 152: `const redirectTo = import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? window.location.origin;` |
| 2 | Service worker does not intercept/cache URLs containing ?code= | VERIFIED | `vite.config.js` lines 41-43: `navigateFallbackDenylist: [/[?&]code=/]` in workbox block |
| 3 | After SIGNED_IN event, ?code= query parameter is removed from the URL | VERIFIED | `src/ui/cloud-sync.js` lines 1385-1389: replaceState inside the SIGNED_IN handler, guarded by `window.location.search.includes('code=')` |
| 4 | iOS PWA standalone mode shows a guidance message in the sign-in form | VERIFIED | `src/ui/cloud-sync.js` lines 1022-1026: `window.navigator.standalone === true` check renders `<p class="auth-ios-notice">` into `_showSignInModal` body |
| 5 | VITE_SUPABASE_REDIRECT_URL is documented in .env.example | VERIFIED | `.env.example` lines 18-21: variable present with comment explaining it must match deployed PWA URL |
| 6 | Manual test script covers all four device/browser scenarios | VERIFIED | `30-MANUAL-TEST.md` is 224 lines, covers iOS PWA, Android PWA, iOS Safari browser, Android Chrome browser, with Known Limitations and sign-off table |

**Score:** 6/6 truths verified (automated checks)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/utils/supabase-sync.js` | emailRedirectTo using VITE_SUPABASE_REDIRECT_URL or window.location.origin | VERIFIED | Line 152 — exact pattern present; wired into `signInWithOtp` on line 153 |
| `src/ui/cloud-sync.js` | URL cleanup after SIGNED_IN; iOS guidance message | VERIFIED | replaceState at line 1388 inside SIGNED_IN handler; iosNotice at line 1022 inside `_showSignInModal` |
| `vite.config.js` | navigateFallbackDenylist excluding auth callback URLs | VERIFIED | Lines 41-43 in workbox block; regex `/[?&]code=/` |
| `.env.example` | VITE_SUPABASE_REDIRECT_URL documented | VERIFIED | Lines 18-21; includes comment and example value |
| `.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md` | Step-by-step test instructions, ≥40 lines | VERIFIED | 224 lines; all four scenarios covered |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/utils/supabase-sync.js` | Supabase Auth OTP | `VITE_SUPABASE_REDIRECT_URL ?? window.location.origin` assigned to `redirectTo`, passed as `emailRedirectTo` in `signInWithOtp` | WIRED | Line 152-153; both env-var path and fallback path are present and wired into the OTP call |
| `src/ui/cloud-sync.js` | `window.history` | `replaceState` inside SIGNED_IN `onAuthStateChange` handler | WIRED | Lines 1385-1389; guarded by `code=` check; called after existing auto-pull logic is triggered |
| `vite.config.js` | Workbox SW | `navigateFallbackDenylist` regex `/[?&]code=/` in `workbox` block | WIRED | Lines 41-43; `generateSW` strategy (default — no `strategies` key); regex prevents SW navigation fallback for auth callback URLs |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MOB-07 | 30-01-PLAN.md | PWA magic link sign-in works on mobile | NEEDS HUMAN | Code changes correct; physical device testing required for full satisfaction |
| SYNC-01 | 30-01-PLAN.md | Auth redirect URL correctly configured for deployed PWA | VERIFIED (automated) | `VITE_SUPABASE_REDIRECT_URL ?? window.location.origin` pattern in place; env var documented |

---

### Anti-Patterns Found

No anti-patterns detected in modified files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

---

### Commits Verified

All five commits documented in SUMMARY.md exist in the repository:

| Commit | Description |
|--------|-------------|
| `b671a16` | feat(30-01): use VITE_SUPABASE_REDIRECT_URL for magic link emailRedirectTo |
| `6c7b94b` | feat(30-01): add URL cleanup after SIGNED_IN and iOS PWA guidance in sign-in modal |
| `4d03869` | feat(30-01): add navigateFallbackDenylist to prevent SW caching auth callback URLs |
| `7545e41` | docs(30-01): create 30-MANUAL-TEST.md with all four device/browser scenarios |
| `01a2e37` | fix(30-01): update supabase-sync signIn test to match new redirectTo logic |

---

### Human Verification Required

The five items below cannot be verified programmatically. All require a physical device, a real email inbox, and the app deployed to its production/staging URL.

#### 1. iOS PWA Standalone — Guidance Message

**Test:** Install the app to the iOS home screen via Safari "Add to Home Screen". Open the installed app from the home screen icon. Navigate to Settings / Cloud Sync and tap Sign In.
**Expected:** A notice paragraph appears above the email input reading "iOS tip: Magic links open in Safari, not this app. Continue sign-in in Safari, or use Safari/browser mode before requesting the link."
**Why human:** `window.navigator.standalone === true` is only true when the app is launched from the iOS home screen; it cannot be reproduced in browser developer tools or CI.

#### 2. iOS Safari Browser (Non-Standalone) — Magic Link Sign-In

**Test:** Open the deployed app URL directly in Safari on an iPhone (not from a home screen icon). Request a magic link. Switch to Mail, tap the link. Verify sign-in completes and the URL no longer contains `?code=`.
**Expected:** App shows signed-in state; URL bar shows clean origin path with no `?code=` query parameter.
**Why human:** Requires a physical iPhone, real email delivery, and PKCE code exchange with the live Supabase project.

#### 3. Android Chrome Browser (Non-Standalone) — Magic Link Sign-In

**Test:** Open the deployed app URL directly in Chrome on Android. Request a magic link. Tap the link in the email app. Verify sign-in completes and `?code=` is gone from the URL.
**Expected:** App shows signed-in state; URL cleaned.
**Why human:** Requires physical Android device, real email, and live Supabase PKCE exchange.

#### 4. Android Chrome PWA (Standalone) — Magic Link Sign-In

**Test:** Install the app to the Android home screen via Chrome. Request a magic link from the installed PWA. Tap the link in the email app. Verify the installed PWA opens (not a browser tab) and the user is signed in.
**Expected:** PWA opens in standalone mode; user is authenticated; `?code=` removed from URL.
**Why human:** Android PWA deep-linking behaviour (whether the link opens the installed PWA or a browser tab) depends on device/Chrome version and can only be confirmed on a real device.

#### 5. Stale-Code Refresh Test

**Test:** Complete a magic link sign-in on any device/browser. After sign-in succeeds, refresh the page.
**Expected:** No "Invalid grant" or PKCE error; user remains signed in.
**Why human:** Requires a prior successful auth flow; verifies that `history.replaceState` successfully cleaned `?code=` before the refresh.

Refer to `.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md` for the complete step-by-step test script and sign-off table.

---

### Summary

All six automated must-haves are fully verified:

- `src/utils/supabase-sync.js` — `signIn()` resolves `emailRedirectTo` from `VITE_SUPABASE_REDIRECT_URL ?? window.location.origin`. Pattern is present, substantive, and wired directly into the `signInWithOtp` call.
- `src/ui/cloud-sync.js` — `_showSignInModal` renders the iOS notice when `navigator.standalone === true`. The `onAuthStateChange` SIGNED_IN handler cleans `?code=` from the URL via `history.replaceState`. Both are additive changes that do not replace existing auth logic.
- `vite.config.js` — `navigateFallbackDenylist: [/[?&]code=/]` is present inside the `workbox` block. The `generateSW` strategy is active (no `strategies` key). No existing workbox options were removed.
- `.env.example` — `VITE_SUPABASE_REDIRECT_URL` is documented with the required comment.
- `30-MANUAL-TEST.md` — 224 lines; covers all four device/browser scenarios with known limitations and sign-off table.

Phase goal cannot be declared fully achieved until a human completes the device testing described in items 1-5 above and records results in the sign-off table.

---

_Verified: 2026-03-15T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
