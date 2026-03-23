# Phase 19: GitHub Pages CI/CD Deployment - Research

**Researched:** 2026-03-10
**Domain:** GitHub Actions CI/CD, Vite build configuration, GitHub Pages, PWA deployment
**Confidence:** HIGH

## Summary

Phase 19 deploys the Budget Console app to GitHub Pages via a GitHub Actions workflow. The workflow file (`.github/workflows/deploy.yml`) already exists in `origin/main` and is structurally correct — it uses the canonical `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages` pattern. The workflow deploys on push to `main`.

The critical blocker is that `vite.config.js` has no `base` option. GitHub Pages hosts project sites under a subdirectory (`https://nab221.github.io/budget-app/`). Without `base: '/budget-app/'`, Vite emits absolute paths (`/assets/...`, `/icons/...`, `start_url: '/'` in the PWA manifest) that resolve to `https://nab221.github.io/assets/...` — a 404. This is the primary code change the phase must make. The PWA manifest `start_url` and `scope` will also need updating to match the base path, which `vite-plugin-pwa` handles automatically when `base` is set.

A secondary concern: the repo's default branch (`origin/HEAD`) currently points to `master`, not `main`. GitHub Pages must be enabled in repository Settings (source = GitHub Actions) and the workflow must be able to push. All workflow permissions are already correctly declared in `deploy.yml`.

**Primary recommendation:** Add `base: '/budget-app/'` to `vite.config.js`, confirm GitHub Pages is enabled in repo Settings with source = "GitHub Actions", verify the workflow runs successfully on push to `main`, and confirm the live URL loads the PWA correctly.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | 6.2.0 (already installed) | Build tool that emits `dist/` | `npm run build` already works; `base` option controls all path prefixes |
| vite-plugin-pwa | 1.2.0 (already installed) | Generates service worker + manifest | Automatically applies `base` to manifest `start_url`, `scope`, and icon paths |
| actions/checkout | v4 | Checkout source in CI | GitHub canonical action |
| actions/setup-node | v4 | Node 20 runtime in CI | GitHub canonical action |
| actions/configure-pages | v5 | Configures GitHub Pages metadata | Injects `GITHUB_PAGES` env var, sets `base_url` for downstream steps |
| actions/upload-pages-artifact | v3 | Uploads `dist/` as Pages artifact | Required for the Pages deployment pipeline |
| actions/deploy-pages | v4 | Deploys the artifact to Pages CDN | Completes the Pages deployment |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| npm ci | — | Reproducible installs in CI | Faster and safer than `npm install` in CI — already used in `deploy.yml` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `actions/deploy-pages` | `peaceiris/actions-gh-pages` | Third-party action; `deploy-pages` is the official GitHub-supported approach and already in use |
| Manual `base` string | Environment variable / dynamic base | Overkill for a single deployment target; static string in `vite.config.js` is simpler |

**No installation needed** — all dependencies are already present.

## Architecture Patterns

### How `base` Flows Through Vite + vite-plugin-pwa

When `base: '/budget-app/'` is set in `vite.config.js`:

1. All `dist/` asset paths become `/budget-app/assets/...`
2. `dist/index.html` script/link tags use `/budget-app/assets/...`
3. `dist/manifest.webmanifest` gets `start_url: '/budget-app/'` and `scope: '/budget-app/'`
4. The service worker (`sw.js`) precache manifest uses `/budget-app/...` paths
5. `dist/icons/...` references in the manifest become `/budget-app/icons/...`

This is the standard Vite approach verified in official docs.

### Workflow Execution Flow
```
push to main
  → build job: checkout → setup-node → npm ci → npm run build → configure-pages → upload-artifact
  → deploy job (needs: build): deploy-pages → live URL
```

### Pattern 1: Vite `base` for GitHub Pages subpath

**What:** Set `base` in `vite.config.js` to the repo name path prefix
**When to use:** Any Vite app hosted on GitHub Pages as a project site (not a user/org `username.github.io` root site)

```javascript
// vite.config.js — add base option
export default defineConfig({
  base: '/budget-app/',
  plugins: [
    VitePWA({ ... })
  ],
});
```

**Note:** `vite-plugin-pwa` reads `base` automatically — no separate manifest config change needed.

### Anti-Patterns to Avoid

- **Hardcoding `base` conditionally by `process.env`:** The app has exactly one deployment target (GitHub Pages). A conditional expression adds complexity for no benefit.
- **Committing `dist/`:** The workflow builds `dist/` in CI from source. Committing `dist/` creates merge conflicts and bloat. The existing `.gitignore` should exclude it (verify).
- **Pointing GitHub Pages source to a branch instead of GitHub Actions:** The modern approach (already in `deploy.yml`) uses the "GitHub Actions" source in Pages settings, not a `gh-pages` branch. Mixing the two causes double-deploy confusion.
- **Merging `main` back to `master` to trigger deploy:** The workflow triggers on `main`; development must stay on `main`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PWA manifest path correction | Manual find/replace in manifest | Set `base` in `vite.config.js` | vite-plugin-pwa recalculates all paths automatically |
| Service worker cache invalidation | Custom cache-busting logic | Workbox (already configured) | `cleanupOutdatedCaches: true` already handles this |
| Artifact upload/deploy | Custom `gh-pages` branch push script | `actions/upload-pages-artifact` + `actions/deploy-pages` | Already in `deploy.yml`; these actions handle cache headers and CDN purge |

## Common Pitfalls

### Pitfall 1: Missing `base` — Blank/Broken Page on GitHub Pages
**What goes wrong:** App loads at `https://nab221.github.io/budget-app/` but shows a blank page; browser console shows 404s for `/assets/index-xxx.js`.
**Why it happens:** Vite's default `base: '/'` emits absolute paths rooted at the domain root. GitHub Pages project sites live under `/budget-app/`, so paths resolve to the wrong location.
**How to avoid:** Add `base: '/budget-app/'` to `vite.config.js` before the first deploy.
**Warning signs:** `dist/index.html` contains `src="/assets/..."` (absolute, not `src="/budget-app/assets/..."`).

### Pitfall 2: PWA `start_url` Mismatch
**What goes wrong:** App installs as PWA but immediately shows an error or blank screen when launched from home screen.
**Why it happens:** `start_url: '/'` in the manifest resolves to the domain root, not the app path.
**How to avoid:** Setting `base` in `vite.config.js` causes `vite-plugin-pwa` to automatically set `start_url` and `scope` to `/budget-app/`. Verify in `dist/manifest.webmanifest` after building.
**Warning signs:** `dist/manifest.webmanifest` shows `"start_url":"/"` after running `npm run build` with the new `base`.

### Pitfall 3: GitHub Pages Not Enabled / Wrong Source Setting
**What goes wrong:** Workflow runs successfully in Actions but the URL `https://nab221.github.io/budget-app/` returns 404.
**Why it happens:** GitHub Pages must be explicitly enabled in Repository Settings > Pages. The source must be set to "GitHub Actions" (not a branch).
**How to avoid:** After the first successful workflow run, check Settings > Pages and confirm "Your site is live at https://nab221.github.io/budget-app/".
**Warning signs:** Workflow shows green but visiting the URL returns GitHub's 404 page.

### Pitfall 4: Stale Service Worker Caching Old `/` Paths
**What goes wrong:** After deploying with the corrected `base`, users who visited the old broken deploy see a cached service worker that serves 404 assets.
**Why it happens:** The PWA service worker registered from the old broken deploy caches whatever it could.
**How to avoid:** `cleanupOutdatedCaches: true` is already set in `workbox` config — this handles it automatically on the next load. No manual intervention needed.
**Warning signs:** Users report app working on first install but broken after clearing browser cache.

### Pitfall 5: `origin/HEAD` Points to `master`, Not `main`
**What goes wrong:** Some tools and GitHub UI show `master` as the default branch, causing confusion about which branch triggers the deploy.
**Why it happens:** The repo was likely created with `master` as default and `main` was created later. `origin/HEAD -> origin/master` confirms this.
**How to avoid:** Optionally update the default branch in GitHub Settings > General > Default branch from `master` to `main`. The workflow already correctly targets `main` — this is a cosmetic/hygiene item, not a blocker.
**Warning signs:** PRs auto-target `master` instead of `main`.

## Code Examples

### Minimal `vite.config.js` Change Required

```javascript
// Source: https://vitejs.dev/guide/static-deploy.html#github-pages
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/budget-app/',   // ADD THIS LINE — repo name path
  plugins: [
    VitePWA({
      registerType: 'prompt',
      manifest: {
        // No changes needed here — vite-plugin-pwa reads base automatically
        name: 'Budget Console',
        start_url: '/',  // Will be overridden to '/budget-app/' by base
        // ... rest unchanged
      },
      // ... rest unchanged
    }),
  ],
});
```

### Verifying the Build Output

```bash
npm run build
# Check asset paths are prefixed
grep 'src=' dist/index.html
# Should show: src="/budget-app/assets/index-xxx.js"

# Check manifest
cat dist/manifest.webmanifest | grep start_url
# Should show: "start_url":"/budget-app/"
```

### Existing Workflow (Already Correct — No Changes Needed)

```yaml
# .github/workflows/deploy.yml — already in origin/main
# This is correct and does NOT need modification
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gh-pages` npm package + branch | `actions/deploy-pages` + GitHub Actions source | ~2022 | Official support, no extra tokens needed |
| Manual `base_url` injection | `actions/configure-pages` sets `GITHUB_PAGES=true` | 2022 | Vite can detect Pages context automatically if using `configure-pages` |

**Note on `actions/configure-pages`:** This action sets environment variables including `GITHUB_PAGES=true`. Vite 4+ can read this to automatically set `base` — but this feature is not yet universally reliable and requires Vite config awareness. The safer, explicit approach is to hardcode `base: '/budget-app/'` in `vite.config.js`.

## Open Questions

1. **Is GitHub Pages already enabled in repo settings?**
   - What we know: The workflow file exists in `origin/main`, suggesting it was set up with intent.
   - What's unclear: Whether Pages was enabled in GitHub Settings (this cannot be checked locally).
   - Recommendation: Treat enabling Pages as a required manual step in the plan. The planner should include a verification task: push to `main`, check Actions tab, then check the live URL.

2. **Is `dist/` in `.gitignore`?**
   - What we know: `dist/` exists locally and CI rebuilds it fresh. It should not be committed.
   - What's unclear: Whether the current `.gitignore` excludes it.
   - Recommendation: Verify `.gitignore` includes `dist/` as a plan task. If absent, add it.

3. **Does the app use any absolute hardcoded paths in JS?**
   - What we know: `src/app.js` imports modules normally. The PWA service worker handles asset caching.
   - What's unclear: Whether any JS file contains hardcoded `/src/...` or fetch calls to `/api/...`.
   - Recommendation: A quick grep for `fetch('/'` or `url: '/'` patterns in `src/` as part of verification.

## Validation Architecture

> nyquist_validation key is absent from .planning/config.json — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.7 |
| Config file | `vitest.config.js` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

This phase is infrastructure/deployment, not application logic. Most validation is observational (did the CI pipeline succeed? does the URL load?). No unit tests apply to workflow YAML or GitHub settings.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEPLOY-01 | `npm run build` succeeds with `base` set | smoke | `npm run build` | N/A — build script |
| DEPLOY-02 | `dist/index.html` contains `/budget-app/` prefixed asset paths | smoke | `grep '/budget-app/assets' dist/index.html` | N/A — grep on output |
| DEPLOY-03 | `dist/manifest.webmanifest` has `start_url: '/budget-app/'` | smoke | `cat dist/manifest.webmanifest` | N/A — grep on output |
| DEPLOY-04 | GitHub Actions workflow runs green | manual | GitHub Actions UI | Exists in origin/main |
| DEPLOY-05 | Live URL `https://nab221.github.io/budget-app/` loads app | manual | Browser visit | N/A |

### Sampling Rate
- **Per task commit:** `npm run build && grep '/budget-app/assets' dist/index.html`
- **Per wave merge:** Full build smoke + manual URL check
- **Phase gate:** Live URL loads and PWA installs before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers unit tests. This phase's verification is build output inspection + manual URL confirmation, not unit tests.

## Sources

### Primary (HIGH confidence)
- Vite official docs — https://vitejs.dev/guide/static-deploy.html#github-pages — `base` option for GitHub Pages subpath deployment
- vite-plugin-pwa docs — https://vite-pwa-org.netlify.app/ — `base` propagation to manifest and service worker
- GitHub Actions official — https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site — Pages source = GitHub Actions
- Local repo inspection — `.github/workflows/deploy.yml`, `vite.config.js`, `dist/index.html`, `dist/manifest.webmanifest`

### Secondary (MEDIUM confidence)
- GitHub canonical actions (checkout@v4, setup-node@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4) — versions confirmed from workflow file already in repo

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools already in repo, workflow already exists
- Architecture: HIGH — `base` option is the documented Vite solution, verified against build output
- Pitfalls: HIGH — confirmed by inspecting `dist/index.html` (absolute paths present, confirming the gap)

**Research date:** 2026-03-10
**Valid until:** 2026-09-10 (stable tooling — Vite, GitHub Actions)
