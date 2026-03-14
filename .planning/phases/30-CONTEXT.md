
# Phase 30 Context: Magic Link PWA / Auth Fix

## Objective
Fix Supabase magic link email authentication when the app is installed as a PWA on iOS Safari and Android Chrome. Currently, clicking the magic link on mobile does not successfully authenticate the user into the app.

## Background

### How Magic Links Work
1. User enters email in the sign-in form
2. Supabase sends an email containing a magic link: `https://[project].supabase.co/auth/v1/verify?token=...&redirect_to=[app-url]`
3. In the current PKCE-based flow, clicking the link opens a browser and Supabase redirects to `[app-url]?code=...`
4. Supabase JS v2 completes the sign-in on app load when the client initializes with `detectSessionInUrl: true`

### Why It Fails on PWA/Mobile

**Scenario A — PWA Installed (iOS Safari)**
On iOS, installed PWAs open in a separate browser context. When the user clicks the magic link in their email app, iOS opens it in Safari (not the PWA). The auth token is delivered to Safari, not the PWA's IndexedDB. The PWA never receives the auth event.

**Scenario B — Android Chrome PWA**
Similar issue: Chrome PWAs have their own browsing context. The redirect may open in a regular Chrome tab rather than the PWA. The token is in the Chrome tab's context.

**Scenario C — Service Worker Intercept**
If the service worker intercepts the redirect URL matching the app's scope, it may serve a cached shell that doesn't handle the `#access_token` hash correctly, or the hash is stripped.

### Possible Solutions

**Option 1 — Let Supabase JS v2 initialize the redirect flow on app load**
On every app load, allow the Supabase client to initialize normally and call `supabase.auth.getSession()` during startup. With `detectSessionInUrl: true`, Supabase JS v2 handles PKCE `?code=` redirects automatically. Do not manually extract tokens into `supabase.auth.setSession()` for the default magic-link flow.

**Option 2 — Custom URL Scheme (PWA Manifest)**
Configure the PWA manifest with a custom `protocol_handlers` entry or use `start_url` with a query parameter that Supabase redirects to. Android supports `protocol_handlers` in modern browsers.

**Option 3 — PKCE Redirect Hardening**
Keep the existing PKCE flow and harden the redirect path. Ensure `emailRedirectTo` matches the deployed app URL exactly, exclude auth callback URLs from service-worker navigation fallback, and clean stale auth params from the URL after a successful sign-in.

**Recommended approach:** Keep PKCE, verify the redirect URL, let Supabase JS v2 complete the redirect flow automatically on load, and ensure the service worker does not cache auth callback URLs. On iOS standalone PWA, show guidance because email deep links open Safari instead of the installed app.

## Files to Change
- `src/utils/supabase-sync.js` — verify `emailRedirectTo` points to the deployed app URL
- `src/ui/cloud-sync.js` — trigger session initialization on load, clean stale auth params, and show iOS standalone guidance
- `vite.config.js` — ensure Workbox does not serve cached navigation fallback for auth callback URLs containing `?code=`
- `.env.example` — document that `VITE_SUPABASE_REDIRECT_URL` must match the deployed PWA URL exactly

```bash
# .env.example
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_REDIRECT_URL=https://your-deployed-pwa-url.example.com
```

## Acceptance Criteria
- [ ] Magic link email received on Android opens the installed PWA and completes sign-in
- [ ] Magic link fallback: if PWA is not installed, the link opens in Safari/Chrome and completes sign-in in the browser tab
- [ ] On iOS standalone PWA, the sign-in UI shows guidance explaining that the link will open in Safari rather than the installed app
- [ ] Service worker does not block or corrupt the auth redirect path containing `?code=`
- [ ] After sign-in via magic link on mobile, the app auto-pulls from the cloud (existing v2.7 behaviour preserved)
- [ ] Manual verification on physical iOS device (Safari) and Android device documented in 30-VERIFICATION.md

## Technical Notes
- Supabase JS client v2.99.0 is already in use. Call `supabase.auth.getSession()` on app load and let the SDK complete PKCE redirects automatically when `detectSessionInUrl: true` is enabled.
- Service workers cannot inspect URL fragments. Service-worker rules must target the auth callback path or query string such as `?code=` rather than `#access_token`.
- On iOS, PWA standalone mode uses `window.navigator.standalone === true` — this can be used to display a helpful message if the magic link cannot auto-open the PWA
- HUMAN-VERIFICATION-REQUIRED: This phase cannot be fully verified by an AI agent. The implementing agent must produce a manual test script (30-MANUAL-TEST.md) with step-by-step instructions for testing on: (1) iOS Safari PWA, (2) Android Chrome PWA, (3) iOS Safari browser, (4) Android Chrome browser. A human must execute this script and sign off.

## Resources
- Supabase Auth documentation: https://supabase.com/docs/guides/auth/server-side/oauth-with-pkce-flow-for-ssr
- PWA deep linking best practices
- `src/ui/cloud-sync.js` — existing auth handler location
