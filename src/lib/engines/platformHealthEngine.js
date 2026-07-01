import { getPlatformStatusFromScore } from "./statusSystem.js";

const DEFAULT_WEIGHTS = {
  fixtures: 20,
  pitches: 15,
  officials: 20,
  parking: 20,
  communications: 10,
  weather: 5,
  configuration: 10,
};

function clamp(value, fallback = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, number));
}

export function calculatePlatformHealth({ operationsHealth = {}, recommendationCentre = {}, weights = DEFAULT_WEIGHTS } = {}) {
  const domains = operationsHealth.domains || [];
  const weighted = domains.reduce((acc, domain) => {
    const weight = Number(weights[domain.id] || 10);
    return {
      score: acc.score + clamp(domain.score) * weight,
      weight: acc.weight + weight,
    };
  }, { score: 0, weight: 0 });

  let score = weighted.weight ? Math.round(weighted.score / weighted.weight) : clamp(operationsHealth.score, 100);
  const criticalRecommendations = Number(recommendationCentre.metrics?.critical || 0);
  const attentionRecommendations = Number(recommendationCentre.metrics?.attention || 0);

  if (criticalRecommendations > 0) score = Math.min(score, 55);
  if (attentionRecommendations > 0) score = Math.min(score, 75);

  const status = getPlatformStatusFromScore(score, {
    hasCritical: criticalRecommendations > 0,
    hasAttention: attentionRecommendations > 0,
  });

  return {
    score,
    status: status.legacyStatus,
    statusKey: status.key,
    label: status.label,
    summary: criticalRecommendations > 0
      ? "Critical matchday issues need action."
      : attentionRecommendations > 0
        ? "Some operational areas need attention."
        : "Platform health is stable.",
    weights,
    domains,
    recommendationCentre,
  };
}

export default calculatePlatformHealth;
