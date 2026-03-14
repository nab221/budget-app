---
status: investigating
trigger: "Diagnose why scheduleAutoSave() in budget-app.html is not successfully triggering saveToFile() or updating the status to "✓ Saved" after a mutation. Verify if queryPermission() prevents background writes without a new gesture and propose a fix."
created: 2026-03-02T15:00:00Z
updated: 2026-03-02T15:00:00Z
---

## Current Focus

hypothesis: requestPermission() fails inside setTimeout because it's not a user gesture, and the UI doesn't allow re-granting permission easily for restored handles.
test: Examine budget-app.html code for permission handling and user gesture requirements.
expecting: Finding that requestPermission requires a user gesture and the current implementation calls it in a debounced (timed) manner.
next_action: Verify if queryPermission/requestPermission behavior in budget-app.html is the root cause.

## Symptoms

expected: scheduleAutoSave() triggers saveToFile() which successfully writes to the file and updates the UI status to "✓ Saved".
actual: saveToFile() might be failing or not triggered correctly, status doesn't show "✓ Saved" or shows "⚠ Offline / Error".
errors: console.error('Save failed:', err); in saveToFile.
reproduction: 1. Open app. 2. Select/Create file. 3. Refresh page (handle is restored). 4. Try to add a mutation (e.g., add income). 5. Auto-save fails because permission is not 'granted' and cannot be requested in background.
started: Milestone v1.4 implementation of File System Access API.

## Eliminated

## Evidence

- 2026-03-02T15:05:00Z: Read budget-app.html. Found `scheduleAutoSave` uses `setTimeout(saveToFile, 500)`.
- 2026-03-02T15:05:00Z: `saveToFile` calls `fileHandle.requestPermission({ mode: 'readwrite' })` if permission is not 'granted'.
- 2026-03-02T15:05:00Z: browser security requires user gesture for `requestPermission`. `setTimeout` breaks the gesture chain.

## Resolution

root_cause: 
fix: 
verification: 
files_changed: []
