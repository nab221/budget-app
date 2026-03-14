# Phase 7 Context: Rolling Overview - Daily Balance & Binned Bars

## Phase Goal
Refine the "Rolling Financial Overview" chart to support mixed-resolution data: a high-resolution daily line for Account Balance overlaying summarized (weekly or monthly) bar charts for Income and Expenses.

## Decisions

### 1. UI & Controls
- **Options:** The "Daily" (D) option is removed from the binning selector. Only "Weekly" (W) and "Monthly" (M) remain.
- **Default:** The chart defaults to the **Weekly** view upon loading.
- **Z-Index:** The Account Balance line must always be rendered **on top** of the bars to ensure visibility across all data points.

### 2. Bar Visualization
- **Type:** Income = Green (positive, upwards), Expenses = Red (negative, downwards).
- **Alignment:** Bars are aligned to the **start of the period** (Monday for weeks, 1st for months) and must stretch to cover the entire duration of the bin.
- **Styles:**
    - **Actual Bars:** Solid color (full opacity).
    - **Forecast Bars:** Any bin containing at least one future date (relative to "Today") must be styled as a forecast: **0.5 opacity** and a **dashed border**.

### 3. Axis & Resolution
- **Account Balance:** Stays **Daily**. It provides the granular trend line.
- **Income/Expenses:** Aggregated into bins.
- **X-Axis Ticks:** Labels must appear exactly on the **Monday** of every week (for weekly view).
- **Date Format:** Use a clean "D MMM" format (e.g., "5 Jan", "12 Jan") to avoid crowding.

### 4. Interactions (Tooltips)
- **Daily Focus:** The tooltip must show the specific **Daily Balance** for the day hovered.
- **Resolution Mixing:** To provide context, the tooltip must show both:
    1. The **Daily** Income/Expense value for that specific date.
    2. The **Bin Total** (Weekly or Monthly) for the period that day belongs to.

## Code Context

### Mapping Logic
Implementation will require a "Sparse Dataset" approach or a custom Chart.js plugin to handle bars stretching across multiple daily labels. 
- `src/utils/cashflow.js`: `getDailyRollingData` should provide the daily data stream.
- `src/ui/charts.js`: `renderRollingOverviewChart` needs a major refactor to handle dual-resolution mapping and custom styling for forecast bins.

### Reference Patterns
- Use `date-fns` for Monday-anchored week logic (`startOfWeek` with `weekStartsOn: 1`).
- Custom `dataset.segment` or bar styling overrides in Chart.js to handle the forecast/actual visual split within the same dataset.

## Deferred Ideas
- *Custom binning ranges (e.g., bi-weekly)*: Not required for this phase.
- *Interactive bar drilling*: Hover/Click to expand a weekly bar into daily bars.
