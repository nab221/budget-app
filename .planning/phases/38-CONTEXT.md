# Phase 38 Context: GitHub Actions Node.js 24 & Technical Hygiene

## Objective
Upgrade the CI/CD pipeline actions to Node.js 24-compatible versions before the June 2, 2026 deadline. Clean up loose test/debug files from the repository root.

## Background

### Deprecation Deadline
GitHub Actions will force all actions to run on Node.js 24 starting June 2, 2026. Actions still using Node.js 20 will produce deprecation warnings and may break after the deadline.

### Current Actions in `.github/workflows/deploy.yml`
```yaml
- actions/checkout@v4
- actions/setup-node@v4
- actions/configure-pages@v5
- actions/upload-pages-artifact@v3
- actions/deploy-pages@v4
```
These warnings currently appear in CI runs:
> "Node.js 20 actions are deprecated. Actions will be forced to run with Node.js 24 by default starting June 2nd, 2026."

### Fix
Check the GitHub Actions Marketplace for the latest versions of each action that ship with Node.js 24 runtime. At the time of writing:
- `actions/checkout` → check for v5 or latest Node 24 compatible tag
- `actions/setup-node` → check for v5 or latest
- `actions/configure-pages` → check for latest
- `actions/upload-pages-artifact` → check for v4 or latest
- `actions/deploy-pages` → check for v5 or latest

**Agent must verify current latest versions from GitHub Marketplace before updating** — do not assume version numbers.

### Root Directory Cleanup
The following files exist in the repository root and should not be there:
- `test-output.txt` — test run output artifact, not source code
- `test-purify.cjs` — ad-hoc test script
- `test-security.js` — ad-hoc security test script
- `test-syntax.cjs` — ad-hoc syntax check script
- `print_lines.cjs` — utility/debug script

**Action:** Move any scripts that should be retained to `tests/` or `scripts/`. Delete pure artifacts (`test-output.txt`). Update any `package.json` scripts that reference moved files. Add root-level test artifacts to `.gitignore`.

## Files to Change
- `.github/workflows/deploy.yml` — update action versions
- Root level: delete `test-output.txt`, review and move/delete `test-purify.cjs`, `test-security.js`, `test-syntax.cjs`, `print_lines.cjs`
- `.gitignore` — add `test-output.txt` (and similar generated files)
- `package.json` — update any scripts referencing moved files

## Acceptance Criteria
- [ ] All GitHub Actions in `deploy.yml` are at Node.js 24-compatible versions
- [ ] CI pipeline runs without any Node.js deprecation warnings
- [ ] All 354+ Vitest tests pass in CI after the upgrade
- [ ] Root directory is clean: no loose test/debug scripts
- [ ] `.gitignore` covers future test output artifacts
- [ ] No `package.json` scripts are broken by the cleanup
- [ ] Deployed GitHub Pages site still functions correctly after pipeline update

## Technical Notes
- Before updating action versions, run the CI once with the current config to capture a baseline of the warning messages
- The `actions/setup-node@v4` action's `node-version` field in the YAML may need to specify `'24'` explicitly after the upgrade — verify
- Do not change the Node.js version used to build the app itself (the Vite build) unless required — the CI Node.js runtime version and the action runner version are separate concerns
- Timeline: this must be complete before June 2, 2026. Phase 38 is scheduled well within this window (assuming v3.0 progresses normally from March 2026).
