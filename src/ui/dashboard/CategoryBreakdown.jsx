import { useState } from 'react';
import { categoryBreakdown } from '../../engine/breakdown.js';
import Money from '../components/Money.jsx';
import PeriodSelector from '../components/PeriodSelector.jsx';
import EmptyState from '../components/EmptyState.jsx';

const VIEW_OPTIONS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

/**
 * Z4a — "where it goes": one horizontal bar per category (normalised
 * long-run cost), single hue, direct-labelled with the amount and share.
 * Magnitude is the job here, so no categorical palette — the name on each
 * row carries identity (dashboard plan §5).
 */
export default function CategoryBreakdown({ data, categories, fromStr }) {
  const [view, setView] = useState('month');
  const { rows, totalAnnualPence } = categoryBreakdown(data, categories, fromStr);

  const maxAnnual = rows.length > 0 ? rows[0].annualPence : 0;
  const valueOf = (r) => (view === 'year' ? r.annualPence : r.monthlyPence);

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Where it goes</h3>
        <PeriodSelector value={view} onChange={setView} options={VIEW_OPTIONS} label="Breakdown period" />
      </div>
      {rows.length === 0 ? (
        <EmptyState hint="Add recurring expenses and debts on the Expenses tab to see the breakdown." />
      ) : (
        <>
          <ul className="catbar-list">
            {rows.map((r) => (
              <li key={r.name} className="catbar">
                <div className="catbar__head">
                  <span className="catbar__name">{r.name}</span>
                  <span className="catbar__value">
                    <Money pence={valueOf(r)} />
                    <span className="muted catbar__share">
                      {' '}
                      {Math.round(r.shareOfTotal * 100)}%
                    </span>
                  </span>
                </div>
                <div className="catbar__track" aria-hidden="true">
                  <div
                    className="catbar__fill"
                    style={{ width: `${maxAnnual > 0 ? (r.annualPence / maxAnnual) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="muted catbar-total">
            Committed spending ≈{' '}
            <Money pence={view === 'year' ? totalAnnualPence : Math.round(totalAnnualPence / 12)} />{' '}
            / {view === 'year' ? 'year' : 'month'} (long-run average; weekly expenses ≈ ×4.35 a month).
          </p>
        </>
      )}
    </section>
  );
}
