import Money from '../components/Money.jsx';
import { formatDay } from '../components/dates.js';

/**
 * The company year's dividends from both people, newest first. These are the
 * Income tab's dividend events; editing or deleting here changes them there.
 *
 * @param {Array<object>} props.events - pence-domain rows from `gatherCompanyData`
 *   (each carries `personName`).
 */
export default function DividendLedger({ events, onEdit, onDelete }) {
  return (
    <section className="company-ledger">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Person</th>
              <th>Note</th>
              <th className="num">Dividend</th>
              <th className="company-ledger__actions">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td>{formatDay(ev.date)}</td>
                <td>{ev.personName ?? <span className="muted">Unknown person</span>}</td>
                <td>{ev.note || <span className="muted">—</span>}</td>
                <td className="num">
                  <Money pence={ev.amountPence} />
                </td>
                <td className="company-ledger__actions">
                  <button type="button" className="btn btn--sm" onClick={() => onEdit(ev)}>
                    Edit
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn--sm btn--danger"
                    onClick={() => onDelete(ev)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
