# Phase 09 Context: Swipe Gesture System

## Overview
Phase 09 introduces a `SwipeManager` to the Expenses table, enabling mobile-first gestures for deleting and clearing transactions. The system prioritizes muscle memory, tactile feedback (haptics), and visual clarity within the existing reconciliation workflow.

## Implementation Decisions

### 1. Gesture Sensitivity & Thresholds
- **Threshold**: 80px minimum fixed distance (not percentage) to reveal action buttons.
- **Trigger Logic**: **NO auto-trigger** on full swipe. A deliberate tap on the revealed button is always required to execute an action.
- **Haptic Feedback**: Fire a `tap` haptic exactly when the 80px threshold is crossed to notify the user that buttons are now interactive.
- **Snap-back Animation**: 250ms ease-out `cubic-bezier(0.25, 0.46, 0.45, 0.94)` for an elastic, responsive feel.

### 2. Visual Interaction & Layout
- **DOM Structure**: Wrap `<td>` contents in a `<div class="swipeable-content">` to allow horizontal translation without breaking the `<table>` alignment.
- **Affordance Design**:
  - **Delete (Left-Swipe)**: Red background (#dc3545) with 🗑️ "Delete".
  - **Clear (Right-Swipe)**: Green background (#28a745) with ✓ "Clear" (only in Reconciliation Mode).
- **Locked/Reconciled Rows**: Limit movement to 20px max, then "thud" back (100ms) with an `error` haptic to signal the row is immutable.
- **Styling**: Use solid background colors for action areas; no gradients.

### 3. Conflict & State Management
- **iOS Guardrail**: Ignore touchstart events within <40px of the left screen edge to avoid conflicting with the system "Back" gesture.
- **State Limit**: Enforce a **single-row-open** policy. If a new swipe begins, any currently revealed row must automatically snap shut.
- **Input Scope**: **Touch-only** implementation. Pointer/mouse events are excluded to prevent conflicts with text selection on desktop.
- **Storage**: Use a `WeakMap` keyed by the row DOM node to track reveal states, ensuring automatic garbage collection when rows are re-rendered.

### 4. Reconciliation Workflow Integration
- **Contextual Availability**: The "Clear" (right-swipe) gesture is strictly disabled when Reconciliation Mode is OFF.
- **Feedback Loop**:
  - Upon clearing an item via swipe, the row snaps back immediately and applies the "Cleared" (green) styling.
  - The reconciliation summary totals update immediately with a 200ms yellow flash to draw attention to the change.
- **Clear Haptic**: Use the `success` pattern `[30, 20, 30]` for clearing, distinct from the `tap` or `delete` patterns.

## Code Context
- **Target Container**: `tbody#expenseBody` in `src/ui/expenses.js`.
- **Haptic Utility**: `src/utils/haptics.js` (Phase 08) provides `triggerHaptic()`.
- **Performance**: Use `requestAnimationFrame` to debounce `touchmove` events to 60fps and `touch-action: pan-y` to prevent vertical scroll interference during horizontal swipes.

## Deferred Ideas
- Swipe-to-delete on Income tab (v2.5+).
- Custom swipe thresholds per-user (unnecessary complexity for v2.4).
