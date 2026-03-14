# Phase 23 Context: Update GitHub Actions to Support Node.js 24

## Background
GitHub announced the deprecation of Node.js 20 on GitHub Actions runners. Starting June 2, 2026, Node.js 24 will become the default runtime for action execution.

## Current State
The budget-app CI/CD pipeline ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) uses the following deprecated actions:
- `actions/checkout@v4` (build job)
- `actions/setup-node@v4` (build job)
- `actions/configure-pages@v5` (build job)
- `actions/upload-pages-artifact@v3` (build job)
- `actions/deploy-pages@v4` (deploy job)

These warnings appear in GitHub Actions:
```
Node.js 20 actions are deprecated. The following actions are running on Node.js 20 
and may not work as expected: actions/checkout@v4, actions/setup-node@v4, 
actions/configure-pages@v5, actions/upload-artifact@v4. Actions will be forced to 
run with Node.js 24 by default starting June 2nd, 2026.
```

## GitHub's Recommendation
1. Check if updated versions of actions are available that support Node.js 24
2. Update to the latest versions
3. Test the updated workflow
4. Optionally set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` to test early (not preferred — better to update actions)

## Scope
This phase addresses only the GitHub Actions versioning issue. It does not include:
- Upgrading Node.js runtime version in application code
- Changing CI/CD architecture
- Modifying build or deploy processes

## Timeline
- **Ideal Completion**: May 2026 (before June 2 deadline)
- **Action Required By**: June 2, 2026
- **Current Date**: March 11, 2026 (~3 months remaining)

## Stakeholders
- GitHub Actions (external service) — defines deprecation policy
- CI/CD Pipeline — relies on these actions
- Deployment (GitHub Pages) — depends on successful CI/CD runs

## Resources
- [GitHub Blog: Deprecation of Node 20 on GitHub Actions runners](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [budget-app CI/CD Workflow](.github/workflows/deploy.yml)
