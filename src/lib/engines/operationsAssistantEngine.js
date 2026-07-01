import { getParkingSnapshot } from "./parkingEngine.js";
import { createPlatformAction, buildActionSummary } from "./actionFramework.js";

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
  recommendationCentre = null,
  ...rest
} = {}) {
  if (clubTwin?.assistant) return clubTwin.assistant;

  const activeFixtures = getFixturesFromArgs({ fixtures, final, games, scheduledFixtures, matchdayFixtures })
    .filter((fixture) => fixture?.status !== "postponed");
  const built = typeof scheduleBuilt === "boolean" ? scheduleBuilt : Boolean(hasRun || activeFixtures.length);
  const missingOfficials = refWarnings ?? countMissingOfficials(activeFixtures);
  const parking = getParkingSnapshot({ fixtures: activeFixtures, club, pitchCfg });
  const messagesAreReady = hasCoachMessages({ messagesReady, coachMessagesReady, coachMessages });

  const actions = [];

  if (!built) {
    actions.push(createPlatformAction({
      domain: "fixtures",
      type: "build_schedule",
      title: "Build schedule",
      detail: "Build Saturday or Sunday before final readiness checks.",
      severity: "critical",
      priority: 100,
      workspace: "fixtures",
      card: "schedule",
      cta: "Open fixtures",
    }));
  }

  if (unresolvedCount > 0) {
    actions.push(createPlatformAction({
      domain: "fixtures",
      type: "unresolved_fixtures",
      title: "Resolve fixtures",
      detail: `${unresolvedCount} fixture${unresolvedCount === 1 ? "" : "s"} still need manual review.`,
      severity: "critical",
      priority: 95,
      workspace: "fixtures",
      card: "unresolved",
      cta: "Open fixtures",
    }));
  }

  if (parking.isOverCapacity) {
    actions.push(createPlatformAction({
      domain: "parking",
      type: "parking_over_capacity",
      title: "Review parking",
      detail: `${parking.utilisation}% peak use at ${parking.peakTime} (${parking.peakCars}/${parking.capacity} spaces).`,
      severity: "critical",
      priority: 90,
      workspace: "intelligence",
      card: "parkingIntelligence",
      cta: "Open parking",
    }));
  } else if (parking.isHighPressure || parking.isOverConcurrentLimit) {
    actions.push(createPlatformAction({
      domain: "parking",
      type: "parking_watch",
      title: "Watch parking",
      detail: `${parking.utilisation}% peak use at ${parking.peakTime} (${parking.peakCars}/${parking.capacity} spaces).`,
      severity: "watch",
      priority: 70,
      workspace: "intelligence",
      card: "parkingIntelligence",
      cta: "Open parking",
    }));
  }

  if (missingOfficials > 0) {
    actions.push(createPlatformAction({
      domain: "officials",
      type: "officials_missing",
      title: "Confirm officials",
      detail: `${missingOfficials} fixture${missingOfficials === 1 ? "" : "s"} need official confirmation.`,
      severity: built ? "attention" : "watch",
      priority: 65,
      workspace: "intelligence",
      card: "operationsHealth",
      cta: "Open officials",
    }));
  }

  if (built && !messagesAreReady) {
    actions.push(createPlatformAction({
      domain: "communications",
      type: "communications_prepare",
      title: "Prepare coach messages",
      detail: "Generate coach messages once the schedule has been reviewed.",
      severity: "watch",
      priority: 55,
      workspace: "communications",
      card: "coachMessages",
      cta: "Open messages",
    }));
  }

  const centreActions = (recommendationCentre?.actions || []).slice(0, 4);
  const summary = buildActionSummary([...actions, ...centreActions]);

  if (built && !summary.actions.some((action) => ["critical", "attention", "watch"].includes(action.platformStatus))) {
    summary.actions.push(createPlatformAction({
      domain: "communications",
      type: "publish",
      title: "Publish weekend",
      detail: "The core checks look ready. Review and publish the weekend schedule.",
      severity: "healthy",
      priority: 10,
      workspace: "communications",
      cta: "Publish",
    }));
  }

  const actionSummary = buildActionSummary(summary.actions);
  const criticalCount = actionSummary.critical;
  const attentionCount = actionSummary.attention;
  const watchCount = actionSummary.watch;
  const status = criticalCount > 0 ? "danger" : attentionCount > 0 || watchCount > 0 ? "warning" : "success";
  const label = criticalCount > 0 ? "Action required" : attentionCount > 0 || watchCount > 0 ? "Review required" : "Ready";

  return {
    title: label,
    headline: label,
    label,
    summary:
      criticalCount > 0
        ? `${criticalCount} urgent action${criticalCount === 1 ? "" : "s"} found.`
        : attentionCount > 0 || watchCount > 0
          ? `${attentionCount + watchCount} item${attentionCount + watchCount === 1 ? "" : "s"} need review.`
          : "No urgent actions found.",
    status,
    platformStatus: criticalCount > 0 ? "critical" : attentionCount > 0 ? "attention" : watchCount > 0 ? "watch" : "healthy",
    statusKey: criticalCount > 0 ? "urgent" : attentionCount > 0 || watchCount > 0 ? "review" : "ready",
    urgentCount: criticalCount,
    urgentActionCount: criticalCount,
    reviewCount: attentionCount + watchCount,
    totalActions: actionSummary.actions.length,
    actionCount: actionSummary.actions.length,
    actions: actionSummary.actions,
    items: actionSummary.actions,
    nextBestAction: actionSummary.nextAction,
    nextAction: actionSummary.nextAction,
    metrics: {
      activeFixtures: activeFixtures.length,
      activeCount: activeFixtures.length,
      urgent: criticalCount,
      dangerCount: criticalCount,
      review: attentionCount + watchCount,
      warningCount: attentionCount + watchCount,
      actionCount: actionSummary.actions.length,
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
