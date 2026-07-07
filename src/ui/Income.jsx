import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { peopleRepo, incomeEventsRepo } from '../db/repositories.js';
import { gatherIncomeData } from '../db/incomeData.js';
import { taxYearForDate, shiftTaxYear, taxYearBounds } from '../engine/tax.js';
import EmptyState from './components/EmptyState.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import { formatDay } from './components/dates.js';
import PersonCard from './income/PersonCard.jsx';
import PersonForm from './income/PersonForm.jsx';
import EventForm, { EVENT_KIND_LABELS } from './income/EventForm.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Income tab (spec amendment 2026-07-07 (b)) — the two-person tax-year
 * tracker. Per person: annual salary/sacrifice/pension/BIK/other plus dated
 * dividend draws and salary adjustments; the engine computes gross income,
 * adjusted net income, headroom to the 40% band and the £100k childcare line,
 * and the PAYE-vs-dividend tax split. All figures computed at read time.
 */
export default function Income() {
  const [taxYear, setTaxYear] = useState(() => taxYearForDate(today()));
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null); // raw repo row
  // { personId, personName, kind, event|null } — one dialog for add + edit.
  const [eventDialog, setEventDialog] = useState(null);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null);

  const { data, loading } = useLiveData(() => gatherIncomeData(taxYear), [taxYear]);

  const currentYear = taxYearForDate(today());
  const bounds = taxYearBounds(taxYear);
  const people = data?.people ?? [];
  const anyOver100k = people.filter((p) => p.summary.over100k);
  const formOpen = addingPerson || editingPerson || eventDialog;

  const addPerson = async (payload) => {
    await peopleRepo.add(payload);
    setAddingPerson(false);
  };
  const savePerson = async (payload) => {
    await peopleRepo.update(editingPerson.id, payload);
    setEditingPerson(null);
  };
  const removePerson = async () => {
    await peopleRepo.delete(confirmDeletePerson.id);
    setConfirmDeletePerson(null);
  };
  const saveEvent = async (payload) => {
    if (eventDialog.event) {
      await incomeEventsRepo.update(eventDialog.event.id, payload);
    } else {
      await incomeEventsRepo.add({ ...payload, personId: eventDialog.personId });
    }
    setEventDialog(null);
  };
  const removeEvent = async () => {
    await incomeEventsRepo.delete(confirmDeleteEvent.id);
    setConfirmDeleteEvent(null);
  };

  // Events are stored in pounds at the repo edge but arrive here in pence via
  // gatherIncomeData — the edit form needs the pounds row back.
  const openEditEvent = async (entry, ev) => {
    const row = await incomeEventsRepo.get(ev.id);
    setEventDialog({ personId: entry.id, personName: entry.name, kind: row.kind, event: row });
  };

  return (
    <div className="screen">
      <header className="screen__head">
        <h2>Income</h2>
        <div className="screen__head-actions">
          <div className="taxyear-nav" role="group" aria-label="Tax year">
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Previous tax year"
              onClick={() => setTaxYear((y) => shiftTaxYear(y, -1))}
            >
              ‹
            </button>
            <span className="taxyear-nav__label">
              Tax year {taxYear}
              <span className="muted taxyear-nav__dates">
                {formatDay(bounds.startDate)} – {formatDay(bounds.endDate)}
              </span>
            </span>
            <button
              type="button"
              className="btn btn--sm"
              aria-label="Next tax year"
              onClick={() => setTaxYear((y) => shiftTaxYear(y, 1))}
            >
              ›
            </button>
            {taxYear !== currentYear && (
              <button type="button" className="btn btn--sm" onClick={() => setTaxYear(currentYear)}>
                Today
              </button>
            )}
          </div>
          {!formOpen && (
            <button type="button" className="btn btn--primary" onClick={() => setAddingPerson(true)}>
              Add person
            </button>
          )}
        </div>
      </header>

      {data && data.tableYear !== data.taxYear && (
        <p className="banner banner--info">
          No Budget rates published for {data.taxYear} yet — figures use the {data.tableYear}{' '}
          rates.
        </p>
      )}

      {anyOver100k.length > 0 && (
        <p className="banner banner--warn">
          {anyOver100k.map((p) => p.name).join(' and ')}{' '}
          {anyOver100k.length > 1 ? 'are' : 'is'} over the £100,000 adjusted-net-income line —
          one parent crossing it is enough for the household to lose Tax-Free Childcare and
          free hours.
        </p>
      )}

      {addingPerson && <PersonForm onSubmit={addPerson} onCancel={() => setAddingPerson(false)} />}
      {editingPerson && (
        <PersonForm
          initial={editingPerson}
          onSubmit={savePerson}
          onCancel={() => setEditingPerson(null)}
        />
      )}
      {eventDialog && (
        <EventForm
          kind={eventDialog.kind}
          personName={eventDialog.personName}
          initial={eventDialog.event}
          onSubmit={saveEvent}
          onCancel={() => setEventDialog(null)}
        />
      )}

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState
          title="No people yet"
          hint="Add yourself and your wife with your annual salaries. Then record each dividend draw as you take it — the card shows how close each of you is to the 40% band and the £100,000 childcare line, and what the tax bill will be."
        />
      ) : (
        <ul className="card-list income-list">
          {people.map((entry) => (
            <PersonCard
              key={entry.id}
              entry={entry}
              table={data.table}
              onAddDividend={() =>
                setEventDialog({
                  personId: entry.id,
                  personName: entry.name,
                  kind: 'dividend',
                  event: null,
                })
              }
              onAddAdjustment={() =>
                setEventDialog({
                  personId: entry.id,
                  personName: entry.name,
                  kind: 'salary-adjustment',
                  event: null,
                })
              }
              onEdit={() => setEditingPerson(entry.person)}
              onDelete={() => setConfirmDeletePerson(entry)}
              onEditEvent={(ev) => openEditEvent(entry, ev)}
              onDeleteEvent={(ev) => setConfirmDeleteEvent(ev)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!confirmDeletePerson}
        title="Remove person"
        message={
          confirmDeletePerson
            ? `Remove "${confirmDeletePerson.name}" and all their dividend draws and salary adjustments (every tax year)? This can't be undone.`
            : ''
        }
        confirmLabel="Remove"
        danger
        onConfirm={removePerson}
        onCancel={() => setConfirmDeletePerson(null)}
      />
      <ConfirmDialog
        open={!!confirmDeleteEvent}
        title="Delete entry"
        message={
          confirmDeleteEvent
            ? `Delete this ${EVENT_KIND_LABELS[confirmDeleteEvent.kind].toLowerCase()} of ${formatDay(confirmDeleteEvent.date)}? This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={removeEvent}
        onCancel={() => setConfirmDeleteEvent(null)}
      />
    </div>
  );
}
