import { useMemo, useState } from 'react';
import { dailyTotalsPence, spendingOccurrences } from '../../engine/spending.js';
import { formatGBP } from '../../engine/currency.js';
import Money from '../components/Money.jsx';
import { formatDay, formatMonth } from '../components/dates.js';
import PaymentDayGroup from './PaymentDayGroup.jsx';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const p2 = (n) => String(n).padStart(2, '0');

// Shading tops out at this share of the accent colour so the day number stays
// readable on both themes (sequential single hue — magnitude, dataviz method).
const MAX_MIX_PCT = 55;

/** Month maths in plain {year, month(1-12)} space. */
const shiftMonth = ({ year, month }, delta) => {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
};

/**
 * Z3a — the payment calendar: the month as a Monday-based grid, each day
 * shaded by its committed total; selecting a day lists its payments. Computed
 * from the same occurrence walkers as every other total.
 */
export default function PaymentCalendar({ data, fromStr }) {
  const [ym, setYm] = useState({
    year: Number(fromStr.slice(0, 4)),
    month: Number(fromStr.slice(5, 7)),
  });
  const [selected, setSelected] = useState(null); // 'yyyy-MM-dd' | null

  const monthStart = `${ym.year}-${p2(ym.month)}-01`;
  const next = shiftMonth(ym, 1);
  const monthEnd = `${next.year}-${p2(next.month)}-01`;

  const totals = useMemo(
    () => dailyTotalsPence(data, monthStart, monthEnd),
    [data, monthStart, monthEnd]
  );
  const rows = useMemo(
    () => spendingOccurrences(data, monthStart, monthEnd),
    [data, monthStart, monthEnd]
  );
  const maxDayPence = Math.max(0, ...totals.values());
  const monthTotalPence = rows.reduce((t, r) => t + (r.amountPence || 0), 0);

  // Grid cells: leading blanks to align day 1 under its weekday, then the days.
  const daysInMonth = new Date(ym.year, ym.month, 0).getDate();
  const firstWeekday = (new Date(ym.year, ym.month - 1, 1).getDay() + 6) % 7; // Mon=0
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${ym.year}-${p2(ym.month)}-${p2(i + 1)}`;
      return { day: i + 1, date, pence: totals.get(date) || 0 };
    }),
  ];

  const selectedRows = selected ? rows.filter((r) => r.date === selected) : [];

  const navigate = (delta) => {
    setYm((cur) => shiftMonth(cur, delta));
    setSelected(null);
  };

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Payment calendar</h3>
        <div className="payperiod__nav">
          <button type="button" className="btn btn--sm" aria-label="Previous month" onClick={() => navigate(-1)}>
            ‹
          </button>
          <span className="calendar__month">{formatMonth(monthStart)}</span>
          <button type="button" className="btn btn--sm" aria-label="Next month" onClick={() => navigate(1)}>
            ›
          </button>
        </div>
      </div>

      <div className="calendar" role="grid" aria-label={`Payments in ${formatMonth(monthStart)}`}>
        {WEEKDAYS.map((d) => (
          <span key={d} className="calendar__weekday muted" aria-hidden="true">
            {d}
          </span>
        ))}
        {cells.map((cell, i) =>
          cell === null ? (
            <span key={`pad-${i}`} className="calendar__pad" aria-hidden="true" />
          ) : (
            <button
              key={cell.date}
              type="button"
              className={`calendar__day${cell.date === fromStr ? ' calendar__day--today' : ''}${
                cell.date === selected ? ' calendar__day--selected' : ''
              }`}
              style={
                cell.pence > 0 && maxDayPence > 0
                  ? {
                      background: `color-mix(in srgb, var(--accent) ${Math.max(
                        12,
                        Math.round((cell.pence / maxDayPence) * MAX_MIX_PCT)
                      )}%, var(--surface))`,
                    }
                  : undefined
              }
              aria-label={`${formatDay(cell.date)} — ${
                cell.pence > 0 ? `${formatGBP(cell.pence)} due` : 'nothing due'
              }`}
              onClick={() => setSelected((cur) => (cur === cell.date ? null : cell.date))}
            >
              {cell.day}
            </button>
          )
        )}
      </div>

      <p className="muted calendar__total">
        <Money pence={monthTotalPence} /> committed this month
        {maxDayPence > 0 && (
          <>
            {' · '}heaviest day <Money pence={maxDayPence} />
          </>
        )}
      </p>

      {selected && (
        <div className="calendar__detail">
          {selectedRows.length === 0 ? (
            <>
              <h4 className="calendar__detail-title">{formatDay(selected)}</h4>
              <p className="muted">Nothing due this day.</p>
            </>
          ) : (
            <PaymentDayGroup dateStr={selected} rows={selectedRows} />
          )}
        </div>
      )}
    </section>
  );
}
