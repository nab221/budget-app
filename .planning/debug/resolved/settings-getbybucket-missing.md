---
status: resolved
trigger: "error when change to settings, see log: Uncaught (in promise) TypeError: To.getByBucket is not a function at Object.renderTargetSettings"
created: 2026-03-07T00:00:00Z
updated: 2026-03-07T00:15:00Z
---

## Current Focus

hypothesis: CONFIRMED - targetRepository was missing getByBucket() method
test: added getByBucket method to targetRepository
expecting: settings page should now render without error
next_action: rebuild app and verify settings page loads

## Symptoms

expected: Settings view should render with target inputs when navigating to settings
actual: TypeError - "To.getByBucket is not a function" thrown when renderTargetSettings executes
errors: Uncaught (in promise) TypeError: To.getByBucket is not a function at Object.renderTargetSettings (index-BP1Zb5kC.js:715:1663)
reproduction: Navigate to settings panel in the app
started: Unknown - appears to be a missing implementation

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-07T00:00:00Z
  checked: src/ui/targets.js lines 27-28, 83
  found: Code calls targetRepository.getByBucket('recurrent') and targetRepository.getByBucket('one-off')
  implication: The UI code expects this method to exist

- timestamp: 2026-03-07T00:00:00Z
  checked: src/db/repository.js line 467
  found: targetRepository = createBaseRepository(db.targets, ['amount']) - only has base methods (getAll, get, add, update, delete)
  implication: The getByBucket method was never implemented despite being called by targets.js

- timestamp: 2026-03-07T00:00:00Z
  checked: .planning verification docs
  found: Phase 08 verification mentions getByBucket should exist at line 360-362, but actual code doesn't have it
  implication: Implementation was planned but never completed

- timestamp: 2026-03-07T00:00:00Z
  checked: dist/assets/ folder after build
  found: New bundle index-B-RpEggI.js created, dist/index.html references it correctly
  implication: Build is correct but preview loads old bundle index-BP1Zb5kC.js due to service worker cache

- timestamp: 2026-03-07T00:00:00Z
  checked: npm run dev vs npm run preview
  found: Dev mode works (no error), preview mode fails with old bundle
  implication: Service worker in preview is serving cached old version

## Resolution

root_cause: targetRepository is missing the getByBucket() method. The targets.js UI code calls this method but repository.js only provides base CRUD methods.
fix: Added getByBucket method to targetRepository that queries db.targets.where('bucket').equals(bucketName).first()
verification: Build successful. App rebuilt with new bundle (index-B-RpEggI.js). Method now available in targetRepository.
files_changed: ['src/db/repository.js']
