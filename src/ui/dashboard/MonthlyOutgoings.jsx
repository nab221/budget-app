import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { monthlySeriesPence } from '../../engine/spending.js';
import { formatGBP, fromPence } from '../../engine/currency.js';
import { useChartTokens } from '../components/useChartTokens.js';
import Chart from '../components/Chart.jsx';
import Money from '../components/Money.jsx';

const MONTHS_AHEAD = 12;

// Fixed series order (matches CHART_SERIES slots — never re-ordered).
const GROUPS = [
  { key: 'billsPence', label: 'Recurring expenses' },
  { key: 'debtPence', label: 'Debt payments' },
  { key: 'childcarePence', label: 'Childcare' },
];

/**
 * Z3b — the next 12 months as stacked columns (recurring / debt / childcare),
 * so lumpy months with annual or quarterly bills stop being surprises. Ships
 * with a "view as table" toggle — the accessible fallback the palette's
 * light-mode contrast WARN requires (and what jsdom tests see).
 */
export default function MonthlyOutgoings({ data, fromStr }) {
  const [asTable, setAsTable] = useState(false);

  const series = useMemo(
    () => monthlySeriesPence(data, fromStr, MONTHS_AHEAD),
    [data, fromStr]
  );
  const usedGroups = GROUPS.filter((g) => series.some((m) => m[g.key] > 0));

  const tokens = useChartTokens();
  const chartConfig = useMemo(() => {
    return {
      data: {
        labels: series.map((m) => format(parseISO(`${m.month}-01`), 'MMM yy')),
        datasets: usedGroups.map((g, i) => ({
          label: g.label,
          data: series.map((m) => fromPence(m[g.key])),
          backgroundColor: tokens.series[GROUPS.indexOf(g)],
          // 2px surface gap between stacked segments (mark spec).
          borderColor: tokens.surface,
          borderWidth: { top: i === 0 ? 0 : 2 },
          borderSkipped: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: tokens.muted },
            border: { color: tokens.border },
          },
          y: {
            stacked: true,
            grid: { color: tokens.border },
            border: { display: false },
            ticks: {
              color: tokens.muted,
              callback: (value) => `£${Number(value).toLocaleString('en-GB')}`,
            },
          },
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: tokens.text, boxWidth: 12, boxHeight: 12 },
          },
          tooltip: {
            callbacks: {
              label: (item) =>
                `${item.dataset.label}: ${formatGBP(Math.round(item.parsed.y * 100))}`,
            },
          },
        },
      },
    };
  }, [series, usedGroups, tokens]);

  const heaviest = series.reduce((a, b) => (b.totalPence > a.totalPence ? b : a), series[0]);

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Next 12 months</h3>
        <button type="button" className="btn btn--sm" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>

      {asTable ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                {usedGroups.map((g) => (
                  <th key={g.key} className="num">
                    {g.label}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {series.map((m) => (
                <tr key={m.month}>
                  <td>{format(parseISO(`${m.month}-01`), 'MMM yyyy')}</td>
                  {usedGroups.map((g) => (
                    <td key={g.key} className="num">
                      <Money pence={m[g.key]} />
                    </td>
                  ))}
                  <td className="num">
                    <Money pence={m.totalPence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Chart
          type="bar"
          data={chartConfig.data}
          options={chartConfig.options}
          height={240}
          ariaLabel={`Committed outgoings for the next ${MONTHS_AHEAD} months, stacked by group. Use "View as table" for the figures.`}
        />
      )}

      {heaviest && heaviest.totalPence > 0 && (
        <p className="muted calendar__total">
          Heaviest month: {format(parseISO(`${heaviest.month}-01`), 'MMMM yyyy')} at{' '}
          <Money pence={heaviest.totalPence} />
        </p>
      )}
    </section>
  );
}
