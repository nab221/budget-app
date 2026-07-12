import Money from '../components/Money.jsx';

/** Whole-pound label for a threshold, e.g. 5027000 → "£50,270". */
const poundsLabel = (pence) =>
  `£${Math.round(pence / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

function MiniMeter({ label, valuePence, limitPence, headroomPence, over, overText }) {
  const pct = limitPence > 0 ? Math.min(100, Math.round((valuePence / limitPence) * 100)) : 0;
  return (
    <div className={`util threshold${over ? ' threshold--over' : ''}`}>
      <div className="util__label threshold__head">
        <span>{label}</span>
        <span className="threshold__pct">{pct}%</span>
      </div>
      <div className="util__bar">
        <div className="util__fill threshold__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="muted util__label">
        {over ? (
          <span className="threshold__over">{overText}</span>
        ) : (
          <>
            ≈ <Money pence={headroomPence} /> headroom
          </>
        )}
      </span>
    </div>
  );
}

/**
 * Z6 — compact read-only mirror of the Income tab for the CURRENT tax year:
 * per person, adjusted net income, the two threshold meters, and the tax
 * split. Renders nothing when no people exist. `people` comes from
 * `gatherIncomeData` (computed at read time, like everything else).
 */
export default function IncomeTaxStrip({ income, onNavigate }) {
  const people = income?.people ?? [];
  if (people.length === 0) return null;
  const { table } = income;

  return (
    <section className="panel">
      <div className="panel__head">
        <h3 className="panel__title">Income &amp; tax — {income.taxYear}</h3>
        {onNavigate && (
          <button type="button" className="btn btn--sm" onClick={() => onNavigate('income')}>
            Open Income
          </button>
        )}
      </div>
      <div className="taxstrip">
        {people.map((p) => (
          <div className="taxstrip__person" key={p.id}>
            <div className="taxstrip__head">
              <span className="taxstrip__name">{p.name}</span>
              <span className="muted">
                ANI <Money pence={p.summary.adjustedNetIncomePence} />
              </span>
            </div>
            <MiniMeter
              label={`40% band (${poundsLabel(table.higherRateThresholdPence)})`}
              valuePence={p.summary.grossIncomePence}
              limitPence={table.higherRateThresholdPence}
              headroomPence={p.summary.headroomToHigherRatePence}
              over={p.summary.overHigherRate}
              overText="over the 40% band"
            />
            <MiniMeter
              label={`Childcare line (${poundsLabel(table.taperThresholdPence)})`}
              valuePence={p.summary.adjustedNetIncomePence}
              limitPence={table.taperThresholdPence}
              headroomPence={p.summary.headroomTo100kPence}
              over={p.summary.over100k}
              overText="over £100k — childcare support lost"
            />
            <p className="muted taxstrip__tax">
              Tax ≈ <Money pence={p.summary.totalTaxPence} /> (PAYE ≈{' '}
              <Money pence={p.summary.payeTaxPence} /> · Self Assessment ≈{' '}
              <Money pence={p.summary.selfAssessmentTaxPence} />)
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
