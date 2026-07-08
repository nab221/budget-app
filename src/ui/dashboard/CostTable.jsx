import { useMemo, useState } from 'react';
import { costRows } from '../../engine/breakdown.js';
import Money from '../components/Money.jsx';
import EmptyState from '../components/EmptyState.jsx';

const FREQUENCY_LABELS = {
  weekly: 'Weekly',
  '2-weekly': 'Every 2 weeks',
  '4-weekly': 'Every 4 weeks',
  '5-weekly': 'Every 5 weeks',
  '6-weekly': 'Every 6 weeks',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  '6-monthly': 'Every 6 months',
  annual: 'Yearly',
};

const COLUMNS = [
  { key: 'label', label: 'What', numeric: false },
  { key: 'category', label: 'Category', numeric: false },
  { key: 'frequency', label: 'Every', numeric: false },
  { key: 'perOccurrencePence', label: 'Payment', numeric: true },
  { key: 'monthlyPence', label: '/ month', numeric: true },
  { key: 'annualPence', label: '/ year', numeric: true },
];

/**
 * Z4b — the "cost of everything" table: every committed outgoing with its
 * true monthly and yearly cost, sortable, defaulting to yearly cost
 * descending. This is the twice-a-year cancellation-review report.
 */
export default function CostTable({ data, categories, fromStr }) {
  const [sort, setSort] = useState({ key: 'annualPence', dir: 'desc' });

  const rows = useMemo(() => {
    const base = costRows(data, categories, fromStr);
    const { key, dir } = sort;
    const mul = dir === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string') return mul * av.localeCompare(bv);
      return mul * (av - bv);
    });
  }, [data, categories, fromStr, sort]);

  const toggleSort = (key, numeric) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: numeric ? 'desc' : 'asc' }
    );

  return (
    <section className="panel">
      <h3 className="panel__title">What everything costs</h3>
      {rows.length === 0 ? (
        <EmptyState hint="Nothing committed yet — expenses and debts appear here with their true yearly cost." />
      ) : (
        <div className="table-wrap">
          <table className="table cost-table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={col.numeric ? 'num' : undefined}
                    aria-sort={
                      sort.key === col.key
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      className="cost-table__sort"
                      onClick={() => toggleSort(col.key, col.numeric)}
                    >
                      {col.label}
                      {sort.key === col.key && (
                        <span aria-hidden="true"> {sort.dir === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td className="muted">{r.category}</td>
                  <td className="muted">{FREQUENCY_LABELS[r.frequency] ?? r.frequency}</td>
                  <td className="num">
                    <Money pence={r.perOccurrencePence} />
                  </td>
                  <td className="num">
                    <Money pence={r.monthlyPence} />
                  </td>
                  <td className="num">
                    <Money pence={r.annualPence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
