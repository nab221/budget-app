// src/ui/expenses/ByDateList.jsx
import { useState } from 'react';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { formatDay, formatPayMonth } from '../components/dates.js';
import { describeKind } from './byDate.js';

/** One day's occurrences under a date + day-total heading (mirrors PaymentDayGroup). */
function DayBlock({ day, categoryByBillId, onJump }) {
  return (
    <div className={`day-group${day.isPast ? ' is-past' : ''}`}>
      <div className="day-group__head">
        <span className="day-group__date">{formatDay(day.date)}</span>
        {day.rows.length > 1 && <Money pence={day.totalPence} className="day-group__total" />}
      </div>
      <ul className="upcoming-list">
        {day.rows.map((r, i) => (
          <li className="upcoming-list__row bydate__row" key={`${r.domId}-${i}`}>
            <span className="upcoming-list__label">
              <button type="button" className="rowlink" onClick={() => onJump(r.domId)}>
                {r.label}
              </button>
              <span className="bydate__kind muted">{describeKind(r, categoryByBillId)}</span>
              {r.isAdjusted && <span className="tag">shifted</span>}
            </span>
            <Money pence={r.amountPence} className="upcoming-list__amount" />
            <Money pence={r.runningPence} className="bydate__running muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodayDivider({ todayStr }) {
  return (
    <div className="bydate__today" role="separator" aria-label="Today">
      Today — {formatDay(todayStr)}
    </div>
  );
}

/**
 * Renders `items` in order with the today divider before the first item that
 * is not past (or after everything when the whole period has gone). `isPast`
 * and `render` let the same walk serve days (week/month) and months (year).
 */
function withTodayDivider(items, todayStr, isPast, render) {
  const out = [];
  let placed = false;
  for (const item of items) {
    if (!placed && !isPast(item)) {
      out.push(<TodayDivider key="today" todayStr={todayStr} />);
      placed = true;
    }
    out.push(render(item));
  }
  if (!placed) out.push(<TodayDivider key="today" todayStr={todayStr} />);
  return out;
}

/**
 * The By-date view (design §4): every occurrence in the period in date order,
 * grouped by day, with running totals, a divider at today, and a footer that
 * splits the period total into gone-out and still-to-go. For the year period
 * days roll up into collapsible months. Read-only; names jump to their card.
 */
export default function ByDateList({ byDate, period, todayStr, categoryByBillId, onJump }) {
  const [openMonths, setOpenMonths] = useState(() => new Set());
  const { days, months, goneOutPence, stillToGoPence, totalPence } = byDate;

  const toggleMonth = (month) =>
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });

  if (days.length === 0) {
    return (
      <section className="panel">
        <h3 className="panel__title">By date</h3>
        <EmptyState hint="Nothing goes out in this period." />
      </section>
    );
  }

  const renderDay = (day) => (
    <DayBlock key={day.date} day={day} categoryByBillId={categoryByBillId} onJump={onJump} />
  );

  return (
    <section className="panel bydate">
      <h3 className="panel__title">By date</h3>

      {period === 'year'
        ? withTodayDivider(months, todayStr, (m) => m.isPast, (m) => {
            const open = openMonths.has(m.month);
            return (
              <div className={`bydate__month${m.isPast ? ' is-past' : ''}`} key={m.month}>
                <button
                  type="button"
                  className="bydate__month-head"
                  aria-expanded={open}
                  onClick={() => toggleMonth(m.month)}
                >
                  <span className="bydate__month-name">{formatPayMonth(m.month)}</span>
                  <span className="muted">
                    {m.days.length} day{m.days.length === 1 ? '' : 's'}
                  </span>
                  <Money pence={m.totalPence} className="bydate__month-total" />
                </button>
                {open && <div className="bydate__month-days">{m.days.map(renderDay)}</div>}
              </div>
            );
          })
        : withTodayDivider(days, todayStr, (d) => d.isPast, renderDay)}

      <div className="bydate__footer">
        <div className="stat">
          <span className="stat__label">Gone out so far</span>
          <Money pence={goneOutPence} className="stat__value stat__value--muted" />
        </div>
        <div className="stat">
          <span className="stat__label">Still to go</span>
          <Money pence={stillToGoPence} className="stat__value" />
        </div>
        <div className="stat">
          <span className="stat__label">Period total</span>
          <Money pence={totalPence} className="stat__value stat__value--muted" />
        </div>
      </div>
    </section>
  );
}
