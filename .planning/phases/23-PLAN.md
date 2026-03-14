# Phase 23 Plan: Update GitHub Actions to Support Node.js 24

## Objective
Update all deprecated Node.js 20 GitHub Actions to versions that support Node.js 24 before the June 2, 2026 deadline when Node.js 24 becomes the default on GitHub Actions runners.

## Context
- **Current Status**: GitHub Actions CI/CD pipeline runs with Node.js 20 actions
- **Issue**: GitHub has deprecated Node.js 20 actions; they will be forced to Node.js 24 on June 2, 2026
- **Impact**: Pipeline may fail or behave unexpectedly without updates
- **Deadline**: June 2, 2026 (~3 months away)

## Deprecated Actions to Update
Based on [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
1. `actions/checkout@v4` → latest Node.js 24–compatible version
2. `actions/setup-node@v4` → latest Node.js 24–compatible version
3. `actions/configure-pages@v5` → latest Node.js 24–compatible version
4. `actions/upload-pages-artifact@v3` → verify and update if needed
5. `actions/deploy-pages@v4` → latest Node.js 24–compatible version

## Success Criteria
- [ ] All GitHub Actions updated to versions supporting Node.js 24
- [ ] CI/CD pipeline runs successfully after updates
- [ ] GitHub Pages deployment works end-to-end
- [ ] No deprecation warnings in GitHub Actions UI
- [ ] All tests pass with updated actions

## Implementation Plan

### Phase 23.1: Research
- Verify the latest compatible versions of each GitHub Action
- Check official GitHub Actions marketplace documentation
- Identify any breaking changes between current and target versions

### Phase 23.2: Plan
- Document exact version numbers to use for each action
- Identify any workflow adjustments needed
- Plan test strategy

### Phase 23.3: Implementation
- Update [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
  - Replace `actions/checkout@v4` with latest version
  - Replace `actions/setup-node@v4` with latest version
  - Replace `actions/configure-pages@v5` with latest version
  - Verify/update `actions/upload-pages-artifact@v3` if needed
  - Replace `actions/deploy-pages@v4` with latest version
  - Keep all existing configuration (caches, paths, etc.)

### Phase 23.4: Testing & Verification
- Manually trigger workflow run via `workflow_dispatch`
- Verify both `build` and `deploy` jobs complete successfully
- Confirm GitHub Pages site deploys correctly
- Check GitHub Actions UI for absence of deprecation warnings

### Phase 23.5: Commit & Push
- Commit with message: `chore(ci): update GitHub Actions to support Node.js 24`
- Push to `main`
- Verify tests pass on remote

## Rollback Plan
If any issues arise:
1. Revert to previous workflow: `git revert <commit-hash>`
2. Manually re-run workflow to verify rollback works
3. Investigate and plan fix for phase re-attempt

## Notes
- This is a low-risk update (GitHub Actions are widely maintained and tested)
- No application code changes required
- Only workflow configuration changes needed
