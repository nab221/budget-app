import { useRef, useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import { getSetting } from '../../db/settings.js';
import { downloadBackup, importBackup } from '../../db/backup.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const STALE_DAYS = 14;

/** True if the last export is missing or older than 14 days. */
export function isExportStale(lastExportAt, now = new Date()) {
  if (!lastExportAt) return true;
  const then = new Date(lastExportAt).getTime();
  if (Number.isNaN(then)) return true;
  const ageDays = (now.getTime() - then) / (1000 * 60 * 60 * 24);
  return ageDays > STALE_DAYS;
}

export default function BackupSettings() {
  const { data: lastExportAt } = useLiveData(() => getSetting('lastExportAt'), []);
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null); // parsed envelope awaiting confirm
  const [message, setMessage] = useState(null); // { kind: 'ok'|'error', text }

  const doExport = async () => {
    setMessage(null);
    try {
      await downloadBackup();
      setMessage({ kind: 'ok', text: 'Backup downloaded.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || String(err) });
    }
  };

  const onFile = async (e) => {
    setMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setPending(parsed);
    } catch {
      setMessage({ kind: 'error', text: 'That file is not valid JSON.' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmImport = async () => {
    const parsed = pending;
    setPending(null);
    try {
      await importBackup(parsed);
      setMessage({ kind: 'ok', text: 'Backup imported — all data replaced.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err.message || String(err) });
    }
  };

  const stale = isExportStale(lastExportAt);

  return (
    <section className="settings-group">
      <h3>Backup</h3>
      <p className="muted">
        Last export: {lastExportAt ? new Date(lastExportAt).toLocaleString('en-GB') : 'never'}
      </p>
      {stale && (
        <p className="warn-line">
          {lastExportAt
            ? "It's been over 14 days since your last backup — consider exporting again."
            : "You haven't exported a backup yet. Export one to keep your data safe."}
        </p>
      )}

      <div className="form__actions form__actions--left">
        <button type="button" className="btn btn--primary" onClick={doExport}>
          Export JSON
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Import JSON…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={onFile}
        />
      </div>

      {message && (
        <p className={message.kind === 'error' ? 'form__error' : 'settings-flash'}>{message.text}</p>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Replace all data?"
        message="Importing this backup will REPLACE all current data in the app. This can't be undone. Continue?"
        confirmLabel="Replace all data"
        danger
        onConfirm={confirmImport}
        onCancel={() => setPending(null)}
      />
    </section>
  );
}
