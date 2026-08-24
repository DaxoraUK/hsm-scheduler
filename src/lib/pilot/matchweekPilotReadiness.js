import { MATCHDAY_SCOPES, normaliseMatchdayScope } from "../domain/matchdayScope.js";

function clean(value) {
  return String(value || "").trim();
}

function requiredDates({ scope, satDate, sunDate, midweekDate }) {
  const resolvedScope = normaliseMatchdayScope(scope);
  if (resolvedScope === MATCHDAY_SCOPES.SATURDAY) return [clean(satDate)].filter(Boolean);
  if (resolvedScope === MATCHDAY_SCOPES.SUNDAY) return [clean(sunDate)].filter(Boolean);
  if (resolvedScope === MATCHDAY_SCOPES.MIDWEEK) return [clean(midweekDate)].filter(Boolean);
  if (resolvedScope === MATCHDAY_SCOPES.MATCHWEEK) return [clean(midweekDate), clean(satDate), clean(sunDate)].filter(Boolean);
  return [clean(satDate), clean(sunDate)].filter(Boolean);
}

export function hasSavedCurrentMatchweek({ history = [], scope, satDate, sunDate, midweekDate }) {
  const dates = requiredDates({ scope, satDate, sunDate, midweekDate });
  if (!dates.length) return false;
  return history.some((entry) => {
    const entryDates = new Set([clean(entry?.date), clean(entry?.satDate), clean(entry?.sunDate), clean(entry?.midweekDate)].filter(Boolean));
    return dates.every((date) => entryDates.has(date));
  });
}

export function buildMatchweekPilotReadiness({
  mode = "test", scope, scheduleBuilt = false, fixtureIssues = 0,
  officialOutstanding = 0, officialConflicts = 0, history = [],
  satDate, sunDate, midweekDate, buildDays = [],
} = {}) {
  const saved = hasSavedCurrentMatchweek({ history, scope, satDate, sunDate, midweekDate });
  const builtDays = buildDays.filter((day) => day.enabled && day.hasRun);
  const locked = Boolean(scheduleBuilt) && builtDays.length > 0 && builtDays.every((day) => day.locked);
  const checks = [
    { id: "live-data", label: "Live fixture data", passed: mode === "live", detail: mode === "live" ? "Using live fixture sources" : "Demonstration data is still selected", action: "fixtures" },
    { id: "schedule", label: "Schedule built", passed: Boolean(scheduleBuilt), detail: scheduleBuilt ? "Current matchweek has been generated" : "Build the selected matchdays", action: "fixtures" },
    { id: "fixtures", label: "Fixture resolution", passed: Boolean(scheduleBuilt) && Number(fixtureIssues) === 0, detail: Number(fixtureIssues) === 0 ? "No unresolved fixture or pitch issues" : `${fixtureIssues} issue${Number(fixtureIssues) === 1 ? "" : "s"} need attention`, action: "fixtures" },
    { id: "officials", label: "Officials confirmed", passed: Boolean(scheduleBuilt) && Number(officialOutstanding) === 0 && Number(officialConflicts) === 0, detail: Number(officialConflicts) > 0 ? `${officialConflicts} assignment clash${Number(officialConflicts) === 1 ? "" : "es"}` : Number(officialOutstanding) > 0 ? `${officialOutstanding} confirmation${Number(officialOutstanding) === 1 ? "" : "s"} outstanding` : "No outstanding official checks", action: "officials" },
    { id: "saved", label: "Current plan saved", passed: saved, detail: saved ? "Saved matchweek matches the selected dates" : "Save this matchweek before operational use", action: "save" },
    { id: "locked", label: "Schedule locked", passed: locked, detail: locked ? "Built matchdays are protected from accidental edits" : "Lock the reviewed matchdays in Operations", action: "operations" },
  ];
  const complete = checks.filter((check) => check.passed).length;
  const blockers = checks.filter((check) => !check.passed);
  return { checks, complete, total: checks.length, percent: Math.round((complete / checks.length) * 100), blockers, ready: blockers.length === 0 };
}

