import { recommendationCopy } from './recommendationCopy.js';

/**
 * The directive centrepiece of the dashboard (spec §4.1): reads instantly as
 * "Safe to pay extra: £X — pay it onto <debt>", or the plain-language no-spare /
 * needs-balance / debt-free variants. Copy comes from the pure
 * `recommendationCopy` helper; this component only styles it.
 */
export default function RecommendationCard({ plan }) {
  const { tone, title, detail } = recommendationCopy(plan);
  return (
    <div className={`reco-card reco-card--${tone}`} role="status">
      <p className="reco-card__title">{title}</p>
      <p className="reco-card__detail">{detail}</p>
    </div>
  );
}
