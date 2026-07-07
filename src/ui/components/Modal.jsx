import { useEffect, useRef } from 'react';

/**
 * Minimal modal wrapper. Renders a centred panel over a dim backdrop; closes
 * on Escape and backdrop click. No portal, no dependency — mounted only while
 * shown (the caller conditionally renders it). Reuses the `.dialog__overlay`
 * pattern shared with ConfirmDialog and the Add chooser; `--form` widens the
 * panel and lets a tall form body scroll.
 */
export default function Modal({ title, onClose, children }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Move focus into the panel so keyboard users leave the background trigger.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className="dialog__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog dialog--form" ref={panelRef} tabIndex={-1}>
        <div className="dialog__head">
          {title && <h3 className="dialog__title">{title}</h3>}
          <button
            type="button"
            className="dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="dialog__scroll">{children}</div>
      </div>
    </div>
  );
}
