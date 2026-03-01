# Phase 04 Context: PWA and Charts

## Implementation Decisions

### Android & Windows Focus
- **Target Platforms**: Strictly Android (Chrome) and Windows (Chrome/Edge).
- **No iOS Support**: All Apple/iOS-specific logic (e.g., Safari "Add to Home Screen" banners) is explicitly removed from the scope.

### PWA Installation & Updates
- **Installation Trigger**: Dedicated "Install App" button located in the **Settings** tab. No automatic browser prompts on load.
- **Update Notification**: A subtle notification bar at the **bottom** of the screen when a new version is detected.
- **App Identity**: Icon uses a green symbol on a white circle for high visibility.
- **Splash Screen**: Background and theme colors follow the **system setting** (Dark/Light) of the device.

### Offline & Storage Feedback
- **First-Time Caching**: A simple "Ready for Offline" status message in the **Settings** tab once precaching is complete.
- **Connectivity Status**: No status badges or "Offline" icons in the header. The app should feel like a native tool that "just works."
- **Smart Reminders**: A "persistence warning" or export reminder appears only if the last backup export was **more than 7 days ago**.
- **Data Safety**: If `navigator.storage.persist()` is denied, a red **"Risk" badge** appears on the Dashboard to warn about potential OS-driven data purging.

### Charts & Accessibility
- **Color-Blind Safe Palette**: Optimized for Red-Green color blindness using the Okabe-Ito scale:
    - **Income**: Blue (#0072B2)
    - **Fixed Expenses**: Vermilion/Orange (#D55E00)
    - **Variable Expenses**: Yellow/Amber (#F0E442)
- **Trend Visualization**: **Stacked Area Chart** for Income vs. Fixed vs. Variable spending over the last 12 months.
- **Interactions**: Floating tooltips for exact £ amounts (tappable on Android).
- **Debt Projection**: Initial view focus on the **next 24 months** for readability on mobile screens; full timeline remains accessible.

## Deferred Ideas
- *N/A (Phase boundary is fixed)*
