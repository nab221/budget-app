
# Phase 39 Context: Performance & Bundle Optimisation

## Objective
Reduce initial load time and bundle size. Implement lazy loading for heavy tab modules. Add a performance budget. Measure and document baseline vs post-optimisation metrics.

## Background

### Current State
The app loads all JS modules eagerly on startup. As the app has grown (Phases 27–38 added significant new modules), the initial bundle size has increased and Time to Interactive (TTI) on mobile networks has degraded.

### Target Metrics (Post-Optimisation)
- Initial JS bundle: < 150 KB gzipped
- Time to Interactive (Lighthouse, mobile): < 3.5 seconds
- Largest Contentful Paint (LCP): < 2.5 seconds
- Total bundle size (all chunks, gzipped): < 400 KB

### Optimisation Strategy

**1. Code Splitting by Tab**
Each tab module (`dashboard.js`, `income.js`, `expenses.js`, `debts.js`, `assets.js`, `childcare.js`, `settings.js`) should be a dynamic import, loaded only when the user first navigates to that tab.

```js
// In src/app.js:
const tabModules = {
  dashboard: () => import('./ui/dashboard.js'),
  income:    () => import('./ui/income.js'),
  expenses:  () => import('./ui/expenses.js'),
  // ...
};
```

**2. Lazy Load Heavy Utilities**
- `calculateAmortisationSchedule` (Phase 32): only needed for loan/mortgage debt cards — lazy load `finance.js` when a loan/mortgage card is rendered
- `ofx-importer.js`, `qif-importer.js` (Phase 38): only needed when the import tool is opened
- `jsPDF` (Phase 37): only needed when PDF export is triggered

**3. Tree Shaking**
Ensure all utility exports are named (not default object exports) so Vite/Rollup can tree-shake unused functions.

**4. Asset Optimisation**
- Compress all PNG/SVG icons used in Phase 28 bottom nav bar
- Use `<img loading="lazy">` for non-critical images

**5. Service Worker Cache Strategy**
Review `public/sw.js` cache strategy:
- Core shell (HTML, critical CSS, app.js): cache-first
- Tab modules (dynamic chunks): stale-while-revalidate
- GOV.UK bank holidays API (Phase 31): network-first with 7-day cache fallback

**6. Performance Budget (Vite Plugin)**
Add `rollup-plugin-visualizer` for bundle analysis and `vite-plugin-bundlesize` (or an equivalent CI size-check script) to enforce chunk size limits. `output.manualChunks` remains valid for chunk shaping. Add a CI step that fails if any chunk exceeds 80 KB gzipped.

## Files to Change
- `src/app.js` — convert tab module loads to dynamic imports
- `vite.config.js` — configure `manualChunks`, add visualizer and bundle-size tooling
- `package.json` — add any new build-analysis dev dependencies
- `public/sw.js` — update cache strategy for dynamic chunks
- `src/utils/finance.js` — ensure named exports for tree shaking
- `src/utils/importers/index.js` — ensure named exports
- `.github/workflows/ci.yml` — add bundle size check step, or create `.github/workflows/performance.yml` if no CI workflow exists yet

## Acceptance Criteria
- [ ] Initial JS bundle < 150 KB gzipped (measured with Vite compressed-size output and a visualizer report)
- [ ] Each tab module loads as a separate chunk (verified in build output)
- [ ] Time to Interactive < 3.5s on Lighthouse mobile simulation (measured post-build)
- [ ] LCP < 2.5s on Lighthouse mobile simulation
- [ ] All 354+ existing Vitest tests pass (dynamic imports must not break test runner)
- [ ] CI bundle size check added and passes
- [ ] Baseline vs post-optimisation metrics documented in `39-METRICS.md`

## Technical Notes
- Dynamic imports in Vite: use `import()` syntax; Vite automatically code-splits on dynamic imports
- The Vitest test runner may need `vi.mock()` or `vi.importActual()` adjustments if tests currently use static imports that become dynamic
- Service worker cache strategy for dynamic chunks: use `stale-while-revalidate` to ensure updated chunks are fetched in background
- `manualChunks` configuration: group third-party libs (Supabase, date-fns, jsPDF) into a `vendor` chunk to improve long-term caching
- Use `rollup-plugin-visualizer` for analysis rather than the abandoned `vite-plugin-bundle-analyzer`
- Lighthouse CI: consider adding `@lhci/cli` to the CI pipeline for automated performance regression testing
