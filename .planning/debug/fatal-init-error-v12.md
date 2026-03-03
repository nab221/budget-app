---
status: investigating
trigger: "fatal-init-error-v12"
created: 2025-02-14T10:00:00Z
updated: 2025-02-14T10:00:00Z
---

## Current Focus

hypothesis: The `recurringTemplates` table was removed from the schema in V12, but `templates.js` and `repository.js` still attempt to access it.
test: Check `src/db/schema.js` for the table and `src/db/repository.js` for its usage.
expecting: `recurringTemplates` to be missing from `schema.js` but present in `repository.js`.
next_action: gather initial evidence by reading schema and repository files.

## Symptoms

expected: The application should initialize and load the dashboard without errors after the database upgrade.
actual: The app crashes during initialization, showing a blank screen and a fatal error in the console.
errors: TypeError: Cannot read properties of undefined (reading "toArray") at Object.getAll (repository.js:288:24) at Object.renderTemplates (templates.js:44:57) at Object.init (templates.js:20:16) at init (app.js:167:20)
reproduction: Refresh the browser or open the application.
started: Started immediately after executing Phase 26 (Schema V12 and Migration).

## Eliminated

## Evidence

## Resolution

root_cause:
fix:
verification:
files_changed: []