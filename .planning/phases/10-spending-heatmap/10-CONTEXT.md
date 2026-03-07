# Phase 10: Spending Heatmap - Context

## Goal
Implement a GitHub-style spending heatmap on the Dashboard to visualize daily spending density over the current (and prior) year.

## Requirements
- **HMP-01: 52x7 Grid Rendering**
    - Use Canvas 2D for performance and styling control.
    - Rows represent days of the week, columns represent weeks of the year.
    - Responsive container with `overflow-x: auto`.
- **HMP-02: Quartile-based Coloring**
    - Daily spending data aggregated from `recurrentExpenses` (status: 'paid') and `oneOffExpenses`.
    - 5 color levels: 0 = no spend, 1-4 = quartile-based intensity using success/accent greens.
- **HMP-03: Interactivity (Tooltip & Privacy)**
    - Tooltip on hover/tap showing Date, Total (£), and Top spending category.
    - Integration with Privacy Mode (blur when active, unblur on hover).
- **HMP-04: Multi-year Comparison**
    - Automatically show a second grid for the prior year if >13 months of data exist.
    - Both grids use a shared color scale for consistency.

## Decisions
- Grid layout: Columns for weeks, rows for days. (Sunday-Saturday or Monday-Sunday? GitHub uses Sunday-Saturday).
- Colors: Green gradient (standard green tones from theme).
- Quartile scale: Calculated per year (or per view) to ensure distribution is meaningful for the user.
- Integration: Placed below summary cards on the Dashboard.

## UI Design
- Container with title "Spending Heatmap" and optional "Year" label.
- Month labels above the grid.
- Day labels (Mon, Wed, Fri) to the left of the grid.
- Hover state: Highlight cell border or slightly dim other cells.
- Tooltip: Small floating div with date and stats.
