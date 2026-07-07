import { format, parseISO } from 'date-fns';
import Money from '../components/Money.jsx';

const fmtDate = (iso) => {
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return iso;
  }
};

/**
 * The import preview table (spec §4.6). Pure presentation + per-row controls:
 * an include checkbox (defaulted off for duplicates by the parent), a category
 * select pre-filled from the suggestion, and a duplicate flag. All row state is
 * owned by the parent; this component only renders and reports changes.
 *
 * @param {object} props
 * @param {Array} props.rows - annotated rows (include, categoryId, duplicate…).
 * @param {Array} props.categories - all categories ({ id, name, kind }).
 * @param {(index:number, include:boolean)=>void} props.onToggle
 * @param {(index:number, categoryId:number|'' )=>void} props.onCategory
 */
export default function ImportPreviewTable({ rows, categories = [], onToggle, onCategory }) {
  const catsFor = (kind) =>
    categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'spending'));

  return (
    <div className="table-wrap">
      <table className="table txn-table import-table">
        <thead>
          <tr>
            <th aria-label="Include" />
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th className="num">Amount</th>
            <th>Category</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.hash + i} className={r.duplicate ? 'import-row--dup' : ''}>
              <td>
                <input
                  type="checkbox"
                  checked={!!r.include}
                  onChange={(e) => onToggle(i, e.target.checked)}
                  aria-label={`Include ${r.description || 'transaction'}`}
                />
              </td>
              <td>{fmtDate(r.date)}</td>
              <td>{r.description || <span className="muted">—</span>}</td>
              <td>
                <span className={`badge badge--${r.kind}`}>
                  {r.kind === 'income' ? 'Income' : 'Spend'}
                </span>
              </td>
              <td className="num">
                <Money pence={r.amountPence} />
              </td>
              <td>
                <select
                  className="input input--inline"
                  value={r.categoryId ?? ''}
                  onChange={(e) =>
                    onCategory(i, e.target.value === '' ? '' : Number(e.target.value))
                  }
                  aria-label={`Category for ${r.description || 'transaction'}`}
                >
                  <option value="">Uncategorised</option>
                  {catsFor(r.kind).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                {r.duplicate ? (
                  <span className="badge badge--source" title={r.duplicateReason || 'duplicate'}>
                    {r.duplicateReason || 'duplicate'}
                  </span>
                ) : (
                  <span className="muted">new</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
