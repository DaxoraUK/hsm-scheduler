function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function plural(count, singular, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const mins = Number(value);
  if (!Number.isFinite(mins)) return "—";
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normaliseTime(value) {
  const mins = timeToMinutes(value);
  return mins == null ? null : minutesToTime(mins);
}

function normaliseText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isPostponed(fixture = {}) {
  const status = normaliseText(fixture.status || "active");
  return status === "postponed" || status === "cancelled";
}

function getTeamName(fixture = {}) {
  return fixture.teamName || fixture.cfg?.name || fixture.homeTeam || fixture.team || "Fixture";
}

function getFixtureTitle(fixture = {}) {
  const home = fixture.homeTeam || fixture.teamName || fixture.team || "Home";
  const away = fixture.awayTeam || fixture.opponent || fixture.away || "Opponent";
  return `${home} vs ${away}`;
}

function getFormat(fixture = {}) {
  return fixture.cfg?.format || fixture.manualFormat || fixture.format || fixture.gameFormat || fixture.pitchFormat || "";
}

function getConfiguredTeamType(fixture = {}) {
  return normaliseText(
    fixture.cfg?.teamType ||
      fixture.cfg?.category ||
      fixture.cfg?.ageGroupType ||
      fixture.teamType ||
      fixture.category ||
      fixture.ageGroupType
  );
}

function getAgeFromName(fixture = {}) {
  const text = normaliseText(`${getFixtureTitle(fixture)} ${getTeamName(fixture)}`);
  const match = text.match(/\bu\s?(\d{1,2})\b/);
  return match ? Number(match[1]) : null;
}

function isAdultFixture(fixture = {}) {
  const configuredType = getConfiguredTeamType(fixture);

  if (["adult", "open-age", "open age", "senior", "veterans", "vets"].includes(configuredType)) {
    return true;
  }

  const text = normaliseText(`${getFixtureTitle(fixture)} ${getTeamName(fixture)}`);

  return (
    /\b(1st team|first team|reserves|sunday 1sts|sunday firsts|open age|open-age|adult|senior|vets|veterans)\b/.test(text)
  );
}

function isYouthFixture(fixture = {}) {
  const configuredType = getConfiguredTeamType(fixture);

  if (configuredType === "youth" || configuredType === "junior") return true;
  if (isAdultFixture(fixture)) return false;

  const age = getAgeFromName(fixture);
  if (Number.isFinite(age) && age > 0 && age < 18) return true;

  const format = normaliseText(getFormat(fixture));
  if (format.includes("youth")) return true;

  return false;
}

function getKickOffMins(fixture = {}) {
  if (Number.isFinite(Number(fixture.koMins))) return Number(fixture.koMins);
  return timeToMinutes(fixture.koTime || fixture.ko || fixture.kickOff);
}

function getTimingRules(club = {}) {
  const timing = club.timingSettings || club.timing || {};

  const startHour = toNumber(timing.startHour ?? club.startHour ?? club.earliestKoHour, 8);
  const startMin = toNumber(timing.startMin ?? club.startMin ?? club.earliestKoMin, 30);
  const endHour = toNumber(timing.endHour ?? club.endHour ?? club.latestYouthKoHour, 11);
  const endMin = toNumber(timing.endMin ?? club.endMin ?? club.latestYouthKoMin, 30);

  const earliestKickOff =
    normaliseTime(timing.earliestKickOff || club.earliestKickOff || club.earliestKoTime) ||
    minutesToTime(startHour * 60 + startMin);

  const latestYouthKickOff =
    normaliseTime(timing.latestYouthKickOff || club.latestYouthKickOff || club.latestYouthKoTime) ||
    minutesToTime(endHour * 60 + endMin);

  const adultLatestKickOff =
    normaliseTime(timing.latestAdultKickOff || club.latestAdultKickOff || club.adultLatestKickOff) ||
    "17:00";

  return {
    earliestKickOff,
    latestYouthKickOff,
    adultLatestKickOff,
    earliestKickOffMins: timeToMinutes(earliestKickOff),
    latestYouthKickOffMins: timeToMinutes(latestYouthKickOff),
    adultLatestKickOffMins: timeToMinutes(adultLatestKickOff),
    youthBuffer: toNumber(timing.youthBuffer ?? club.youthBuffer ?? club.bufferYouth, 15),
    adultBuffer: toNumber(timing.adultBuffer ?? club.adultBuffer ?? club.bufferAdult, 30),
  };
}

function getPitchById(fixture = {}, pitchCfg = []) {
  const id = fixture.pitchId || fixture.pitch || fixture.pitchLabel;
  return pitchCfg.find((pitch) => pitch.id === id || pitch.label === id || pitch.name === id);
}

function pitchAllowsFormat(pitch = {}, format = "") {
  if (!pitch || !format) return true;

  const supported = [
    pitch.format,
    pitch.pitchFormat,
    pitch.gameFormat,
    ...(Array.isArray(pitch.formats) ? pitch.formats : []),
    ...(Array.isArray(pitch.allowedFormats) ? pitch.allowedFormats : []),
  ]
    .filter(Boolean)
    .map((item) => normaliseText(item));

  if (!supported.length) return true;
  return supported.includes(normaliseText(format));
}

function makeIssue({ severity = "warning", type, title, detail, action, fixture }) {
  return {
    severity,
    type,
    title,
    detail,
    action,
    fixture,
  };
}

function getStatus(score, issues = []) {
  if (issues.some((issue) => issue.severity === "danger") || score < 65) {
    return { status: "danger", label: "Needs action" };
  }

  if (issues.some((issue) => issue.severity === "warning") || score < 90) {
    return { status: "warning", label: "Review" };
  }

  return { status: "success", label: "Compliant" };
}

export function calculateCompetitionRules({
  fixtures = [],
  active = [],
  pitchCfg = [],
  closedPitches = [],
  club = {},
  allowArtificial = false,
} = {}) {
  const activeFixtures = active.length ? active : fixtures.filter((fixture) => !isPostponed(fixture));
  const timing = getTimingRules(club);
  const closedSet = new Set((closedPitches || []).map((pitch) => String(pitch)));
  const issues = [];

  activeFixtures.forEach((fixture) => {
    const koMins = getKickOffMins(fixture);
    const title = getFixtureTitle(fixture);
    const youth = isYouthFixture(fixture);
    const format = getFormat(fixture);
    const pitch = getPitchById(fixture, pitchCfg);

    if (koMins == null) {
      issues.push(makeIssue({
        severity: "danger",
        type: "missing_kickoff",
        title: "Missing kick-off time",
        detail: `${title} has no valid kick-off time.`,
        action: "Open the fixture and set a valid kick-off before publishing.",
        fixture: title,
      }));
      return;
    }

    if (timing.earliestKickOffMins != null && koMins < timing.earliestKickOffMins) {
      issues.push(makeIssue({
        severity: "danger",
        type: "before_window",
        title: "Kick-off before allowed window",
        detail: `${title} kicks off at ${minutesToTime(koMins)}, before ${timing.earliestKickOff}.`,
        action: "Move the fixture later or update Timing Settings if the rule has changed.",
        fixture: title,
      }));
    }

    if (youth && timing.latestYouthKickOffMins != null && koMins > timing.latestYouthKickOffMins) {
      issues.push(makeIssue({
        severity: "danger",
        type: "youth_after_window",
        title: "Youth kick-off outside rule window",
        detail: `${title} kicks off at ${minutesToTime(koMins)}, after the youth cut-off of ${timing.latestYouthKickOff}.`,
        action: "Move the fixture earlier or update Timing Settings if this competition allows it.",
        fixture: title,
      }));
    }

    if (!youth && timing.adultLatestKickOffMins != null && koMins > timing.adultLatestKickOffMins) {
      issues.push(makeIssue({
        severity: "warning",
        type: "adult_after_window",
        title: "Adult kick-off is late",
        detail: `${title} kicks off at ${minutesToTime(koMins)}, after ${timing.adultLatestKickOff}.`,
        action: "Check league guidance or update the adult timing setting.",
        fixture: title,
      }));
    }

    if (pitch && closedSet.has(String(pitch.id))) {
      issues.push(makeIssue({
        severity: "danger",
        type: "closed_pitch",
        title: "Fixture assigned to a closed pitch",
        detail: `${title} is assigned to ${pitch.label || pitch.name || pitch.id}, which is closed.`,
        action: "Reopen the pitch or move the fixture to an available surface.",
        fixture: title,
      }));
    }

    if (pitch && format && !pitchAllowsFormat(pitch, format)) {
      issues.push(makeIssue({
        severity: "danger",
        type: "format_mismatch",
        title: "Pitch format mismatch",
        detail: `${title} is a ${format} fixture but the assigned pitch does not support that format.`,
        action: "Move the fixture to a suitable pitch or update pitch configuration.",
        fixture: title,
      }));
    }

    if (pitch?.surface && normaliseText(pitch.surface).includes("artificial") && !allowArtificial) {
      issues.push(makeIssue({
        severity: "warning",
        type: "artificial_surface",
        title: "Artificial surface requires review",
        detail: `${title} is assigned to an artificial surface while artificial surfaces are not allowed in scheduling rules.`,
        action: "Enable artificial surfaces or move the fixture to grass.",
        fixture: title,
      }));
    }
  });

  const dangerCount = issues.filter((issue) => issue.severity === "danger").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const score = Math.max(0, 100 - dangerCount * 18 - warningCount * 8);
  const status = getStatus(score, issues);

  const checks = [
    {
      id: "timing",
      label: "Timing window",
      status: issues.some((issue) => ["missing_kickoff", "before_window", "youth_after_window", "adult_after_window"].includes(issue.type))
        ? dangerCount ? "danger" : "warning"
        : "success",
      summary: `${timing.earliestKickOff} earliest, ${timing.latestYouthKickOff} youth cut-off.`,
    },
    {
      id: "formats",
      label: "Pitch formats",
      status: issues.some((issue) => issue.type === "format_mismatch") ? "danger" : "success",
      summary: issues.some((issue) => issue.type === "format_mismatch") ? "Some fixtures are on unsuitable pitches." : "Assigned pitch formats look valid.",
    },
    {
      id: "closures",
      label: "Pitch closures",
      status: issues.some((issue) => issue.type === "closed_pitch") ? "danger" : closedPitches.length ? "warning" : "success",
      summary: closedPitches.length ? plural(closedPitches.length, "pitch", "pitches") + " closed." : "No pitch closure conflicts.",
    },
    {
      id: "surfaces",
      label: "Artificial surfaces",
      status: issues.some((issue) => issue.type === "artificial_surface") ? "warning" : "success",
      summary: allowArtificial ? "Artificial surfaces allowed." : "Artificial surfaces restricted unless reviewed.",
    },
  ];

  return {
    score,
    status: status.status,
    label: status.label,
    checks,
    issues,
    metrics: {
      fixtures: activeFixtures.length,
      danger: dangerCount,
      warnings: warningCount,
      earliestKickOff: timing.earliestKickOff,
      latestYouthKickOff: timing.latestYouthKickOff,
      adultLatestKickOff: timing.adultLatestKickOff,
      youthBuffer: timing.youthBuffer,
      adultBuffer: timing.adultBuffer,
    },
  };
}

export default calculateCompetitionRules;
