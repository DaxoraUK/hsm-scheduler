import { getParkingSnapshot } from "./parkingEngine.js";

function getFixturesFromArgs(args = {}) {
  return (
    args.fixtures ||
    args.final ||
    args.games ||
    args.scheduledFixtures ||
    args.matchdayFixtures ||
    []
  );
}

function countMissingOfficials(fixtures = []) {
  return fixtures.filter((fixture) => {
    const status = String(fixture.refStatus || fixture.officialStatus || fixture.refereeStatus || "TBC").toLowerCase();
    const official = fixture.referee || fixture.official || fixture.ref || "";
    return !official || status === "tbc" || status === "awaiting" || status === "unconfirmed";
  }).length;
}

function hasCoachMessages(args = {}) {
  if (typeof args.messagesReady === "boolean") return args.messagesReady;
  if (typeof args.coachMessagesReady === "boolean") return args.coachMessagesReady;
  if (Array.isArray(args.coachMessages)) return args.coachMessages.length > 0;
  return false;
}

function makeAction({ type, title, message, severity = "review", workspace = "intelligence", ctaLabel = "Open review", priority = 50 }) {
  return {
    id: type,
    type,
    title,
    label: title,
    message,
    description: message,
    severity,
    variant: severity === "urgent" ? "danger" : severity === "ready" ? "success" : "warning",
    workspace,
    ctaLabel,
    priority,
  };
}

export function getOperationsAssistant({
  clubTwin = null,
  fixtures,
  final,
  games,
  scheduledFixtures,
  matchdayFixtures,
  club = {},
  pitchCfg = [],
  hasRun = false,
  scheduleBuilt,
  unresolvedCount = 0,
  refWarnings,
  messagesReady,
  coachMessagesReady,
  coachMessages,
  ...rest
} = {}) {
  if (clubTwin?.assistant) return clubTwin.assistant;

  const activeFixtures = getFixturesFromArgs({ fixtures, final, games, scheduledFixtures, matchdayFixtures });
  const built = typeof scheduleBuilt === "boolean" ? scheduleBuilt : Boolean(hasRun || activeFixtures.length);
  const missingOfficials = refWarnings ?? countMissingOfficials(activeFixtures);
  const parking = getParkingSnapshot({ fixtures: activeFixtures, club, pitchCfg });
  const messagesAreReady = hasCoachMessages({ messagesReady, coachMessagesReady, coachMessages });

  const actions = [];

  if (!built) {
    actions.push(
      makeAction({
        type: "build_schedule",
        title: "Build schedule",
        message: "Build Saturday or Sunday before final readiness checks.",
        severity: "urgent",
        workspace: "fixtures",
        ctaLabel: "Open fixtures",
        priority: 100,
      })
    );
  }

  if (unresolvedCount > 0) {
    actions.push(
      makeAction({
        type: "unresolved_fixtures",
        title: "Resolve fixtures",
        message: `${unresolvedCount} fixture${unresolvedCount === 1 ? "" : "s"} still need manual review.`,
        severity: "urgent",
        workspace: "fixtures",
        ctaLabel: "Open fixtures",
        priority: 95,
      })
    );
  }

  if (parking.isOverCapacity) {
    actions.push(
      makeAction({
        type: "parking",
        title: "Review parking",
        message: `${parking.utilisation}% peak use at ${parking.peakTime} (${parking.peakCars}/${parking.capacity} spaces).`,
        severity: "urgent",
        workspace: "intelligence",
        ctaLabel: "Open parking",
        priority: 90,
      })
    );
  } else if (parking.isHighPressure || parking.isOverConcurrentLimit) {
    actions.push(
      makeAction({
        type: "parking",
        title: "Watch parking",
        message: `${parking.utilisation}% peak use at ${parking.peakTime} (${parking.peakCars}/${parking.capacity} spaces).`,
        severity: "review",
        workspace: "intelligence",
        ctaLabel: "Open parking",
        priority: 70,
      })
    );
  }

  if (missingOfficials > 0) {
    actions.push(
      makeAction({
        type: "officials",
        title: "Confirm officials",
        message: `${missingOfficials} fixture${missingOfficials === 1 ? "" : "s"} need official confirmation.`,
        severity: built ? "review" : "ready",
        workspace: "resources",
        ctaLabel: "Open resources",
        priority: 65,
      })
    );
  }

  if (built && !messagesAreReady) {
    actions.push(
      makeAction({
        type: "communications",
        title: "Prepare coach messages",
        message: "Generate coach messages once the schedule has been reviewed.",
        severity: "review",
        workspace: "communications",
        ctaLabel: "Open messages",
        priority: 55,
      })
    );
  }

  if (built && !actions.some((action) => action.severity === "urgent" || action.severity === "review")) {
    actions.push(
      makeAction({
        type: "publish",
        title: "Publish weekend",
        message: "The core checks look ready. Review and publish the weekend schedule.",
        severity: "ready",
        workspace: "communications",
        ctaLabel: "Publish",
        priority: 10,
      })
    );
  }

  const sortedActions = [...actions].sort((a, b) => b.priority - a.priority);
  const urgentCount = sortedActions.filter((action) => action.severity === "urgent").length;
  const reviewCount = sortedActions.filter((action) => action.severity === "review").length;
  const nextBestAction = sortedActions[0] || null;
  const status = urgentCount > 0 ? "Action required" : reviewCount > 0 ? "Review required" : "Ready";

  return {
    title: status,
    headline: status,
    summary:
      urgentCount > 0
        ? `${urgentCount} urgent action${urgentCount === 1 ? "" : "s"} found.`
        : reviewCount > 0
          ? `${reviewCount} item${reviewCount === 1 ? "" : "s"} need review.`
          : "No urgent actions found.",
    status,
    statusKey: urgentCount > 0 ? "urgent" : reviewCount > 0 ? "review" : "ready",
    urgentCount,
    urgentActionCount: urgentCount,
    reviewCount,
    totalActions: sortedActions.length,
    actionCount: sortedActions.length,
    actions: sortedActions,
    items: sortedActions,
    nextBestAction,
    nextAction: nextBestAction,
    metrics: {
      activeFixtures: activeFixtures.length,
      urgent: urgentCount,
      review: reviewCount,
      parkingPeak: parking.utilisation,
    },
    parking,
    debug: {
      parkingSource: "parkingEngine.getParkingSnapshot",
      parkingCalculation: "peak concurrent window, not all-day total",
      ...rest.debug,
    },
  };
}

export default getOperationsAssistant;
