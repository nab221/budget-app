# Phase 28: UI - Monthly Navigation

## Objective
Implement independent month-based navigation for Recurrent and One-off expense views. This includes persistent month pickers for each sub-tab, localized state, and strict month filtering to handle recurring series gracefully.

## Context
- **Requirement**: Add a formatted Month Picker `[◄ Prev] [Month Year Dropdown] [Next ►]` to the Expenses tab.
- **Persistence**: Store selected month in `localStorage` per sub-tab (`expenses_recurrent_month`, `expenses_oneoff_month`).
- **Dependencies**: Phase 2 (Recurrence Utility) complete.
- **Goal**: Allow users to browse future/past months of expenses independently of the global Dashboard picker.

## Research & Strategy
1. **Source Control**: Modify `src/ui/expenses.js`, `css/main.css`, and `index.html`.
2. **State Management**: Add `recurrentMonth` and `oneOffMonth` to `expensesUI`. Initialize from `localStorage` or default to current month.
3. **Component Design**: Build a helper `renderMonthPicker()` that generates the specific format required.
4. **Integration**: Decouple Expenses from the global `#monthPicker` in `app.js`.

## Tasks

### Task 1: Style the Month Picker (CSS)
Add styling to `css/main.css` for the new picker components.
- Container: Flexbox, centered.
- Buttons: Ghost style with hover states.
- Dropdown: Styled `<select>` to match the app theme.

### Task 2: Implement Month Picker Logic in `expensesUI`
Modify `src/ui/expenses.js`:
- Add `recurrentMonth` and `oneOffMonth` properties.
- Implement `initMonths()` to load from `localStorage`.
- Implement `renderMonthPicker()` to inject the picker into the DOM.
- Bind "Prev", "Next", and "Change" events to update the state and re-render.

### Task 3: Decouple from Global Picker
Modify `src/app.js`:
- Ensure `expensesUI.render()` is called without passing the global month.
- Ensure Expenses tab switching uses its own state.

### Task 4: Polish & Verify
- Ensure the picker is visible and functional in both sub-tabs.
- Verify persistence works across page reloads.
- Verify that navigating one sub-tab doesn't affect the other.

## Success Criteria
- [ ] Both sub-tabs show a picker with `[◄ Prev] [Month Year Dropdown] [Next ►]`.
- [ ] Navigating months filters the table correctly.
- [ ] Selecting "May 2026" in One-off and then switching to Recurrent shows Recurrent's last selected month (e.g. March 2026).
- [ ] Persistence is verified in `localStorage`.
