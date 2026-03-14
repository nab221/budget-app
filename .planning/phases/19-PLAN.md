# Phase 19 Plan: GitHub Pages CI/CD Deployment

## Overview
Phase 19 establishes the production environment for the Budget Console app. It configures the build system for GitHub Pages subpath hosting, refines the PWA manifest for public release, and sets up the GitHub Actions deployment pipeline.

**CRITICAL: Phase 20 (Repository Purge) is a hard prerequisite for live deployment to avoid leaking sensitive planning files and history.**

## Requirements
- **DEPLOY-01**: Configure Vite `base` path to support GitHub Pages subpath hosting (`/budget-app/`).
- **DEPLOY-02**: Standardize PWA manifest metadata for consistent branding.
- **DEPLOY-03**: Update/Verify GitHub Actions workflow for automatic and manual triggers.
- **DEPLOY-04**: Ensure build output correctly prefixes all asset paths and manifest URLs.

## Research Summary
- **Domain**: GitHub Actions CI/CD, Vite build configuration, PWA deployment.
- **Findings**: `vite.config.js` needs `base: '/budget-app/'` to fix 404s on GitHub Pages. `vite-plugin-pwa` handles manifest updates automatically once `base` is set.
- **Strategy**: Update `vite.config.js`, verify local build output, and prepare for CI/CD push.

## Strategy
1. **Local Configuration**: Add `base` to `vite.config.js`.
2. **Local Verification**: Run `npm run build` and inspect `dist/` to confirm path prefixing.
3. **CI/CD Readiness**: Verify `.github/workflows/deploy.yml` structure and triggers.
4. **Execution Gate**: Confirm Phase 20 is complete before pushing to `main` for live deployment.

## Tasks

### Wave 1: Local Configuration & Verification
- [x] **Task 19.1.1: Add base path to vite.config.js**
  - **Action**: Add `base: '/budget-app/',` to `defineConfig` in `vite.config.js`.
  - **Verify**: `npm run build && Select-String '/budget-app/assets' dist/index.html && Select-String '"start_url":"/budget-app/"' dist/manifest.webmanifest`
- [x] **Task 19.1.2: Verify .gitignore for build artifacts**
  - **Action**: Ensure `dist/` is ignored to prevent committing build output.
  - **Verify**: `Select-String '^dist/?$|^dist$' .gitignore`

### Wave 2: CI/CD & Deployment (Depends on Phase 20)
- [x] **Task 19.2.1: Verify GitHub Actions Workflow**
  - **Action**: Inspect `.github/workflows/deploy.yml` for correct triggers and permissions.
  - **Verify**: Manual inspection of YAML confirms `push` on `main`, `workflow_dispatch`, and required permissions.
- [ ] **Task 19.2.2: Live Deployment & Smoke Test**
  - **Action**: Push to `main` (Post-Phase 20), enable GitHub Pages in settings, and visit the live URL.
  - **Verify**: App loads at `https://nab221.github.io/budget-app/` and PWA is installable.

## Verification Plan
### Automated Tests
- `npm run build` success.
- Grep checks on `dist/index.html` and `dist/manifest.webmanifest` for path prefixes.

### Manual Verification
- GitHub Actions run status (Green).
- Live URL functional check.
- PWA installation and offline capability.
