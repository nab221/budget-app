/**
 * OneDrive utility module
 *
 * Handles MSAL.js v4/v5 PKCE Auth Code flow for OneDrive and Microsoft Graph
 * REST operations for the cloud backup feature.
 *
 * MSAL instance is created once as a module-level singleton. initialize() is
 * awaited before any MSAL method is called (required since MSAL v3+).
 *
 * Token storage for OneDrive is managed by MSAL itself (msal.* localStorage
 * keys). This module only persists provider state and account email under the
 * shared CLOUD_* localStorage keys.
 */

import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

// --- Constants ---

const ONEDRIVE_CLIENT_ID = import.meta.env.VITE_ONEDRIVE_CLIENT_ID ?? '';
const ONEDRIVE_FILE_NAME = 'budget-backup.json';
const MSAL_SCOPES = ['Files.ReadWrite', 'User.Read'];

const CLOUD_PROVIDER_KEY = 'cloud_provider';
const CLOUD_ACCOUNT_KEY = 'cloud_account_email';
const CLOUD_LAST_BACKUP_KEY = 'cloud_last_backup';

// --- Module-scope state ---

/** @type {PublicClientApplication|null} */
let _msalInstance = null;

/** Whether _msalInstance.initialize() has been awaited. */
let _initialized = false;

// --- Internal helpers ---

/**
 * Returns the MSAL singleton, creating and initialising it on first call.
 * initialize() is awaited exactly once per module lifetime.
 *
 * @returns {Promise<PublicClientApplication>}
 */
async function getMsal() {
  if (!_msalInstance) {
    _msalInstance = new PublicClientApplication({
      auth: {
        clientId: ONEDRIVE_CLIENT_ID,
        authority: 'https://login.microsoftonline.com/consumers',
        redirectUri: window.location.origin
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
      }
    });
  }

  if (!_initialized) {
    await _msalInstance.initialize();
    _initialized = true;
  }

  return _msalInstance;
}

/**
 * Acquires an access token silently, falling back to a popup on
 * InteractionRequiredAuthError.
 *
 * @returns {Promise<string>} The access token.
 * @throws {Error} 'NOT_CONNECTED' if no MSAL account is cached.
 */
async function getOneDriveToken() {
  const msal = await getMsal();
  const accounts = msal.getAllAccounts();

  if (!accounts.length) {
    throw new Error('NOT_CONNECTED');
  }

  try {
    const res = await msal.acquireTokenSilent({
      scopes: MSAL_SCOPES,
      account: accounts[0]
    });
    return res.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      // Silent token refresh failed — need user interaction (popup).
      const res = await msal.acquireTokenPopup({
        scopes: MSAL_SCOPES,
        account: accounts[0]
      });
      return res.accessToken;
    }
    throw err;
  }
}

// --- Exported functions ---

/**
 * Returns true when OneDrive is the currently connected cloud provider.
 * @returns {boolean}
 */
export function isOneDriveConnected() {
  return localStorage.getItem(CLOUD_PROVIDER_KEY) === 'onedrive';
}

/**
 * Opens the MSAL login popup to authenticate the user with their Microsoft
 * account and connect OneDrive.
 *
 * Persists cloud provider state and account email to localStorage on success.
 *
 * @returns {Promise<{ email: string }>}
 */
export async function connectOneDrive() {
  const msal = await getMsal();
  const response = await msal.loginPopup({ scopes: MSAL_SCOPES });
  const email = response.account?.username ?? '';

  localStorage.setItem(CLOUD_PROVIDER_KEY, 'onedrive');
  localStorage.setItem(CLOUD_ACCOUNT_KEY, email);

  return { email };
}

/**
 * Disconnects OneDrive:
 * - Clears MSAL's token cache (removes all msal.* localStorage keys).
 * - Resets the module-scope singleton so a fresh instance is created next time.
 * - Removes all CLOUD_* localStorage keys managed by this app.
 *
 * @returns {Promise<void>}
 */
export async function disconnectOneDrive() {
  const msal = await getMsal();
  const accounts = msal.getAllAccounts();

  if (accounts.length) {
    await msal.clearCache();
  }

  // Reset singleton so a fresh MSAL instance is created on next connect.
  _msalInstance = null;
  _initialized = false;

  localStorage.removeItem(CLOUD_PROVIDER_KEY);
  localStorage.removeItem(CLOUD_ACCOUNT_KEY);
  localStorage.removeItem(CLOUD_LAST_BACKUP_KEY);
}

/**
 * Uploads a JSON string to OneDrive as budget-backup.json via a Graph API PUT.
 * The PUT is an upsert — creates or replaces the file automatically.
 *
 * @param {string} jsonString - Serialised backup data.
 * @returns {Promise<{ id: string, lastModifiedDateTime: string }>} Graph DriveItem metadata.
 * @throws {Error} 'OneDrive upload failed: {status}' on non-OK response.
 */
export async function oneDriveUpload(jsonString) {
  const token = await getOneDriveToken();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FILE_NAME}:/content`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: jsonString
    }
  );

  if (!res.ok) {
    throw new Error(`OneDrive upload failed: ${res.status}`);
  }

  localStorage.setItem(CLOUD_LAST_BACKUP_KEY, new Date().toISOString());

  return res.json();
}

/**
 * Downloads budget-backup.json from OneDrive via a Graph API GET.
 *
 * @returns {Promise<string>} Raw JSON string of the backup file.
 * @throws {Error} 'NO_BACKUP_FOUND' when the file does not exist in OneDrive.
 * @throws {Error} 'OneDrive download failed: {status}' on other non-OK responses.
 */
export async function oneDriveDownload() {
  const token = await getOneDriveToken();

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/root:/${ONEDRIVE_FILE_NAME}:/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (res.status === 404) {
    throw new Error('NO_BACKUP_FOUND');
  }

  if (!res.ok) {
    throw new Error(`OneDrive download failed: ${res.status}`);
  }

  return res.text();
}

/**
 * Fetches the authenticated user's email address from the Microsoft Graph /me
 * endpoint. Requires the User.Read scope.
 *
 * @returns {Promise<string>} The user's email or userPrincipalName.
 */
export async function getOneDriveUserEmail() {
  const token = await getOneDriveToken();

  const res = await fetch(
    'https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName',
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  return data.mail || data.userPrincipalName;
}
