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

function isPostponed(fixture = {}) {
  return clean(fixture.status) === "postponed";
}

function getOfficialName(fixture = {}) {
  return fixture.referee || fixture.ref || fixture.official || fixture.matchOfficial || fixture.assignedOfficial || "";
}

export function isFixtureOfficialConfirmed(fixture = {}) {
  const status = clean(fixture.refStatus || fixture.officialStatus || fixture.refereeStatus || fixture.matchOfficialStatus);
  const official = clean(getOfficialName(fixture));

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

function timeKey(fixture = {}) {
  return fixture.ko || fixture.kickOff || fixture.time || fixture.koLabel || String(fixture.koMins || "unscheduled");
}

function getFixtureId(fixture = {}, index = 0) {
  return fixture.id || fixture.fixtureId || `${fixtureLabel(fixture)}-${timeKey(fixture)}-${index}`;
}

function buildConflictMap(fixtures = []) {
  const assigned = new Map();

  fixtures.forEach((fixture, index) => {
    if (isPostponed(fixture) || !isFixtureOfficialConfirmed(fixture)) return;
    const official = clean(getOfficialName(fixture));
    if (!official) return;
    const key = `${official}-${timeKey(fixture)}`;
    const current = assigned.get(key) || [];
    current.push({ fixture, index });
    assigned.set(key, current);
  });

  const conflicts = [];
  assigned.forEach((items, key) => {
    if (items.length < 2) return;
    const [official] = key.split("-");
    conflicts.push({
      official,
      fixtures: items.map((item) => item.fixture),
      count: items.length,
      message: `${items.length} fixtures appear to share ${getOfficialName(items[0].fixture) || "the same official"} at ${timeKey(items[0].fixture)}.`,
    });
  });

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
  const inferredConflicts = buildConflictMap(activeFixtures);
  const suppliedConflicts = asArray(officialConflicts);

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
