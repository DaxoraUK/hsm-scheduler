import { normalisePlatformStatus } from "./statusSystem.js";

const ACTION_TARGETS = {
  parking: { workspace: "intelligence", card: "parkingIntelligence", label: "Review parking" },
  officials: { workspace: "intelligence", card: "operationsHealth", label: "Review officials" },
  fixtures: { workspace: "fixtures", card: "schedule", label: "Open schedule" },
  unresolved: { workspace: "fixtures", card: "unresolved", label: "Resolve fixtures" },
  pitchClosures: { workspace: "resources", card: "pitchClosures", label: "Review pitches" },
  resources: { workspace: "resources", card: "pitchAssignments", label: "Review resources" },
  weather: { workspace: "intelligence", card: "weatherIntelligence", label: "Review weather" },
  competitionRules: { workspace: "fixtures", card: "competitionRules", label: "Review rules" },
  communications: { workspace: "communications", card: "coachMessages", label: "Prepare messages" },
  optimiser: { workspace: "intelligence", card: "dayOptimiser", label: "Review optimiser" },
};

const DOMAIN_ALIASES = Object.freeze({
  rules: "competitionRules",
  pitches: "resources",
  flow: "fixtures",
});

const SEVERITY_WEIGHT = Object.freeze({
  critical: 4,
  attention: 3,
  watch: 2,
  healthy: 1,
});

export function canonicalActionDomain(domain = "fixtures") {
  return DOMAIN_ALIASES[domain] || domain;
}

export function getActionIdentity(action = {}) {
  const explicit = action.dedupeKey || action.metadata?.dedupeKey;
  if (explicit) return String(explicit);
  return `${canonicalActionDomain(action.domain)}:${action.id || createId("action", action.title || action.label || action.type)}`;
}

function actionSeverityWeight(action = {}) {
  return SEVERITY_WEIGHT[normalisePlatformStatus(action.severity || action.status).key] || 0;
}

function mergeActionPair(current, candidate) {
  const preferred = actionSeverityWeight(candidate) > actionSeverityWeight(current) ? candidate : current;
  const supplementary = preferred === candidate ? current : candidate;
  return {
    ...supplementary,
    ...preferred,
    metric: preferred.metric || supplementary.metric,
    guidance: preferred.guidance || supplementary.guidance,
    description: preferred.description || supplementary.description,
    detail: preferred.detail || supplementary.detail,
    metadata: { ...supplementary.metadata, ...preferred.metadata },
    sources: [...new Set([...(current.sources || [current.source]).filter(Boolean), ...(candidate.sources || [candidate.source]).filter(Boolean)])],
  };
}

export function dedupeActions(actions = []) {
  const unique = new Map();
  actions.filter(Boolean).forEach((action) => {
    const identity = getActionIdentity(action);
    unique.set(identity, unique.has(identity) ? mergeActionPair(unique.get(identity), action) : action);
  });
  return [...unique.values()];
}

function createId(prefix, value) {
  return `${prefix}-${String(value || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function createRecommendationAction({
  id,
  type = "review",
  domain = "fixtures",
  title,
  label,
  description,
  severity = "watch",
  priority = 50,
  target,
  dedupeKey,
  metadata = {},
} = {}) {
  const status = normalisePlatformStatus(severity);
  const targetConfig = target || ACTION_TARGETS[domain] || ACTION_TARGETS.fixtures;

  return {
    id: id || createId(domain, title || type),
    type,
    domain,
    title: title || label || targetConfig.label,
    label: label || targetConfig.label,
    description: description || "Review this operational item.",
    severity: status.key,
    status: status.legacyStatus,
    statusLabel: status.label,
    priority,
    dedupeKey,
    target: targetConfig,
    metadata,
  };
}

export function createReviewAction(domain, overrides = {}) {
  return createRecommendationAction({
    domain,
    type: "review",
    ...overrides,
  });
}

export function sortActionsByPriority(actions = []) {
  return dedupeActions(actions).sort((a, b) => {
    const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

export const createPlatformAction = createRecommendationAction;

export function buildActionSummary(actions = []) {
  const sorted = sortActionsByPriority(actions);
  return { actions: sorted, items: sorted, nextAction: sorted[0] || null };
}

export function getActionTarget(domain) {
  return ACTION_TARGETS[domain] || ACTION_TARGETS.fixtures;
}

export { ACTION_TARGETS };
