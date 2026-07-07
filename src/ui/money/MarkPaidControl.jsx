import { useState } from 'react';
import CurrencyInput from '../components/CurrencyInput.jsx';

/**
 * Small inline "confirm this bill is paid" control. Shows the occurrence date
 * and an editable amount (defaulting to the planned amount, in POUNDS), with
 * Confirm / Cancel. Reused by the recurring-bills list and the pay-period
 * timeline so the confirm affordance behaves identically in both places.
 *
 * @param {string} props.label
 * @param {string} props.occurrenceDate - ISO yyyy-MM-dd being confirmed.
 * @param {number} props.defaultAmountPounds - planned amount in pounds.
 * @param {(amountPounds:number)=>void} props.onConfirm
 * @param {()=>void} props.onCancel
 */
export default function MarkPaidControl({
  label,
  occurrenceDate,
  defaultAmountPounds,
  onConfirm,
  onCancel,
}) {
  const [amount, setAmount] = useState(defaultAmountPounds);

  return (
    <span className="markpaid" role="group" aria-label={`Mark ${label || 'bill'} paid`}>
      <span className="markpaid__date muted">{occurrenceDate}</span>
      <CurrencyInput value={amount} onChange={setAmount} />
      <button
        type="button"
        className="btn btn--sm btn--primary"
        onClick={() => onConfirm(amount == null || amount === '' ? defaultAmountPounds : amount)}
      >
        Confirm
      </button>
      <button type="button" className="btn btn--sm" onClick={onCancel}>
        Cancel
      </button>
    </span>
  );
}
