import { useEffect, useState } from 'react';
import { useLiveData } from '../../db/useLiveData.js';
import { debtsRepo } from '../../db/repositories.js';
import { fromPence } from '../../engine/currency.js';
import Money from '../components/Money.jsx';
import { parseStatementPdf, SUPPORTED_PROVIDERS } from './parseStatementPdf.js';
import { getRememberedDebtId, rememberDebtForProvider } from './statementDebtMap.js';

/**
 * Credit-card statement PDF import (spec §4.6). Modal flow on the Debts tab:
 *   file input → pdf.js text extraction + provider auto-detect → summary preview
 *   (provider, statement date, closing balance, min payment) → pick the debt
 *   (preselected from the remembered provider→debt association) → "Update debt"
 *   writes balancePence + balanceAsOf (and the min-payment override if opted in).
 *   Nothing is written to the transactions ledger.
 *
 * `parseFile` is injectable so tests drive the preview without pdf.js.
 *
 * @param {object} props
 * @param {()=>void} props.onClose
 * @param {(file:File)=>Promise<object>} [props.parseFile] - defaults to the real pdf.js path.
 */
export default function StatementImport({ onClose, parseFile = parseStatementPdf }) {
  const { data: debts } = useLiveData(() => debtsRepo.getAll(), []);

  const [status, setStatus] = useState('choose'); // choose | parsing | preview | done
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [debtId, setDebtId] = useState('');
  const [setOverride, setSetOverride] = useState(false);
  const [result, setResult] = useState(null); // { name, oldPounds, newPounds }

  const debtList = debts ?? [];

  // Preselect the debt once the summary is parsed AND debts have loaded: the
  // remembered provider→debt association if it still exists, else the first
  // debt. Runs in an effect so it doesn't race the async debts load.
  useEffect(() => {
    if (status !== 'preview' || !summary || debtList.length === 0 || debtId !== '') return;
    let cancelled = false;
    (async () => {
      const rememberedId = await getRememberedDebtId(summary.provider);
      if (cancelled) return;
      const remembered = rememberedId != null && debtList.some((d) => d.id === rememberedId);
      setDebtId(remembered ? rememberedId : debtList[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, summary, debtList, debtId]);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // allow re-selecting the same file after an error
    if (!file) return;
    setError(null);
    setStatus('parsing');
    try {
      const parsed = await parseFile(file);
      setSummary(parsed);
      setDebtId(''); // effect fills it in (remembered debt, or the first one)
      setSetOverride(false);
      setStatus('preview');
    } catch (err) {
      setError(err.message || String(err));
      setStatus('choose');
    }
  };

  const update = async () => {
    const id = Number(debtId);
    const debt = debtList.find((d) => d.id === id);
    if (!debt) return;
    // Engine summary is in PENCE; the debtsRepo API takes POUNDS, so convert at
    // this UI boundary (fromPence) before writing.
    const newPounds = fromPence(summary.closingBalancePence);
    const asOf = summary.statementDate || new Date().toISOString().slice(0, 10);
    await debtsRepo.updateBalance(id, newPounds, asOf);
    if (setOverride && summary.minimumPaymentPence != null) {
      await debtsRepo.update(id, { minPaymentOverridePence: fromPence(summary.minimumPaymentPence) });
    }
    await rememberDebtForProvider(summary.provider, id);
    // debt.balancePence is already POUNDS at the repo edge (see repositories.js).
    setResult({ name: debt.name, oldPounds: debt.balancePence, newPounds });
    setStatus('done');
  };

  return (
    <div
      className="dialog__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Import credit-card statement"
    >
      <div className="dialog">
        <h3 className="dialog__title">Import statement (PDF)</h3>

        {status === 'done' ? (
          <>
            <p>
              Updated <strong>{result.name}</strong>: <Money pounds={result.oldPounds} /> →{' '}
              <Money pounds={result.newPounds} />.
            </p>
            <div className="dialog__actions">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : status === 'preview' ? (
          <>
            <div className="card statement-summary">
              <div className="statement-summary__row">
                <span className="muted">Provider</span>
                <strong>{summary.provider}</strong>
              </div>
              <div className="statement-summary__row">
                <span className="muted">Statement date</span>
                <span>{summary.statementDate || '—'}</span>
              </div>
              <div className="statement-summary__row">
                <span className="muted">Closing balance</span>
                <Money pence={summary.closingBalancePence} />
              </div>
              <div className="statement-summary__row">
                <span className="muted">Minimum payment</span>
                <span>
                  {summary.minimumPaymentPence != null ? (
                    <Money pence={summary.minimumPaymentPence} />
                  ) : (
                    '—'
                  )}
                </span>
              </div>
            </div>

            {debtList.length === 0 ? (
              <p className="form__error">
                Add a debt first, then import a statement to update its balance.
              </p>
            ) : (
              <>
                <label className="field">
                  <span>Update which debt?</span>
                  <select
                    className="input"
                    value={debtId}
                    onChange={(e) => setDebtId(e.target.value)}
                    aria-label="Choose debt to update"
                  >
                    {debtList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field field--check">
                  <input
                    type="checkbox"
                    checked={setOverride}
                    disabled={summary.minimumPaymentPence == null}
                    onChange={(e) => setSetOverride(e.target.checked)}
                  />
                  <span>
                    Also set minimum payment override
                    {summary.minimumPaymentPence == null && ' (no minimum payment found)'}
                  </span>
                </label>
              </>
            )}

            <div className="dialog__actions">
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={update}
                disabled={debtList.length === 0 || debtId === ''}
              >
                Update debt
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Choose a credit-card statement PDF. We’ll read the closing balance and minimum
              payment and use them to update a debt. Supported: {SUPPORTED_PROVIDERS}.
            </p>
            <label className="field">
              <span>Statement PDF</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="input"
                onChange={onFile}
                aria-label="Choose statement PDF"
              />
            </label>
            {status === 'parsing' && <p className="muted">Reading PDF…</p>}
            {error && (
              <p className="form__error">
                {error} Supported statements: {SUPPORTED_PROVIDERS}.
              </p>
            )}
            <div className="dialog__actions">
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
