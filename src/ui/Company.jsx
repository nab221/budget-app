import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { gatherCompanyData } from '../db/companyData.js';
import {
  financialYearForDate,
  shiftFinancialYear,
  financialYearBounds,
} from '../engine/corporation-tax.js';
import EmptyState from './components/EmptyState.jsx';
import { formatDay } from './components/dates.js';
import CompanySummary from './company/CompanySummary.jsx';
import { fyTitle } from './company/format.js';
import { incomeEventsRepo } from '../db/repositories.js';
import Modal from './components/Modal.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import DividendForm from './company/DividendForm.jsx';
import DividendLedger from './company/DividendLedger.jsx';
import DrawCalculator from './company/DrawCalculator.jsx';
import { formatGBP } from '../engine/currency.js';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Company tab (spec amendment 2026-09-12 (j)) — corporation tax on the
 * dividends both people draw from the same limited company. A dividend can
 * only be paid out of profit AFTER corporation tax, so the dividends drawn
 * in a company year (1 April – 31 March, the owner's year-end) imply a
 * profit and a CT bill; this screen shows both, where the year sits against
 * the £50,000 small-profits line, and — via the draw calculator — what one
 * more dividend would cost the company and the person drawing it.
 *
 * The ledger IS the Income tab's dividend events. Nothing is stored here:
 * profit, CT, and previews are computed at read time by `gatherCompanyData`,
 * per the "never persist computed rows" rule.
 */
export default function Company() {
  const [fy, setFy] = useState(() => financialYearForDate(today()));

  const { data, loading } = useLiveData(() => gatherCompanyData(fy), [fy]);

  const currentFy = financialYearForDate(today());
  const bounds = financialYearBounds(fy);
  const people = data?.people ?? [];

  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState(null); // raw repo row (pounds)
  const [confirmDelete, setConfirmDelete] = useState(null); // pence-domain ledger row

  const record = async (payload) => {
    await incomeEventsRepo.add(payload);
    setRecording(false);
  };
  const save = async (payload) => {
    await incomeEventsRepo.update(editing.id, payload);
    setEditing(null);
  };
  const remove = async () => {
    await incomeEventsRepo.delete(confirmDelete.id);
    setConfirmDelete(null);
  };
  // The ledger carries pence-domain rows; the edit form needs the pounds row back.
  const openEdit = async (ev) => {
    setEditing(await incomeEventsRepo.get(ev.id));
  };

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Company</h2>
        <div className="screen__head-actions">
          <div className="taxyear-nav" role="group" aria-label="Company year">
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Previous company year"
              onClick={() => setFy((y) => shiftFinancialYear(y, -1))}
            >
              ‹
            </button>
            <span className="taxyear-nav__label">
              Company year {fyTitle(fy)}
              <span className="muted taxyear-nav__dates">
                {formatDay(bounds.startDate)} – {formatDay(bounds.endDate)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Next company year"
              onClick={() => setFy((y) => shiftFinancialYear(y, 1))}
            >
              ›
            </button>
            {fy !== currentFy && (
              <button type="button" className="btn btn--sm" onClick={() => setFy(currentFy)}>
                Today
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn btn--primary"
            disabled={people.length === 0}
            onClick={() => setRecording(true)}
          >
            Record dividend
          </button>
        </div>
      </header>

      {data && data.tableYear !== data.financialYear && (
        <p className="banner banner--info">
          No corporation-tax rules recorded for {fyTitle(data.financialYear)} — figures use
          the {fyTitle(data.tableYear)} rules.
        </p>
      )}

      {recording && (
        <Modal title="Record dividend" onClose={() => setRecording(false)}>
          <DividendForm people={people} onSubmit={record} onCancel={() => setRecording(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit dividend — ${formatDay(editing.date)}`} onClose={() => setEditing(null)}>
          <DividendForm
            key={editing.id}
            people={people}
            initial={editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState
          title="No people yet"
          hint="Add yourself and your wife on the Income tab first. Every dividend recorded there is pooled here as a draw from the company."
        />
      ) : (
        <>
          <CompanySummary data={data} />
          <DrawCalculator
            key={fy}
            data={data}
            onRecord={(payload) => incomeEventsRepo.add(payload)}
          />
          {data.events.length === 0 ? (
            <EmptyState
              title={`No dividends drawn in ${fyTitle(fy)}`}
              hint="Record a dividend here or on the Income tab — either way it counts against this company year."
            />
          ) : (
            <DividendLedger events={data.events} onEdit={openEdit} onDelete={setConfirmDelete} />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete dividend"
        message={
          confirmDelete
            ? `Delete the dividend of ${formatGBP(confirmDelete.amountPence)} on ${formatDay(confirmDelete.date)}? It disappears from the Income tab too. This can't be undone.`
            : ''
        }
        confirmLabel="Delete dividend"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
