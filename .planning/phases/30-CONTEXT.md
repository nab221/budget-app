
# Phase 30 Context: Magic Link PWA / Auth Fix

## Objective
Fix Supabase magic link email authentication when the app is installed as a PWA on iOS Safari and Android Chrome. Currently, clicking the magic link on mobile does not successfully authenticate the user into the app.

## Background

### How Magic Links Work
1. User enters email in the sign-in form
2. Supabase sends an email containing a magic link: `https://[project].supabase.co/auth/v1/verify?token=...&redirect_to=[app-url]`
3. Clicking the link opens a browser, Supabase validates the token, then redirects to `[app-url]#access_token=...&refresh_token=...`
4. The app's auth callback handler (in `cloud-sync.js`) reads the hash params and completes sign-in

### Why It Fails on PWA/Mobile

**Scenario A — PWA Installed (iOS Safari)**
On iOS, installed PWAs open in a separate browser context. When the user clicks the magic link in their email app, iOS opens it in Safari (not the PWA). The auth token is delivered to Safari, not the PWA's IndexedDB. The PWA never receives the auth event.

**Scenario B — Android Chrome PWA**
Similar issue: Chrome PWAs have their own browsing context. The redirect may open in a regular Chrome tab rather than the PWA. The token is in the Chrome tab's context.

**Scenario C — Service Worker Intercept**
If the service worker intercepts the redirect URL matching the app's scope, it may serve a cached shell that doesn't handle the `#access_token` hash correctly, or the hash is stripped.

### Possible Solutions

**Option 1 — Use `window.location` hash handling on app load**
On every app load, check `window.location.hash` for `access_token`. If found, call `supabase.auth.setSession()` with the extracted tokens. This is the standard Supabase approach and must be implemented in the app's init sequence.

**Option 2 — Custom URL Scheme (PWA Manifest)**
Configure the PWA manifest with a custom `protocol_handlers` entry or use `start_url` with a query parameter that Supabase redirects to. Android supports `protocol_handlers` in modern browsers.

**Option 3 — PKCE Flow**
Switch to Supabase PKCE (Proof Key for Code Exchange) flow instead of the implicit flow. PKCE sends a `?code=` parameter instead of a `#access_token=` hash. This is more reliable across PWA contexts and is Supabase's recommended approach for mobile.

**Recommended approach:** Implement Option 1 first (hash handling on load) as the lowest-risk fix. If iOS still fails, evaluate Option 3 (PKCE flow change in Supabase settings + client code update).

## Files to Change
- `src/ui/cloud-sync.js` — check for `#access_token` on init, call `supabase.auth.setSession()`
- `public/sw.js` (service worker) — ensure the service worker does not intercept the auth redirect URL; add an allow-through rule for the Supabase redirect path
- `public/manifest.json` — review `start_url` and `scope` to ensure the magic link redirect URL is within scope
- `.env.example` — document that `VITE_SUPABASE_REDIRECT_URL` must match the deployed PWA URL exactly

```bash
# .env.example
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_REDIRECT_URL=https://your-deployed-pwa-url.example.com
```

## Acceptance Criteria
- [ ] Magic link email received on iOS opens the installed PWA and completes sign-in
- [ ] Magic link email received on Android opens the installed PWA and completes sign-in
- [ ] Magic link fallback: if PWA is not installed, the link opens in Safari/Chrome and completes sign-in in the browser tab
- [ ] Service worker does not block or corrupt the auth redirect
- [ ] After sign-in via magic link on mobile, the app auto-pulls from the cloud (existing v2.7 behaviour preserved)
- [ ] Manual verification on physical iOS device (Safari) and Android device documented in 30-VERIFICATION.md

## Technical Notes
- Supabase JS client v2: `supabase.auth.getSession()` should be called on every app load; if a session is in the URL hash, the client will parse it automatically in v2. Verify the Supabase JS client version in `package.json`.
- The service worker at `public/sw.js` (if it exists) must have a pass-through rule for URLs containing `#access_token` or `?code=`
- On iOS, PWA standalone mode uses `window.navigator.standalone === true` — this can be used to display a helpful message if the magic link cannot auto-open the PWA
- HUMAN-VERIFICATION-REQUIRED: This phase cannot be fully verified by an AI agent. The implementing agent must produce a manual test script (30-MANUAL-TEST.md) with step-by-step instructions for testing on: (1) iOS Safari PWA, (2) Android Chrome PWA, (3) iOS Safari browser, (4) Android Chrome browser. A human must execute this script and sign off.

## Resources
- Supabase Auth documentation: https://supabase.com/docs/guides/auth/server-side/oauth-with-pkce-flow-for-ssr
- PWA deep linking best practices
- `src/ui/cloud-sync.js` — existing auth handler location
