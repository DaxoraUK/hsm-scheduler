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
  totalFixtures = 0,
  pitchCount = 0,
  closedPitchCount = 0,
  refereeOutstanding = 0,
  parkingPercent = 0,
  parkingCapacity = 0,
  parkingOverCapacity = false,
  communicationsReady = false,
  blockerCount = 0,
} = {}) {
  const scopeLabel = getMatchdayScopeLabel(scope);
  const lowerScopeLabel = scopeLabel.toLowerCase();

  const steps = [
    {
      key: "fixtures",
      title: "Build schedule",
      detail: scheduleBuilt
        ? `${totalFixtures} fixture${totalFixtures === 1 ? "" : "s"} scheduled for ${lowerScopeLabel}.`
        : "Build the selected matchday before final readiness checks.",
      status: scheduleBuilt ? "complete" : "current",
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
      detail: refereeOutstanding
        ? `${refereeOutstanding} official ${refereeOutstanding === 1 ? "needs" : "need"} confirmation.`
        : "Officials look healthy for scheduled fixtures.",
      status: refereeOutstanding ? "warning" : "complete",
      required: true,
      action: WORKFLOW_ACTIONS.OFFICIALS,
    },
    {
      key: "parking",
      title: "Review parking pressure",
      detail: scheduleBuilt
        ? `${parkingPercent}% projected peak against ${parkingCapacity} spaces.`
        : "Parking forecast will update after schedule build.",
      status: !scheduleBuilt ? "pending" : parkingOverCapacity ? "warning" : "complete",
      action: WORKFLOW_ACTIONS.PARKING,
    },
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
      detail: blockerCount ? "Resolve review items before publishing." : `${scopeLabel} is ready to publish.`,
      status: blockerCount ? "pending" : "complete",
      required: true,
      action: blockerCount ? WORKFLOW_ACTIONS.OPERATIONS : WORKFLOW_ACTIONS.PUBLISH,
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
  fixtureIssues = 0,
  refereeOutstanding = 0,
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

  if (fixtureIssues > 0 || parkingOverCapacity || refereeOutstanding > 0) {
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
    detail: "Fixtures, ground status, officials, parking and communications are ready.",
  };
}
