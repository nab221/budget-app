import Money from '../components/Money.jsx';
import { MARGINAL_RATES, VEHICLE_LABELS } from '../../engine/mileage.js';

/** A mile count for display: thousands separated, one decimal only when needed. */
export function formatMiles(miles) {
  const n = Number(miles) || 0;
  return n.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/** "45p" / "25p" for a rate table entry. */
const rateLabel = (pence) => `${pence}p`;

/**
 * The 45p-band meter for cars and vans: how much of the 10,000-mile allowance
 * at the higher rate has been used this tax year, and what is left.
 */
function BandMeter({ entry }) {
  const { thresholdMiles, miles, milesToThreshold, overThreshold, rate } = entry;
  const pct = Math.min(100, Math.round((miles / thresholdMiles) * 100));
  return (
    <div className={`util threshold${overThreshold ? ' threshold--over' : ''}`}>
      <div className="util__label threshold__head">
        <span>
          {formatMiles(thresholdMiles)} miles at {rateLabel(rate.firstRatePence)} —{' '}
          {VEHICLE_LABELS[entry.vehicle].toLowerCase()}
        </span>
        <span className="threshold__pct">{pct}%</span>
      </div>
      <div className="util__bar">
        <div className="util__fill threshold__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="util__label">
        {overThreshold ? (
          <span className="threshold__over">
            Past {formatMiles(thresholdMiles)} miles — further miles are worth{' '}
            {rateLabel(rate.afterRatePence)} each ({formatMiles(entry.afterBandMiles)} so far).
          </span>
        ) : (
          <span>
            {formatMiles(milesToThreshold)} miles left at {rateLabel(rate.firstRatePence)}, then{' '}
            {rateLabel(rate.afterRatePence)}.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The tax-year headline for the Mileage tab: miles driven, what HMRC's
 * approved rates make that worth, what the employer already paid, and the
 * claim left over — plus what the claim is worth as a refund at the chosen
 * marginal rate. Everything is computed at read time by `gatherMileageData`.
 *
 * @param {object} props.data - the `gatherMileageData` snapshot.
 * @param {(rate: number) => void} props.onMarginalRateChange
 * @param {(pencePerMile: number) => void} props.onEmployerRateChange
 */
export default function MileageSummary({ data, onMarginalRateChange, onEmployerRateChange }) {
  const { totals, byVehicle, reliefPence, marginalRate, employerRatePence, route } = data;
  const carLike = byVehicle.filter((v) => v.thresholdMiles != null);
  const ratePct = Math.round((marginalRate || 0) * 100);

  return (
    <section className="panel mileage-summary">
      <div className="kpi-row">
        <div className="stat">
          <span className="stat__label">Business miles</span>
          <span className="stat__value">{formatMiles(totals.miles)}</span>
          <span className="stat__sub muted">
            {totals.tripCount} {totals.tripCount === 1 ? 'trip' : 'trips'}
          </span>
        </div>
        <div className="stat">
          <span className="stat__label">Approved amount</span>
          <span className="stat__value">
            <Money pence={totals.allowancePence} />
          </span>
          <span className="stat__sub muted">HMRC approved rates</span>
        </div>
        <div className="stat">
          <span className="stat__label">Paid by employer</span>
          <span className="stat__value">
            <Money pence={totals.reimbursedPence} />
          </span>
          <span className="stat__sub muted">Mileage already reimbursed</span>
        </div>
        <div className="stat">
          <span className="stat__label">Claim from HMRC</span>
          <span className="stat__value">
            <Money pence={totals.shortfallPence} />
          </span>
          <span className="stat__sub muted">
            ≈ <Money pence={reliefPence} /> back at {ratePct}%
          </span>
        </div>
      </div>

      {carLike.map((entry) => (
        <BandMeter key={entry.vehicle} entry={entry} />
      ))}

      {totals.excessPence > 0 && (
        <p className="banner banner--warn">
          Your employer paid <Money pence={totals.excessPence} /> more than the approved
          amount. The excess counts as taxable pay rather than something to claim.
        </p>
      )}

      {totals.shortfallPence > 0 && (
        <p className="mileage-summary__route muted">
          {route === 'self-assessment'
            ? 'Over £2,500 of expenses in one tax year — this goes on a Self Assessment return, not a P87.'
            : 'Under £2,500 of expenses — this can go in on a P87 claim.'}
        </p>
      )}

      {byVehicle.length > 0 && (
        <div className="table-wrap">
          <table className="table mileage-breakdown">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th className="num">Miles</th>
                <th className="num">Higher rate</th>
                <th className="num">Lower rate</th>
                <th className="num">Approved</th>
                <th className="num">Paid</th>
                <th className="num">Claim</th>
              </tr>
            </thead>
            <tbody>
              {byVehicle.map((v) => (
                <tr key={v.vehicle}>
                  <td>{VEHICLE_LABELS[v.vehicle]}</td>
                  <td className="num">{formatMiles(v.miles)}</td>
                  <td className="num">
                    {formatMiles(v.firstBandMiles)} @ {rateLabel(v.rate.firstRatePence)}
                  </td>
                  <td className="num">
                    {v.thresholdMiles == null
                      ? '—'
                      : `${formatMiles(v.afterBandMiles)} @ ${rateLabel(v.rate.afterRatePence)}`}
                  </td>
                  <td className="num">
                    <Money pence={v.allowancePence} />
                  </td>
                  <td className="num">
                    <Money pence={v.reimbursedPence} />
                  </td>
                  <td className="num">
                    {v.excessPence > 0 ? (
                      <span className="muted">
                        −<Money pence={v.excessPence} />
                      </span>
                    ) : (
                      <Money pence={v.shortfallPence} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="form-row mileage-summary__rates">
        <div className="field">
          <label htmlFor="mileage-employer-rate">Employer pays (p per mile)</label>
          <input
            id="mileage-employer-rate"
            className="input input--sm"
            type="number"
            min="0"
            step="1"
            value={employerRatePence}
            onChange={(e) => onEmployerRateChange(e.target.value)}
          />
          <span className="field__hint">Used to pre-fill each new trip. 0 if unpaid.</span>
        </div>
        <div className="field">
          <label htmlFor="mileage-marginal-rate">Your tax rate</label>
          <select
            id="mileage-marginal-rate"
            className="input input--sm"
            value={marginalRate}
            onChange={(e) => onMarginalRateChange(Number(e.target.value))}
          >
            {MARGINAL_RATES.map((r) => (
              <option key={r.rate} value={r.rate}>
                {r.label}
              </option>
            ))}
          </select>
          <span className="field__hint">Sets what the claim is worth as a refund.</span>
        </div>
      </div>
    </section>
  );
}
