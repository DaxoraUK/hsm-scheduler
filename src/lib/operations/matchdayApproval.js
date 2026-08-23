function clean(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function buildMatchdaySnapshot(fixtures = []) {
  return (Array.isArray(fixtures) ? fixtures : [])
    .filter((fixture) => fixture?.status !== "postponed")
    .map((fixture) => ({
      id: clean(fixture?.id || fixture?.fixtureId),
      home: clean(fixture?.home || fixture?.homeTeam || fixture?.team),
      away: clean(fixture?.away || fixture?.awayTeam || fixture?.opposition),
      date: clean(fixture?.date || fixture?.fixtureDate),
      time: clean(fixture?.time || fixture?.kickOff || fixture?.ko),
      pitch: clean(fixture?.pitch || fixture?.pitchId),
      official: clean(fixture?.referee || fixture?.official || fixture?.ref),
      status: clean(fixture?.status || "scheduled"),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

export function buildMatchdaySnapshotHash(fixtures = []) {
  const value = JSON.stringify(buildMatchdaySnapshot(fixtures));
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
