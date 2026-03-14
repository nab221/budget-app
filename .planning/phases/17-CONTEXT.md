# Phase 17 Context: Dashboard Invariant Forecast KPIs and Layout Reflow

## Overview
Phase 17 aligns Dashboard summary behavior with user expectations:
- Running Balance, Next Month Forecast, and 3-Month Forecast must always represent current forward-looking values (not month/YTD/all-time filtered values).
- These three KPI cards should use the same projection baseline as the detailed 45-day forecast (with 30-day and 90-day horizons respectively).
- Dashboard layout should visually separate navigation-dependent content from navigation-invariant content by moving the month navigation controls to the invariant section, placing them below the Spending Heatmap and above KPI cards.

## Requirements
- **DASH-INV-01**: Running Balance card shows the true current account balance and does not change when month navigation/view mode changes.
- **DASH-INV-02**: Next Month Forecast card shows the 30-day projection from current balance using the same underlying forecast engine/assumptions as the detailed 45-day forecast.
- **DASH-INV-03**: 3-Month Forecast card shows the 90-day projection from current balance using the same underlying forecast engine/assumptions as the detailed 45-day forecast.
- **DASH-INV-04**: All three forecast KPI cards are invariant to dashboard navigation state (selected month, month view, YTD, all-time).
- **DASH-INV-05**: Spending Heatmap and forecast KPI cards are grouped in the invariant section below navigation-dependent chart content.
- **DASH-INV-06**: Month navigation controls are repositioned below the heatmap and directly above the KPI cards, acting as a visual separator between variable and invariant sections.
- **DASH-INV-07**: Existing chart rendering, detailed forecast toggle, and card formatting (currency/italics/risk badges) remain functional after layout change.

## Decisions

### Data Semantics
- Treat KPI cards as "today-forward snapshot" metrics, independent of dashboard timeline navigation.
- Reuse central forecast calculation path used by the detailed 45-day forecast to avoid drift between widgets.

### Layout Strategy
- Keep navigation-dependent visuals (rolling overview and timeline-driven chart state) above the section split.
- Place invariant widgets (heatmap and KPI cards) in a dedicated lower section.
- Use month navigation row as the explicit boundary: below heatmap, above KPI cards.

### Testing Focus
- Add/adjust tests to prove KPI invariance while navigating months and switching view modes.
- Add regression coverage for expected values (running/current, +30d, +90d) and DOM placement order.

## Deferred Ideas
- Add explicit card subtitles such as "As of today", "+30 days", and "+90 days" (defer unless needed for clarity after implementation).