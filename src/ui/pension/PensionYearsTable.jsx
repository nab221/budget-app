// src/ui/pension/PensionYearsTable.jsx
import Money from '../components/Money.jsx';

const SOURCE_LABEL = { entered: 'entered', estimate: 'estimate', none: 'none' };

/**
 * The four-year window: allowance, pension input amount (with its source),
 * SIPP gross, used, unused / carry-forward, and an Edit per year. Public
 * constants (the allowance) are plain text; the owner's figures go through
 * <Money> so the privacy blur applies.
 *
 * @param {Array<object>} props.years - `entry.years` from the pension engine, oldest first.
 * @param {(year: object) => void} props.onEditYear
 */
export default function PensionYearsTable({ years, onEditYear }) {
  return (
    <div className="table-wrap">
      <table className="table pension-years">
        <thead>
          <tr>
            <th>Tax year</th>
            <th className="num">Allowance</th>
            <th className="num">Pension input</th>
            <th>Source</th>
            <th className="num">SIPP gross</th>
            <th className="num">Used</th>
            <th className="num">Unused</th>
            <th>Note</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y.taxYear} className={y.piaSource === 'none' ? 'is-inactive' : ''}>
              <td>{y.taxYear}</td>
              <td className="num">
                <Money pence={y.allowancePence} />
                {!y.allowanceFromTable && <span className="muted"> *</span>}
              </td>
              <td className="num">{y.piaPence == null ? <span className="muted">—</span> : <Money pence={y.piaPence} />}</td>
              <td>
                <span className={`badge badge--pension-${y.piaSource}`}>{SOURCE_LABEL[y.piaSource]}</span>
              </td>
              <td className="num">
                <Money pence={y.sippGrossPence} />
              </td>
              <td className="num">
                <Money pence={y.usedPence} />
              </td>
              <td className="num">
                <Money pence={y.unusedPence} />
                {y.carriedPence > 0 && (
                  <span className="muted">
                    {' '}
                    (−<Money pence={y.carriedPence} /> used this year)
                  </span>
                )}
              </td>
              <td className="muted">{y.note || ''}</td>
              <td className="pension-years__actions">
                <button type="button" className="btn btn--sm" onClick={() => onEditYear(y)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
