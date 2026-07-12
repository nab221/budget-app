import { useState } from 'react';
import { useLiveData } from '../db/useLiveData.js';
import { peopleRepo, incomeEventsRepo, salaryPeriodsRepo, payslipsRepo } from '../db/repositories.js';
import { gatherIncomeData } from '../db/incomeData.js';
import { taxYearForDate, shiftTaxYear, taxYearBounds } from '../engine/tax.js';
import EmptyState from './components/EmptyState.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import { formatDay, formatPayMonth } from './components/dates.js';
import PersonCard from './income/PersonCard.jsx';
import PersonForm from './income/PersonForm.jsx';
import EventForm, { EVENT_KIND_LABELS } from './income/EventForm.jsx';
import SalaryPeriodForm, { PERIOD_START_SENTINEL } from './income/SalaryPeriodForm.jsx';
import PayslipForm from './income/PayslipForm.jsx';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Income tab (spec §4.8, income redesign amendment (c)) — the two-person
 * tax-year tracker. Per person: a salary TIMELINE of dated annual rates
 * (raise / LTFT / new contract = a new entry), a monthly payslip log whose
 * actuals override the timeline projection month by month, plus dated
 * dividend draws; the engine computes gross income, adjusted net income,
 * headroom to the 40% band and the £100k childcare line, the PAYE-vs-dividend
 * tax split, and a cumulative-basis PAYE sanity check. All figures computed
 * at read time.
 */
export default function Income() {
  const [taxYear, setTaxYear] = useState(() => taxYearForDate(today()));
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null); // raw repo row
  // { personId, personName, kind, event|null } — one dialog for add + edit.
  const [eventDialog, setEventDialog] = useState(null);
  // { personId, personName, period|null } — add + edit a salary timeline entry.
  const [periodDialog, setPeriodDialog] = useState(null);
  // { personId, personName, month, payslip|null, projectedPounds } — the month grid form.
  const [payslipDialog, setPayslipDialog] = useState(null);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null);
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState(null);
  const [confirmDeletePayslip, setConfirmDeletePayslip] = useState(null);

  const { data, loading } = useLiveData(() => gatherIncomeData(taxYear), [taxYear]);

  const currentYear = taxYearForDate(today());
  const bounds = taxYearBounds(taxYear);
  const people = data?.people ?? [];
  const anyOver100k = people.filter((p) => p.summary.over100k);
  const formOpen = addingPerson || editingPerson || eventDialog || periodDialog || payslipDialog;

  const addPerson = async (payload) => {
    // The add form's salary/sacrifice seed the first timeline entry; the person
    // row itself only keeps the person-level annual figures.
    const { annualSalaryPence = 0, salarySacrificePence = 0, ...person } = payload;
    const personId = await peopleRepo.add(person);
    if (annualSalaryPence > 0 || salarySacrificePence > 0) {
      await salaryPeriodsRepo.add({
        personId,
        effectiveFrom: PERIOD_START_SENTINEL,
        annualSalaryPence,
        salarySacrificePence,
      });
    }
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
  const savePeriod = async (payload) => {
    if (periodDialog.period?.id != null) {
      await salaryPeriodsRepo.update(periodDialog.period.id, payload);
    } else {
      // Covers both a brand-new entry and materialising the legacy annual
      // salary (a virtual period with no id) into a real timeline row.
      await salaryPeriodsRepo.add({ ...payload, personId: periodDialog.personId });
    }
    setPeriodDialog(null);
  };
  const removePeriod = async () => {
    await salaryPeriodsRepo.delete(confirmDeletePeriod.id);
    setConfirmDeletePeriod(null);
  };
  const savePayslip = async (payload) => {
    await payslipsRepo.upsert(payslipDialog.personId, payload);
    setPayslipDialog(null);
  };
  const removePayslip = async () => {
    await payslipsRepo.delete(confirmDeletePayslip.id);
    setConfirmDeletePayslip(null);
    setPayslipDialog(null);
  };

  // Events, periods, and payslips are stored in pounds at the repo edge but
  // arrive here in pence via gatherIncomeData — the edit forms need the
  // pounds rows back.
  const openEditEvent = async (entry, ev) => {
    const row = await incomeEventsRepo.get(ev.id);
    setEventDialog({ personId: entry.id, personName: entry.name, kind: row.kind, event: row });
  };
  const openEditPeriod = async (entry, period) => {
    const row =
      period.id != null
        ? await salaryPeriodsRepo.get(period.id)
        : {
            // The legacy virtual period: prefill from the person's annual
            // fields (pounds); saving creates the first real timeline row.
            effectiveFrom: PERIOD_START_SENTINEL,
            annualSalaryPence: entry.person.annualSalaryPence,
            salarySacrificePence: entry.person.salarySacrificePence,
          };
    setPeriodDialog({ personId: entry.id, personName: entry.name, period: row });
  };
  const openEditMonth = async (entry, row) => {
    const payslip = row.payslip ? await payslipsRepo.get(row.payslip.id) : null;
    setPayslipDialog({
      personId: entry.id,
      personName: entry.name,
      month: row.month,
      payslip,
      projectedPounds: row.taxablePence / 100,
    });
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
      {/* The forms seed their state once on mount, so each carries a key tied
          to the entity being edited — clicking Edit on a different entry
          while a form is open remounts it instead of showing stale figures. */}
      {eventDialog && (
        <EventForm
          key={eventDialog.event?.id ?? `new-${eventDialog.personId}-${eventDialog.kind}`}
          kind={eventDialog.kind}
          personName={eventDialog.personName}
          initial={eventDialog.event}
          onSubmit={saveEvent}
          onCancel={() => setEventDialog(null)}
        />
      )}
      {periodDialog && (
        <SalaryPeriodForm
          key={periodDialog.period?.id ?? `new-${periodDialog.personId}`}
          personName={periodDialog.personName}
          initial={periodDialog.period}
          onSubmit={savePeriod}
          onCancel={() => setPeriodDialog(null)}
        />
      )}
      {payslipDialog && (
        <PayslipForm
          key={`${payslipDialog.personId}-${payslipDialog.month}`}
          month={payslipDialog.month}
          personName={payslipDialog.personName}
          initial={payslipDialog.payslip}
          projectedPounds={payslipDialog.projectedPounds}
          onSubmit={savePayslip}
          onDelete={() => setConfirmDeletePayslip(payslipDialog.payslip)}
          onCancel={() => setPayslipDialog(null)}
        />
      )}

      {loading && !data ? (
        <p className="muted">Loading…</p>
      ) : people.length === 0 ? (
        <EmptyState
          title="No people yet"
          hint="Add yourself and your wife with your current annual salaries. Enter each month's payslip as it arrives and record salary changes on the timeline — the card shows how close each of you is to the 40% band and the £100,000 childcare line, and what the tax bill will be."
        />
      ) : (
        <ul className="card-list income-list">
          {people.map((entry) => (
            <PersonCard
              key={entry.id}
              entry={entry}
              table={data.table}
              todayMonth={data.todayMonth}
              onAddDividend={() =>
                setEventDialog({
                  personId: entry.id,
                  personName: entry.name,
                  kind: 'dividend',
                  event: null,
                })
              }
              onAddPeriod={() =>
                setPeriodDialog({ personId: entry.id, personName: entry.name, period: null })
              }
              onEditPeriod={(period) => openEditPeriod(entry, period)}
              onDeletePeriod={(period) => setConfirmDeletePeriod(period)}
              onEditMonth={(row) => openEditMonth(entry, row)}
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
            ? `Remove "${confirmDeletePerson.name}" with their whole salary history, payslips, and dividend draws (every tax year)? This can't be undone.`
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
      <ConfirmDialog
        open={!!confirmDeletePeriod}
        title="Delete salary change"
        message={
          confirmDeletePeriod
            ? `Delete the salary change${confirmDeletePeriod.effectiveFrom !== PERIOD_START_SENTINEL ? ` of ${formatDay(confirmDeletePeriod.effectiveFrom)}` : ''}? Months will project from the previous rate instead.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={removePeriod}
        onCancel={() => setConfirmDeletePeriod(null)}
      />
      <ConfirmDialog
        open={!!confirmDeletePayslip}
        title="Remove payslip"
        message={
          confirmDeletePayslip
            ? `Remove the ${formatPayMonth(confirmDeletePayslip.month)} payslip? The month goes back to the projected figure.`
            : ''
        }
        confirmLabel="Remove"
        danger
        onConfirm={removePayslip}
        onCancel={() => setConfirmDeletePayslip(null)}
      />
    </div>
  );
}
