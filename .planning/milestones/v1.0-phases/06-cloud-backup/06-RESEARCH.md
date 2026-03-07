# Phase 6: Cloud Backup - Research

**Researched:** 2026-03-01
**Domain:** Client-side OAuth2 (GIS token model + MSAL.js PKCE) + REST file upload to Google Drive and OneDrive
**Confidence:** MEDIUM-HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Google Drive: GIS (Google Identity Services) + gapi — standard approach, silent token refresh via `prompt: 'none'`
- OneDrive: MSAL.js (Microsoft Authentication Library) public client flow — no backend needed, token refresh handled by MSAL automatically
- Both use a client-side-only OAuth flow; no server secrets involved
- Cloud Backup lives as a dedicated section within the existing Settings page
- Shown as two provider cards side by side: Google Drive and OneDrive
- Before connecting: cards show provider logo, name, and a "Connect" button
- After connecting: card shows connected state, associated account (email if available from API), last backup timestamp, and action buttons: "Backup Now" / "Restore" / "Disconnect"
- Clicking "Connect" opens the OAuth flow (popup preferred; redirect fallback if popup blocked)
- On success: card updates immediately to connected state, token + preference saved to localStorage
- Only one provider can be connected at a time — if user connects a second, prompt: "Disconnect [current provider] and connect [new provider]?"
- Disconnect requires confirmation dialog: "Disconnect [Provider]? Your local data won't be affected."
- On confirm: token cleared, preference removed, card returns to unconnected state
- **Manual only** — "Backup Now" and "Restore" buttons on the connected provider card
- No automatic sync in this phase
- Backup creates/overwrites a single named file in the provider — not versioned
- Restore replaces local data — show confirmation: "Restore from [Provider]? Your current local data will be replaced."
- No diff/merge — Restore always replaces local data
- Last backup timestamp on the card helps user decide whether to restore
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

### Deferred Ideas (OUT OF SCOPE)
- Dropbox support — removed from scope per user decision
- Automatic sync on data change — future phase
- Multiple provider connections simultaneously — future phase
- Versioned backups / restore history — future phase
- Scheduled/recurring backups — future phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLOUD-01 | User can connect a cloud account (re-interpreted as OneDrive per CONTEXT.md decision) via PKCE OAuth with no server required, and save their data file | MSAL.js `@azure/msal-browser` v4.x implements PKCE Auth Code flow for SPAs; PUT `/me/drive/root:/{filename}:/content` uploads the file |
| CLOUD-02 | User can load their data file from OneDrive to restore or sync across devices | GET `/me/drive/root:/{filename}:/content` with Bearer token retrieves the file; existing `executeImport()` in backup.js handles import into Dexie |
| CLOUD-03 | User can connect a Google Drive account and save/load their data file (GIS + gapi OAuth) | GIS `initTokenClient` + `requestAccessToken()` obtains access token; Drive v3 REST multipart upload for save, files.list + files.get for restore |
| CLOUD-04 | Connected cloud account preference persists in localStorage; user can disconnect at any time | Token + provider key stored in localStorage; disconnect clears keys; settings card re-renders on state change |
</phase_requirements>

---

## Summary

Phase 6 adds cloud backup/restore to the budget app via two client-side-only OAuth providers: Google Drive (using GIS token model) and OneDrive (using MSAL.js v4 PKCE Auth Code flow). Both flows happen entirely in the browser — no backend, no server secrets, and no CDN scripts need to be injected at runtime (MSAL.js ships as an npm package; GIS script is loaded from Google's CDN).

**Critical correction to CONTEXT.md assumption:** The GIS token model does NOT support silent token refresh via `prompt: 'none'`. Google's own documentation explicitly states: "Due to security concerns, only the popup UX is supported" and "automatic refresh of expired access tokens has been removed." When a GIS access token expires, `requestAccessToken()` must be called again from a user-initiated event. Tokens last approximately 1 hour. For this phase's manual-only trigger pattern this is acceptable: if the token is expired when the user clicks "Backup Now" or "Restore", call `requestAccessToken()` to get a fresh token, then immediately perform the operation. There is no true silent background refresh for GIS.

**OneDrive via MSAL.js** is well-suited here. `acquireTokenSilent()` genuinely refreshes tokens silently using a refresh token (24-hour lifetime) or hidden iframe when the user has an active Microsoft session. Fallback to `acquireTokenPopup()` is needed only when silent fails (expired refresh token, password change, Conditional Access). `@azure/msal-browser` v4.28.2 is the current stable version — install via npm, not CDN (CDN was deprecated in v3+).

**Primary recommendation:** Use `drive.appdata` scope for Google Drive (hidden app-specific folder, no broad Drive access, non-sensitive scope) and `Files.ReadWrite` scope for OneDrive via Graph API. Both store a single file named `budget-backup.json`. The settings UI adds a new `<div>` section to the existing Settings tab panel, following the existing pattern of bordered sections in index.html.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@azure/msal-browser` | 4.28.2 (current) | MSAL.js PKCE Auth Code flow for OneDrive | Official Microsoft library for browser SPAs; no backend needed; built-in silent token refresh; npm-installable |
| GIS script (CDN) | Current | Google OAuth2 token acquisition | Official Google library; loaded as `<script src="https://accounts.google.com/gsi/client">` |
| Google Drive v3 REST API | v3 | Upload/download backup file to Google Drive | Direct REST calls with Bearer token; no additional library needed |
| Microsoft Graph v1.0 REST API | v1.0 | Upload/download backup file to OneDrive | Direct REST calls with Bearer token; no additional library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing `backup.js` | — | Data serialisation/deserialisation (Dexie → JSON → Dexie) | Reuse `executeExport()` data collection and `executeImport()` import logic |
| Existing `templateUI` (modal) | — | Confirmation dialogs | Reuse for disconnect and restore confirmation prompts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `drive.appdata` scope | `drive.file` scope | `drive.file` creates a user-visible file; `drive.appdata` is hidden and app-specific — better UX and privacy |
| Direct REST for Google Drive | `gapi.client.drive` | gapi.client requires additional `gapi` script loading; direct `fetch()` with Authorization header is simpler and sufficient |
| MSAL.js v4 popup flow | Redirect flow | Popup preferred per CONTEXT.md; redirect requires extra handling to restore app state after return |

**Installation:**
```bash
npm install @azure/msal-browser
```

GIS is not on npm; load via script tag in index.html:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── ui/
│   ├── cloud-backup.js      # New: Cloud backup UI module (provider cards, connect/disconnect, backup/restore)
│   └── backup.js            # Existing: local export/import — reuse data collection helpers
├── utils/
│   └── cloud/
│       ├── google-drive.js  # New: GIS token acquisition + Drive v3 REST operations
│       └── onedrive.js      # New: MSAL.js init + Graph REST operations
```

Alternatively (simpler, matching existing flat structure):
```
src/
├── ui/
│   └── cloud-backup.js      # Cloud backup UI module
├── utils/
│   ├── google-drive.js      # Google Drive auth + file ops
│   └── onedrive.js          # OneDrive auth + file ops
```

### Pattern 1: GIS Token Model — Get and Use Access Token

**What:** `initTokenClient` creates a reusable token client. `requestAccessToken()` opens a popup. Callback receives the token. Store the token in memory (not localStorage — short-lived, ~1 hour). Store only the connected state and account email in localStorage.

**When to use:** When user clicks "Connect" (first auth) or when a 401 response indicates token expiry during backup/restore.

```javascript
// Source: https://developers.google.com/identity/oauth2/web/guides/use-token-model

let googleTokenClient = null;
let googleAccessToken = null;

function initGoogleClient(clientId) {
  // GIS script must be loaded (accounts.google.com/gsi/client)
  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    // drive.appdata: hidden app folder, non-sensitive scope, no OAuth verification needed
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    callback: (tokenResponse) => {
      if (tokenResponse.error) {
        handleGoogleError(tokenResponse);
        return;
      }
      googleAccessToken = tokenResponse.access_token;
      // Fetch user email via oauth2/v2/userinfo
      fetchGoogleUserInfo(googleAccessToken);
    }
  });
}

// Called on "Connect" button click OR when token is stale and user triggers backup/restore
function requestGoogleToken() {
  if (!googleTokenClient) initGoogleClient(GOOGLE_CLIENT_ID);
  googleTokenClient.requestAccessToken({ prompt: '' }); // empty string = no forced consent re-prompt after first auth
}
```

**Key limitation:** No silent refresh. `prompt: 'none'` is NOT supported. Token expires in ~1 hour. Strategy: when backup/restore is triggered, check if token is present in memory. If not (or if API returns 401), call `requestAccessToken()` to show popup before proceeding.

### Pattern 2: MSAL.js — Init, Login, Silent Token Acquisition

**What:** `PublicClientApplication` is the MSAL entry point. `loginPopup()` handles initial authentication. `acquireTokenSilent()` silently refreshes using refresh token (24-hour lifetime). Fall back to `acquireTokenPopup()` on `InteractionRequiredAuthError`.

**When to use:** OneDrive connect, backup, restore operations.

```javascript
// Source: https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: 'YOUR_AZURE_APP_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/consumers', // personal accounts only
    redirectUri: window.location.origin
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false
  }
};

let msalInstance = null;

function getMsalInstance() {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig);
  }
  return msalInstance;
}

async function connectOneDrive() {
  const instance = getMsalInstance();
  await instance.initialize(); // Required in MSAL v4 before use
  const response = await instance.loginPopup({
    scopes: ['Files.ReadWrite', 'User.Read']
  });
  // response.account contains user info
  return response;
}

async function getOneDriveToken() {
  const instance = getMsalInstance();
  const accounts = instance.getAllAccounts();
  if (!accounts.length) throw new Error('Not connected');

  const request = {
    scopes: ['Files.ReadWrite'],
    account: accounts[0]
  };

  try {
    const response = await instance.acquireTokenSilent(request);
    return response.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      // Fallback: popup
      const response = await instance.acquireTokenPopup(request);
      return response.accessToken;
    }
    throw err;
  }
}
```

**Note on authority for personal accounts:** Use `https://login.microsoftonline.com/consumers` for personal Microsoft accounts (Outlook, Hotmail, Live). The `common` endpoint works too but may produce quirks with personal accounts targeting OneDrive consumer.

**Note on `initialize()`:** In MSAL.js v3+, you MUST call `await instance.initialize()` before calling any other MSAL methods. This handles redirect promise processing.

### Pattern 3: Google Drive File Operations (appDataFolder)

**What:** Upload and download a JSON backup file to the hidden `appDataFolder` space using Drive v3 REST API with `fetch()`.

```javascript
// Source: https://developers.google.com/workspace/drive/api/guides/appdata
const DRIVE_FILE_NAME = 'budget-backup.json';

async function googleDriveUpload(jsonString, accessToken) {
  // Step 1: Find existing file by name (to overwrite by ID)
  const listRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27budget-backup.json%27&fields=files(id)',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  const existingId = listData.files?.[0]?.id;

  const metadata = { name: DRIVE_FILE_NAME, parents: existingId ? undefined : ['appDataFolder'] };
  const blob = new Blob([jsonString], { type: 'application/json' });

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const method = existingId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  return await res.json(); // { id, name, modifiedTime }
}

async function googleDriveDownload(accessToken) {
  // Find file ID
  const listRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27budget-backup.json%27&fields=files(id,modifiedTime)',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  const file = listData.files?.[0];
  if (!file) throw new Error('No backup found in Google Drive');

  const dlRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!dlRes.ok) throw new Error(`Drive download failed: ${dlRes.status}`);
  return await dlRes.text(); // raw JSON string
}
```

### Pattern 4: OneDrive File Operations (Microsoft Graph)

**What:** Upload and download using Graph API path-based addressing. Automatically creates or replaces the file.

```javascript
// Source: https://learn.microsoft.com/en-us/graph/api/driveitem-put-content
const ONEDRIVE_FILE_NAME = 'budget-backup.json';

async function oneDriveUpload(jsonString, accessToken) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FILE_NAME}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: jsonString
    }
  );
  if (!res.ok) throw new Error(`OneDrive upload failed: ${res.status}`);
  return await res.json(); // { id, name, lastModifiedDateTime }
}

async function oneDriveDownload(accessToken) {
  // Download by path — returns file content directly
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FILE_NAME}:/content`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (res.status === 404) throw new Error('No backup found in OneDrive');
  if (!res.ok) throw new Error(`OneDrive download failed: ${res.status}`);
  return await res.text(); // raw JSON string
}

async function getOneDriveUserEmail(accessToken) {
  const res = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.mail || data.userPrincipalName;
}
```

### Pattern 5: localStorage State Management

**What:** Persist connection state and account info across sessions. Tokens themselves should not be stored in localStorage (MSAL manages its own cache; GIS tokens are short-lived and kept in memory).

```javascript
// Recommended localStorage keys (Claude's discretion)
const CLOUD_PROVIDER_KEY = 'cloud_provider';      // 'google' | 'onedrive' | null
const CLOUD_ACCOUNT_KEY  = 'cloud_account_email'; // string | null
const CLOUD_LAST_BACKUP_KEY = 'cloud_last_backup'; // ISO timestamp | null

// On connect success:
localStorage.setItem(CLOUD_PROVIDER_KEY, 'google');
localStorage.setItem(CLOUD_ACCOUNT_KEY, email);
// Note: MSAL stores its own tokens in localStorage under msal.* keys automatically

// On disconnect:
localStorage.removeItem(CLOUD_PROVIDER_KEY);
localStorage.removeItem(CLOUD_ACCOUNT_KEY);
localStorage.removeItem(CLOUD_LAST_BACKUP_KEY);
// For MSAL: call instance.logout() or instance.clearCache() — clears msal.* keys
```

### Pattern 6: Google User Info (for email display)

GIS token model does not return user profile. Fetch it separately after getting the access token:

```javascript
async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.email; // 'user@gmail.com'
}
```

This requires the `openid` and `email` scopes in addition to `drive.appdata`. The full scope string:
```
'https://www.googleapis.com/auth/drive.appdata openid email'
```

Or use `https://www.googleapis.com/oauth2/v3/userinfo` (returns `email` in the JSON body).

### Anti-Patterns to Avoid

- **Storing GIS access tokens in localStorage:** GIS tokens are ~1 hour access tokens only. Store in module-scope variable. Stale tokens cause 401s — detect and re-request.
- **Using `drive` or `drive.file` scope instead of `drive.appdata`:** These require OAuth app verification and request broad access. `drive.appdata` is non-sensitive, restricted to the app's own folder.
- **Using CDN for MSAL.js:** The CDN has been deprecated since v3. Always `npm install @azure/msal-browser`.
- **Calling MSAL methods before `initialize()`:** In v3+, `instance.initialize()` must be awaited before `loginPopup()` or `acquireTokenSilent()`. Skipping this causes interaction_in_progress errors.
- **Trying `prompt: 'none'` with GIS token model:** GIS explicitly does not support this. It will not silently refresh tokens.
- **Triggering popups not from a click handler:** Both Google and Microsoft OAuth popups will be blocked by browsers if not triggered directly from a user gesture. Always call from inside a click event handler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PKCE Auth Code generation for OneDrive | Custom code_verifier/challenge logic | `@azure/msal-browser` | MSAL handles PKCE, state, nonce, token cache, refresh internally |
| Token refresh for OneDrive | Custom refresh token management | MSAL `acquireTokenSilent()` | MSAL manages refresh token rotation, expiry detection, fallback |
| Popup window management for MSAL | `window.open()` + postMessage | MSAL `loginPopup()` | MSAL handles popup lifecycle, cross-origin message, token extraction |
| Data serialisation for backup | Custom JSON schema | Reuse `backupUI.executeExport()` data collection + `backupUI.executeImport()` logic | Already handles all Dexie tables, encryption option |

**Key insight:** MSAL handles the entire OAuth2+PKCE flow, token storage, and silent refresh. For Google, GIS handles the popup and token response. The app only needs to call the right methods and handle the resulting token.

---

## Common Pitfalls

### Pitfall 1: GIS Popup Blocked
**What goes wrong:** Browser blocks the GIS OAuth popup if `requestAccessToken()` is not called directly from a user click handler. The callback is never invoked; the user sees nothing.
**Why it happens:** Modern browsers block `window.open()` not triggered by a trusted user gesture.
**How to avoid:** Always call `requestAccessToken()` inside a button's `addEventListener('click', ...)` handler — not in a setTimeout, not from a Promise `.then()` chain, not from async code more than one call stack away from the click.
**Warning signs:** Popup appears briefly then closes; console shows "Popup was blocked" or no callback fires.

### Pitfall 2: MSAL `initialize()` Not Awaited
**What goes wrong:** Calling `loginPopup()` or `acquireTokenSilent()` before awaiting `instance.initialize()` throws `interaction_in_progress` or processes redirect responses incorrectly.
**Why it happens:** MSAL v3+ requires initialization to process any pending redirect responses from a previous flow.
**How to avoid:** In app startup or the cloud module's init function, always do `await msalInstance.initialize()` before exposing any MSAL operations.
**Warning signs:** Error: "interaction_in_progress: Interaction is currently in progress."

### Pitfall 3: GIS Token Expiry During Operation
**What goes wrong:** User connected hours ago; access token in memory is gone (page refresh) or expired. Backup/Restore attempt returns HTTP 401 from Google Drive.
**Why it happens:** GIS access tokens last ~1 hour and are held only in module-scope memory (not persisted). Page refresh clears them.
**How to avoid:** On every backup/restore trigger for Google Drive, check if `googleAccessToken` is truthy AND not expired (check `expires_in` from the token response + a timestamp). If expired or absent, call `requestAccessToken()` first, then perform the operation inside the callback. Store the token expiry timestamp in memory alongside the token.
**Warning signs:** Drive API returns 401; user is confused because they see the "connected" state card.

### Pitfall 4: OneDrive Personal vs Work Account Scope Confusion
**What goes wrong:** App registers with authority `common`, requests `Files.ReadWrite`, but personal Microsoft account users cannot authenticate, or tokens don't grant Drive access.
**Why it happens:** The personal account endpoint (`consumers`) has subtly different scope requirements. Some sources mention `OneDrive.ReadWrite` for older Live Connect flows.
**How to avoid:** Use authority `https://login.microsoftonline.com/consumers` for a personal-account-only app. Request `['Files.ReadWrite', 'User.Read']` — these work for personal accounts via Microsoft Graph.
**Warning signs:** MSAL returns token but Graph API returns 403; or login popup shows only work/school account option.

### Pitfall 5: Google Drive `drive.appdata` Scope and OAuth Verification
**What goes wrong:** Developer incorrectly requests `drive` or `drive.file` scope, triggering Google's OAuth App Verification requirements (shows unverified app warning to users, may block production use).
**Why it happens:** `drive` and `drive.file` are sensitive/restricted scopes. `drive.appdata` is non-sensitive and does not require verification.
**How to avoid:** Use only `https://www.googleapis.com/auth/drive.appdata openid email` as the scope string. Register the app in Google Cloud Console, add the authorized JavaScript origin for the app's URL.
**Warning signs:** OAuth consent screen shows "This app is not verified" warning in production.

### Pitfall 6: CSP / COOP Headers Blocking GIS Popup
**What goes wrong:** GIS popup opens but closes immediately with no callback; or the sign-in page shows a broken state.
**Why it happens:** Strict Cross-Origin-Opener-Policy (COOP) headers prevent the GIS popup from communicating with the opener window.
**How to avoid:** If the app adds COOP headers, they must allow `same-origin-allow-popups` or a compatible setting. CSP must include `script-src https://accounts.google.com/gsi/client` and `frame-src https://accounts.google.com/gsi/`.
**Warning signs:** GIS popup closes without callback; console COOP cross-origin error.

### Pitfall 7: Service Worker Caching GIS Script
**What goes wrong:** Vite-PWA's Workbox precaches `accounts.google.com/gsi/client` if the globPatterns are too broad, or fails to cache it correctly for offline use.
**Why it happens:** GIS is a CDN-loaded third-party script. It should NOT be cached by the service worker — it must be loaded fresh from Google's CDN.
**How to avoid:** Ensure `workbox.globPatterns` in `vite.config.js` only covers local assets (`**/*.{js,css,html,ico,png,svg}`). Do not add the GIS URL to the precache list. Accept that cloud backup is not available offline (gracefully disable the backup/restore buttons when offline).
**Warning signs:** Cloud features work in dev but fail in production PWA; GIS script served stale from cache.

### Pitfall 8: MSAL Multiple Instances
**What goes wrong:** Creating a new `PublicClientApplication` instance on every button click causes "interaction_in_progress" errors and clears the token cache.
**Why it happens:** MSAL uses in-memory state per instance. Multiple instances do not share state.
**How to avoid:** Create MSAL instance once (module-level singleton), initialize once, reuse for all operations.
**Warning signs:** Silent token acquisition always fails; user must re-login every time.

---

## Code Examples

### Google Drive: Complete Connect + Token-Expired Flow

```javascript
// Source: https://developers.google.com/identity/oauth2/web/guides/use-token-model

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email';

let _tokenClient = null;
let _tokenData = null; // { access_token, expires_at }

function getTokenClient(clientId, onSuccess, onError) {
  if (!_tokenClient) {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.error) { onError(response); return; }
        _tokenData = {
          access_token: response.access_token,
          expires_at: Date.now() + (response.expires_in * 1000) - 60_000 // 60s buffer
        };
        onSuccess(_tokenData.access_token);
      }
    });
  }
  return _tokenClient;
}

function isGoogleTokenValid() {
  return _tokenData && Date.now() < _tokenData.expires_at;
}

// Called from button click handler ONLY
function withGoogleToken(clientId, callback) {
  if (isGoogleTokenValid()) {
    callback(_tokenData.access_token);
  } else {
    const client = getTokenClient(clientId, callback, (err) => {
      throw new Error('Google auth failed: ' + err.error);
    });
    client.requestAccessToken({ prompt: '' });
  }
}
```

### MSAL.js: Singleton Init Pattern

```javascript
// Source: https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token
import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

let _msalInstance = null;
let _initialized = false;

async function getMsal(clientId) {
  if (!_msalInstance) {
    _msalInstance = new PublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/consumers',
        redirectUri: window.location.origin
      },
      cache: { cacheLocation: 'localStorage', storeAuthStateInCookie: false }
    });
  }
  if (!_initialized) {
    await _msalInstance.initialize();
    _initialized = true;
  }
  return _msalInstance;
}

async function getOneDriveAccessToken(clientId) {
  const msal = await getMsal(clientId);
  const accounts = msal.getAllAccounts();
  if (!accounts.length) throw new Error('NOT_CONNECTED');

  try {
    const res = await msal.acquireTokenSilent({
      scopes: ['Files.ReadWrite'],
      account: accounts[0]
    });
    return res.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const res = await msal.acquireTokenPopup({
        scopes: ['Files.ReadWrite'],
        account: accounts[0]
      });
      return res.accessToken;
    }
    throw err;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gapi.auth2` (Google Sign-In) | GIS (`google.accounts.oauth2`) | 2022-2023 | Old library deprecated; GIS is the replacement for all Google OAuth in the browser |
| Implicit flow (token in URL hash) for SPAs | Auth Code + PKCE (no implicit) | MSAL v2, 2020 | MSAL.js v1 used implicit flow; v2+ uses PKCE — more secure, refresh tokens supported |
| MSAL CDN script tag | npm install | MSAL v3, 2023 | CDN deprecated; must use npm package |
| `gapi.client.setToken()` | Direct `fetch()` with `Authorization: Bearer` header | 2022+ | gapi.client works but adds dependency; direct fetch is cleaner for simple file ops |

**Deprecated/outdated:**
- `gapi.auth2`: Fully deprecated. Do not use. GIS token model is the replacement.
- MSAL.js v1 / implicit flow: Do not use. MSAL v2+ with PKCE is required.
- MSAL CDN: Deprecated since v3. npm only.
- `prompt: 'none'` for GIS token model: Not supported. Token refresh requires user gesture.

---

## Open Questions

1. **Google Cloud Console app registration for `drive.appdata` — does it need OAuth verification?**
   - What we know: `drive.appdata` is classified as a non-sensitive scope and does NOT require OAuth App Verification according to Google's documentation.
   - What's unclear: Whether Google still shows any "unverified app" warning even for `drive.appdata` during the development/testing phase (before publishing the OAuth consent screen).
   - Recommendation: Register the Google Cloud project, add the JavaScript origin, set the consent screen to "External" with `drive.appdata` + `openid` + `email` scopes. Test end-to-end in a real browser with the registered origin before finalising implementation.

2. **Azure App Registration for OneDrive personal accounts**
   - What we know: A registered Azure app (Entra ID) with `platform: SPA` and the app's redirect URI is required. Consumer/personal accounts need `https://login.microsoftonline.com/consumers` or `common` authority.
   - What's unclear: The CONTEXT.md specifies the planner/developer will configure this. The client IDs need to be provided at implementation time.
   - Recommendation: Document in the plan that client IDs are environment-specific. Use placeholder constants `GOOGLE_CLIENT_ID` and `ONEDRIVE_CLIENT_ID` in source code, not hardcoded values. They could be in a config file or environment variable.

3. **GIS Token Re-request UX During Backup/Restore**
   - What we know: If the GIS token is expired when user clicks "Backup Now", `requestAccessToken()` must be called — which opens a popup. This is unavoidable with GIS token model.
   - What's unclear: Will this feel jarring? The CONTEXT.md mentions "only surface an error if refresh fails" — but technically a popup IS user interaction for GIS.
   - Recommendation: When Google token is absent/expired, call `requestAccessToken()` silently in the background (no error shown), and proceed with the backup/restore operation in the callback. Only show an error if the token request itself fails (e.g., user cancels the popup or access is denied). This matches the spirit of CONTEXT.md's "silent re-auth" intent even though the mechanism is a popup rather than a hidden frame.

---

## Integration Notes for This Codebase

### Loading GIS script
The GIS script must be added to `index.html`. It should NOT be in the Workbox precache:
```html
<!-- In <head> or before </body> -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### Reusing existing `backup.js` data helpers
The `cloudBackupUI` module should NOT re-implement data collection/import. Instead, extract the data-layer logic from `backup.js`:
- `getData()` — collect all Dexie tables into a JSON-serialisable object (extract from `executeExport()`)
- `importData(parsed)` — clear all tables and bulkAdd (extract from `executeImport()`)

Or: call `backup.js` functions directly and adapt (avoids duplicating the Dexie transaction logic).

### App.js integration
In `app.js`, import and initialise the cloud backup module the same way `backupUI.init()` is called:
```javascript
import { cloudBackupUI } from './ui/cloud-backup.js';
// ...
await cloudBackupUI.init();
```

The Settings tab switch handler already calls `categoryUI.render()` etc. Add a `cloudBackupUI.render()` call there to update the card state when the user switches to Settings.

### Settings panel HTML
Add a new bordered section to the Settings tab panel in `index.html`, following the existing pattern:
```html
<div style="margin-top:20px; padding-top:20px; border-top:1px solid var(--border)">
  <h3 style="font-size:.9rem;margin-bottom:8px">Cloud Backup</h3>
  <div class="hint" style="margin-bottom:12px">Back up and restore your data via Google Drive or OneDrive. Manual backup only — no automatic sync.</div>
  <div id="cloudBackupContainer">
    <!-- Rendered by cloud-backup.js -->
  </div>
</div>
```

---

## Sources

### Primary (HIGH confidence)
- [GIS Token Model Guide](https://developers.google.com/identity/oauth2/web/guides/use-token-model) — token acquisition, prompt values, expiry behaviour, popup-only constraint
- [GIS API Reference — TokenClientConfig](https://developers.google.com/identity/oauth2/web/reference/js-reference#TokenClientConfig) — confirms `prompt:'none'` status
- [Drive v3 — appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata) — appDataFolder scope, visibility, file operations
- [Drive v3 — Upload types](https://developers.google.com/drive/api/guides/manage-uploads) — multipart upload for small files, PATCH vs POST for existing file
- [Drive API Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) — scope classification, `drive.appdata` non-sensitive
- [MSAL.js about-msal-browser](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser) — version, PKCE Auth Code flow, CDN deprecation
- [MSAL SPA acquire token](https://learn.microsoft.com/en-us/entra/identity-platform/scenario-spa-acquire-token) — `acquireTokenSilent`, `InteractionRequiredAuthError`, fallback pattern, configuration
- [Graph API — driveitem-put-content](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content) — PUT `/me/drive/root:/{filename}:/content`, upsert, permissions
- [Graph API — user-get](https://learn.microsoft.com/en-us/graph/api/user-get) — GET `/me` for email, User.Read scope

### Secondary (MEDIUM confidence)
- [GIS Migration Guide](https://developers.google.com/identity/oauth2/web/guides/migration-to-gis) — confirms automatic token refresh was removed, code model vs token model
- [GIS FedCM Migration](https://developers.google.com/identity/gsi/web/guides/fedcm-migration) — FedCM impacts sign-in buttons/One Tap only, NOT `requestAccessToken` token model
- [MSAL authentication flows](https://learn.microsoft.com/en-us/entra/identity-platform/msal-authentication-flows) — confirms Auth Code + PKCE for SPAs, implicit not supported in v2+
- [OneDrive personal account scopes](https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/permissions_reference) — `Files.ReadWrite` delegated permission for personal accounts
- [GIS CSP requirements](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) — CSP header requirements for GIS popup/frame sources

### Tertiary (LOW confidence — needs runtime validation)
- Personal Microsoft account authority: multiple community sources indicate `https://login.microsoftonline.com/consumers` works for personal OneDrive; `common` may also work but is less explicit. Verify during implementation.
- GIS token expiry duration (~1 hour): stated in multiple community sources but not explicitly in the official `use-token-model` page reviewed.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm package versions and CDN script sourced from official docs
- GIS token model: HIGH — confirmed popup-only, no silent refresh, from official docs
- MSAL.js flow: HIGH — official Microsoft Learn docs, version confirmed via docs (4.28.2)
- Architecture: HIGH — patterns derived from official docs and match existing codebase conventions
- Pitfalls: MEDIUM — most derived from official docs; popup blocker and CSP pitfalls from verified community sources
- OneDrive personal account authority: MEDIUM — community-corroborated but not explicitly in the single official source reviewed

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable APIs; GIS/MSAL change slowly, but verify MSAL version before install)
