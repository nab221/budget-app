import { scheduleCsv } from '../../engine/reports.js';

/**
 * Z7 — reports: print the Monthly Money Report (browser print → PDF) and
 * download the next 12 months of computed occurrences as CSV. Both computed
 * at read time; nothing persisted.
 */
export default function ReportsPanel({ data, fromStr, onPrint }) {
  const downloadCsv = () => {
    const csv = scheduleCsv(data, data.categories, fromStr, 12);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `payment-schedule-${fromStr}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel">
      <h3 className="panel__title">Reports</h3>
      <div className="reports__actions">
        <button type="button" className="btn" onClick={onPrint}>
          Print Monthly Money Report
        </button>
        <button type="button" className="btn" onClick={downloadCsv}>
          Download 12-month schedule (CSV)
        </button>
      </div>
      <p className="muted reports__hint">
        The report is a one-page print view of everything above (print to PDF from the browser
        dialog). The CSV lists every computed payment for the next 12 months — for your own
        analysis in Numbers or Excel.
      </p>
    </section>
  );
}
