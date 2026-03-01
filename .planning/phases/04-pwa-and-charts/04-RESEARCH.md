# Phase 4: PWA and Charts - Research

**Researched:** 2025-03-24
**Domain:** PWA (Service Workers, Manifest) and Data Visualization (Chart.js)
**Confidence:** HIGH

## Summary

This phase focuses on transforming the budget application into a fully offline-capable Progressive Web App (PWA) and adding visual spending trends. The research confirms that `vite-plugin-pwa` is the standard tool for Vite-based projects to handle Service Worker generation and manifest management. Chart.js is selected for the "Stacked Area" charts due to its robust stacking support and mobile-friendly tooltips.

**Primary recommendation:** Use `vite-plugin-pwa` in `generateSW` mode with a custom "Need Refresh" prompt to handle updates without breaking the offline-first experience.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Target Platforms**: Strictly Android (Chrome) and Windows (Chrome/Edge).
- **No iOS Support**: All Apple/iOS-specific logic is explicitly removed.
- **Installation Trigger**: Dedicated "Install App" button in **Settings**. No automatic browser prompts.
- **Update Notification**: Subtle notification bar at the **bottom** when a new version is detected.
- **App Identity**: Icon uses a green symbol on a white circle.
- **Splash Screen**: Background and theme colors follow the **system setting** (Dark/Light).
- **First-Time Caching**: "Ready for Offline" status in Settings once precaching is complete.
- **Color-Blind Safe Palette**: Okabe-Ito scale:
    - **Income**: Blue (#0072B2)
    - **Fixed Expenses**: Vermilion/Orange (#D55E00)
    - **Variable Expenses**: Yellow/Amber (#F0E442)
- **Trend Visualization**: **Stacked Area Chart** for 12-month spending.
- **Smart Reminders**: Export reminder if last backup > 7 days ago.
- **Data Safety**: Red "Risk" badge on Dashboard if `navigator.storage.persist()` is denied.

### Claude's Discretion
- (No specific discretion areas mentioned in CONTEXT.md, but implementation details for the "subtle bar" and "caching strategy" are researched here).

### Deferred Ideas (OUT OF SCOPE)
- N/A (Phase boundary is fixed)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHART-01 | Monthly spending trends chart | Chart.js `line` with `fill: true` and `stacked: true` Y-axis. |
| CHART-02 | Debt payoff timeline chart | Balance projection using the same stacking/line patterns. |
| PWA-01 | Valid PWA manifest | Handled by `vite-plugin-pwa` configuration. |
| PWA-02 | Works fully offline | SW precaching strategy via `generateSW`. |
| PWA-03 | iOS Add to Home Screen | **EXPLICITLY REMOVED** per CONTEXT.md (overrides REQUIREMENTS.md). |
| PWA-04 | Refresh prompt for new version | `registerSW` with `onNeedRefresh` callback logic. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite-plugin-pwa` | ^0.19.0 | SW & Manifest | De facto standard for Vite PWA integration. |
| `chart.js` | ^4.4.0 | Visualization | Lightweight, well-documented, supports stacking and tooltips. |

### Installation:
```bash
npm install chart.js
npm install -D vite-plugin-pwa
```

## Architecture Patterns

### PWA Update Flow ("Subtle Bar")
The app will use the `prompt` update strategy. When a new Service Worker is found and enters the `waiting` state, `vite-plugin-pwa` triggers `onNeedRefresh`.
- **Logic**: Show a fixed `div` at the bottom of the screen.
- **Action**: User clicks "Refresh", calling `updateServiceWorker(true)` which sends the `SKIP_WAITING` message.

### Manual Install Pattern
1. Listen for `beforeinstallprompt` event globally.
2. `e.preventDefault()` to stop the browser's default bar.
3. Store the event in a global variable (e.g., `window.deferredPrompt`).
4. In Settings tab, check if `window.deferredPrompt` exists.
5. If yes, show "Install App" button.
6. On click: `window.deferredPrompt.prompt()` and then clear the variable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SW Generation | Manual `sw.js` | `vite-plugin-pwa` | Precaching hashes and manifest injection are complex to maintain manually. |
| Chart Rendering | SVG/Canvas paths | Chart.js | Stacking logic, axis scaling, and mobile tooltips are non-trivial. |
| Date Comparison | Complex math | Native `Date` + logic | 7-day reminder only needs simple millisecond comparison. |

## Common Pitfalls

### Pitfall 1: Service Worker Stuck "Waiting"
**What goes wrong:** New code is downloaded but doesn't activate because the old tab is still open.
**How to avoid:** Ensure the "Update" button actually calls `skipWaiting` and reloads the page.

### Pitfall 2: Chart Responsiveness
**What goes wrong:** Charts overflow on small Android screens.
**How to avoid:** Use `maintainAspectRatio: false` and wrap `<canvas>` in a relative-positioned container with a fixed height.

## Code Examples

### Stacked Area Chart (Chart.js)
```javascript
new Chart(ctx, {
  type: 'line',
  data: {
    labels: months,
    datasets: [
      { label: 'Income', data: incomeData, fill: true, backgroundColor: '#0072B280', borderColor: '#0072B2' },
      { label: 'Fixed', data: fixedData, fill: true, backgroundColor: '#D55E0080', borderColor: '#D55E00' },
      { label: 'Variable', data: varData, fill: true, backgroundColor: '#F0E44280', borderColor: '#F0E442' }
    ]
  },
  options: {
    scales: {
      y: { stacked: true, beginAtZero: true }
    },
    plugins: {
      tooltip: { intersect: false, mode: 'index' }
    }
  }
});
```

### Smart Export Reminder (7 Days)
```javascript
const checkExportReminder = () => {
  const lastExport = localStorage.getItem('last_export_timestamp');
  if (!lastExport) return;
  
  const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - parseInt(lastExport) > sevenDaysInMs) {
    // Show reminder UI
  }
};
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `package.json` / `vitest.config.ts` |
| Quick run command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHART-01 | Spending trends render | Integration | `npm test` | ❌ Wave 0 |
| PWA-01 | Manifest valid | Smoke | `npm run build` | ❌ Wave 0 |
| DATA-03 | 7-day reminder logic | Unit | `npm test utils/reminders.test.js` | ❌ Wave 0 |

## Sources

### Primary (HIGH confidence)
- Official Vite PWA Documentation (Update strategies)
- Chart.js Official Docs (Stacked Area Charts)
- MDN: Web App Manifest & `beforeinstallprompt`

## Metadata
**Research date:** 2025-03-24
**Valid until:** 2025-04-24
