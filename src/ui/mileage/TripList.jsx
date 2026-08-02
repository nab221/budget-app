import Money from '../components/Money.jsx';
import { formatDay, formatPayMonth } from '../components/dates.js';
import { VEHICLE_LABELS } from '../../engine/mileage.js';
import { formatMiles } from './MileageSummary.jsx';

/** Group claim-ordered trips into `{ month, trips, miles, allowancePence }`. */
export function groupByMonth(trips) {
  const groups = [];
  for (const trip of trips) {
    const month = trip.date.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.month !== month) {
      group = { month, trips: [], miles: 0, allowancePence: 0 };
      groups.push(group);
    }
    group.trips.push(trip);
    group.miles += trip.miles;
    group.allowancePence += trip.allowancePence;
  }
  // Miles are summed as floats for display only; round off the drift.
  for (const g of groups) g.miles = Math.round(g.miles * 10) / 10;
  return groups;
}

/**
 * The tax year's trips, oldest first and grouped by month — the order the
 * claim is worked out in, so the running band position reads top to bottom.
 * A trip that straddles the 10,000-mile line is tagged with its split.
 *
 * @param {object} props.trips - priced trips from `gatherMileageData`.
 */
export default function TripList({ trips, onEdit, onDelete }) {
  const groups = groupByMonth(trips);

  return (
    <div className="mileage-trips">
      {groups.map((group) => (
        <section key={group.month} className="day-group">
          <div className="day-group__head">
            <span className="day-group__date">{formatPayMonth(group.month)}</span>
            <span className="day-group__total">
              {formatMiles(group.miles)} miles · <Money pence={group.allowancePence} />
            </span>
          </div>
          <div className="table-wrap">
            <table className="table mileage-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Purpose</th>
                  <th className="num">Miles</th>
                  <th className="num">Approved</th>
                  <th className="num">Paid</th>
                  <th className="mileage-table__actions" />
                </tr>
              </thead>
              <tbody>
                {group.trips.map((trip) => (
                  <tr key={trip.id}>
                    <td>{formatDay(trip.date)}</td>
                    <td>
                      {trip.purpose || <span className="muted">No purpose recorded</span>}
                      {trip.vehicle !== 'car' && (
                        <span className="tag">{VEHICLE_LABELS[trip.vehicle]}</span>
                      )}
                      {trip.crossesThreshold && (
                        <span className="tag tag--band">
                          {formatMiles(trip.firstBandMiles)} + {formatMiles(trip.afterBandMiles)}{' '}
                          over 10,000
                        </span>
                      )}
                    </td>
                    <td className="num">{formatMiles(trip.miles)}</td>
                    <td className="num">
                      <Money pence={trip.allowancePence} />
                    </td>
                    <td className="num">
                      {trip.reimbursedPence > 0 ? (
                        <Money pence={trip.reimbursedPence} />
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="mileage-table__actions">
                      <span className="row-actions">
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => onEdit(trip)}
                          aria-label={`Edit trip on ${formatDay(trip.date)}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn--sm"
                          onClick={() => onDelete(trip)}
                          aria-label={`Delete trip on ${formatDay(trip.date)}`}
                        >
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
