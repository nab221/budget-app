/**
 * The employments mileage can be claimed against, with the pence-per-mile each
 * one pays. Rendered as a subsection above the trip ledger; each employment
 * gets its own 10,000-mile allowance at the higher rate, which is the whole
 * reason a trip needs to know which job it was for.
 *
 * @param {Array<{ id: number, name: string, ratePencePerMile: number }>} props.employers
 */
export default function EmployerList({ employers, onAdd, onEdit, onDelete }) {
  return (
    <section className="panel mileage-employers">
      <div className="panel__head">
        <h3 className="panel__title">Employers</h3>
        <button type="button" className="btn btn--sm" onClick={onAdd}>
          Add employer
        </button>
      </div>

      {employers.length === 0 ? (
        <p className="muted">
          None yet — trips are claimed as one unnamed employment. Add employers only if
          you drive for more than one job: each gets its own 10,000 miles at the higher
          rate.
        </p>
      ) : (
        <ul className="event-list">
          {employers.map((employer) => (
            <li key={employer.id} className="event-list__row">
              <span className="event-list__note">{employer.name}</span>
              <span className="event-list__amount">
                {employer.ratePencePerMile > 0 ? (
                  `${employer.ratePencePerMile}p / mile`
                ) : (
                  <span className="muted">Pays nothing</span>
                )}
              </span>
              <span className="event-list__actions">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onEdit(employer)}
                  aria-label={`Edit employer ${employer.name}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onDelete(employer)}
                  aria-label={`Delete employer ${employer.name}`}
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
