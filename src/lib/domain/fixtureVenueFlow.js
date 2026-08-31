function clockToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function prepareAwayFixture(fixture = {}) {
  const koTime = fixture.koTime || fixture.kickOff || "";
  return {
    ...fixture,
    status: "away",
    venueRole: "away",
    isAwayFixture: true,
    requiresScheduling: false,
    pitchId: "",
    pitchLabel: "Away",
    koTime,
    koMins: fixture.koMins ?? clockToMinutes(koTime),
  };
}

export function partitionFixturesForScheduling(fixtures = []) {
  const home = [];
  const away = [];
  fixtures.forEach((fixture) => {
    if (fixture?.isAwayFixture || fixture?.venueRole === "away" || fixture?.requiresScheduling === false) away.push(prepareAwayFixture(fixture));
    else home.push(fixture);
  });
  return { home, away };
}

export function reverseAwayFixture(fixture = {}, { actor = "", now = new Date().toISOString() } = {}) {
  const reversedAt = new Date(now).toISOString();
  return {
    ...fixture,
    homeTeam: fixture.awayTeam || fixture.homeTeam,
    awayTeam: fixture.homeTeam || fixture.awayTeam,
    status: "active",
    venueRole: "home",
    isAwayFixture: false,
    requiresScheduling: true,
    pitchId: "",
    pitchLabel: "",
    venueReversal: {
      originalHomeTeam: fixture.homeTeam || "",
      originalAwayTeam: fixture.awayTeam || "",
      actor: String(actor || "").trim(),
      reversedAt,
    },
  };
}
