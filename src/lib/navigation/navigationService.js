import { NAV_TARGETS, getNavigationTarget } from "./navigationTargets.js";

function safeCall(fn, ...args) {
  if (typeof fn === "function") fn(...args);
}

function resetToTop() {
  if (typeof window === "undefined") return;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  } catch (_error) {
    window.scrollTo(0, 0);
  }
}

function normaliseSearchQuery(query = "") {
  return String(query).trim().toLowerCase();
}

export function resolveSearchNavigation(query = "") {
  const q = normaliseSearchQuery(query);
  if (!q) return null;

  if (q.includes("timeline") || q.includes("control room")) {
    return { target: NAV_TARGETS.TIMELINE, options: { scroll: false } };
  }

  if (q.includes("sun") || q.includes("sunday")) {
    return { target: NAV_TARGETS.OPERATIONS, options: { day: "sunday", scroll: false } };
  }

  if (
    q.includes("sat") ||
    q.includes("saturday") ||
    q.includes("fixture") ||
    q.includes("fixtures") ||
    q.includes("schedule") ||
    q.includes("pitch") ||
    q.includes("u7") ||
    q.includes("u8") ||
    q.includes("u9") ||
    q.includes("u10") ||
    q.includes("u11") ||
    q.includes("u12") ||
    q.includes("u13") ||
    q.includes("u14") ||
    q.includes("u15") ||
    q.includes("lioness")
  ) {
    return { target: NAV_TARGETS.OPERATIONS, options: { day: "saturday", scroll: false } };
  }

  if (q.includes("parking") || q.includes("car park")) {
    return { target: NAV_TARGETS.PARKING, options: { day: "saturday", scroll: true } };
  }

  if (q.includes("official") || q.includes("ref") || q.includes("referee")) {
    return { target: NAV_TARGETS.OFFICIALS, options: { day: "saturday", scroll: true } };
  }

  if (q.includes("weather")) {
    return { target: NAV_TARGETS.WEATHER, options: { day: "saturday", scroll: true } };
  }

  if (q.includes("message") || q.includes("coach") || q.includes("whatsapp") || q.includes("communication")) {
    return { target: NAV_TARGETS.COMMUNICATIONS };
  }

  if (q.includes("analytics") || q.includes("stats") || q.includes("insight")) return { target: NAV_TARGETS.ANALYTICS };
  if (q.includes("report") || q.includes("pdf") || q.includes("print")) return { target: NAV_TARGETS.REPORTS };
  if (q.includes("venue") || q.includes("ground")) return { target: NAV_TARGETS.VENUES };
  if (q.includes("team") || q.includes("club")) return { target: NAV_TARGETS.TEAMS };
  if (q.includes("integration") || q.includes("full-time") || q.includes("full time") || q.includes("fa")) return { target: NAV_TARGETS.INTEGRATIONS };
  if (q.includes("setting") || q.includes("settings")) return { target: NAV_TARGETS.SETTINGS };

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
    const requestedDay = options.day || meta.day || meta.dayTab || null;
    const shouldScroll = options.scroll !== false;
    const workspace = options.workspace || meta.workspace;
    const card = options.card || meta.card;
    const hasSectionTarget = Boolean(workspace || card);

    if (!shouldScroll || !hasSectionTarget) resetToTop();

    safeCall(setMainPage, meta.page);

    if (["saturday", "sunday", "timeline"].includes(String(requestedDay).toLowerCase())) {
      safeCall(setDayTab, requestedDay);
    }

    if (meta.settingsTab || options.settingsTab) {
      safeCall(setSettingsTab, options.settingsTab || meta.settingsTab);
    }

    safeCall(setNavigationTarget, {
      target,
      page: meta.page,
      day: requestedDay === "saturday" || requestedDay === "sunday" ? requestedDay : null,
      workspace,
      card,
      settingsTab: options.settingsTab || meta.settingsTab,
      scroll: shouldScroll,
      highlight: options.highlight !== false,
      createdAt: Date.now(),
    });

    return meta;
  };

  return {
    goTo,
    goToMissionControl: () => goTo(NAV_TARGETS.MISSION_CONTROL),
    goToOperations: (options) => goTo(NAV_TARGETS.OPERATIONS, options),
    goToOperationsTimeline: (options) => goTo(NAV_TARGETS.TIMELINE, options),
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
