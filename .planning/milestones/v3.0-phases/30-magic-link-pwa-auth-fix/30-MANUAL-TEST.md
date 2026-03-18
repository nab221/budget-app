# Phase 30 — Magic Link PWA Auth Fix: Manual Test Script

**Status:** HUMAN-VERIFICATION-REQUIRED

This document provides step-by-step instructions for manually verifying the PWA magic link
authentication changes across all four target environments. Complete all scenarios and record
results in the sign-off table at the bottom before approving Phase 30.

---

## Pre-Conditions (All Scenarios)

Before starting each scenario:

1. Ensure the app is deployed to its production/staging URL (e.g. `https://username.github.io/budget-app/`).
2. Have access to a real email inbox you can receive magic links on.
3. Confirm `VITE_SUPABASE_REDIRECT_URL` is set in your deployment to the exact PWA URL (or left unset
   to use `window.location.origin` as the fallback).
4. Confirm the redirect URL is listed in Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.

---

## Known Limitations

**iOS PWA Deep-Linking is Not Supported (Apple Platform Limitation)**

As of iOS 17, Apple does not support opening a PWA installed to the home screen directly from an email
link. When the user taps a magic link on iOS, the OS always opens it in Safari (the system browser),
not in the installed PWA.

The application mitigates this limitation by displaying a guidance message inside the sign-in form when
running in iOS standalone (PWA) mode. The guidance tells the user to request and open the magic link in
Safari instead.

The test for Scenario 1 (iOS PWA) is therefore:
- "Verify the guidance message is shown" — NOT "verify the magic link signs in via the PWA directly".

This is expected behaviour, not a bug.

---

## Scenario 1: iOS Safari PWA (Standalone Mode)

**Device:** iPhone (any model running iOS 16+)
**Browser:** Safari (app installed to home screen)

### Pre-Conditions

- The app is installed to the iOS home screen ("Add to Home Screen" via Safari).
- You have previously signed out (or have never signed in on this device).
- Open the installed app from the home screen — verify the URL bar is absent (standalone mode).

### Steps

1. Open the app from the iOS home screen icon.
2. Navigate to the Settings or Cloud Sync section.
3. Tap "Sign In" to open the sign-in form.
4. Observe the sign-in modal or form.

### Expected Results

- Step 4: A notice paragraph is displayed above the email input that reads:
  **"iOS tip: Magic links open in Safari, not this app. Continue sign-in in Safari, or use
  Safari/browser mode before requesting the link."**
- The email input and "Send Link" button are still accessible and functional.

### Pass/Fail Criteria

| Check | Expected | Pass? |
|-------|----------|-------|
| iOS guidance notice is visible | Yes, displayed above email input | |
| Notice text mentions "Safari" | Yes | |
| Email input is usable | Yes | |

---

## Scenario 2: Android Chrome PWA (Standalone Mode)

**Device:** Android phone (any model running Android 10+)
**Browser:** Chrome (app installed to home screen)

### Pre-Conditions

- The app is installed via Chrome's "Add to Home Screen" / "Install App" prompt.
- Sign out and clear the app session: open the app → Settings → Sign Out (if signed in).
- Clear the browser/app storage if retesting: Chrome → Settings → Site Settings → Storage → Clear.

### Steps

1. Open the installed app from the Android home screen.
2. Navigate to Settings or Cloud Sync.
3. Tap "Sign In". Enter your email address and tap "Send Link".
4. **Expected result:** "Check your email for a sign-in link." notification appears.
5. Open your email app and tap the magic link.
6. The link should open the installed PWA (not a browser tab) and complete sign-in.
7. Return to the Cloud Sync section. Observe the signed-in state.
8. Check the URL bar is absent (standalone mode) and the URL does not contain `?code=`.

### Expected Results

- Step 4: Success notification shown.
- Step 6: The installed PWA opens and processes the auth code.
- Step 7: The app shows the signed-in user's email and cloud sync options.
- Step 8: No `?code=` query parameter in the address (URL was cleaned after sign-in).

### Pass/Fail Criteria

| Check | Expected | Pass? |
|-------|----------|-------|
| Magic link email delivered | Yes | |
| Link opens installed PWA (not browser tab) | Yes | |
| User is signed in after tapping link | Yes | |
| `?code=` removed from URL after sign-in | Yes | |
| No "Invalid grant" or auth error on refresh | Yes | |

---

## Scenario 3: iOS Safari Browser (Non-Standalone)

**Device:** iPhone (any model running iOS 16+)
**Browser:** Safari browser tab (NOT installed to home screen)

### Pre-Conditions

- Open the app URL directly in Safari (not from a home screen icon).
- Confirm the URL bar is visible (non-standalone/browser mode).
- Sign out if currently signed in.

### Steps

1. Open the deployed app URL in Safari on iPhone.
2. Navigate to Settings or Cloud Sync.
3. Tap "Sign In". Enter your email address and tap "Send Link".
4. **Expected result:** "Check your email for a sign-in link." notification appears.
5. Switch to the Mail app and tap the magic link.
6. Safari should open the app URL with `?code=...` and process the sign-in.
7. Wait for the auth to complete (the page may briefly reload or update).
8. Verify the signed-in state is shown.
9. Check the URL — it should no longer contain `?code=`.

### Expected Results

- Step 4: Success notification shown.
- Step 6: Safari navigates to the app URL and Supabase processes the PKCE code.
- Step 8: The app shows the signed-in user's email.
- Step 9: URL is clean — `?code=` has been removed via `history.replaceState`.

### Pass/Fail Criteria

| Check | Expected | Pass? |
|-------|----------|-------|
| Magic link email delivered | Yes | |
| Tapping link opens Safari with app URL | Yes | |
| User is signed in after navigation | Yes | |
| `?code=` removed from URL after sign-in | Yes | |
| Refreshing the page does not cause an auth error | Yes | |

---

## Scenario 4: Android Chrome Browser (Non-Standalone)

**Device:** Android phone (any model running Android 10+)
**Browser:** Chrome browser tab (NOT installed to home screen)

### Pre-Conditions

- Open the app URL directly in Chrome (not from a home screen shortcut).
- Confirm the URL bar is visible (non-standalone/browser mode).
- Sign out if currently signed in.

### Steps

1. Open the deployed app URL in Chrome on Android.
2. Navigate to Settings or Cloud Sync.
3. Tap "Sign In". Enter your email address and tap "Send Link".
4. **Expected result:** "Check your email for a sign-in link." notification appears.
5. Open your email app and tap the magic link.
6. Chrome should open the app URL with `?code=...` and process the sign-in.
7. Wait for the auth to complete.
8. Verify the signed-in state is shown.
9. Check the URL — it should no longer contain `?code=`.

### Expected Results

- Step 4: Success notification shown.
- Step 6: Chrome navigates to the app URL and Supabase processes the PKCE code.
- Step 8: The app shows the signed-in user's email.
- Step 9: URL is clean — `?code=` has been removed.

### Pass/Fail Criteria

| Check | Expected | Pass? |
|-------|----------|-------|
| Magic link email delivered | Yes | |
| Tapping link opens Chrome with app URL | Yes | |
| User is signed in after navigation | Yes | |
| `?code=` removed from URL after sign-in | Yes | |
| Refreshing the page does not cause an auth error | Yes | |

---

## Regression Check (All Devices)

After completing the above scenarios, verify no regressions on desktop:

1. Open the app in a desktop Chrome or Firefox browser.
2. Request a magic link and sign in.
3. Confirm sign-in works and URL is cleaned after auth.

---

## Sign-Off Table

Complete this table after testing. All scenarios should show "Pass" before approving Phase 30.

| # | Scenario | Tester | Device | OS Version | Browser Version | Date | Result | Notes |
|---|----------|--------|--------|-----------|-----------------|------|--------|-------|
| 1 | iOS PWA Standalone (guidance message) | | | | | | Pass / Fail | |
| 2 | Android PWA Standalone (magic link sign-in) | | | | | | Pass / Fail | |
| 3 | iOS Safari Browser (magic link sign-in) | | | | | | Pass / Fail | |
| 4 | Android Chrome Browser (magic link sign-in) | | | | | | Pass / Fail | |
| 5 | Desktop browser regression | | | | | | Pass / Fail | |

**Approval:** Once all rows show "Pass", type `approved` to complete Phase 30.
