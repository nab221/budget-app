// src/ui/expenses/SortHeader.jsx
/**
 * One sortable table header: a button that reports its column to the parent,
 * an arrow for the active column, and `aria-sort` for assistive tech.
 * First click on a column sorts ascending, the next flips (see `toggleSort`).
 */
export default function SortHeader({ column, label, sort, onSort, numeric = false }) {
  const active = sort.key === column;
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th className={numeric ? 'num' : undefined} aria-sort={ariaSort}>
      <button
        type="button"
        className={`sort-btn${active ? ' is-active' : ''}`}
        onClick={() => onSort(column)}
      >
        {label}
        <span className="sort-btn__arrow" aria-hidden="true">
          {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  );
}
