# Phase 23 Research: GitHub Actions Node.js 24 Compatibility

## Findings Summary

### 1) Action Version Targets
| Action | Previous | Target | Node 24 status | Notes |
|---|---:|---:|---|---|
| `actions/checkout` | v4 | **v6** | ✅ `runs.using: node24` | Major upgrade available and recommended |
| `actions/setup-node` | v4 | **v6** | ✅ `runs.using: node24` | Major upgrade available and recommended |
| `actions/configure-pages` | v5 | **v5** (latest) | ⚠️ still `runs.using: node20` | No `v6` tag exists yet |
| `actions/upload-pages-artifact` | v3 | **v4** | ✅ composite action | Runtime is composite (no Node runtime pin) |
| `actions/deploy-pages` | v4 | **v4** (latest) | ⚠️ still `runs.using: node20` | No `v5` tag exists yet |

### 2) Breaking Changes / Config Impact
- `checkout` v6: no workflow input changes required for this repository.
- `setup-node` v6: existing `cache: npm` remains valid.
- `upload-pages-artifact` v4: existing `path: dist` remains valid.
- No additional permission changes required; existing `pages: write` and `id-token: write` are already present.

### 3) Required Workflow Adjustments
- Upgrade `actions/checkout` to `@v6`.
- Upgrade `actions/setup-node` to `@v6`.
- Upgrade `actions/upload-pages-artifact` to `@v4`.
- Keep `actions/configure-pages@v5` and `actions/deploy-pages@v4` until upstream releases Node 24 runtime majors.
- Align build runtime with target platform by setting `node-version: 24`.

### 4) Testing Strategy
- Local validation: run `npm test -- --run` to confirm no app regressions.
- Remote validation: trigger `workflow_dispatch` and verify `build` + `deploy` jobs complete.
- Deployment validation: confirm GitHub Pages URL updates and site loads successfully.

## Research Conclusion
Phase 23 can be partially completed today by upgrading all currently available actions to latest compatible majors and moving build runtime to Node 24. Full elimination of Node 20 action runtime warnings is currently blocked by upstream availability of new major versions for `actions/configure-pages` and `actions/deploy-pages`.
