---
phase: 26-foundation-and-schema-v12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/db/schema.js]
autonomous: true
requirements: [V1.5-DB-01, V1.5-MIG-01]
must_haves:
  truths:
    - "Database version is 12"
    - "recurrentExpenses and oneOffExpenses have new recurrence fields"
    - "Existing recurringTemplates are migrated to recurrentExpenses"
  artifacts:
    - path: "src/db/schema.js"
      provides: "Schema version 12 with upgrade logic"
---

<objective>
Update the database schema to version 12 to support automatic recurring transactions. This includes adding recurrence metadata to expense tables and migrating legacy templates into the new recurrent expense system.
</objective>

<execution_context>
@C:/Users/nab221/.gemini/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@src/db/schema.js
@.planning/milestones/v1.5-REQUIREMENTS.md
@.planning/milestones/v1.5-ROADMAP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Define Schema Version 12</name>
  <files>src/db/schema.js</files>
  <action>
    - Increment schema version to 12.
    - Update 'recurrentExpenses' store definition to include: `isRecurring`, `frequency`, `recurrenceId`, `parentDate`.
    - Update 'oneOffExpenses' store definition to include: `isRecurring`, `frequency`, `recurrenceId`, `parentDate`.
    - Set 'recurringTemplates' to null in the version 12 stores object to mark the table for deletion after upgrade.
  </action>
  <verify>
    <automated>node -e "import('./src/db/schema.js').then(m => console.log(m.default.versions.find(v => v._cfg.version === 12) !== undefined))"</automated>
  </verify>
  <done>Schema version 12 is defined with correct indices.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement Migration Logic</name>
  <files>src/db/schema.js</files>
  <behavior>
    - Existing 'recurrentExpenses' should get default: isRecurring=true, frequency='monthly', recurrenceId=UUID, parentDate=date.
    - Existing 'oneOffExpenses' should get default: isRecurring=false, frequency=null, recurrenceId=null, parentDate=null.
    - Records from 'recurringTemplates' must be converted to 'recurrentExpenses' with isRecurring=true and 12 months of instances generated starting from the current date.
  </behavior>
  <action>
    Implement the .upgrade(async tx => { ... }) block for version 12:
    1. Update existing recurrentExpenses with defaults and unique recurrenceIds (use crypto.randomUUID()).
    2. Update existing oneOffExpenses with defaults.
    3. Iterate through 'recurringTemplates':
       - Map fields (name -> label, etc.).
       - Generate 12 months of instances using a simple date-loop (or helper if available).
       - Insert into recurrentExpenses.
    4. Note: Since recurringTemplates is set to null in stores, Dexie will delete it after the upgrade hook finishes.
  </action>
  <verify>
    Check for syntax errors and logic flow. Manual verification in browser (Phase 13 style) is recommended as automated DB migration tests are environment-dependent.
  </verify>
  <done>Migration logic covers both existing records and template conversion.</done>
</task>

</tasks>

<success_criteria>
- App loads without Dexie VersionError.
- Browser DevTools > IndexedDB shows version 12.
- recurrentExpenses table contains migrated items from templates.
</success_criteria>
