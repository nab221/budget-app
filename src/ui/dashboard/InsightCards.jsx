const TAB_LABELS = {
  expenses: 'Review on Expenses',
  payoff: 'Open Payoff planner',
  settings: 'Open Settings',
  income: 'Open Income',
  childcare: 'Open Childcare',
};

const MAX_CARDS = 4;

/**
 * Z2 — insight cards. Renders the top few cards from `buildInsights`, most
 * severe first, and renders NOTHING when there is nothing worth saying (no
 * "all good" filler — the dashboard plan is explicit about this).
 */
export default function InsightCards({ cards, onNavigate }) {
  if (!cards || cards.length === 0) return null;
  return (
    <section aria-label="Insights" className="insight-list">
      {cards.slice(0, MAX_CARDS).map((card) => (
        <article key={card.id} className={`insight insight--${card.severity}`}>
          <div className="insight__text">
            <h4 className="insight__title">{card.title}</h4>
            <p className="insight__body">{card.body}</p>
          </div>
          {card.tab && onNavigate && (
            <button
              type="button"
              className="btn btn--sm insight__action"
              onClick={() => onNavigate(card.tab)}
            >
              {TAB_LABELS[card.tab] ?? 'Open'}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
