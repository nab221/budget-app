/**
 * Temporary placeholder for a screen that lands in a later phase.
 * Replaced tab-by-tab as the refactor progresses.
 */
export default function Placeholder({ title, phase }) {
  return (
    <section className="placeholder">
      <h2>{title}</h2>
      <p className="placeholder__note">Coming in phase {phase}.</p>
    </section>
  );
}
