import { NAV_TARGETS, getNavigationTarget } from "./navigationTargets.js";

function safeCall(fn, ...args) {
  if (typeof fn === "function") fn(...args);
}

function resetScrollPosition() {
  if (typeof window === "undefined") return;

  const reset = () => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    if (typeof document !== "undefined") {
      document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
      document.querySelector("main")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    }
  };

  reset();
  window.requestAnimationFrame(reset);
  window.setTimeout(reset, 0);
}

function normaliseSearchQuery(query = "") {
  return String(query).trim().toLowerCase();
}

export function resolveSearchNavigation(query = "") {
  const q = normaliseSearchQuery(query);
  if (!q) return null;

  const timelineTarget =
    NAV_TARGETS.TIMELINE || NAV_TARGETS.OPERATIONS_TIMELINE || NAV_TARGETS.OPERATIONS;

  if (q.includes("timeline") || q.includes("control room")) {
    return { target: timelineTarget, options: { scroll: false } };
  }

  if (q.includes("midweek") || q.includes("weekday") || q.includes("wednesday") || q.includes("thursday")) {
    return {
      target: NAV_TARGETS.FIXTURES,
      options: { day: "midweek", card: "actionBar", workspace: "fixtures" },
    };
  }

  if (q.includes("sun") || q.includes("sunday")) {
    return {
      target: NAV_TARGETS.FIXTURES,
      options: { day: "sunday", card: "actionBar", workspace: "fixtures" },
    };
  }

  if (
    q.includes("sat") ||
    q.includes("saturday") ||
    q.includes("fixture") ||
    q.includes("fixtures") ||
    q.includes("schedule") ||
    q.includes("pitch") ||
    /\bu(?:7|8|9|10|11|12|13|14|15)\b/.test(q) ||
    q.includes("lioness")
  ) {
    return {
      target: NAV_TARGETS.FIXTURES,
      options: { day: "saturday", card: "actionBar", workspace: "fixtures" },
    };
  }

  if (q.includes("parking") || q.includes("car park")) {
    return { target: NAV_TARGETS.PARKING, options: { day: "saturday" } };
  }

  if (q.includes("official") || q.includes("ref") || q.includes("referee")) {
    return { target: NAV_TARGETS.OFFICIALS, options: { day: "saturday" } };
  }

  if (q.includes("weather")) {
    return { target: NAV_TARGETS.WEATHER, options: { day: "saturday" } };
  }

  if (
    q.includes("message") ||
    q.includes("coach") ||
    q.includes("whatsapp") ||
    q.includes("communication")
  ) {
    return { target: NAV_TARGETS.COMMUNICATIONS, options: {} };
  }

  if (q.includes("analytics") || q.includes("stats") || q.includes("insight")) {
    return { target: NAV_TARGETS.ANALYTICS, options: {} };
  }

  if (q.includes("report") || q.includes("pdf") || q.includes("print")) {
    return { target: NAV_TARGETS.REPORTS, options: {} };
  }

  if (q.includes("venue") || q.includes("ground")) {
    return { target: NAV_TARGETS.VENUES, options: {} };
  }

  if (q.includes("team") || q.includes("club")) {
    return { target: NAV_TARGETS.TEAMS, options: {} };
  }

  if (
    q.includes("integration") ||
    q.includes("full-time") ||
    q.includes("full time") ||
    q.includes("fa")
  ) {
    return { target: NAV_TARGETS.INTEGRATIONS, options: {} };
  }

  if (q.includes("setting") || q.includes("settings")) {
    return { target: NAV_TARGETS.SETTINGS, options: {} };
  }

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
    const card = Object.prototype.hasOwnProperty.call(options, "card")
      ? options.card
      : meta.card;
    const workspace = Object.prototype.hasOwnProperty.call(options, "workspace")
      ? options.workspace
      : meta.workspace;
    const shouldScrollToSection =
      options.scrollToSection === true || Boolean(card || workspace);

    safeCall(setMainPage, meta.page);

    if (["saturday", "sunday", "midweek", "timeline"].includes(String(requestedDay).toLowerCase())) {
      safeCall(setDayTab, requestedDay);
    }

    if (meta.settingsTab || options.settingsTab) {
      safeCall(setSettingsTab, options.settingsTab || meta.settingsTab);
    }

    if (!shouldScrollToSection) {
      safeCall(setNavigationTarget, null);
      resetScrollPosition();
      return meta;
    }

    safeCall(setNavigationTarget, {
      target,
      page: meta.page,
      day:
        ["saturday", "sunday", "midweek"].includes(requestedDay)
          ? requestedDay
          : null,
      workspace,
      card,
      settingsTab: options.settingsTab || meta.settingsTab,
      scroll: options.scroll !== false,
      highlight: options.highlight !== false,
      createdAt: Date.now(),
    });

    return meta;
  };

  const timelineTarget =
    NAV_TARGETS.TIMELINE || NAV_TARGETS.OPERATIONS_TIMELINE || NAV_TARGETS.OPERATIONS;

  return {
    goTo,
    goToMissionControl: () => goTo(NAV_TARGETS.MISSION_CONTROL),
    goToOperations: (options) => goTo(NAV_TARGETS.OPERATIONS, options),
    goToOperationsTimeline: (options) => goTo(timelineTarget, options),
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
