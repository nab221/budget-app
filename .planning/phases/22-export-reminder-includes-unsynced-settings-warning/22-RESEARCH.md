# Phase 22 Research: Export Reminder Includes Unsynced Settings Warning

## Standard Stack
- **Persistence:** `localStorage` for app settings (Theme, Privacy, Haptics, Payoff Preferences).
- **Environment Detection:** `isConfigured()` from `src/utils/supabase-sync.js` to detect if Cloud Sync is enabled via env vars.
- **UI Banners:** Native HTML `div` elements in `index.html` (e.g., `#export-reminder`) controlled via CSS `.hidden` class and JS DOM manipulation.
- **Centralized Constants:** `src/utils/storage.js` is the source of truth for all `localStorage` keys to prevent "magic string" drift.

## Architecture Patterns
- **Banner Injection:** Use `innerHTML` instead of `textContent` when the banner needs to include interactive elements (like an "Export Now" button) to avoid losing DOM nodes during update.
- **Grace Period Logic:** Implement a "First Seen" timestamp for new users to allow a 24-hour window before showing the export reminder, rather than hiding it indefinitely if no export exists.
- **Centralized Storage Registry:** Maintain a `settingKeys` array in `src/ui/backup.js` that maps to `src/utils/storage.js` constants to ensure the manual JSON export always captures the full set of local-only preferences.

## Don't Hand-Roll
- **Do NOT hand-roll a settings sync to Supabase:** This phase is strictly UI/UX warning based. Do not extend the `pushSnapshot` logic in `src/utils/supabase-sync.js` to include settings; keep the boundary between transactional data (Cloud) and preference data (Local) clear.
- **Do NOT create a custom notification system:** Use the existing `#export-reminder` banner in `index.html` to maintain visual consistency with PWA update and persistence warnings.

## Common Pitfalls
- **The "First-Time User" Trap:** If `last_export_timestamp` is missing, the current logic hides the reminder. This results in users who NEVER export NEVER being reminded.
- **String Overwriting:** Using `el.textContent = msg` in `_showExportReminder` will wipe out any buttons or links added to the banner in HTML. Use `innerHTML` or a dedicated text span within the banner.
- **UI Hunting:** Telling a user to "Export Now" in a banner without providing a button in that same banner forces them to hunt for the export button in the header toolbar, which may be hidden or scrolled out of view on mobile.
- **Constant Drift:** Forgetting to move `LAST_EXPORT_KEY` to `storage.js` leads to duplicate definitions (currently in `pwa-ux.js` and referenced in `backup.js`).

## Code Examples

### 1. Centralizing Settings Constants
Move all keys to `src/utils/storage.js` to ensure the backup utility always has an up-to-date registry.
```javascript
// src/utils/storage.js
export const LAST_EXPORT_KEY = 'last_export_timestamp';
// ... other keys ...
```

### 2. Improved Reminder Logic with Grace Period
Handle the case where a user has never exported by setting an "app first use" date.
```javascript
// src/ui/pwa-ux.js
const FIRST_USE_KEY = 'budget_first_use_timestamp';

export function checkExportReminder() {
  let lastExportMs = parseInt(localStorage.getItem(LAST_EXPORT_KEY), 10);
  
  if (isNaN(lastExportMs)) {
    // New user path: establish a "first use" date if not present
    let firstUseMs = parseInt(localStorage.getItem(FIRST_USE_KEY), 10);
    if (isNaN(firstUseMs)) {
      firstUseMs = Date.now();
      localStorage.setItem(FIRST_USE_KEY, firstUseMs.toString());
    }
    
    // Check if 24h grace period has passed
    const hoursSinceStart = (Date.now() - firstUseMs) / (1000 * 60 * 60);
    if (hoursSinceStart < 24) return _hideExportReminder();
    
    // Force a "reminder" state by pretending they exported 8 days ago
    lastExportMs = Date.now() - (8 * 24 * 60 * 60 * 1000);
  }

  const daysSince = (Date.now() - lastExportMs) / (1000 * 60 * 60 * 24);
  if (daysSince > EXPORT_REMINDER_DAYS) {
    _showExportReminder(Math.floor(daysSince));
  } else {
    _hideExportReminder();
  }
}
```

### 3. Actionable Banner with HTML Support
Injecting a button directly into the banner for better conversion.
```javascript
// src/ui/pwa-ux.js
function _showExportReminder(daysSince) {
  const el = document.getElementById('export-reminder');
  if (!el) return;

  let warning = '';
  if (isConfigured()) {
    warning = '<br><small>Transactions are cloud-synced, but settings (Theme, Privacy) are <strong>local-only</strong> and require manual export.</small>';
  }

  el.innerHTML = `
    Your last data export was ${daysSince} days ago. 
    <button class="primary sm" style="margin: 0 10px; background:#000" onclick="window.app.triggerExport()">Export Now</button>
    ${warning}
  `;
  el.classList.remove('hidden');
}
```
*Note: This requires exposing a `triggerExport` method on `window.app` or similar global access.*
