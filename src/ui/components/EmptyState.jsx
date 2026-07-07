/**
 * Small "nothing here yet" hint used across the setup screens.
 */
export default function EmptyState({ title, hint, children }) {
  return (
    <div className="empty-state">
      {title && <p className="empty-state__title">{title}</p>}
      {hint && <p className="empty-state__hint">{hint}</p>}
      {children}
    </div>
  );
}
