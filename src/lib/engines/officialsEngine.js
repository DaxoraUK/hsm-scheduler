function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

function normalise(value) {
  return clean(value).replace(/\./g, "").replace(/\s+/g, " ");
}

function isPostponed(fixture = {}) {
  return clean(fixture.status) === "postponed";
}

export function getOfficialName(fixture = {}) {
  return fixture.referee || fixture.ref || fixture.official || fixture.matchOfficial || fixture.assignedOfficial || "";
}

function getOfficialStatus(fixture = {}) {
  return clean(fixture.refStatus || fixture.officialStatus || fixture.refereeStatus || fixture.matchOfficialStatus);
}

export function getOfficialRoleFromName(name = "") {
  const official = normalise(name);

  if (!official || ["tbc", "none", "unassigned", "missing"].includes(official)) return "unassigned";
  if (official.includes("parent")) return "parent_referee";
  if (official.includes("volunteer")) return "volunteer";
  if (official.includes("manager")) return "manager_referee";
  if (official.includes("assistant")) return "assistant_referee";
  if (official.includes("mentor") || official.includes("observer")) return "observer";
  if (official.includes("league")) return "league_referee";
  if (official.includes("club")) return "club_referee";

  return "club_referee";
}

export function getOfficialRole(fixture = {}, refs = []) {
  const explicitRole = fixture.officialRole || fixture.refereeRole || fixture.refRole || fixture.role;
  if (explicitRole) return normalise(explicitRole).replace(/\s+/g, "_");

  const officialName = normalise(getOfficialName(fixture));
  const refRecord = asArray(refs).find((ref) => normalise(ref?.name) === officialName);

  if (refRecord?.role) return normalise(refRecord.role).replace(/\s+/g, "_");
  if (refRecord?.type) return normalise(refRecord.type).replace(/\s+/g, "_");

  return getOfficialRoleFromName(officialName);
}

export function shouldEnforceOfficialClashes(fixture = {}, refs = []) {
  const officialName = normalise(getOfficialName(fixture));
  if (!officialName || ["tbc", "none", "unassigned", "missing"].includes(officialName)) return false;

  const refRecord = asArray(refs).find((ref) => normalise(ref?.name) === officialName);
  if (typeof refRecord?.enforceClashes === "boolean") return refRecord.enforceClashes;
  if (typeof refRecord?.ignoreClashes === "boolean") return !refRecord.ignoreClashes;

  const role = getOfficialRole(fixture, refs);

  return ![
    "parent_referee",
    "parent_ref",
    "parent",
    "volunteer",
    "observer",
    "mentor",
  ].includes(role);
}

export function isFixtureOfficialConfirmed(fixture = {}) {
  const status = getOfficialStatus(fixture);
  const official = normalise(getOfficialName(fixture));

  if (["confirmed", "accepted", "assigned", "yes", "ok", "ready"].includes(status)) return true;
  if (["tbc", "unassigned", "missing", "none", "no", "pending", "declined"].includes(status)) return false;
  if (!official || ["tbc", "none", "unassigned", "missing"].includes(official)) return false;

  return Boolean(official);
}

function fixtureLabel(fixture = {}) {
  const home = fixture.homeTeam || fixture.team || fixture.home || "Fixture";
  const away = fixture.awayTeam || fixture.opponent || fixture.away || "";
  return away ? `${home} vs ${away}` : home;
}

function getKickOffMinutes(fixture = {}) {
  if (fixture.koMins != null) return toNumber(fixture.koMins, null);
  const value = fixture.koTime || fixture.ko || fixture.kickOff || fixture.time || "";
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function getEndMinutes(fixture = {}) {
  if (fixture.endMins != null) return toNumber(fixture.endMins, null);
  const koMins = getKickOffMinutes(fixture);
  if (koMins == null) return null;
  const duration = toNumber(fixture.durationMins || fixture.duration || fixture.matchDuration, 60);
  return koMins + duration;
}

function timeKey(fixture = {}) {
  return fixture.ko || fixture.kickOff || fixture.time || fixture.koTime || fixture.koLabel || String(fixture.koMins || "unscheduled");
}

function getFixtureId(fixture = {}, index = 0) {
  return fixture.id || fixture.fixtureId || `${fixtureLabel(fixture)}-${timeKey(fixture)}-${index}`;
}

export function fixturesOverlap(fixtureA = {}, fixtureB = {}) {
  const aStart = getKickOffMinutes(fixtureA);
  const bStart = getKickOffMinutes(fixtureB);
  const aEnd = getEndMinutes(fixtureA);
  const bEnd = getEndMinutes(fixtureB);

  if (aStart == null || bStart == null || aEnd == null || bEnd == null) return false;

  return aStart < bEnd && bStart < aEnd;
}

export function findOfficialConflicts(fixtures = [], refs = []) {
  const activeFixtures = asArray(fixtures).filter(
    (fixture) =>
      !isPostponed(fixture) &&
      isFixtureOfficialConfirmed(fixture) &&
      shouldEnforceOfficialClashes(fixture, refs)
  );

  const conflicts = [];

  for (let a = 0; a < activeFixtures.length; a += 1) {
    for (let b = a + 1; b < activeFixtures.length; b += 1) {
      const first = activeFixtures[a];
      const second = activeFixtures[b];
      const firstOfficial = normalise(getOfficialName(first));
      const secondOfficial = normalise(getOfficialName(second));

      if (!firstOfficial || firstOfficial !== secondOfficial) continue;
      if (!shouldEnforceOfficialClashes(first, refs) || !shouldEnforceOfficialClashes(second, refs)) continue;
      if (!fixturesOverlap(first, second)) continue;

      conflicts.push({
        referee: getOfficialName(first),
        official: getOfficialName(first),
        role: getOfficialRole(first, refs),
        a: first,
        b: second,
        fixtures: [first, second],
        message: `${getOfficialName(first)} is assigned to overlapping fixtures: ${fixtureLabel(first)} and ${fixtureLabel(second)}.`,
      });
    }
  }

  return conflicts;
}

function statusFromCounts({ missingCount = 0, conflictCount = 0 }) {
  if (conflictCount > 0) return "danger";
  if (missingCount > 0) return "warning";
  return "success";
}

export function calculateOfficialsReadiness({ fixtures = [], active = [], officialConflicts = [], refWarnings = null, refs = [] } = {}) {
  const activeFixtures = asArray(active).length ? asArray(active) : asArray(fixtures).filter((fixture) => !isPostponed(fixture));
  const fixtureCount = activeFixtures.length;

  const missingFixtures = activeFixtures.filter((fixture) => !isFixtureOfficialConfirmed(fixture));
  const confirmedFixtures = activeFixtures.filter(isFixtureOfficialConfirmed);
  const inferredConflicts = findOfficialConflicts(activeFixtures, refs);
  const suppliedConflicts = asArray(officialConflicts).filter((conflict) => {
    const sample = conflict?.a || conflict?.fixtures?.[0] || null;
    return sample ? shouldEnforceOfficialClashes(sample, refs) : true;
  });

  const missingCount = refWarnings === null || refWarnings === undefined
    ? missingFixtures.length
    : toNumber(refWarnings, missingFixtures.length);
  const conflictCount = suppliedConflicts.length || inferredConflicts.length;
  const status = statusFromCounts({ missingCount, conflictCount });
  const score = Math.max(0, Math.min(100, 100 - missingCount * 8 - conflictCount * 20));

  const issues = [];
  const actions = [];

  if (missingCount > 0) {
    issues.push(`${missingCount} fixture${missingCount === 1 ? "" : "s"} without confirmed referee.`);
    actions.push("Chase referee confirmations before publishing.");
  }

  if (conflictCount > 0) {
    issues.push(`${conflictCount} referee overlap${conflictCount === 1 ? "" : "s"} detected.`);
    actions.push("Move kick-offs or reassign officials to clear referee overlaps.");
  }

  return {
    status,
    score,
    label: status === "success" ? "Officials clear" : status === "warning" ? "Officials need chasing" : "Official clash",
    summary: status === "success" ? "Officials look healthy." : issues[0] || "Officials need review.",
    issues,
    actions,
    missingFixtures: missingFixtures.map((fixture, index) => ({
      id: getFixtureId(fixture, index),
      label: fixtureLabel(fixture),
      fixture,
    })),
    conflicts: suppliedConflicts.length ? suppliedConflicts : inferredConflicts,
    metrics: {
      fixtures: fixtureCount,
      confirmed: confirmedFixtures.length,
      missing: missingCount,
      conflicts: conflictCount,
      refereePool: asArray(refs).length,
    },
  };
}

export default calculateOfficialsReadiness;
