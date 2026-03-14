# Phase 1: Foundation - Research

**Researched:** 2026-02-28
**Domain:** Web infrastructure, PWA, Data Persistence (IndexedDB), Security
**Confidence:** HIGH

## Summary

This research establishes the architectural foundation for a robust, offline-first Budget PWA. The primary goals are to solve the floating-point arithmetic issue, ensure data safety across browsers (particularly Safari), and establish a secure, modular codebase using modern vanilla JavaScript (ES modules).

**Primary recommendation:** Use a modular "App Shell" architecture with Dexie.js for persistence (pence-integer storage) and DOMPurify for XSS protection, while prioritizing PWA installability to bypass Safari's aggressive storage deletion.

<user_constraints>
## User Constraints (from CONTEXT.md)

*No CONTEXT.md found. Using requirements from roadmap/instructions.*

### Focus Areas
- **Pence-integer arithmetic**: Mandatory for financial accuracy.
- **Dexie.js**: Schema design with migration support.
- **Safari ITP**: Implement `storage.persist()` and PWA patterns to mitigate data loss.
- **DOMPurify**: Essential for safe rendering of user-provided notes/labels.
- **Category Management**: Split into Fixed vs Variable groups.
- **Modular Project Structure**: Move away from monolithic `budget-app.html`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | Modular project structure | Recommended ES Modules + directory structure. |
| FOUND-02 | Pence-integer arithmetic | Standard integer-math pattern for currency. |
| FOUND-03 | Safe data persistence | Dexie.js versioning and migration patterns. |
| FOUND-04 | XSS protection | DOMPurify sanitization pattern. |
| CAT-01/02/03/04 | Category management | Dexie table schema + UI filtering by group. |
| THEME-01/02 | Theme toggling | CSS Variables + persistent preference. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Dexie.js | ^4.0.0 | IndexedDB Wrapper | Excellent migration support, easy API, handles blocking/concurrency. |
| DOMPurify | ^3.0.0 | XSS Protection | De-facto standard for sanitizing HTML in the browser. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| Workbox | ^7.0.0 | PWA Service Worker | Best-in-class for caching strategies and offline reliability. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pence Integers | Dinero.js | Dinero is great but adds bundle size; plain integer math is sufficient for simple budget apps. |
| Vanilla ESM | Vite/Webpack | Bundlers add complexity; for a simple PWA, native ESM is faster to develop and simpler to deploy. |

**Installation:**
```bash
npm install dexie dompurify
```
*(Note: Can also be used via ESM-ready CDNs like esm.sh or unpkg for a buildless setup)*

## Architecture Patterns

### Recommended Project Structure
```
/
├── index.html          # Entry point (App Shell)
├── manifest.webmanifest # PWA config
├── sw.js               # Service Worker
├── css/
│   ├── main.css        # Global styles & variables
│   └── components/     # Component-specific styles
└── src/
    ├── app.js          # Initialization & Orchestration
    ├── db/
    │   ├── schema.js   # Dexie instance & versioning
    │   └── repository.js # Data access layer
    ├── ui/
    │   ├── categories.js # Category management UI
    │   ├── theme.js    # Theme toggling logic
    │   └── components/ # Reusable UI snippets
    └── utils/
        ├── currency.js # Pence-integer math helpers
        └── storage.js  # storage.persist() & persistence checks
```

### Pattern 1: Pence-Integer Arithmetic
**What:** Store all monetary values as integers representing the smallest unit (pence).
**When to use:** Always for financial data.
**Example:**
```typescript
// src/utils/currency.js
export const toPence = (pounds) => Math.round(parseFloat(pounds) * 100);
export const fromPence = (pence) => (pence / 100).toFixed(2);
export const formatGBP = (pence) => new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP'
}).format(pence / 100);
```

### Pattern 2: Dexie Migration & Versioning
**What:** Sequential versioning with data transformation.
**When to use:** When adding tables, indexes, or changing data formats (like converting floats to pence).
**Example:**
```javascript
// src/db/schema.js
db.version(2).stores({
  income: '++id, date, source, amount',
  // ... other tables
}).upgrade(async tx => {
  // Convert existing floats to pence if migrating from legacy data
  await tx.income.toCollection().modify(item => {
    if (typeof item.amount === 'number' && !Number.isInteger(item.amount * 100)) {
       item.amount = Math.round(item.amount * 100);
    }
  });
});
```

### Anti-Patterns to Avoid
- **Floating Point for Currency:** Never use `0.1 + 0.2` for balances.
- **innerHTML without Sanitization:** Direct injection of user input (labels, notes) is a high XSS risk.
- **Blocking Migrations:** Not handling `db.on('blocked')` causes the app to hang if multiple tabs are open during an upgrade.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB Wrapper | Custom IDB logic | Dexie.js | Native IDB is verbose and error-prone for migrations. |
| HTML Sanitization | Custom Regex/Replace | DOMPurify | XSS is complex; regex is not enough to stop all attack vectors. |
| Currency Formatting | Custom string concat | Intl.NumberFormat | Handles locale-specific rules and symbols correctly. |

## Common Pitfalls

### Pitfall 1: Safari ITP 7-Day Storage Deletion
**What goes wrong:** Safari deletes all IndexedDB data if the user doesn't interact with the site for 7 days.
**Why it happens:** Privacy protection (Intelligent Tracking Prevention).
**How to avoid:**
1. Call `navigator.storage.persist()`.
2. Encourage user to **"Add to Home Screen"** (PWA). PWA-installed apps on iOS are currently exempt from the 7-day cap.
3. Show a "Last Backed Up" warning if not recently exported.

### Pitfall 2: Dexie Versioning Gaps
**What goes wrong:** Removing old version declarations that have `.upgrade()` logic.
**How to avoid:** Keep all previous versions that include data migrations so users skipping multiple versions can still upgrade correctly.

## Code Examples

### Verified Pattern: storage.persist()
```javascript
// src/utils/storage.js
export async function ensurePersistence() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Storage persisted: ${isPersisted}`);
    return isPersisted;
  }
  return false;
}
```

### Verified Pattern: DOMPurify Sanitization
```javascript
// src/ui/render.js
import DOMPurify from 'dompurify';

export function safeHTML(template, ...args) {
  const raw = String.raw(template, ...args);
  return DOMPurify.sanitize(raw);
}

// Usage
element.innerHTML = safeHTML`<span>${userNote}</span>`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Float arithmetic | Integer/Pence arithmetic | Standard practice | Eliminates rounding errors in financial reports. |
| Monolithic HTML | Modular ESM | ES2015+ | Better maintainability, tree-shaking, and lazy-loading. |
| localStorage | IndexedDB (Dexie) | Modern PWA | Allows complex queries and much larger storage limits. |

## Open Questions

1. **Service Worker Strategy:** Should we use Workbox or a custom light SW?
   - *Recommendation:* Start with a custom SW for simplicity, move to Workbox in Phase 4 if caching requirements become complex.
2. **Category Hierarchy:** Are "Fixed" and "Variable" the only groups, or should we support nested groups?
   - *Recommendation:* Keep it flat (Fixed/Variable) as per requirements to avoid UI complexity.

## Sources

### Primary (HIGH confidence)
- [Dexie.js Documentation](https://dexie.org/docs/Tutorial/Hello-World) - Versioning and migrations.
- [MDN StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) - Persistence API.
- [WebKit Blog: ITP](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) - 7-day storage cap details.

### Secondary (MEDIUM confidence)
- [DOMPurify GitHub](https://github.com/cure53/dompurify) - Integration patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Industry standards (Dexie, DOMPurify).
- Architecture: HIGH - Standard ESM patterns.
- Pitfalls: HIGH - Well-known browser limitations.

**Research date:** 2026-02-28
**Valid until:** 2026-08-28
