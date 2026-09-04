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

function isAdultFixture(fixture = {}) {
  const teamName = String(fixture.homeTeam || fixture.cfg?.name || "").toLowerCase();
  if (/\bu\s?\d{1,2}\b/.test(teamName)) return false;
  const teamType = String(fixture.teamType || fixture.cfg?.teamType || "").toLowerCase();
  if (["adult", "open_age", "open age", "women", "veterans"].includes(teamType)) return true;
  return String(fixture.cfg?.format || fixture.format || "").toLowerCase() === "11v11";
}

export function getFixtureOccupancy({ fixture = {}, timing = {} } = {}) {
  const playingMins = Math.max(1, toFiniteNumber(
    fixture.cfg?.gameMins ?? fixture.gameMins ?? fixture.manualMins ?? 70,
  ) ?? 70);
  const adult = isAdultFixture(fixture);
  const halfTimeMins = Math.max(0, toFiniteNumber(
    adult
      ? timing.adultHalfTimeMins ?? timing.halfTimeMins
      : timing.youthHalfTimeMins ?? timing.halfTimeMins,
  ) ?? 0);
  const turnaroundMins = Math.max(0, toFiniteNumber(
    timing.turnaroundMins ??
    (adult
      ? timing.adultTurnaroundMins ?? timing.adultBuffer
      : timing.youthTurnaroundMins ?? timing.youthBuffer),
  ) ?? (adult ? 30 : 15));
  const koMins = toFiniteNumber(fixture.koMins) ?? timeToMinutes(fixture.koTime);
  const occupancyMins = playingMins + halfTimeMins + turnaroundMins;

  return {
    playingMins,
    halfTimeMins,
    turnaroundMins,
    occupancyMins,
    koMins,
    endMins: koMins == null ? null : koMins + occupancyMins,
  };
}
