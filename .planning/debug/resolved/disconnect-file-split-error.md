---
status: resolved
trigger: |
  I deplyed this with netlify. When using online, when I've clicked in disconnect file this error apear Initialization Error
  Something went wrong while starting the app.
  
  TypeError: Cannot read properties of undefined (reading 'split')
      at JD (https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/assets/index-YlOv19gJ.js:12:135110)
      at pi (https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/assets/index-YlOv19gJ.js:12:134338)
      at Yb (https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/assets/index-YlOv19gJ.js:12:143995)
      at yx (https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/assets/index-YlOv19gJ.js:113:4970)
      at async mE (https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/assets/index-YlOv19gJ.js:113:8172)
      at async Promise.all (index 1)
      at async lh (https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/assets/index-YlOv19gJ.js:789:436)
      at async sF (https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/assets/index-YlOv19gJ.js:785:31432)
      at async Promise.all (index 13)
      at async yF (https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/assets/index-YlOv19gJ.js:1052:5452)
created: 2026-03-07T22:58:53.3097784+00:00
updated: 2026-03-07T23:15:10.0000000+00:00
---

## Current Focus

hypothesis: resolved
test: resolved
expecting: resolved
next_action: archived

## Symptoms

expected: clicking disconnect file should return app to local/offline mode without breaking initialization
actual: app shows Initialization Error after disconnecting file in deployed Netlify app
errors: "TypeError: Cannot read properties of undefined (reading 'split')" during startup
reproduction: in deployed app, connect file mode then click disconnect file, app reload/startup fails with split undefined stack trace
started: observed after deployment on Netlify when using disconnect file online

## Eliminated


## Evidence

- timestamp: 2026-03-07T23:02:05.0000000+00:00
  checked: text search for disconnect workflow
  found: disconnect handler exists in src/ui/file-sync.js with button id disconnectFileBtn and handleDisconnectFile()
  implication: likely root path includes this handler and subsequent reinitialization

- timestamp: 2026-03-07T23:02:05.0000000+00:00
  checked: text search for split() usages in src
  found: unguarded split on month strings appears in src/db/repository.js and multiple UI modules
  implication: undefined persisted month can trigger exact TypeError seen in production

- timestamp: 2026-03-07T23:04:10.0000000+00:00
  checked: src/ui/file-sync.js disconnect flow
  found: handleDisconnectFile clears HandleStore then forces location.reload()
  implication: any fragile startup state handling after reload is likely trigger point

- timestamp: 2026-03-07T23:04:10.0000000+00:00
  checked: src/app.js startup sequence
  found: init() runs many module init() calls in Promise.all; any thrown TypeError aborts entire app with Initialization Error screen
  implication: single module split(undefined) is sufficient to reproduce reported fatal startup error

- timestamp: 2026-03-07T23:09:20.0000000+00:00
  checked: startup Promise.all index mapping versus stack trace
  found: stack includes Promise.all index 13, matching initDashboard() position in app initialization Promise.all list
  implication: root failure likely in dashboard render path rather than file-sync handler itself

- timestamp: 2026-03-07T23:09:20.0000000+00:00
  checked: split calls in dashboard and cashflow path
  found: getDailyRollingData(targetMonth) uses targetMonth.split('-') when targetMonth truthy; dashboard passes module variable _selectedMonth
  implication: production failure mechanism matches undefined month argument reaching getDailyRollingData

- timestamp: 2026-03-07T23:15:10.0000000+00:00
  checked: production build after patch
  found: npm run build completed successfully and emitted updated bundle without compile/runtime syntax issues
  implication: fix is build-safe and ready for environment verification on Netlify


## Resolution

root_cause: dashboard initialization path relies on month strings that are assumed valid; cashflow helpers parse month using split('-') without validation, so undefined/invalid month values cause fatal startup TypeError
fix: add centralized month normalization fallback in dashboard and cashflow before split('-') parsing
verification: local build passed and user requested commit/push after human-verify checkpoint
files_changed: [src/ui/dashboard.js, src/utils/cashflow.js]
