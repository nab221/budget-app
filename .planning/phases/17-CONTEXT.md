# Phase 16 Context: Advanced Utilities

## Overview
Phase 16 adds power-user features for setting an initial opening balance and manually triggering recurring templates.

## Decisions

### Initial Opening Balance Setup
- **Placement**: The setting will be integrated into the existing "Balance Start Date" section in the Settings tab, creating a unified "Balance Start Configuration" area.
- **Negative Values**: The input will support negative values to allow users to start their tracking while in an overdraft.
- **Feedback**: Saving the opening balance will use the same inline status feedback ("Recalculating...") as the start date, as both trigger the same background balance chain recalculation.

### Template Trigger Behavior
- **Placement**: A secondary "Call Templates" button will be added to the Expenses tab, positioned near the "+ Add Expense" button (e.g., as a `ghost` button).
- **Existing Flow**: Clicking the button will invoke the existing template processing modal (which prompts the user to select which templates to apply for the month).
- **Duplicate Prevention**: If the template logic detects that templates have already been run for the current month, the button will still function but the modal will naturally show the user what they are about to add, allowing them to cancel if they realize it's a duplicate. We will rely on the user to review the modal before confirming.

## Deferred Ideas
*None identified during discussion.*