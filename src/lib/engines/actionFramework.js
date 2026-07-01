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
  return [...actions].sort((a, b) => {
    const priorityDiff = Number(b.priority || 0) - Number(a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

export function getActionTarget(domain) {
  return ACTION_TARGETS[domain] || ACTION_TARGETS.fixtures;
}

export { ACTION_TARGETS };
