# Phase 14 Context: UI Polish & Layout

This document captures the implementation decisions for Phase 14, focusing on visual refinements, layout corrections, and dashboard consistency.

## 1. Visual Density & Spacing Strategy
- **Table Layout**: Each entry must be in its own distinct line/row. The current "banner-style" layout (where values appear above headings) is to be removed.
- **Entry Management**: Instead of inline fields that cause overlapping, use pop-up modals for adding and filling new entries.
- **Mobile Experience**: Prioritize a spacious design for mobile users to ensure ease of use and prevent visual clutter.
- **Row Heights**: Table row heights must be dynamic, adjusting automatically to fit the content.

## 2. Card Aesthetics & Consistency
- **Unified Style**: The dashboard "balance banner" will consist of three cards (Running Balance, Next Month Forecast, 3-Month Forecast) sharing the exact same visual style (backgrounds, borders, font weights).
- **Forecast Indicators**: Clear visual indicators (e.g., icons, italicized text, or badges) must be used to distinguish "forecasted" values from "actual" values.
- **Interactions**: Balance cards are informational only and do not require interactive states (hover, active, or click effects).

## 3. Dashboard Layout & Responsiveness
- **Large Screens**: Balance cards are allowed to wrap to a new line if the horizontal space is insufficient.
- **Mobile Layout**: Cards must stack vertically, with each card occupying its own line.
- **Missing Data**: If data for a specific card (e.g., a forecast) is missing or unavailable, that card should be hidden entirely from the dashboard.
- **Visual Weight**: All three balance cards must have equal visual prominence.

## 4. Content Clamping & Overflow
- **Text Wrapping**: For long category names or descriptions, the text must wrap within the cell, and the row height should increase dynamically. Do not use ellipses ("...") or tooltips for overflow.
- **Character Limits**: No maximum character limits will be enforced on names or descriptions.
- **Currency Notation**: On narrow screens or within constrained spaces, "k" notation (e.g., 10.5k instead of 10,500) is permitted to maintain layout integrity.
- **Dynamic Font Scaling**: If a currency amount exceeds the width of a dashboard card, the font size for that value should be reduced to ensure it fits within the card boundaries.

---
*Created on: 2026-03-01*
