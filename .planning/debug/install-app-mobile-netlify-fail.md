---
status: investigating
trigger: "install app is not working on mobile on the deployed netlify"
created: 2026-03-07T12:00:00Z
updated: 2026-03-07T12:01:00Z
---

## Current Focus

hypothesis: Click event is firing but installApp() either has null deferredInstallPrompt or an error is being thrown silently
test: adding console.log statements to trace execution
expecting: logs will show if click event fires, if deferredInstallPrompt is null, or if prompt() is called
next_action: add debugging logs to installApp function and button click handler

## Symptoms

expected: Clicking "Install App" button should show browser install prompt to add app to home screen
actual: Button is visible but nothing happens when tapped/clicked - no prompt appears
errors: Chrome console warning: "Banner not shown: beforeinstallpromptevent.preventDefault() called. The page must call beforeinstallpromptevent.prompt() to show the banner."
reproduction: Open https://69acac1236f88f6fed351ab7--creative-peony-7f2ce2.netlify.app/ on Android Chrome, wait for install button to appear, tap it - nothing happens
started: First time testing on mobile; was working on desktop but now showing same issue 

## Eliminated

## Evidence

- timestamp: 2026-03-07T12:01:00Z
  checked: src/ui/pwa-ux.js lines 40-53
  found: installApp() function correctly calls deferredInstallPrompt.prompt()
  implication: The code logic is correct

- timestamp: 2026-03-07T12:02:00Z
  checked: src/ui/pwa-ux.js lines 131-143
  found: _registerInstallListener() captures beforeinstallprompt event and stores in deferredInstallPrompt
  implication: Event capture logic is correct

- timestamp: 2026-03-07T12:03:00Z
  checked: src/app.js lines 77-79
  found: installAppBtn click event is wired to call installApp()
  implication: Event listener is properly connected

- timestamp: 2026-03-07T12:04:00Z
  checked: Console logs from user
  found: "[PWA] Install prompt intercepted and deferred" appears in logs
  implication: The beforeinstallprompt event is firing and being stored correctly

- timestamp: 2026-03-07T12:05:00Z
  checked: vite.config.js
  found: VitePWA plugin with registerType: 'prompt', but this is for update prompts not install prompts
  implication: No conflict with VitePWA plugin

- timestamp: 2026-03-07T12:06:00Z
  action: Added debug console.log statements to installApp() and button click handler
  expecting: Will reveal if click fires, if deferredInstallPrompt is null, or if an error occurs
  next: Build and deploy to test with enhanced logging

## Resolution

root_cause: 
fix: 
verification: 
files_changed: []
