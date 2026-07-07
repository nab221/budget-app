import { useState } from 'react';
import { wipeAllData } from '../../db/wipe.js';

/**
 * Wipe-all danger zone (spec §4.7). The button only enables once the user types
 * DELETE exactly, guarding against accidental clicks.
 */
export default function DangerZone() {
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState(null);
  const armed = confirmText === 'DELETE';

  const wipe = async () => {
    if (!armed) return;
    try {
      await wipeAllData();
      setConfirmText('');
      setMessage('All data wiped. Default categories restored.');
    } catch (err) {
      setMessage(err.message || String(err));
    }
  };

  return (
    <section className="settings-group danger-zone">
      <h3>Danger zone</h3>
      <p className="muted">
        Wipe every income source, bill, debt, transaction, child, and setting. Default categories
        are restored afterwards. This cannot be undone — export a backup first.
      </p>
      <div className="form-row">
        <div className="field">
          <label>Type DELETE to confirm</label>
          <input
            className="input"
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
          />
        </div>
        <button
          type="button"
          className="btn btn--danger"
          disabled={!armed}
          onClick={wipe}
        >
          Wipe all data
        </button>
      </div>
      {message && <p className="settings-flash">{message}</p>}
    </section>
  );
}
