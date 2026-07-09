import { getMatchdayScopeLabel } from "../domain/matchdayScope.js";

export const WORKFLOW_ACTIONS = Object.freeze({
  FIXTURES: "fixtures",
  GROUND: "ground",
  OFFICIALS: "officials",
  PARKING: "parking",
  COMMUNICATIONS: "communications",
  OPERATIONS: "operations",
  PUBLISH: "publish",
});

export function buildMissionControlWorkflow({
  scope = "weekend",
  scheduleBuilt = false,
  totalFixtures = null,
  pitchCount = 0,
  closedPitchCount = 0,
  refereeOutstanding = 0,
  officialConflicts = 0,
  parkingEnabled = true,
  parkingConfigured = true,
  parkingPercent = 0,
  parkingCapacity = 0,
  parkingOverCapacity = false,
  communicationsReady = false,
  blockerCount = 0,
} = {}) {
  const scopeLabel = getMatchdayScopeLabel(scope);
  const lowerScopeLabel = scopeLabel.toLowerCase();
  const knownFixtureCount = totalFixtures == null ? null : Math.max(0, Number(totalFixtures) || 0);
  const scheduleReady = scheduleBuilt && (knownFixtureCount == null || knownFixtureCount > 0);

  const steps = [
    {
      key: "fixtures",
      title: "Build schedule",
      detail: scheduleReady
        ? knownFixtureCount == null
          ? `${scopeLabel} schedule has been built.`
          : `${knownFixtureCount} fixture${knownFixtureCount === 1 ? "" : "s"} scheduled for ${lowerScopeLabel}.`
        : scheduleBuilt
          ? `No active fixtures are scheduled for ${lowerScopeLabel}. Add or import fixtures before publishing.`
          : "Build the selected matchday before final readiness checks.",
      status: scheduleReady ? "complete" : "current",
      required: true,
      action: WORKFLOW_ACTIONS.FIXTURES,
    },
    {
      key: "ground",
      title: "Review ground status",
      detail: closedPitchCount
        ? `${closedPitchCount} pitch ${closedPitchCount === 1 ? "closure is" : "closures are"} active.`
        : `${pitchCount} pitches available and no closures active.`,
      status: closedPitchCount ? "warning" : "complete",
      required: true,
      action: WORKFLOW_ACTIONS.GROUND,
    },
    {
      key: "officials",
      title: "Confirm officials",
      detail: !scheduleReady
        ? "Officials will be assessed after active fixtures are scheduled."
        : officialConflicts
          ? `${officialConflicts} overlapping official ${officialConflicts === 1 ? "assignment needs" : "assignments need"} attention.`
          : refereeOutstanding
            ? `${refereeOutstanding} official ${refereeOutstanding === 1 ? "needs" : "need"} confirmation.`
            : "Officials look healthy for scheduled fixtures.",
      status: !scheduleReady ? "pending" : officialConflicts || refereeOutstanding ? "warning" : "complete",
      required: true,
      action: WORKFLOW_ACTIONS.OFFICIALS,
    },
    ...(parkingEnabled
      ? [{
          key: "parking",
          title: parkingConfigured ? "Review parking pressure" : "Configure parking",
          detail: !parkingConfigured
            ? "Set the primary venue parking capacity before using parking readiness."
            : scheduleReady
              ? `${parkingPercent}% projected peak against ${parkingCapacity} spaces.`
              : "Parking forecast will update after active fixtures are scheduled.",
          status: !parkingConfigured
            ? "warning"
            : !scheduleReady
              ? "pending"
              : parkingOverCapacity
                ? "warning"
                : "complete",
          action: WORKFLOW_ACTIONS.PARKING,
        }]
      : []),
    {
      key: "messages",
      title: "Prepare coach messages",
      detail: communicationsReady
        ? "Coach messages are ready for review and copy-out."
        : "Coach messages are waiting for the built schedule.",
      status: communicationsReady ? "complete" : "pending",
      required: true,
      action: WORKFLOW_ACTIONS.COMMUNICATIONS,
    },
    {
      key: "publish",
      title: `Publish ${lowerScopeLabel}`,
      detail: !scheduleReady
        ? "Add or import active fixtures before publishing."
        : blockerCount
          ? "Resolve review items before publishing."
          : `${scopeLabel} is ready to publish.`,
      status: !scheduleReady || blockerCount ? "pending" : "complete",
      required: true,
      action: !scheduleReady || blockerCount ? WORKFLOW_ACTIONS.OPERATIONS : WORKFLOW_ACTIONS.PUBLISH,
    },
  ];

  return {
    steps,
    nextAction: steps.find((step) => step.status !== "complete") || steps[steps.length - 1],
    completedSteps: steps.filter((step) => step.status === "complete").length,
    totalSteps: steps.length,
  };
}

export function getMissionState({
  scheduleBuilt = false,
  totalFixtures = null,
  fixtureIssues = 0,
  refereeOutstanding = 0,
  officialConflicts = 0,
  parkingEnabled = true,
  parkingConfigured = true,
  parkingOverCapacity = false,
  communicationsReady = false,
} = {}) {
  if (!scheduleBuilt) {
    return {
      tone: "warning",
      label: "Review Required",
      title: "Build schedule",
      detail: "Your weekend is close, but the schedule needs building before final readiness checks.",
    };
  }

  if (totalFixtures != null && totalFixtures <= 0) {
    return {
      tone: "warning",
      label: "No Fixtures",
      title: "Add fixtures",
      detail: "The schedule has been built, but there are no active fixtures to assess or publish.",
    };
  }

  if (
    fixtureIssues > 0 ||
    (parkingEnabled && (!parkingConfigured || parkingOverCapacity)) ||
    refereeOutstanding > 0 ||
    officialConflicts > 0
  ) {
    return {
      tone: "warning",
      label: "Action Required",
      title: "Review weekend",
      detail: "Ground Control has found items to check before publishing.",
    };
  }

  if (!communicationsReady) {
    return {
      tone: "warning",
      label: "Almost Ready",
      title: "Prepare messages",
      detail: "Your operations are ready. Prepare communications before publishing.",
    };
  }

  return {
    tone: "success",
    label: "Weekend Ready",
    title: "Ready to publish",
    detail: parkingEnabled
      ? "Fixtures, ground status, officials, parking and communications are ready."
      : "Fixtures, ground status, officials and communications are ready.",
  };
}
