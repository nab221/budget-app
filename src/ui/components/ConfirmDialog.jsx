/**
 * Minimal modal confirm dialog. No portal, no dependency — a fixed overlay
 * rendered only when `open` is true.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <div className="dialog__overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog">
        {title && <h3 className="dialog__title">{title}</h3>}
        {message && <div className="dialog__body">{message}</div>}
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
