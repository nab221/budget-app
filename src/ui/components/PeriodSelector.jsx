const OPTIONS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

/** Week / Month / Year segmented toggle shared by Dashboard and Expenses. */
export default function PeriodSelector({ value, onChange }) {
  return (
    <div className="segmented" role="group" aria-label="Period">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`segmented__btn${value === o.value ? ' is-active' : ''}`}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
