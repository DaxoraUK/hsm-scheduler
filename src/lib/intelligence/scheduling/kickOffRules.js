function normaliseText(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function timeToMinutes(time) {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function minutesToTime(totalMinutes) {
  const mins = Number(totalMinutes);
  if (!Number.isFinite(mins)) return null;
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normaliseTime(value = "") {
  const mins = timeToMinutes(value);
  if (mins == null) return null;
  return minutesToTime(mins);
}

function numberOrNull(value) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function getFixtureTeamName(fixture = {}) {
  return fixture.teamName || fixture.cfg?.name || fixture.homeTeam || "";
}

export function getFixtureFormatForRules(fixture = {}) {
  return fixture.cfg?.format || fixture.manualFormat || fixture.format || "";
}

export function isYouthFixture(fixture = {}) {
  const name = normaliseText(getFixtureTeamName(fixture));
  const ageOrder = Number(fixture.cfg?.ageOrder ?? fixture.ageOrder);

  if (Number.isFinite(ageOrder) && ageOrder > 0 && ageOrder < 11) return true;
  return /\bu\s?\d{1,2}\b/.test(name);
}

export function isAdultFixture(fixture = {}) {
  const format = getFixtureFormatForRules(fixture);
  const ageOrder = Number(fixture.cfg?.ageOrder ?? fixture.ageOrder);

  if (isYouthFixture(fixture)) return false;
  if (Number.isFinite(ageOrder) && ageOrder >= 11) return true;
  return format === "11v11";
}

export function getTimingSettings(club = {}) {
  const timing = club.timingSettings || club.timing || {};

  const startHour = numberOrNull(timing.startHour ?? club.startHour ?? club.earliestKoHour);
  const startMin = numberOrNull(timing.startMin ?? club.startMin ?? club.earliestKoMin);
  const endHour = numberOrNull(timing.endHour ?? club.endHour ?? club.latestYouthKoHour);
  const endMin = numberOrNull(timing.endMin ?? club.endMin ?? club.latestYouthKoMin);

  const earliestKickOff =
    normaliseTime(timing.earliestKickOff || club.earliestKickOff || club.earliestKoTime) ||
    minutesToTime((startHour ?? 8) * 60 + (startMin ?? 30));

  const latestYouthKickOff =
    normaliseTime(timing.latestYouthKickOff || club.latestYouthKickOff || club.latestYouthKoTime) ||
    minutesToTime((endHour ?? 11) * 60 + (endMin ?? 30));

  return {
    earliestKickOff,
    latestYouthKickOff,
    earliestKickOffMins: timeToMinutes(earliestKickOff),
    latestYouthKickOffMins: timeToMinutes(latestYouthKickOff),
    youthBuffer: numberOrNull(timing.youthBuffer ?? club.youthBuffer),
    adultBuffer: numberOrNull(timing.adultBuffer ?? club.adultBuffer),
  };
}

export function getSuggestionWindowForFixture({ fixture = {}, club = {} } = {}) {
  const timing = getTimingSettings(club);
  const start = timing.earliestKickOff || "08:30";
  const end = isYouthFixture(fixture)
    ? timing.latestYouthKickOff || "11:30"
    : normaliseTime(club.adultLatestKickOff || club.latestAdultKickOff) || "17:00";

  return { start, end };
}

export function getKickOffRuleFailure({ fixture = {}, koTime, club = {} } = {}) {
  const nextKo = normaliseTime(koTime || fixture.koTime);
  if (!nextKo) return null;

  const nextMins = timeToMinutes(nextKo);
  const timing = getTimingSettings(club);

  if (timing.earliestKickOffMins != null && nextMins < timing.earliestKickOffMins) {
    return {
      ok: false,
      type: "kickoff_rule",
      title: "Kick-off before start window",
      detail: `Fixtures cannot kick off before ${timing.earliestKickOff}.`,
      action: "Choose a later kick-off time or update the Timing Settings.",
      earliestKickOff: timing.earliestKickOff,
    };
  }

  if (
    isYouthFixture(fixture) &&
    timing.latestYouthKickOffMins != null &&
    nextMins > timing.latestYouthKickOffMins
  ) {
    return {
      ok: false,
      type: "kickoff_rule",
      title: "Kick-off outside youth window",
      detail: `Youth fixtures must kick off by ${timing.latestYouthKickOff}.`,
      action: "Choose an earlier kick-off time or update the Timing Settings.",
      latestKickOff: timing.latestYouthKickOff,
    };
  }

  return null;
}

export function isKickOffAllowedForFixture({ fixture = {}, koTime, club = {} } = {}) {
  return !getKickOffRuleFailure({ fixture, koTime, club });
}
