import { useState } from 'react';
import EventForm from '../income/EventForm.jsx';

/**
 * Record or edit a dividend from the Company tab: a person picker wrapped
 * around the Income tab's dividend event form, so the row written is the
 * same `incomeEvents` row the Income tab shows. Money is pounds at the
 * repository edge, as everywhere else. Rendered inside a Modal.
 *
 * @param {object} props
 * @param {Array<{ id: number, name: string }>} props.people
 * @param {number} [props.initialPersonId] - preselected person (defaults to the first).
 * @param {object} [props.initial] - existing event row (pounds) when editing.
 * @param {(payload: { personId, date, kind, amountPence, note }) => Promise<void>} props.onSubmit
 */
export default function DividendForm({ people, initialPersonId, initial, onSubmit, onCancel }) {
  const [personId, setPersonId] = useState(
    () => initial?.personId ?? initialPersonId ?? people[0]?.id ?? null
  );

  return (
    <div className="form">
      <div className="form-row">
        <div className="field">
          <label htmlFor="company-dividend-person">Person</label>
          <select
            id="company-dividend-person"
            className="input"
            value={personId ?? ''}
            onChange={(e) => setPersonId(Number(e.target.value))}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <EventForm
        kind="dividend"
        initial={initial}
        onSubmit={(payload) => onSubmit({ ...payload, personId })}
        onCancel={onCancel}
      />
    </div>
  );
}
