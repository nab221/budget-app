# Phase 6: Cloud Backup - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect Dropbox or Google Drive via OAuth (PKCE for Dropbox, standard OAuth 2.0 with silent token refresh for Google Drive), save the app's JSON data file to the provider, and load it back to restore or sync. No backend required — all auth is client-side. Provider preference persists across sessions. User can disconnect at any time from settings.

Creating/editing transactions, dashboard, and other app features are out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Settings UI placement
- Cloud Backup lives as a dedicated section within the existing Settings page
- Shown as two provider cards side by side: Dropbox and Google Drive
- Before connecting: cards show provider logo, name, and a "Connect" button
- After connecting: card shows connected state, last backup timestamp, and "Backup Now" / "Restore" / "Disconnect" actions

### Connect flow
- Clicking "Connect" opens the OAuth flow (popup or redirect — Claude's discretion based on browser compatibility)
- On success: card updates immediately to connected state, preference saved to localStorage
- No confirmation needed to connect

### Disconnect flow
- Disconnect requires a simple confirmation: "Disconnect [Provider]? Your local data won't be affected."
- On confirm: token cleared, preference removed, card returns to unconnected state
- Only one provider can be connected at a time (connecting a second auto-disconnects the first — or block until user disconnects first, Claude's discretion)

### Save & restore trigger
- Manual only: "Backup Now" and "Restore" buttons on the connected provider card
- No automatic sync in this phase
- Backup overwrites the previous file in cloud storage (single-file backup, not versioned)
- Restore overwrites local data — show confirmation: "Restore from [Provider]? Your current local data will be replaced."

### Conflict handling
- If the user hits Restore, always show the confirmation above — no diff/merge, just replace
- "Last saved" timestamp on the card helps user decide whether to restore

### Status & feedback
- Connected card shows: provider name, connected email/account (if available from API), last backup timestamp
- "Backup Now" shows inline loading state, then success ("Backed up just now") or error with retry
- "Restore" shows loading, then reloads app data on success or shows error
- Silent token refresh (Google Drive) happens invisibly — only surface an error if refresh fails and user needs to reconnect
- If re-auth fails and user tries to backup/restore: show "Session expired — reconnect [Provider]" inline on the card

### Claude's Discretion
- Exact OAuth popup vs redirect decision (browser compatibility)
- Whether to block second provider connect or auto-disconnect first
- Token storage mechanism (localStorage vs sessionStorage vs IndexedDB)
- File naming convention for the backup file in cloud storage
- Exact loading/success/error animation style

</decisions>

<specifics>
## Specific Ideas

- Success criteria explicitly states PKCE for Dropbox (no server-side secret)
- Google Drive re-auth must be silent when token expires — don't interrupt the user unless the refresh itself fails
- "Connected cloud account preference persists across sessions" — localStorage is the natural fit

</specifics>

<deferred>
## Deferred Ideas

- Automatic sync on data change — future phase
- Multiple provider connections simultaneously — future phase
- Versioned backups / restore history — future phase
- Scheduled/recurring backups — future phase

</deferred>

---

*Phase: 06-cloud-backup*
*Context gathered: 2026-03-01*
