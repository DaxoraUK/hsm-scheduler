function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes)
    ? hours * 60 + minutes
    : null;
}

export const SCHEDULING_TIME_INCREMENT_MINS = 5;

const ADULT_CATEGORIES = new Set(["adult", "open_age", "open age", "open-age", "women", "veterans", "vets"]);

export function classifyFixtureAgeCategory(fixture = {}) {
  const explicitValues = [
    fixture.ageCategory,
    fixture.ageGroup,
    fixture.teamType,
    fixture.competitionAgeCategory,
    fixture.competitionType,
    fixture.cfg?.ageCategory,
    fixture.cfg?.ageGroup,
    fixture.cfg?.teamType,
    fixture.cfg?.competitionAgeCategory,
  ].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  const teamNames = [fixture.homeTeam, fixture.awayTeam, fixture.team, fixture.cfg?.name]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  if (explicitValues.some((value) => /(^|\W)u\s?\d{1,2}(\W|$)/.test(value)) || /\bu\s?\d{1,2}\b/.test(teamNames)) {
    return "youth";
  }
  if (explicitValues.some((value) => ADULT_CATEGORIES.has(value))) return "adult";
  return "unknown";
}

export function getFixtureOccupancy({ fixture = {}, timing = {} } = {}) {
  const playingMins = Math.max(1, toFiniteNumber(
    fixture.cfg?.gameMins ?? fixture.gameMins ?? fixture.manualMins ?? 70,
  ) ?? 70);
  const ageCategory = classifyFixtureAgeCategory(fixture);
  const adult = ageCategory === "adult";
  const halfTimeMins = Math.max(0, toFiniteNumber(
    adult
      ? timing.adultHalfTimeMins ?? timing.halfTimeMins
      : timing.youthHalfTimeMins ?? timing.halfTimeMins,
  ) ?? 0);
  const turnaroundMins = Math.max(0, toFiniteNumber(
    timing.turnaroundMins ??
    (adult
      ? timing.adultTurnaroundMins ?? timing.adultBuffer ?? timing.bufferAdult
      : timing.youthTurnaroundMins ?? timing.youthBuffer ?? timing.bufferYouth),
  ) ?? (adult ? 30 : 15));
  const koMins = toFiniteNumber(fixture.koMins) ?? timeToMinutes(fixture.koTime);
  const occupancyMins = playingMins + halfTimeMins + turnaroundMins;

  return {
    playingMins,
    ageCategory,
    halfTimeMins,
    turnaroundMins,
    occupancyMins,
    koMins,
    endMins: koMins == null ? null : koMins + occupancyMins,
  };
}
