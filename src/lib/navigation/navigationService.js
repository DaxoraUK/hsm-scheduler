import { NAV_TARGETS, getNavigationTarget } from "./navigationTargets.js";

function safeCall(fn, ...args) {
  if (typeof fn === "function") fn(...args);
}

function resetWindowScroll() {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

export function resolveSearchNavigation(query = "") {
  const q = String(query).trim().toLowerCase();

  if (!q) return null;
  if (q.includes("sun") || q.includes("sunday")) return { target: NAV_TARGETS.FIXTURES, options: { day: "sunday", card: "actionBar" } };
  if (q.includes("sat") || q.includes("fixture") || q.includes("schedule") || q.includes("pitch")) return { target: NAV_TARGETS.FIXTURES, options: { day: "saturday", card: "actionBar" } };
  if (q.includes("message") || q.includes("coach") || q.includes("whatsapp")) return { target: NAV_TARGETS.COMMUNICATIONS, options: {} };
  if (q.includes("analytics") || q.includes("stats")) return { target: NAV_TARGETS.ANALYTICS, options: {} };
  if (q.includes("report") || q.includes("pdf") || q.includes("print")) return { target: NAV_TARGETS.REPORTS, options: {} };
  if (q.includes("setting") || q.includes("team") || q.includes("ref")) return { target: NAV_TARGETS.SETTINGS, options: {} };

  return null;
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
    const card = Object.prototype.hasOwnProperty.call(options, "card") ? options.card : meta.card;
    const workspace = Object.prototype.hasOwnProperty.call(options, "workspace") ? options.workspace : meta.workspace;
    const shouldScrollToSection = options.scrollToSection === true || Boolean(card || workspace);

    safeCall(setMainPage, meta.page);
    if (day === "saturday" || day === "sunday") safeCall(setDayTab, day);
    if (meta.settingsTab) safeCall(setSettingsTab, meta.settingsTab);

    if (!shouldScrollToSection) {
      safeCall(setNavigationTarget, null);
      resetWindowScroll();
      return meta;
    }

    safeCall(setNavigationTarget, {
      target,
      page: meta.page,
      day,
      workspace,
      card,
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
