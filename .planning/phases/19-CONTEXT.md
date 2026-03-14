# Phase 19 Context: GitHub Pages CI/CD Deployment

## Overview
Phase 19 establishes the production environment for the Budget Console app. It configures the build system for GitHub Pages subpath hosting, refines the PWA manifest for public release, and sets up the GitHub Actions deployment pipeline.

**CRITICAL: Phase 20 (Repository Purge) is a hard prerequisite. This phase must not execute a live deployment until all sensitive planning files and history have been purged from the repository.**

## Requirements
- **DEPLOY-01**: Configure Vite `base` path to support GitHub Pages subpath hosting (`/budget-app/`) with an environment variable fallback for future custom domains.
- **DEPLOY-02**: Standardize PWA manifest metadata (Name, Short Name, Colors) for a consistent "Budget Console" brand across all platforms.
- **DEPLOY-03**: Update GitHub Actions workflow to support both automatic (`push: main`) and manual (`workflow_dispatch`) deployment triggers.
- **DEPLOY-04**: Ensure the build output (`dist/`) correctly prefixes all asset paths and manifest URLs to prevent 404s on the live site.

## Decisions

### Build Configuration
- **Base Path**: Use `process.env.VITE_BASE_URL ?? '/budget-app/'` in `vite.config.js`. This allows the app to be hosted at the default GitHub Pages URL while remaining "plug-and-play" for a future custom domain (where `VITE_BASE_URL` would be set to `/`).
- **Environment Variables**: Use standard Vite environment variable patterns for the base URL to avoid hardcoded path logic in the build scripts.

### PWA Branding (Locked)
These values are baked into the Service Worker and manifest. They must remain consistent to avoid breaking existing installations:
- **Name**: `Budget Console` (Matches internal app ID and database name).
- **Short Name**: `Budget` (Fits home screen constraints).
- **Theme Color**: `#0b1120` (Matches slate/blue UI theme).
- **Background Color**: `#0b1120` (Seamless splash screen).
- **Display**: `standalone` (Browser UI hidden).

### CI/CD Strategy
- **Deployment Source**: GitHub Actions (not a `gh-pages` branch).
- **Triggers**:
  - `push` to `main`: Automatic production updates.
  - `workflow_dispatch`: Manual trigger for on-demand deploys/testing without commits.
- **Permissions**: Workflow requires `pages: write` and `id-token: write` for the modern OIDC deployment path.

### Safety & Sequence
- **Phase 20 Dependency**: The deployment workflow must not be enabled/pushed to a public state until the `.planning/` directory and all historical references to personal/sensitive context are purged via `git filter-repo` or a similar tool.
- **Git Hygiene**: Ensure `dist/` is strictly ignored in `.gitignore` to prevent build artifacts from bloating the public history.

## Deferred Ideas
- **Custom Domain**: Configuration is "future-proofed" via the `VITE_BASE_URL` variable, but no DNS work or domain purchase is part of this phase.
- **Staging Environment**: Defer until the user requires a pre-production preview URL.
