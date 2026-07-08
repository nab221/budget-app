import { useMemo, useState } from 'react';
import { differenceInCalendarMonths, format, parseISO } from 'date-fns';
import { payoffBalanceSeries, actualDebtPoints, debtFreeProjection } from '../../engine/payoff.js';
import { formatGBP, fromPence } from '../../engine/currency.js';
import { chartTokens } from '../theme.js';
import Chart from '../components/Chart.jsx';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';

// Past this horizon the line is wallpaper — truncate and say so.
const MAX_CHART_MONTHS = 121; // start + 10 years

/**
 * Z5a — the payoff projection: total debt balance by month under the chosen
 * strategy (accent) vs minimums-only (de-emphasis gray) — the gap is what the
 * extra payments buy. Actual balance-update observations from the
 * `balanceUpdates` log overlay as dots (plan §7). Emphasis form: one hue +
 * gray, single axis.
 */
export default function PayoffProjection({ data, balanceUpdates, fromStr, onNavigate }) {
  const [asTable, setAsTable] = useState(false);

  const strategy = data.payoffStrategy === 'snowball' ? 'snowball' : 'avalanche';
  const extraPence = data.payoffExtraPence || 0;

  const fullSeries = useMemo(
    () => payoffBalanceSeries(data.debts, strategy, extraPence, fromStr),
    [data.debts, strategy, extraPence, fromStr]
  );
  const truncated = fullSeries.length > MAX_CHART_MONTHS;
  const series = truncated ? fullSeries.slice(0, MAX_CHART_MONTHS) : fullSeries;

  const projection = useMemo(
    () => debtFreeProjection(data.debts, strategy, extraPence, fromStr),
    [data.debts, strategy, extraPence, fromStr]
  );

  const actuals = useMemo(
    () => actualDebtPoints(balanceUpdates, data.debts),
    [balanceUpdates, data.debts]
  );

  const chartConfig = useMemo(() => {
    if (series.length === 0) return null;
    const tokens = chartTokens();
    const startMonth = parseISO(`${series[0].month}-01`);
    // Actual observations mapped onto the month axis (category scale → index).
    const actualByIndex = new Array(series.length).fill(null);
    for (const pt of actuals) {
      const idx = differenceInCalendarMonths(parseISO(pt.date), startMonth);
      if (idx >= 0 && idx < series.length) actualByIndex[idx] = fromPence(pt.totalPence);
    }
    return {
      data: {
        labels: series.map((m) => format(parseISO(`${m.month}-01`), 'MMM yy')),
        datasets: [
          {
            label: `${strategy === 'snowball' ? 'Snowball' : 'Avalanche'}${extraPence > 0 ? ' + extra' : ''} (your plan)`,
            data: series.map((m) => fromPence(m.chosenPence)),
            borderColor: tokens.series[0],
            backgroundColor: tokens.series[0],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.15,
          },
          {
            label: 'Minimums only',
            data: series.map((m) => fromPence(m.minimumsPence)),
            borderColor: tokens.muted,
            backgroundColor: tokens.muted,
            borderWidth: 2,
            borderDash: [5, 4],
            pointRadius: 0,
            tension: 0.15,
          },
          ...(actuals.length > 0
            ? [
                {
                  label: 'Actual (your balance updates)',
                  data: actualByIndex,
                  type: 'line',
                  showLine: false,
                  pointRadius: 4,
                  pointHoverRadius: 6,
                  borderColor: tokens.text,
                  backgroundColor: tokens.text,
                  // 2px surface ring so dots read on top of the lines.
                  pointBorderColor: tokens.surface,
                  pointBorderWidth: 2,
                },
              ]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: tokens.muted, maxTicksLimit: 13 },
            border: { color: tokens.border },
          },
          y: {
            beginAtZero: true,
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
                item.parsed.y == null
                  ? null
                  : `${item.dataset.label}: ${formatGBP(Math.round(item.parsed.y * 100))}`,
            },
          },
        },
      },
    };
  }, [series, actuals, strategy, extraPence]);

  if (series.length === 0) {
    return (
      <section className="panel">
        <h3 className="panel__title">Payoff projection</h3>
        <EmptyState hint="Add a credit card or loan on the Expenses tab to see the payoff path." />
      </section>
    );
  }

  // Table view: yearly rows keep it readable (12-month steps + the last month).
  const tableRows = series.filter((_, i) => i % 12 === 0 || i === series.length - 1);

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Payoff projection</h3>
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
                <th className="num">Your plan</th>
                <th className="num">Minimums only</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((m) => (
                <tr key={m.month}>
                  <td>{format(parseISO(`${m.month}-01`), 'MMM yyyy')}</td>
                  <td className="num">
                    <Money pence={m.chosenPence} />
                  </td>
                  <td className="num">
                    <Money pence={m.minimumsPence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Chart
          type="line"
          data={chartConfig.data}
          options={chartConfig.options}
          height={260}
          ariaLabel="Projected total debt by month: your plan vs minimums only. Use “View as table” for the figures."
        />
      )}

      <p className="muted calendar__total">
        {projection.neverClears ? (
          <span className="stat__sub--warn">
            The current payments never clear the balance — review the plan.
          </span>
        ) : (
          <>
            Debt-free {format(parseISO(`${projection.clearMonth}-01`), 'MMMM yyyy')} on this plan
            {truncated && ' (chart truncated at 10 years)'}
            {' · '}projected interest <Money pence={projection.totalInterestPence} />
          </>
        )}
        {onNavigate && (
          <>
            {' · '}
            <button type="button" className="linkbtn" onClick={() => onNavigate('payoff')}>
              change the plan
            </button>
          </>
        )}
      </p>
      {actuals.length === 0 && (
        <p className="muted calendar__total">
          Balance updates you enter will appear here as dots — actual vs plan.
        </p>
      )}
    </section>
  );
}
