export const NAV_TARGETS = Object.freeze({
  MISSION_CONTROL: "mission-control",
  OPERATIONS: "operations",
  TIMELINE: "operations.timeline",
  OPERATIONS_TIMELINE: "operations.timeline",
  FIXTURES: "operations.fixtures",
  RESOURCES: "operations.resources",
  PARKING: "operations.parking",
  OFFICIALS: "operations.officials",
  WEATHER: "operations.weather",
  RECOMMENDATIONS: "operations.recommendations",
  COMMUNICATIONS: "communications",
  ANALYTICS: "analytics",
  REPORTS: "reports",
  SETTINGS: "settings",
  VENUES: "settings.venues",
  TEAMS: "settings.teams",
  PITCHES: "settings.pitches",
  INTEGRATIONS: "settings.integrations",
});

export const NAV_TARGET_META = Object.freeze({
  [NAV_TARGETS.MISSION_CONTROL]: { page: "dashboard", label: "Mission Control" },
  [NAV_TARGETS.OPERATIONS]: { page: "operations", label: "Operations" },
  [NAV_TARGETS.TIMELINE]: { page: "operations", workspace: "timeline", dayTab: "timeline", label: "Operations Timeline" },
  [NAV_TARGETS.FIXTURES]: { page: "operations", workspace: "fixtures", card: "schedule", label: "Fixtures" },
  [NAV_TARGETS.RESOURCES]: { page: "operations", workspace: "resources", card: "pitchClosures", label: "Resources" },
  [NAV_TARGETS.PARKING]: { page: "operations", workspace: "intelligence", card: "parkingIntelligence", label: "Parking" },
  [NAV_TARGETS.OFFICIALS]: { page: "operations", workspace: "intelligence", card: "operationsHealth", label: "Officials" },
  [NAV_TARGETS.WEATHER]: { page: "operations", workspace: "intelligence", card: "weatherIntelligence", label: "Weather" },
  [NAV_TARGETS.RECOMMENDATIONS]: { page: "operations", workspace: "intelligence", card: "recommendationCentre", label: "Recommendations" },
  [NAV_TARGETS.COMMUNICATIONS]: { page: "communications", label: "Communications" },
  [NAV_TARGETS.ANALYTICS]: { page: "analytics", label: "Analytics" },
  [NAV_TARGETS.REPORTS]: { page: "reports", label: "Reports" },
  [NAV_TARGETS.SETTINGS]: { page: "settings", label: "Settings" },
  [NAV_TARGETS.VENUES]: { page: "settings", settingsTab: "venues", label: "Venue Settings" },
  [NAV_TARGETS.TEAMS]: { page: "settings", settingsTab: "teams", label: "Team Settings" },
  [NAV_TARGETS.PITCHES]: { page: "settings", settingsTab: "pitches", label: "Pitch Settings" },
  [NAV_TARGETS.INTEGRATIONS]: { page: "settings", settingsTab: "integrations", label: "Integration Settings" },
});

export function getNavigationTarget(target) {
  return NAV_TARGET_META[target] || NAV_TARGET_META[NAV_TARGETS.MISSION_CONTROL];
}
