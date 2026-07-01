/**
 * Matchday Domain
 *
 * Canonical matchday model used by engines and pages. The goal is to move
 * Ground Control away from passing many independent arrays/settings into every
 * engine and towards one predictable object that can be enriched over time.
 */

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});

function asArray(value) {
  return Array.isArray(value) ? value : EMPTY_ARRAY;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : EMPTY_OBJECT;
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normaliseDay(day = "Saturday") {
  const text = String(day || "Saturday").toLowerCase();
  if (text.startsWith("sun")) return "Sunday";
  if (text.startsWith("sat")) return "Saturday";
  if (text === "weekend") return "Weekend";
  return day || "Matchday";
}

function getFixtureKey(fixture = {}, index = 0) {
  return (
    fixture.id ||
    fixture.fixtureId ||
    fixture.key ||
    `${fixture.home || fixture.homeTeam || "home"}-${fixture.away || fixture.awayTeam || "away"}-${fixture.koMins ?? "ko"}-${index}`
  );
}

function normaliseFixture(fixture = {}, index = 0) {
  const home = fixture.home || fixture.homeTeam || fixture.homeName || "Home";
  const away = fixture.away || fixture.awayTeam || fixture.awayName || "Away";
  const koMins = fixture.koMins ?? fixture.kickOffMins ?? fixture.startMins ?? null;
  const endMins = fixture.endMins ?? fixture.finishMins ?? null;

  return {
    ...fixture,
    id: getFixtureKey(fixture, index),
    home,
    away,
    label: fixture.label || `${home} vs ${away}`,
    koMins,
    endMins,
    pitchId: fixture.pitchId || fixture.pitch || fixture.assignedPitchId || null,
    status: fixture.status || "scheduled",
    isActive: fixture.status !== "postponed" && fixture.status !== "cancelled",
    isScheduled: koMins != null && endMins != null && Boolean(fixture.pitchId || fixture.pitch || fixture.assignedPitchId),
  };
}

function normalisePitch(pitch = {}, index = 0) {
  return {
    ...pitch,
    id: pitch.id || pitch.pitchId || pitch.name || `pitch-${index + 1}`,
    name: pitch.name || pitch.label || `Pitch ${index + 1}`,
    siteId: pitch.siteId || pitch.venueId || pitch.groundId || "primary",
    format: pitch.format || pitch.type || pitch.size || "Unknown",
    isClosed: Boolean(pitch.closed || pitch.isClosed || pitch.status === "closed"),
  };
}

function normaliseTeam(team = {}, index = 0) {
  const name = team.name || team.teamName || team.label || `Team ${index + 1}`;
  return {
    ...team,
    id: team.id || team.teamId || name,
    name,
    type: team.type || team.teamType || "youth",
    siteId: team.siteId || team.homeSiteId || team.venueId || "primary",
  };
}

function buildCounts(fixtures = [], pitches = [], teams = [], closedPitches = []) {
  const activeFixtures = fixtures.filter((fixture) => fixture.isActive);
  const scheduledFixtures = activeFixtures.filter((fixture) => fixture.isScheduled);
  const availablePitches = pitches.filter((pitch) => !pitch.isClosed);

  return {
    fixtures: fixtures.length,
    activeFixtures: activeFixtures.length,
    scheduledFixtures: scheduledFixtures.length,
    teams: teams.length,
    pitches: pitches.length,
    availablePitches: availablePitches.length,
    closedPitches: closedPitches.length || pitches.length - availablePitches.length,
  };
}

export function createMatchdayDomain({
  id,
  day = "Saturday",
  dateLabel = "Matchday",
  games = [],
  fixtures,
  teams = [],
  pitches = [],
  pitchCfg = [],
  venues = [],
  sites = [],
  club = {},
  settings = {},
  hasRun = false,
  overrides = {},
  closedPitches = [],
  parking = {},
  weather = {},
  officials = {},
  resources = {},
  communications = {},
  recommendations = {},
  health = {},
  analytics = {},
  metadata = {},
} = {}) {
  const normalisedDay = normaliseDay(day);
  const fixtureSource = fixtures || games || EMPTY_ARRAY;
  const pitchSource = pitches.length ? pitches : pitchCfg;

  const normalisedFixtures = asArray(fixtureSource).map(normaliseFixture);
  const normalisedPitches = asArray(pitchSource).map(normalisePitch);
  const normalisedTeams = asArray(teams).map(normaliseTeam);
  const normalisedClosedPitches = asArray(closedPitches);
  const activeFixtures = normalisedFixtures.filter((fixture) => fixture.isActive);
  const scheduledFixtures = activeFixtures.filter((fixture) => fixture.isScheduled);

  return {
    id: id || `${normalisedDay.toLowerCase()}-${String(dateLabel || "matchday").replace(/\s+/g, "-").toLowerCase()}`,
    kind: "matchday",
    day: normalisedDay,
    dateLabel,
    metadata: {
      ...asObject(metadata),
      hasRun: Boolean(hasRun),
      createdFrom: "matchdayDomain",
    },
    club: asObject(club),
    settings: asObject(settings),
    venues: asArray(venues.length ? venues : sites),
    sites: asArray(sites.length ? sites : venues),
    teams: normalisedTeams,
    pitches: normalisedPitches,
    pitchCfg: normalisedPitches,
    fixtures: normalisedFixtures,
    games: normalisedFixtures,
    activeFixtures,
    scheduledFixtures,
    hasRun: Boolean(hasRun),
    overrides: asObject(overrides),
    closedPitches: normalisedClosedPitches,
    parking: asObject(parking),
    weather: asObject(weather),
    officials: asObject(officials),
    resources: asObject(resources),
    communications: asObject(communications),
    recommendations: asObject(recommendations),
    health: asObject(health),
    analytics: asObject(analytics),
    counts: buildCounts(normalisedFixtures, normalisedPitches, normalisedTeams, normalisedClosedPitches),
  };
}

export function createMatchdayContext(args = {}) {
  return createMatchdayDomain(args);
}

export function enrichMatchday(matchday = {}, key, value) {
  if (!key) return createMatchdayDomain(matchday);
  const base = matchday?.kind === "matchday" ? matchday : createMatchdayDomain(matchday);
  return {
    ...base,
    [key]: value,
    metadata: {
      ...(base.metadata || {}),
      updatedAt: new Date().toISOString(),
      lastUpdatedSection: key,
    },
  };
}

export function enrichMatchdayMany(matchday = {}, updates = {}) {
  const base = matchday?.kind === "matchday" ? matchday : createMatchdayDomain(matchday);
  return {
    ...base,
    ...asObject(updates),
    metadata: {
      ...(base.metadata || {}),
      ...(updates.metadata || {}),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getActiveFixtures(games = []) {
  return asArray(games).filter((game) => game.status !== "postponed" && game.status !== "cancelled");
}

export function getScheduledFixtures(games = []) {
  return getActiveFixtures(games).filter((game) => {
    const koMins = game.koMins ?? game.kickOffMins ?? game.startMins;
    const endMins = game.endMins ?? game.finishMins;
    return koMins != null && endMins != null && Boolean(game.pitchId || game.pitch || game.assignedPitchId);
  });
}

export function getMatchdayFixtures(matchday = {}) {
  return asArray(matchday.fixtures || matchday.games);
}

export function getMatchdayActiveFixtures(matchday = {}) {
  return asArray(matchday.activeFixtures).length
    ? matchday.activeFixtures
    : getActiveFixtures(getMatchdayFixtures(matchday));
}

export function getMatchdayScheduledFixtures(matchday = {}) {
  return asArray(matchday.scheduledFixtures).length
    ? matchday.scheduledFixtures
    : getScheduledFixtures(getMatchdayFixtures(matchday));
}

export function getMatchdayPitchById(matchday = {}, pitchId) {
  if (!pitchId) return null;
  return asArray(matchday.pitches || matchday.pitchCfg).find(
    (pitch) => pitch.id === pitchId || pitch.pitchId === pitchId || pitch.name === pitchId
  ) || null;
}

export function getMatchdayParkingCapacity(matchday = {}, fallback = 0) {
  const parking = asObject(matchday.parking);
  const club = asObject(matchday.club);
  return safeNumber(
    parking.capacity || parking.parkingCapacity || club.parkingCapacity || club.carParkSpaces,
    fallback
  );
}

export default createMatchdayDomain;
