# Phase 6: Cloud Backup - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect Google Drive or OneDrive via OAuth (no backend required — all auth is client-side), save the app's JSON data file to the chosen provider, and load it back to restore or sync across devices. Provider preference persists in localStorage. User can disconnect at any time from settings.

**Provider scope (deviation from original requirements):**
- Original requirements listed Dropbox (CLOUD-01, CLOUD-02) + Google Drive (CLOUD-03)
- User decision: **replace Dropbox with OneDrive**
- Providers in scope: **Google Drive** (GIS + gapi OAuth) and **OneDrive** (MSAL.js, public client — no backend required)
- CLOUD-01 and CLOUD-02 will be re-interpreted as OneDrive connect + save/load instead of Dropbox

Creating/editing transactions, dashboard, and all other app features are out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Providers
- Google Drive: GIS (Google Identity Services) + gapi — standard approach, silent token refresh via `prompt: 'none'`
- OneDrive: MSAL.js (Microsoft Authentication Library) public client flow — no backend needed, token refresh handled by MSAL automatically
- Both use a client-side-only OAuth flow; no server secrets involved

### Settings UI placement
- Cloud Backup lives as a dedicated section within the existing Settings page
- Shown as two provider cards side by side: Google Drive and OneDrive
- Before connecting: cards show provider logo, name, and a "Connect" button
- After connecting: card shows connected state, associated account (email if available from API), last backup timestamp, and action buttons: "Backup Now" / "Restore" / "Disconnect"

### Connect flow
- Clicking "Connect" opens the OAuth flow (popup preferred; redirect fallback if popup blocked)
- On success: card updates immediately to connected state, token + preference saved to localStorage
- Only one provider can be connected at a time — if user connects a second, prompt: "Disconnect [current provider] and connect [new provider]?"

### Disconnect flow
- Disconnect requires confirmation dialog: "Disconnect [Provider]? Your local data won't be affected."
- On confirm: token cleared, preference removed, card returns to unconnected state

### Save & restore trigger
- **Manual only** — "Backup Now" and "Restore" buttons on the connected provider card
- No automatic sync in this phase
- Backup creates/overwrites a single named file in the provider (e.g., `budget-backup.json`) — not versioned
- Restore replaces local data — show confirmation: "Restore from [Provider]? Your current local data will be replaced."

### Conflict handling
- No diff/merge — Restore always replaces local data
- Last backup timestamp on the card helps user decide whether to restore

### Status & feedback
- Connected card shows: provider name, account email (if available), last backup timestamp
- "Backup Now" shows inline loading state → success message ("Backed up just now") or inline error with retry
- "Restore" shows loading → reloads app data on success or shows inline error
- Silent token refresh (both providers) — only surface an error if refresh fails and user action is required
- If re-auth fails when user attempts backup/restore: show "Session expired — reconnect [Provider]" inline on the card

### Claude's Discretion
- Exact file name for backup file in cloud storage
- Token storage details (localStorage keys, structure)
- Exact loading/success/error animation style
- Popup vs redirect decision per provider based on browser constraints
- How to handle popup blockers gracefully

</decisions>

<specifics>
## Specific Ideas

- Google Drive re-auth must be silent (`prompt: 'none'`) — don't interrupt the user unless silent refresh fails
- OneDrive via MSAL.js public client — no backend, works from a static/PWA app
- "Connected cloud account preference persists across sessions" — localStorage for both token and provider preference
- Single backup file per provider (e.g., `budget-backup.json`) — simple, not versioned

</specifics>

<deferred>
## Deferred Ideas

- Dropbox support — removed from scope per user decision (was CLOUD-01/02 in original requirements)
- Automatic sync on data change — future phase
- Multiple provider connections simultaneously — future phase
- Versioned backups / restore history — future phase
- Scheduled/recurring backups — future phase

</deferred>

---

*Phase: 06-cloud-backup*
*Context gathered: 2026-03-01*
*Providers: Google Drive + OneDrive (replaces original Dropbox + Google Drive)*
