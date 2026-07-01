import { NAV_TARGETS, getNavigationTarget } from "./navigationTargets.js";

function safeCall(fn, ...args) {
  if (typeof fn === "function") fn(...args);
}

export function createNavigationController({
  setMainPage,
  setDayTab,
  setSettingsTab,
  setNavigationTarget,
} = {}) {
  const goTo = (target, options = {}) => {
    const meta = getNavigationTarget(target);
    const day = options.day || meta.day || null;

    safeCall(setMainPage, meta.page);
    if (day === "saturday" || day === "sunday") safeCall(setDayTab, day);
    if (meta.settingsTab) safeCall(setSettingsTab, meta.settingsTab);

    safeCall(setNavigationTarget, {
      target,
      page: meta.page,
      day,
      workspace: options.workspace || meta.workspace,
      card: options.card || meta.card,
      settingsTab: options.settingsTab || meta.settingsTab,
      scroll: options.scroll !== false,
      highlight: options.highlight !== false,
      createdAt: Date.now(),
    });

    return meta;
  };

  return {
    goTo,
    goToMissionControl: () => goTo(NAV_TARGETS.MISSION_CONTROL),
    goToOperations: (options) => goTo(NAV_TARGETS.OPERATIONS, options),
    goToFixtures: (options) => goTo(NAV_TARGETS.FIXTURES, options),
    goToResources: (options) => goTo(NAV_TARGETS.RESOURCES, options),
    goToParking: (options) => goTo(NAV_TARGETS.PARKING, options),
    goToOfficials: (options) => goTo(NAV_TARGETS.OFFICIALS, options),
    goToWeather: (options) => goTo(NAV_TARGETS.WEATHER, options),
    goToRecommendations: (options) => goTo(NAV_TARGETS.RECOMMENDATIONS, options),
    goToCommunications: () => goTo(NAV_TARGETS.COMMUNICATIONS),
    goToAnalytics: () => goTo(NAV_TARGETS.ANALYTICS),
    goToReports: () => goTo(NAV_TARGETS.REPORTS),
    goToSettings: (options) => goTo(NAV_TARGETS.SETTINGS, options),
    goToVenues: () => goTo(NAV_TARGETS.VENUES),
    goToTeams: () => goTo(NAV_TARGETS.TEAMS),
    goToPitches: () => goTo(NAV_TARGETS.PITCHES),
    goToIntegrations: () => goTo(NAV_TARGETS.INTEGRATIONS),
  };
}
