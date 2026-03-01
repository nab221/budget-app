/**
 * Google Drive utility module
 *
 * Handles GIS (Google Identity Services) token acquisition and Drive v3 REST
 * operations for the cloud backup feature.
 *
 * Token model: access token is held in module-scope memory only (NOT localStorage).
 * Only the connected state (provider key + account email) is persisted in localStorage.
 *
 * IMPORTANT: withGoogleToken() MUST be called from a user-initiated click handler
 * only — the GIS popup will be blocked if triggered from async code not directly
 * tied to a user gesture.
 */

import { CLOUD_LAST_BACKUP_KEY } from './storage.js';

// --- Constants ---

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.appdata openid email';
const DRIVE_FILE_NAME = 'budget-backup.json';

const CLOUD_PROVIDER_KEY = 'cloud_provider';
const CLOUD_ACCOUNT_KEY = 'cloud_account_email';

// --- Module-scope state (NOT exported) ---

/** @type {object|null} GIS TokenClient instance */
let _tokenClient = null;

/**
 * In-memory access token data. Never written to localStorage.
 * @type {{ access_token: string, expires_at: number }|null}
 */
let _tokenData = null;

/**
 * Pending callback to invoke once a fresh token has been obtained.
 * Stored at module scope so the token client callback closure can reach it.
 * @type {((token: string) => void)|null}
 */
let _pendingCallback = null;

// --- Exported functions ---

/**
 * Returns true when Google Drive is the currently connected cloud provider.
 * @returns {boolean}
 */
export function isGoogleConnected() {
  return localStorage.getItem(CLOUD_PROVIDER_KEY) === 'google';
}

/**
 * Fetches the authenticated user's email address from Google's userinfo endpoint.
 * Requires the `openid` and `email` scopes in the access token.
 *
 * @param {string} accessToken - A valid GIS access token.
 * @returns {Promise<string>} The user's email address.
 */
export async function fetchGoogleUserEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await res.json();
  return data.email;
}

/**
 * Initialises the GIS token client singleton.
 *
 * Must be called before withGoogleToken(). Safe to call multiple times — only
 * creates the client once. The callback always routes through _pendingCallback
 * so that withGoogleToken() callers can supply different callbacks on each call.
 *
 * @throws {Error} GIS_NOT_LOADED — if the accounts.google.com/gsi/client script
 *   has not been loaded yet.
 */
export function initGoogleDrive() {
  if (!window.google) {
    throw new Error('GIS_NOT_LOADED');
  }

  if (_tokenClient) return; // already initialised

  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: async (response) => {
      if (response.error) {
        // Surface error to the pending callback's caller via a thrown error.
        // We cannot throw here synchronously into the caller's stack, so we log
        // and let the operation time out / fail silently. The UI layer should
        // wrap withGoogleToken in a try/catch around the operation.
        console.error('GIS token error:', response.error, response.error_description);
        return;
      }

      // Store token in memory with a 60-second early-expiry buffer.
      _tokenData = {
        access_token: response.access_token,
        expires_at: Date.now() + (response.expires_in * 1000) - 60_000
      };

      // Persist connected state and account info to localStorage.
      const email = await fetchGoogleUserEmail(_tokenData.access_token);
      localStorage.setItem(CLOUD_PROVIDER_KEY, 'google');
      localStorage.setItem(CLOUD_ACCOUNT_KEY, email);

      // Invoke the callback that was registered for this token request.
      if (_pendingCallback) {
        const cb = _pendingCallback;
        _pendingCallback = null;
        cb(_tokenData.access_token);
      }
    },
    error_callback: (error) => {
      // Called when the popup is blocked or the user closes it.
      console.error('GIS error_callback:', error);
      _pendingCallback = null;
    }
  });
}

/**
 * Obtains a valid Google access token and invokes callback with it.
 *
 * If a non-expired token is already held in memory the callback is called
 * synchronously (within the same event task). Otherwise the GIS token popup is
 * opened and the callback is invoked asynchronously after the user completes
 * the OAuth flow.
 *
 * MUST be called directly from a user-initiated click handler — not from a
 * setTimeout, Promise chain, or any code not directly tied to a user gesture.
 *
 * @param {(token: string) => void} callback - Invoked with the access token.
 */
export function withGoogleToken(callback) {
  if (!_tokenClient) {
    initGoogleDrive();
  }

  // Use the cached token if it is still valid.
  if (_tokenData && Date.now() < _tokenData.expires_at) {
    callback(_tokenData.access_token);
    return;
  }

  // Request a fresh token — will open the GIS popup.
  _pendingCallback = callback;
  _tokenClient.requestAccessToken({ prompt: '' });
}

/**
 * Disconnects Google Drive:
 * - Clears the in-memory token.
 * - Removes all cloud-related localStorage keys.
 * - Best-effort token revocation via GIS (fire-and-forget).
 */
export function disconnectGoogle() {
  const tokenToRevoke = _tokenData?.access_token;

  _tokenData = null;
  _tokenClient = null;
  _pendingCallback = null;

  localStorage.removeItem(CLOUD_PROVIDER_KEY);
  localStorage.removeItem(CLOUD_ACCOUNT_KEY);
  localStorage.removeItem(CLOUD_LAST_BACKUP_KEY);

  // Best-effort revocation — do not await or surface errors.
  if (tokenToRevoke && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(tokenToRevoke, () => {});
  }
}

/**
 * Uploads a JSON string to Google Drive appDataFolder as budget-backup.json.
 *
 * Uses a PATCH on the existing file if one is found, or a POST to create a new
 * one. Both use the multipart upload endpoint.
 *
 * @param {string} jsonString - Serialised backup data.
 * @param {string} accessToken - Valid GIS access token.
 * @returns {Promise<{ id: string, modifiedTime: string }>} Drive file metadata.
 * @throws {Error} 'Drive upload failed: {status}' on non-OK response.
 */
export async function googleDriveUpload(jsonString, accessToken) {
  // Step 1: Check whether the file already exists in appDataFolder.
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27${encodeURIComponent(DRIVE_FILE_NAME)}%27&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  const existingId = listData.files?.[0]?.id ?? null;

  // Step 2: Build multipart body.
  const metadata = existingId
    ? { name: DRIVE_FILE_NAME }
    : { name: DRIVE_FILE_NAME, parents: ['appDataFolder'] };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([jsonString], { type: 'application/json' }));

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const method = existingId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form
  });

  if (!res.ok) {
    throw new Error(`Drive upload failed: ${res.status}`);
  }

  localStorage.setItem(CLOUD_LAST_BACKUP_KEY, new Date().toISOString());

  return res.json();
}

/**
 * Downloads budget-backup.json from Google Drive appDataFolder.
 *
 * @param {string} accessToken - Valid GIS access token.
 * @returns {Promise<string>} Raw JSON string of the backup file.
 * @throws {Error} 'NO_BACKUP_FOUND' when no backup file exists in Drive.
 * @throws {Error} 'Drive download failed: {status}' on non-OK response.
 */
export async function googleDriveDownload(accessToken) {
  // Step 1: Find the file ID.
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27${encodeURIComponent(DRIVE_FILE_NAME)}%27&fields=files(id,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const listData = await listRes.json();
  const file = listData.files?.[0];

  if (!file) {
    throw new Error('NO_BACKUP_FOUND');
  }

  // Step 2: Download file content.
  const dlRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!dlRes.ok) {
    throw new Error(`Drive download failed: ${dlRes.status}`);
  }

  return dlRes.text();
}
