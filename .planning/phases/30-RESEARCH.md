# Phase 30: Magic Link PWA / Auth Fix - Research

**Researched:** 2026-03-14
**Domain:** Supabase JS v2 PKCE auth flow + vite-plugin-pwa / Workbox service worker configuration
**Confidence:** MEDIUM — PKCE is already configured in the codebase; remaining uncertainty is around iOS PWA context isolation (a known unsolved problem in the web platform) and the exact vite.config.js PWA options in this repo

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Fix Supabase magic link authentication in PWA standalone mode on iOS Safari and Android Chrome
- Use Option 3 (PKCE flow) — already implemented; do not switch to a different auth strategy
- Service worker must not block or corrupt the auth redirect URL
- Manual verification on a physical iOS device and Android device is required — produce `30-MANUAL-TEST.md`
- HUMAN-VERIFICATION-REQUIRED: this phase cannot be fully verified by an AI agent

### Claude's Discretion
- Exact placement of iOS PWA guidance message in `cloud-sync.js` UI
- Whether to use an inline banner or a modal for the iOS guidance
- Whether to use `window.location.origin` directly or read `VITE_SUPABASE_REDIRECT_URL` env var as the base redirect URL
- Whether `navigateFallbackDenylist` regex patterns use query-string matching or URL-path matching

### Deferred Ideas (OUT OF SCOPE)
- Switching to OTP (6-digit code) flow instead of magic links
- Custom URL scheme (`protocol_handlers`) in PWA manifest
- Native app wrappers (Capacitor, Cordova)
- Any changes to non-auth Supabase sync logic
</user_constraints>

<research_summary>
## Summary

Phase 30 is a PWA auth hardening phase, not a greenfield auth build. The core PKCE flow is **already implemented**: `supabase-sync.js` already sets `flowType: 'pkce'`, `detectSessionInUrl: true`, `persistSession: true`, and `autoRefreshToken: true`. Supabase JS v2 (`^2.99.0`) with these settings will automatically detect the `?code=` parameter on page load and exchange it for a session. This means the fundamental auth mechanism is correct.

What remains are three distinct hardening tasks: (1) ensuring the deployed `emailRedirectTo` URL exactly matches the PWA's origin; (2) preventing the Workbox service worker from intercepting and caching auth callback URLs; and (3) providing a UX fallback message for iOS PWA standalone mode, where the magic link opens in Safari (outside the PWA context) rather than in the installed app — a known iOS web platform limitation with no silent fix.

**Primary recommendation:** The three tasks are small and targeted. Complete them in a single plan (30-1-PLAN): verify/fix the redirect URL, add `navigateFallbackDenylist` in vite.config.js, add URL cleanup after auth, and add the iOS guidance message. Produce `30-MANUAL-TEST.md` for human sign-off.
</research_summary>

<standard_stack>
## Standard Stack

No new libraries are required. All technology is already installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.99.0` | Auth client — PKCE flow, session exchange, auto-refresh | Already installed; v2 natively handles `?code=` PKCE exchange on `detectSessionInUrl: true` |
| `vite-plugin-pwa` | `1.2.0` | Auto-generates Workbox service worker | Already installed; exposes `workbox.navigateFallbackDenylist` to exclude URL patterns from SW intercept |

### Supporting
| Technology | Purpose | Notes |
|------------|---------|-------|
| `window.history.replaceState` | Clean `?code=` from URL after auth completes | Native browser API; no library needed |
| `window.navigator.standalone` | Detect iOS PWA standalone mode | iOS-only property; `true` when app is opened from home screen |
| `import.meta.env.VITE_SUPABASE_REDIRECT_URL` | Configurable redirect base URL | Reads from `.env`; allows per-environment override |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PKCE (current) | Implicit flow (`#access_token` hash) | Implicit flow is deprecated by Supabase for new projects; PKCE is more robust across PWA contexts because query params survive SW navigation unlike hash fragments |
| `navigateFallbackDenylist` regex | `runtimeCaching` NetworkOnly rule for auth URL | Both work; `navigateFallbackDenylist` is more correct for navigation requests (HTML responses), while `runtimeCaching` handles fetch requests — auth redirect is a navigation, so denylist is the right tool |
| iOS UX guidance message | OTP email code (6-digit) | OTP is a better UX fix for iOS but requires a UI form change and Supabase template change — out of scope for this phase |

**Installation:** No new packages. No `package.json` changes.
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Relevant File Structure
```
src/
├── utils/
│   └── supabase-sync.js     # Supabase client (PKCE already configured); emailRedirectTo source
├── ui/
│   └── cloud-sync.js        # Sign-in UI; auth state change handler; init sequence
vite.config.js               # vite-plugin-pwa workbox options — add navigateFallbackDenylist here
.env.example                 # Document VITE_SUPABASE_REDIRECT_URL
.planning/phases/30-*/
└── 30-MANUAL-TEST.md        # Human-verification test script (produced by this phase)
```

### Pattern 1: PKCE Code Exchange (Supabase JS v2 — already in place)
**What:** On app load, `detectSessionInUrl: true` makes the Supabase client scan `window.location.search` for `?code=`. If found, it automatically calls `exchangeCodeForSession(code)` internally and fires `onAuthStateChange('SIGNED_IN', session)`.
**When to use:** Already active. No additional code needed for the exchange itself.
**Example:**
```js
// Source: supabase-sync.js (existing — already configured)
const supabase = createClient(url, key, {
  auth: {
    flowType: 'pkce',          // PKCE mode
    detectSessionInUrl: true,  // Auto-detects ?code= on load
    persistSession: true,
    autoRefreshToken: true,
  }
});
// After the code exchange fires, onAuthStateChange emits 'SIGNED_IN'
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // session is available — clean URL, trigger sync
    if (window.location.search.includes('code=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
});
```

### Pattern 2: navigateFallbackDenylist (vite-plugin-pwa / Workbox)
**What:** Prevents the Workbox SW from intercepting navigation requests whose URLs match one of the denylist regexes. Without this, the SW serves a cached `index.html` shell when the browser navigates to `/?code=xxx`, which may load before Supabase has a chance to read the `?code=` parameter — or worse, serve a stale shell that discards the query string.
**When to use:** Any URL pattern that must reach the network (auth callbacks, API routes).
**Example:**
```js
// Source: vite.config.js — add inside VitePWA({ workbox: { ... } })
// Verified pattern: https://github.com/vite-pwa/vite-plugin-pwa/issues/269
workbox: {
  navigateFallbackDenylist: [
    /[?&]code=/,        // PKCE auth code (?code= anywhere in query string)
    /#access_token=/,   // Legacy implicit flow hash (defensive)
  ],
  // ... other workbox options
}
```

### Pattern 3: iOS PWA Guidance Message
**What:** When `window.navigator.standalone === true` (iOS PWA standalone mode), the magic link opens in Safari, not in the PWA. The session is established in Safari and the PWA never receives it. The guidance message tells the user to sign in via Safari first, then return to the PWA — at which point they will already be signed in (shared Supabase localStorage is NOT shared between Safari and PWA contexts, so this guidance is a workaround, not a fix).
**When to use:** In the sign-in form render path of `cloud-sync.js`, after the email input is shown.
**Example:**
```js
// Source: iOS PWA standalone detection pattern (MDN + Supabase community)
// In cloud-sync.js, when rendering the sign-in form:
const isIOSStandalone = window.navigator.standalone === true;
if (isIOSStandalone) {
  // Render a helper banner above the sign-in form
  container.insertAdjacentHTML('afterbegin', `
    <div class="auth-ios-notice" role="alert">
      <strong>iOS tip:</strong> If the magic link doesn't open this app,
      open this app in Safari first, sign in there, then return here.
    </div>
  `);
}
```

### Anti-Patterns to Avoid
- **Not cleaning the URL after auth:** The `?code=xxx` parameter persists in the address bar and in browser history. If the user refreshes, the stale code will be re-sent to Supabase, which will reject it (codes are one-time-use with a 5-minute expiry). Always call `window.history.replaceState({}, '', window.location.pathname)` after the code is consumed.
- **Using `navigateFallback` without `navigateFallbackDenylist`:** The default `navigateFallback: 'index.html'` causes the SW to serve the cached shell for ALL navigations, including auth callbacks. The denylist exempts auth URLs from this behaviour.
- **Hardcoding `emailRedirectTo` as `window.location.href`:** `window.location.href` includes the current path and any existing query params, which will corrupt the redirect. Always use `window.location.origin` (base URL only) or `import.meta.env.VITE_SUPABASE_REDIRECT_URL`.
- **Trusting `navigator.standalone` on Android:** Android Chrome PWA standalone mode is detected differently (`window.matchMedia('(display-mode: standalone)').matches`). The iOS `navigator.standalone` check should be combined with this for full coverage, but only for informational UI — not for auth flow changes.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PKCE code exchange | Custom `fetch` to `/auth/v1/token?grant_type=pkce` | Supabase JS v2 `detectSessionInUrl: true` | Already does it automatically; manual implementation risks PKCE verifier mismatch (verifier is stored in sessionStorage by the SDK) |
| Session persistence | Custom localStorage read/write for tokens | `persistSession: true` (already set) | SDK handles token serialisation, expiry, and race conditions |
| Token refresh | `setInterval` calling `supabase.auth.refreshSession()` | `autoRefreshToken: true` (already set) | SDK manages refresh timing with jitter to avoid thundering-herd |
| Auth URL exclusion from SW | Manual fetch event listener in custom SW | `navigateFallbackDenylist` in vite-plugin-pwa config | The auto-generated SW from vite-plugin-pwa does not expose a merge point for custom fetch listeners without switching to `injectManifest` strategy |

**Key insight:** The PKCE exchange, session persistence, and token refresh are already handled by the Supabase SDK. The only hand-written code needed is: URL cleanup, denylist config, and the iOS UX guidance text.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Stale `?code=` Parameter on Page Refresh
**What goes wrong:** User completes auth via magic link. The `?code=xxx` is still visible in the URL. If the user refreshes (or the SW intercepts and serves the cached shell with the original URL), Supabase receives the already-used code and returns an error. The user sees a blank auth state or an error.
**Why it happens:** The code is one-time-use with a 5-minute TTL. Refreshing resubmits it.
**How to avoid:** In the `onAuthStateChange('SIGNED_IN')` callback (or immediately after detecting `?code=` in the URL), call `window.history.replaceState({}, '', window.location.pathname)` to strip the query string without adding a history entry.
**Warning signs:** Auth succeeds on first load after clicking magic link, but a refresh of the same URL shows "auth code has already been used" or signs the user out.

### Pitfall 2: Service Worker Caches the Auth Callback URL
**What goes wrong:** The Workbox SW intercepts the navigation to `/?code=xxx`, finds `index.html` in the precache, and serves the cached shell. The page loads but the query string is either stripped by the SW or the page renders so fast from cache that Supabase's `detectSessionInUrl` reads the URL before the code is set, finding nothing.
**Why it happens:** `navigateFallback: 'index.html'` is Workbox's default SPA fallback. It applies to all navigations not in the precache manifest — including auth callback URLs.
**How to avoid:** Add `navigateFallbackDenylist: [/[?&]code=/, /#access_token=/]` to the workbox config in `vite.config.js`. This exempts URLs with auth parameters from the SW fallback, letting the browser fetch them directly.
**Warning signs:** Auth flow works in development (no SW), fails in production (SW active). Clicking the magic link shows the app loading but never signs in.

### Pitfall 3: iOS PWA Context Isolation (Known Platform Limitation)
**What goes wrong:** User has the app installed as a PWA on iOS. They click the magic link in Mail. iOS opens the link in Safari (system browser), not the PWA. Auth completes in Safari. The PWA's localStorage is isolated from Safari's — the session never reaches the PWA.
**Why it happens:** iOS does not support deep-linking into installed PWAs from emails. The PWA's custom URL scheme (`protocol_handlers`) is not supported on iOS Safari as of iOS 17. This is a known web platform limitation.
**How to avoid:** There is no silent fix for this. The correct mitigation is a UX guidance message in the PWA sign-in form: inform the user that on iOS, they should open the app in Safari first, sign in there, then navigate back to the home screen app. The user can also access the app directly in Safari (non-standalone) where auth works correctly.
**Warning signs:** Auth works on Android PWA and desktop but consistently fails on iOS PWA — user is never signed in after clicking the magic link.

### Pitfall 4: `emailRedirectTo` Does Not Match Deployed URL
**What goes wrong:** The magic link's `redirect_to` parameter points to `localhost:5173` (dev) or a staging URL, not the production PWA URL. Supabase validates the redirect URL against its allowlist. If the URL does not match, the redirect is rejected and the user lands on a Supabase error page.
**Why it happens:** `emailRedirectTo` in `supabase.auth.signInWithOtp()` is constructed from `window.location.origin` or a hardcoded value that was not updated for production.
**How to avoid:** Use `import.meta.env.VITE_SUPABASE_REDIRECT_URL ?? window.location.origin` for `emailRedirectTo`. Document `VITE_SUPABASE_REDIRECT_URL` in `.env.example`. Ensure the production URL is added to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
**Warning signs:** Magic link email arrives, clicking it redirects to a Supabase error page ("Invalid redirect URL") instead of the app.

### Pitfall 5: `navigateFallbackDenylist` Regex Not Matching Query String
**What goes wrong:** The denylist regex targets a URL path (e.g. `/auth/callback`) but the app's redirect URL is the root `/?code=xxx`. Path-based regexes like `/^\/auth\/callback/` do not match `/?code=xxx`.
**Why it happens:** Workbox's `navigateFallbackDenylist` matches against the full request URL path + query string. If the regex anchors to a path that does not exist, it never fires.
**How to avoid:** Use query-string-aware regexes: `/[?&]code=/` matches any URL containing `?code=` or `&code=`. Test the regex against a sample redirect URL like `https://app.example.com/?code=abc123` before deploying.
**Warning signs:** `navigateFallbackDenylist` is set but auth still fails in production when SW is active.
</common_pitfalls>

<code_examples>
## Code Examples

### URL Cleanup After PKCE Auth (in `cloud-sync.js` or `supabase-sync.js`)
```js
// Source: Supabase JS v2 onAuthStateChange pattern
// https://supabase.com/docs/guides/auth/sessions/pkce-flow
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    // Clean up the ?code= from the URL to prevent reuse on refresh
    if (window.location.search.includes('code=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
});
```

### navigateFallbackDenylist in vite.config.js
```js
// Source: vite-plugin-pwa workbox config docs
// https://github.com/vite-pwa/vite-plugin-pwa/issues/269
// https://github.com/vite-pwa/vite-plugin-pwa/discussions/545
VitePWA({
  // ... other VitePWA options
  workbox: {
    // ... other workbox options
    navigateFallbackDenylist: [
      /[?&]code=/,       // PKCE auth code parameter (handles /?code=xxx)
      /#access_token=/,  // Legacy implicit flow hash (defensive)
    ],
  },
})
```

### iOS Standalone Detection + Guidance Message (in `cloud-sync.js`)
```js
// Source: MDN Web Docs — navigator.standalone (iOS only)
// https://developer.mozilla.org/en-US/docs/Web/API/Navigator/standalone
// Combined with Android standalone check for completeness
const isIOSStandalone = window.navigator.standalone === true;
const isAndroidStandalone = window.matchMedia('(display-mode: standalone)').matches;

if (isIOSStandalone) {
  // Show guidance — iOS cannot deep-link into PWA from email
  signinForm.insertAdjacentHTML('beforebegin', `
    <p class="auth-ios-notice">
      <strong>Tip:</strong> On iOS, magic links open in Safari, not this app.
      Open this app in <strong>Safari</strong> first, sign in there,
      then return to the home screen app.
    </p>
  `);
}
```

### emailRedirectTo Using Env Var with Origin Fallback
```js
// Source: Pattern from supabase-sync.js line ~153 area
// VITE_SUPABASE_REDIRECT_URL allows per-environment override
const redirectTo = import.meta.env.VITE_SUPABASE_REDIRECT_URL
  ?? window.location.origin;

const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: redirectTo }
});
```

### .env.example Entry
```bash
# Auth redirect URL — must match the deployed PWA URL exactly.
# Also add this URL to Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
# Defaults to window.location.origin if not set.
VITE_SUPABASE_REDIRECT_URL=https://your-deployed-pwa-url.example.com
```
</code_examples>

<sota_updates>
## State of the Art (2025–2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Implicit flow (`#access_token` hash) | PKCE flow (`?code=` query param) | Supabase JS v2 (2023) | PKCE is now Supabase's recommended default; the `#` hash is not sent to servers and not visible in SW navigation requests — `?code=` query params are |
| Manual token exchange | `detectSessionInUrl: true` auto-exchange | Supabase JS v2.0 | SDK handles the full PKCE verifier/code exchange cycle automatically |
| Custom service worker (hand-written `sw.js`) | `vite-plugin-pwa` auto-generated Workbox SW | 2022+ | Plugin generates a production-ready SW; customisation goes via `workbox:` config, not hand-written fetch listeners |
| Separate `/auth/callback` route | Root URL with `?code=` query | SPA pattern | SPAs using Supabase PKCE redirect to the app's root (or any page) with `?code=` appended; no dedicated server route needed |

**New patterns to consider:**
- **`supabase.auth.getUser()` over `getSession()`:** As of Supabase JS v2.60+, `getUser()` is preferred over `getSession()` for security (validates the JWT with the server rather than trusting localStorage). Use `getUser()` when checking auth state on app load.
- **`PKCE code_verifier` in sessionStorage:** The SDK stores the PKCE verifier in `sessionStorage`. If the auth flow starts in one tab/window and the redirect lands in a different tab, the exchange will fail ("code verifier not found"). This is by design — PKCE is origin-and-session-scoped. On iOS PWA this is the root cause of context isolation failures.

**Deprecated/outdated:**
- **Implicit flow:** Supabase still supports it but no longer recommends it for new implementations. The codebase is already on PKCE.
- **Manual `supabase.auth.setSession()` with hash tokens:** Only relevant for implicit flow; not needed with PKCE.
</sota_updates>

<open_questions>
## Open Questions

1. **What is the exact `redirectTo` value currently constructed in `supabase-sync.js` line ~153?**
   - What we know: Line 153 uses `emailRedirectTo: redirectTo`. The variable `redirectTo` is defined somewhere before that line — possibly as `window.location.origin`, a hardcoded string, or reading `import.meta.env.VITE_SUPABASE_REDIRECT_URL`.
   - What's unclear: Whether it already uses `window.location.origin` (correct) or a hardcoded dev URL (broken in production).
   - Recommendation: The implementing agent **must** read `src/utils/supabase-sync.js` from the top to find where `redirectTo` is defined before making any changes.

2. **What is the current `workbox:` configuration in `vite.config.js`?**
   - What we know: `vite-plugin-pwa` v1.2.0 is installed and generates a Workbox SW automatically. The PWA config exists in `vite.config.js`.
   - What's unclear: Whether `navigateFallbackDenylist` is already set; whether `navigateFallback` is configured with a custom value; whether the workbox config uses `generateSW` or `injectManifest` strategy.
   - Recommendation: The implementing agent must read `vite.config.js` in full before modifying the workbox options. If `injectManifest` strategy is used, the approach changes — `navigateFallbackDenylist` is a `generateSW`-only option. In that case, add a fetch event listener in the injected SW template instead.

3. **Does the `onAuthStateChange` callback already exist in `cloud-sync.js`, and where is the init sequence?**
   - What we know: `cloud-sync.js` contains the auth handler (from CONTEXT.md). The URL cleanup and iOS guidance must integrate cleanly into the existing init flow.
   - What's unclear: Whether `onAuthStateChange` is called in `init()`, a constructor, or lazily. The URL cleanup must happen inside the auth state change handler, not in an arbitrary init path.
   - Recommendation: Read `src/ui/cloud-sync.js` in full before making changes. Find the existing `onAuthStateChange` usage (grep for `onAuthStateChange`) and add the `history.replaceState` call inside the `SIGNED_IN` case.

4. **iOS PWA deep-link future support**
   - What we know: As of iOS 17, `protocol_handlers` in the PWA manifest are not supported on iOS Safari. iOS does not route links to installed PWAs from email clients.
   - What's unclear: Whether iOS 18 / upcoming iOS releases will add support.
   - Recommendation: The UX guidance message is the correct mitigation for now. No code change can fix this at the platform level. Document in `30-MANUAL-TEST.md` that iOS PWA deep-linking is a platform limitation, not an app bug.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `src/utils/supabase-sync.js` (task brief analysis) — confirmed `flowType: 'pkce'`, `detectSessionInUrl: true`, `persistSession: true`, `autoRefreshToken: true`, `@supabase/supabase-js ^2.99.0`
- [Supabase PKCE flow documentation](https://supabase.com/docs/guides/auth/sessions/pkce-flow) — code exchange lifecycle, `code_verifier` sessionStorage, 5-minute code TTL, one-time-use codes
- [vite-plugin-pwa GitHub issue #269](https://github.com/antfu/vite-plugin-pwa/issues/269) — confirmed `workbox.navigateFallbackDenylist` is the correct option; regex array format verified
- [vite-plugin-pwa discussions #545](https://github.com/vite-pwa/vite-plugin-pwa/discussions/545) — confirmed `navigateFallbackDenylist` syntax and path-vs-query-string matching nuance

### Secondary (MEDIUM confidence)
- [Supabase GitHub discussion #12227](https://github.com/orgs/supabase/discussions/12227) — iOS PWA context isolation confirmed; OTP recommended as workaround (out of scope); guidance message pattern validated by community
- Task brief codebase findings — confirmed `vite-plugin-pwa v1.2.0`, no manual `sw.js`, Supabase JS `^2.99.0`

### Tertiary (LOW confidence - needs validation during execution)
- `redirectTo` variable definition in `supabase-sync.js` — exact source not read; must be confirmed by implementing agent
- `vite.config.js` workbox strategy (`generateSW` vs `injectManifest`) — not read directly; `navigateFallbackDenylist` approach assumes `generateSW`
- `cloud-sync.js` existing `onAuthStateChange` structure — not read directly; URL cleanup placement must be confirmed by reading the file
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Supabase JS v2 PKCE auth flow
- Ecosystem: vite-plugin-pwa, Workbox `navigateFallbackDenylist`
- Patterns: URL cleanup after auth, iOS standalone detection, auth URL SW exclusion
- Pitfalls: stale code reuse, SW caching auth callbacks, iOS context isolation, redirect URL mismatch

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all technology is already installed and confirmed
- Architecture: HIGH — patterns derived from official Supabase docs and vite-plugin-pwa issue tracker
- Pitfalls: HIGH — all pitfalls are documented failure modes with confirmed root causes
- Code examples: MEDIUM — Supabase and workbox examples verified against docs; exact integration points in `supabase-sync.js` and `cloud-sync.js` need confirming by reading the files

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days — Supabase JS v2 and vite-plugin-pwa APIs are stable)
</metadata>

---

*Phase: 30-magic-link-pwa-auth-fix*
*Research completed: 2026-03-14*
*Ready for planning: yes*
