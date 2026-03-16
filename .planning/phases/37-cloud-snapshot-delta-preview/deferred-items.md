# Deferred Items — Phase 37

## Pre-existing Issue: dashboard.affordability.test.js ordering failure

**Discovered during:** Task 3 full-suite sanity gate
**Test:** "renders without throwing when no income events or snapshot exist" (dashboard.affordability.test.js)
**Status:** Pre-existing — passes in isolation, fails when full suite runs (test environment pollution from another test file)
**Not caused by:** Phase 37 changes (only cloud-sync.js and snapshot-diff.js were modified)
**Scope:** Out of Phase 37 scope — cross-test contamination likely from Dexie mock leaking into jsdom environment
**Action:** Candidate for Phase 39 polish
