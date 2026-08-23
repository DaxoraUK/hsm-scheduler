function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export function buildCoreOperationalReadiness({
  scheduleBuilt = false,
  unresolvedCount = 0,
  conflictCount = 0,
  officialOutstanding = 0,
  officialConflictCount = 0,
  parkingEnabled = true,
  parkingConfigured = true,
  parkingOverCapacity = false,
  parkingHighPressure = false,
  closedPitchCount = 0,
  communicationsReady = false,
} = {}) {
  const unresolved = count(unresolvedCount);
  const conflicts = count(conflictCount);
  const officials = count(officialOutstanding);
  const officialConflicts = count(officialConflictCount);
  const closures = count(closedPitchCount);
  const actions = [];

  if (!scheduleBuilt) actions.push({ key: "schedule-build", domain: "fixtures", severity: "attention", blocking: true, affected: 1 });
  if (unresolved || conflicts) actions.push({ key: "fixture-readiness", domain: "fixtures", severity: "critical", blocking: true, affected: unresolved + conflicts });
  if (officials || officialConflicts) actions.push({ key: "officials-readiness", domain: "officials", severity: officialConflicts ? "attention" : "watch", blocking: false, affected: officials + officialConflicts });
  if (closures) actions.push({ key: "pitch-closures", domain: "pitches", severity: "watch", blocking: false, affected: closures });
  if (parkingEnabled && !parkingConfigured) actions.push({ key: "parking-configuration", domain: "parking", severity: "attention", blocking: false, affected: 1 });
  else if (parkingEnabled && (parkingOverCapacity || parkingHighPressure)) actions.push({ key: "parking-pressure", domain: "parking", severity: parkingOverCapacity ? "attention" : "watch", blocking: false, affected: 1 });
  if (scheduleBuilt && !communicationsReady) actions.push({ key: "communications-readiness", domain: "communications", severity: "watch", blocking: false, affected: 1 });

  return {
    actions,
    actionCount: actions.length,
    blockerCount: actions.filter((item) => item.blocking).reduce((total, item) => total + item.affected, 0),
    blockingActionCount: actions.filter((item) => item.blocking).length,
    warningCount: actions.filter((item) => !item.blocking).reduce((total, item) => total + item.affected, 0),
    warningActionCount: actions.filter((item) => !item.blocking).length,
    readyToLock: scheduleBuilt && !actions.some((item) => item.blocking),
    readyToPublish: scheduleBuilt && !actions.some((item) => item.blocking) && communicationsReady,
  };
}

export default buildCoreOperationalReadiness;
