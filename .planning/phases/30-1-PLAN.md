---
phase: 30-magic-link-pwa-auth-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/utils/supabase-sync.js, src/ui/cloud-sync.js, vite.config.js, .env.example]
autonomous: false
requirements: [MOB-07, SYNC-01]
user_setup: []

# Goal-backward verification (derived during planning, verified after execution)
must_haves:
  truths:
    - "Magic link email on Android Chrome PWA signs the user in to the installed app"
    - "Magic link email on iOS Safari browser (non-standalone) signs the user in"
    - "Clicking the magic link a second time does not cause an auth error (URL is cleaned after first use)"
    - "Service worker does not intercept or cache URLs containing ?code="
    - "iOS PWA standalone mode shows a guidance message in the sign-in form"
    - "After sign-in via magic link, the ?code= query parameter is removed from the URL"
  artifacts:
    - path: "src/utils/supabase-sync.js"
      provides: "emailRedirectTo using window.location.origin or VITE_SUPABASE_REDIRECT_URL"
      contains: "VITE_SUPABASE_REDIRECT_URL"
    - path: "src/ui/cloud-sync.js"
      provides: "URL cleanup after SIGNED_IN event; iOS guidance message"
      contains: "history.replaceState"
    - path: "src/ui/cloud-sync.js"
      provides: "iOS standalone guidance message"
      contains: "navigator.standalone"
    - path: "vite.config.js"
      provides: "navigateFallbackDenylist excluding auth callback URLs"
      contains: "navigateFallbackDenylist"
    - path: ".env.example"
      provides: "VITE_SUPABASE_REDIRECT_URL documented"
      contains: "VITE_SUPABASE_REDIRECT_URL"
    - path: ".planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md"
      provides: "Step-by-step manual test instructions for iOS Safari PWA, Android Chrome PWA, iOS Safari browser, Android Chrome browser"
      min_lines: 40
  key_links:
    - from: "src/utils/supabase-sync.js"
      to: "Supabase Auth OTP"
      via: "emailRedirectTo resolved from VITE_SUPABASE_REDIRECT_URL or window.location.origin"
      pattern: "VITE_SUPABASE_REDIRECT_URL.*window\\.location\\.origin|window\\.location\\.origin.*VITE_SUPABASE_REDIRECT_URL"
    - from: "src/ui/cloud-sync.js"
      to: "window.history"
      via: "replaceState call inside SIGNED_IN auth state change handler"
      pattern: "replaceState"
    - from: "vite.config.js"
      to: "Workbox SW"
      via: "navigateFallbackDenylist regex for ?code= URLs"
      pattern: "navigateFallbackDenylist"
---

<objective>
Harden the Supabase magic link authentication flow for PWA contexts on iOS and Android.

Purpose: MOB-07 and SYNC-01 require that magic link sign-in works correctly when the app is installed as a PWA. The PKCE flow is already configured; this plan addresses the three remaining issues: the redirect URL construction, the service worker intercepting auth callback URLs, and the iOS PWA context isolation UX gap. It also produces the required manual test script for human sign-off.

Output:
- `src/utils/supabase-sync.js` — `emailRedirectTo` uses env var with `window.location.origin` fallback
- `src/ui/cloud-sync.js` — URL cleanup after auth; iOS PWA guidance message
- `vite.config.js` — `navigateFallbackDenylist` excludes auth callback URLs from SW
- `.env.example` — `VITE_SUPABASE_REDIRECT_URL` documented
- `.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md` — human-verification test script
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
@~/.claude/get-shit-done/references/checkpoints.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

@src/utils/supabase-sync.js
@src/ui/cloud-sync.js
@vite.config.js
@.planning/phases/30-magic-link-pwa-auth-fix/30-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify and fix emailRedirectTo in supabase-sync.js</name>
  <files>src/utils/supabase-sync.js, .env.example</files>
  <read_first>src/utils/supabase-sync.js, .env.example</read_first>
  <action>
Read `src/utils/supabase-sync.js` in full before making any changes. Locate where `redirectTo` (or `emailRedirectTo`) is defined — it is used in the `signInWithOtp` call around line 153.

**Goal:** Ensure `emailRedirectTo` resolves to the deployed PWA's origin, not a hardcoded dev URL.

Make the following change:

Find the existing `redirectTo` definition (or the `emailRedirectTo` value inline in the `signInWithOtp` call). Replace it with:

```js
const redirectTo = import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? window.location.origin;
```

Then ensure the `signInWithOtp` call reads:
```js
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: redirectTo }
});
```

Do not change any other part of the `signInWithOtp` call. Do not change the `createClient` options (PKCE is already correctly configured).

**Also update `.env.example`:** Add the following entry if `VITE_SUPABASE_REDIRECT_URL` is not already present:
```bash
# Auth redirect URL — must match the deployed PWA URL exactly.
# Also add this URL to: Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
# Defaults to window.location.origin if not set.
VITE_SUPABASE_REDIRECT_URL=https://your-deployed-pwa-url.example.com
```
  </action>
  <verify>grep -n "VITE_SUPABASE_REDIRECT_URL\|emailRedirectTo\|redirectTo" src/utils/supabase-sync.js .env.example</verify>
  <acceptance_criteria>
    - src/utils/supabase-sync.js contains `VITE_SUPABASE_REDIRECT_URL`
    - src/utils/supabase-sync.js contains `window.location.origin` as the fallback for redirectTo
    - src/utils/supabase-sync.js `signInWithOtp` call uses `emailRedirectTo: redirectTo`
    - .env.example contains `VITE_SUPABASE_REDIRECT_URL`
    - .env.example entry has a comment explaining it must match the deployed PWA URL
  </acceptance_criteria>
  <done>emailRedirectTo uses VITE_SUPABASE_REDIRECT_URL env var with window.location.origin fallback; .env.example documents the variable.</done>
</task>

<task type="auto">
  <name>Task 2: Add URL cleanup and iOS guidance in cloud-sync.js</name>
  <files>src/ui/cloud-sync.js</files>
  <read_first>src/ui/cloud-sync.js</read_first>
  <action>
Read `src/ui/cloud-sync.js` in full before making any changes. Find two integration points:

**A. URL cleanup after auth — inside `onAuthStateChange`:**

Search for `onAuthStateChange` in the file. Find the `SIGNED_IN` event handler case. Inside the `SIGNED_IN` handler (after the existing session handling code, not replacing it), add:

```js
// Clean up PKCE ?code= parameter to prevent stale-code errors on refresh
if (window.location.search.includes('code=')) {
  window.history.replaceState({}, '', window.location.pathname);
}
```

If `onAuthStateChange` does not yet have a `SIGNED_IN` case, add one. Do not modify any existing auth state logic — this is an additive change within the handler.

**B. iOS PWA guidance message — inside the sign-in form render:**

Search for where the sign-in form HTML is rendered (look for the email input or `signInWithOtp` form). Find the function or code block that renders the sign-in UI. Add the following iOS check immediately before or after the form is inserted into the DOM:

```js
// iOS PWA standalone: deep-linking from email is not supported on iOS
// Show a guidance note so users understand how to sign in
if (window.navigator.standalone === true) {
  const notice = document.createElement('p');
  notice.className = 'auth-ios-notice';
  notice.innerHTML = '<strong>iOS tip:</strong> Magic links open in Safari, not this app. ' +
    'Open this app in <strong>Safari</strong> first, sign in there, then return here.';
  // Insert before the sign-in form container
  signinForm.parentNode.insertBefore(notice, signinForm);
}
```

Replace `signinForm` with the actual variable name for the sign-in form element as found in the file. If the form is rendered as a string template into a container, append the notice HTML as a sibling element instead.

Do not modify the existing sign-in form HTML itself — only add the notice element/text around it. Do not remove any existing form functionality.
  </action>
  <verify>grep -n "replaceState\|navigator.standalone\|auth-ios-notice\|code=" src/ui/cloud-sync.js</verify>
  <acceptance_criteria>
    - src/ui/cloud-sync.js contains `history.replaceState` (or `window.history.replaceState`)
    - src/ui/cloud-sync.js `replaceState` call is inside or after the `SIGNED_IN` auth state change handler
    - src/ui/cloud-sync.js contains `navigator.standalone`
    - src/ui/cloud-sync.js contains `auth-ios-notice` class (for the guidance element)
    - src/ui/cloud-sync.js contains check for `'code='` in `window.location.search` before calling `replaceState`
  </acceptance_criteria>
  <done>After SIGNED_IN auth event, ?code= is removed from the URL via history.replaceState; iOS standalone users see a guidance message in the sign-in form.</done>
</task>

<task type="auto">
  <name>Task 3: Add navigateFallbackDenylist to vite.config.js</name>
  <files>vite.config.js</files>
  <read_first>vite.config.js</read_first>
  <action>
Read `vite.config.js` in full before making any changes. Locate the `VitePWA({...})` plugin configuration. Find the `workbox:` section within it.

**IMPORTANT — check the PWA strategy first:**
- If `strategies: 'generateSW'` is set (or no `strategies` key, since `generateSW` is the default), proceed with the change below.
- If `strategies: 'injectManifest'` is set, `navigateFallbackDenylist` is not available. In that case, skip this task and add a comment in the file explaining why, then proceed to Task 4.

**For `generateSW` strategy (default):**

Find the `workbox: { ... }` block inside `VitePWA({...})`. Add the following inside the `workbox` object (alongside any existing workbox options, not replacing them):

```js
navigateFallbackDenylist: [
  /[?&]code=/,       // PKCE auth code — do not serve cached shell for auth callback URLs
  /#access_token=/,  // Legacy implicit flow hash — defensive
],
```

If a `navigateFallbackDenylist` key already exists, append the two regexes to the existing array instead of replacing it.

If there is no `workbox: {}` key at all inside `VitePWA({...})`, create one:
```js
VitePWA({
  // ... existing options
  workbox: {
    navigateFallbackDenylist: [
      /[?&]code=/,
      /#access_token=/,
    ],
  },
})
```

Do not change any other VitePWA or workbox settings.
  </action>
  <verify>grep -n "navigateFallbackDenylist\|code=\|access_token" vite.config.js</verify>
  <acceptance_criteria>
    - vite.config.js contains `navigateFallbackDenylist`
    - vite.config.js `navigateFallbackDenylist` array contains a regex matching `code=`
    - vite.config.js `navigateFallbackDenylist` array contains a regex matching `access_token`
    - No existing vite.config.js workbox options are removed or replaced (only additions)
  </acceptance_criteria>
  <done>Workbox service worker will not intercept navigation requests to URLs containing ?code= or #access_token=, preventing SW caching of auth callback URLs.</done>
</task>

<task type="auto">
  <name>Task 4: Create 30-MANUAL-TEST.md</name>
  <files>.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md</files>
  <read_first>src/utils/supabase-sync.js, src/ui/cloud-sync.js</read_first>
  <action>
Create the file `.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md` with the following content. This is the human-verification test script for Phase 30.

The script must cover all four test scenarios listed in the CONTEXT.md:
1. iOS Safari PWA (standalone mode — app installed to home screen)
2. Android Chrome PWA (standalone mode — app installed to home screen)
3. iOS Safari browser (non-standalone — opening the app URL directly in Safari)
4. Android Chrome browser (non-standalone — opening the app URL directly in Chrome)

For each scenario, the script must include:
- Pre-conditions (clear state: sign out, clear localStorage, ensure any prior session is removed)
- Step-by-step actions (numbered, explicit — no ambiguity)
- Expected results at each step
- Pass/Fail criteria
- Where to record the result

Also include:
- A "Known Limitations" section noting that iOS PWA deep-linking from email is a platform limitation (Apple does not support it as of iOS 17). The app mitigates this with a guidance message. The test for iOS PWA is a "verify guidance message is shown" test, not a "verify sign-in works via magic link" test.
- A sign-off table at the bottom: Tester name, Device, OS Version, Browser Version, Date, Result (Pass/Fail), Notes.

Write the full content of this file as proper Markdown. The file must be at least 40 lines.
  </action>
  <verify>wc -l .planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md && grep -c "iOS\|Android\|Pass\|Fail" .planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md</verify>
  <acceptance_criteria>
    - .planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md exists
    - File contains at least 40 lines
    - File covers all four test scenarios (iOS PWA, Android PWA, iOS browser, Android browser)
    - File contains "Known Limitations" section describing iOS PWA deep-link limitation
    - File contains a sign-off table or section for human testers to record results
    - File is clearly marked as HUMAN-VERIFICATION-REQUIRED
  </acceptance_criteria>
  <done>30-MANUAL-TEST.md exists with step-by-step instructions for all four device/browser scenarios, known limitations documented, and a sign-off section for human testers.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    PWA auth hardening changes across 4 files:
    - src/utils/supabase-sync.js — emailRedirectTo now uses VITE_SUPABASE_REDIRECT_URL ?? window.location.origin
    - src/ui/cloud-sync.js — URL cleanup after SIGNED_IN; iOS guidance message on navigator.standalone
    - vite.config.js — navigateFallbackDenylist excludes ?code= and #access_token= from SW
    - .env.example — VITE_SUPABASE_REDIRECT_URL documented
    - .planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md — manual test script

    Code changes can be reviewed directly; physical device testing is required to verify auth behaviour.
  </what-built>
  <how-to-verify>
    Follow the instructions in `.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md`.

    Minimum required tests before sign-off:
    1. **iOS Safari browser (non-standalone):** Open the deployed PWA URL in Safari on an iPhone. Request a magic link. Click the link in the email. Verify the app opens and shows you as signed in. Verify the URL no longer shows `?code=`.
    2. **Android Chrome browser (non-standalone):** Same flow on Android Chrome.
    3. **iOS PWA (standalone):** Install the app to the home screen. Open it. Go to sign in. Verify the iOS guidance message ("Magic links open in Safari...") is visible.
    4. **Android Chrome PWA (standalone):** Install the app to the home screen. Request a magic link. Click the link. Verify it opens the installed PWA and signs you in.

    Note: iOS PWA magic link deep-linking is a known platform limitation — the guidance message is the expected behaviour on iOS, not a bug.
  </how-to-verify>
  <resume-signal>Type "approved" after completing device testing, or describe any issues found</resume-signal>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `grep -n "VITE_SUPABASE_REDIRECT_URL" src/utils/supabase-sync.js` returns a match
- [ ] `grep -n "replaceState" src/ui/cloud-sync.js` returns a match inside the SIGNED_IN handler
- [ ] `grep -n "navigator.standalone" src/ui/cloud-sync.js` returns a match
- [ ] `grep -n "navigateFallbackDenylist" vite.config.js` returns a match
- [ ] `grep -n "VITE_SUPABASE_REDIRECT_URL" .env.example` returns a match
- [ ] `.planning/phases/30-magic-link-pwa-auth-fix/30-MANUAL-TEST.md` exists with ≥40 lines
- [ ] `npm run build` (or equivalent) succeeds without errors
- [ ] No existing test suite failures introduced: run `npx vitest run` and confirm all tests pass
</verification>

<success_criteria>
- All tasks completed
- All verification checks pass
- emailRedirectTo correctly resolves to production URL via env var
- Workbox SW will not intercept auth callback URLs (navigateFallbackDenylist in place)
- URL is cleaned after auth to prevent stale-code errors on refresh
- iOS PWA users see a guidance message in the sign-in form
- 30-MANUAL-TEST.md covers all four test scenarios with clear pass/fail criteria
- Human checkpoint approved after physical device testing
</success_criteria>

<output>
After completion, create `.planning/phases/30-magic-link-pwa-auth-fix/30-1-SUMMARY.md`
</output>
