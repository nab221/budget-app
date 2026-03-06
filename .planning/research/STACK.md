# Technology Stack: Milestone v2.3 — Advanced Analytics & Mobile Polish

**Project:** Budget App
**Researched:** 2024-05-24

## Recommended Stack

### Core Framework & Persistence
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vanilla JS | ES2022+ | Application Logic | No-build requirement (Vite-lite), low overhead. |
| Dexie.js | 4.x | IndexedDB Wrapper | Excellent for schema migrations and complex queries. |

### Visualisation & UI
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Chart.js | 4.x | Analytics & Trends | Already integrated; supports doughnut, line, and radar charts. |
| CSS Custom Properties | N/A | Theme & Privacy | Used for "Privacy Mode" (blur/mask) and responsive layouts. |
| DOMPurify | 3.x | XSS Protection | Ensures safe rendering of dynamic transaction labels. |

### Mobile Interactions (New)
| Library / API | Version | Purpose | Why |
|---------------|---------|---------|-----|
| Touch Events API | Standard | Swipe-to-Action | Native browser support for simple swipes (delete/edit). |
| navigator.vibrate | Standard | Haptic Feedback | Adds physical confirmation to key actions (PWA only). |
| CSS Bottom Bar | N/A | Navigation | Mobile-first UX pattern for thumb-friendly navigation. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Swipe | Vanilla JS | Hammer.js | Overkill for simple list swipes; adds weight. |
| Biometrics | PIN Code | WebAuthn | WebAuthn has varied browser support for PWA; start with PIN. |

## Installation

```bash
# Core (Existing)
npm install dexie dompurify chart.js

# No new npm packages required for Milestone v2.3.
```

## Sources

- [Chart.js Doughnut Chart Documentation](https://www.chartjs.org/docs/latest/charts/doughnut.html)
- [MDN Web Docs — Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [MDN Web Docs — Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API)
