# Architecture

**Analysis Date:** 2025-03-04

## Pattern Overview

**Overall:** Modular Vanilla JavaScript with Repository Pattern and Reactive UI Updates.

**Key Characteristics:**
- **Repository Pattern:** Data access is encapsulated in repository objects in `src/db/repository.js`, which interact with Dexie.js.
- **UI Modules:** Each major feature (transactions, expenses, debts, etc.) has its own UI module in `src/ui/` responsible for rendering and event handling.
- **Global Event Bus:** Uses a `CustomEvent` ('app:refresh') dispatched on `window` to trigger UI updates across multiple modules.
- **Vanilla DOM Manipulation:** Uses template literals and `innerHTML` (or safe DOM methods) to render components without a heavy framework.

## Layers

**Data Layer:**
- Purpose: Handles persistence and data retrieval using Dexie.js (IndexedDB).
- Location: `src/db/`
- Contains: `schema.js` (DB definition), `repository.js` (Business logic and data access), `backup.js` (Export/Import).
- Depends on: `dexie.min.js`
- Used by: UI Layer modules.

**UI Layer:**
- Purpose: Manages user interaction and DOM rendering.
- Location: `src/ui/`
- Contains: Feature-specific modules like `transactions.js`, `expenses.js`, `dashboard.js`.
- Depends on: Data Layer (repositories), Utility Layer.
- Used by: `src/app.js` (Entry point).

**Utility Layer:**
- Purpose: Provides shared helper functions for currency, formatting, and calculations.
- Location: `src/utils/`
- Contains: `currency.js`, `finance.js`, `storage.js`.
- Depends on: None.
- Used by: Data Layer and UI Layer.

## Data Flow

**Transaction Management:**

1. User inputs data into a form (e.g., in `src/ui/transactions.js`).
2. UI module calls a repository method (e.g., `incomeRepository.add`).
3. Repository saves data to IndexedDB via Dexie.
4. UI module triggers a refresh (either directly calling `render()` or dispatching `app:refresh`).
5. All listening UI modules re-fetch data from repositories and update the DOM.

**Balance Calculation:**

1. Changes to transactions trigger `calculateBalanceChain` in `src/utils/finance.js`.
2. The chain calculation iterates through months, updating `balanceSnapshots` in the database.
3. Dashboard UI module (`src/ui/dashboard.js`) re-renders the balance panel using these snapshots.

**Recurring Templates Trigger:**

1. `templateUI.checkStartOfMonth()` is called during app initialization (`src/app.js`).
2. It compares the current month with `localStorage.getItem('lastPromptedMonth')`.
3. If a new month is detected, a modal (`src/ui/templates.js`) prompts the user to add selected recurring items.
4. Confirmed items are added to `recurrentExpenseRepository` or `incomeRepository`.

**State Management:**
- **Persistence:** All application state is persisted in IndexedDB.
- **Session State:** Simple UI state (like active tabs or selected month) is managed within UI module objects (e.g., `expensesUI.activeSubTab`).
- **Global Coordination:** Managed via the `window.app` object and global event listeners in `src/app.js`.

## Key Abstractions

**UI Module Pattern:**
- Purpose: Encapsulates all logic for a specific UI section.
- Examples: `src/ui/transactions.js`, `src/ui/expenses.js`, `src/ui/debts.js`.
- Pattern: Object literal with `init()`, `setupEventListeners()`, and `render()` methods.

**Repository Pattern:**
- Purpose: Abstracting Dexie/IndexedDB operations behind a clean API.
- Examples: `src/db/repository.js`
- Pattern: Named objects (e.g., `incomeRepository`) with async methods like `add`, `delete`, `getAll`, `getByMonth`.

## Entry Points

**Application Initialization:**
- Location: `src/app.js`
- Triggers: DOM `DOMContentLoaded` (implied by script inclusion in `index.html`).
- Responsibilities: Initializes all UI modules, sets up global navigation (tabs, month picker), and handles initial data seeding.

## Error Handling

**Strategy:** Localized try-catch blocks in UI modules for user actions, with global catch in `init()`.

**Patterns:**
- **UI Alerts:** Most user-facing errors (e.g., failed validation or DB error) are shown via `alert()`.
- **Initialization Error:** Fatal errors during `app.js` init are rendered directly into the `#app` container to provide feedback.

## Cross-Cutting Concerns

**Logging:** Uses `console.log` and `console.warn` for development and background process monitoring.
**Validation:** Basic client-side validation (null checks, `isNaN`) performed in UI modules before calling repository methods.
**Authentication:** Not applicable (local-first application). Cloud backup integrations (`google-drive.js`, `onedrive.js`) handle their own OAuth flows.

---

*Architecture analysis: 2025-03-04*
