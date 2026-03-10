import {
  isConfigured,
  supabase,
  getSession,
  signIn,
  pushSnapshot,
  pullSnapshot,
  CLOUD_LAST_SYNC_KEY,
} from '../utils/supabase-sync.js';
import { importBackupData } from '../db/backup.js';
import { templateUI } from './templates.js';
import { triggerHaptic, alertWithHaptic } from '../utils/haptics.js';
import { db } from '../db/schema.js';

export const cloudSyncUI = {
  _initialized: false,

  /**
   * Initialise cloud sync UI. No-ops silently if Supabase is not configured,
   * keeping the section hidden and the app fully functional.
   */
  async init() {
    if (!isConfigured()) return;
    if (this._initialized) return;
    this._initialized = true;

    this._bindAuthListener();
    this._bindPreviewListener();
    await this._refreshSection();
    document.getElementById('cloudSyncSection')?.classList.remove('hidden');
  },

  /**
   * Re-render the section contents based on current auth state.
   */
  async _refreshSection() {
    const section = document.getElementById('cloudSyncSection');
    if (!section) return;

    const session = await getSession();
    const statusEl = section.querySelector('#cloudSyncStatus');
    const actionsEl = section.querySelector('#cloudSyncActions');
    if (!statusEl || !actionsEl) return;

    if (session) {
      this._renderSignedIn(session, statusEl, actionsEl);
    } else {
      this._renderSignedOut(statusEl, actionsEl);
    }
  },

  _renderSignedIn(session, statusEl, actionsEl) {
    const lastSyncMs = localStorage.getItem(CLOUD_LAST_SYNC_KEY);
    const lastSyncText = lastSyncMs
      ? `Last synced: ${new Date(parseInt(lastSyncMs)).toLocaleString()}`
      : 'Never synced';

    statusEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="color:var(--success);font-size:.85rem">Signed in as ${session.user.email}</span>
        <button id="cloudSignOutBtn" class="ghost" style="font-size:.75rem;padding:2px 8px">Sign Out</button>
      </div>
    `;

    actionsEl.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="cloudPushBtn" class="ghost">Push to Cloud</button>
        <button id="cloudPullBtn" class="ghost">Pull from Cloud</button>
      </div>
      <div class="hint" style="margin-top:6px;font-size:.75rem">${lastSyncText}</div>
    `;

    const signOutBtn = document.getElementById('cloudSignOutBtn');
    if (signOutBtn) signOutBtn.onclick = async () => {
      await supabase.auth.signOut();
      triggerHaptic('tap');
    };

    const pushBtn = document.getElementById('cloudPushBtn');
    if (pushBtn) pushBtn.onclick = async () => {
      try {
        pushBtn.textContent = 'Pushing...';
        pushBtn.disabled = true;
        await pushSnapshot();
        triggerHaptic('success');
        await this._refreshSection();
      } catch (err) {
        console.error('[cloudSyncUI] Push failed:', err);
        alertWithHaptic('Push failed: ' + err.message);
        pushBtn.textContent = 'Push to Cloud';
        pushBtn.disabled = false;
      }
    };

    const pullBtn = document.getElementById('cloudPullBtn');
    if (pullBtn) pullBtn.onclick = async () => {
      try {
        pullBtn.textContent = 'Fetching...';
        pullBtn.disabled = true;
        await pullSnapshot();
        // Event dispatched by pullSnapshot(); UI takes over from the preview listener.
        // Button stays disabled until the modal is dismissed (cancel) or page reloads (confirm).
      } catch (err) {
        console.error('[cloudSyncUI] Pull failed:', err);
        alertWithHaptic('Pull failed: ' + err.message);
        pullBtn.textContent = 'Pull from Cloud';
        pullBtn.disabled = false;
      }
    };
  },

  _renderSignedOut(statusEl, actionsEl) {
    statusEl.innerHTML = '';
    actionsEl.innerHTML = `
      <div class="form-row" style="margin-bottom:8px">
        <div>
          <label for="cloudSyncEmail">Email</label>
          <input type="email" id="cloudSyncEmail" placeholder="your@email.com" style="font-size:.85rem"/>
        </div>
        <div style="display:flex;align-items:flex-end">
          <button id="cloudMagicLinkBtn" class="primary">Send Magic Link</button>
        </div>
      </div>
      <div class="hint">A sign-in link will be emailed to you. No password required.</div>
    `;

    const magicLinkBtn = document.getElementById('cloudMagicLinkBtn');
    if (magicLinkBtn) magicLinkBtn.onclick = async () => {
      const email = document.getElementById('cloudSyncEmail')?.value?.trim();
      if (!email) {
        alertWithHaptic('Please enter your email address.');
        return;
      }
      try {
        magicLinkBtn.textContent = 'Sending...';
        magicLinkBtn.disabled = true;
        await signIn(email);
        magicLinkBtn.textContent = 'Link Sent!';
        alertWithHaptic('Check your email for a sign-in link.', 'success');
      } catch (err) {
        console.error('[cloudSyncUI] Sign-in failed:', err);
        alertWithHaptic('Sign-in failed: ' + err.message);
        magicLinkBtn.textContent = 'Send Magic Link';
        magicLinkBtn.disabled = false;
      }
    };
  },

  /**
   * Reacts to Supabase auth state changes (sign-in via magic link callback,
   * sign-out) by re-rendering the section.
   * Owned here — not in supabase-sync.js — because auth state is a UI concern.
   */
  _bindAuthListener() {
    supabase.auth.onAuthStateChange(() => this._refreshSection());
  },

  /**
   * Listens for the preview event dispatched by pullSnapshot().
   * Shows a modal with snapshot metadata and record counts.
   * Only calls importBackupData() after explicit user confirmation.
   */
  _bindPreviewListener() {
    window.addEventListener('budget:import-cloud-preview', async (e) => {
      const { updated_at, schema_version, counts, tableData } = e.detail;

      const localVersion = db.verno;
      const versionWarning =
        schema_version > localVersion
          ? `<p style="color:var(--danger);margin:8px 0 0">
               Warning: snapshot uses schema v${schema_version}, local is v${localVersion}.
               Importing may fail or produce unexpected results.
             </p>`
          : '';

      const date = new Date(updated_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const escapeHtml = (s) =>
        String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const countLines = Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([t, n]) => `${n} ${escapeHtml(t)}`)
        .join(' · ');

      const body = `
        <p>Cloud snapshot from <strong>${date}</strong></p>
        <p style="margin-top:6px;color:var(--text-soft);font-size:.85rem">${countLines || 'No data'}</p>
        ${versionWarning}
        <p style="margin-top:12px"><strong>Replace local data?</strong> This cannot be undone.</p>
      `;

      const footer = `
        <button class="ghost" id="cancelCloudImportBtn">Cancel</button>
        <button class="danger" id="confirmCloudImportBtn">Replace Local Data</button>
      `;

      templateUI.showModal('Cloud Snapshot Preview', body, footer);

      const restorePullBtn = () => {
        const pullBtn = document.getElementById('cloudPullBtn');
        if (pullBtn) {
          pullBtn.textContent = 'Pull from Cloud';
          pullBtn.disabled = false;
        }
      };

      document.getElementById('cancelCloudImportBtn').onclick = () => {
        templateUI.closeModal();
        restorePullBtn();
      };

      document.getElementById('confirmCloudImportBtn').onclick = async () => {
        templateUI.closeModal();
        try {
          await importBackupData(tableData);
          localStorage.setItem(CLOUD_LAST_SYNC_KEY, String(Date.now()));
          triggerHaptic('success');
          alertWithHaptic('Import successful! The app will now reload.', 'success');
          window.location.reload();
        } catch (err) {
          console.error('[cloudSyncUI] Import failed:', err);
          alertWithHaptic('Import failed: ' + err.message);
          restorePullBtn();
        }
      };
    });
  },
};
