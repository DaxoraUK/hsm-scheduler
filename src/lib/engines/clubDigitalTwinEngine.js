import { TEAM_CONFIG_DEFAULT, PITCHES, DEFAULT_CLUB } from "../constants.js";
import { getWeekendParkingSnapshot } from "./parkingEngine.js";
import { calculateOfficialsReadiness } from "./officialsEngine.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPostponed(fixture = {}) {
  return clean(fixture.status) === "postponed";
}

function uniqueBy(items = [], keyGetter) {
  const seen = new Set();
  const out = [];

  items.forEach((item) => {
    const key = keyGetter(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });

  return out;
}

function getConfiguredTeams(club = {}) {
  const configured =
    asArray(club.teams).length > 0
      ? asArray(club.teams)
      : asArray(club.teamConfig).length > 0
        ? asArray(club.teamConfig)
        : asArray(club.teamSettings).length > 0
          ? asArray(club.teamSettings)
          : TEAM_CONFIG_DEFAULT;

  return configured.map((team, index) => ({
    ...team,
    id: team.id || team.teamId || clean(team.name || team.teamName || `team-${index}`),
    name: team.name || team.teamName || `Team ${index + 1}`,
    teamType: team.teamType || team.type || "youth",
  }));
}

function getSites(club = {}) {
  const sites = asArray(club.sites).length > 0 ? asArray(club.sites) : asArray(DEFAULT_CLUB.sites);

  return sites.map((site, index) => ({
    ...site,
    id: site.id || clean(site.name || `site-${index}`),
    name: site.name || site.venue || `Site ${index + 1}`,
    isPrimary: Boolean(site.isPrimary || site.id === club.primarySiteId || index === 0),
    carParkSpaces: toNumber(site.carParkSpaces, toNumber(club.carParkSpaces, 0)),
  }));
}

function getPitches(pitchCfg = []) {
  return asArray(pitchCfg).length > 0 ? asArray(pitchCfg) : PITCHES;
}

function getFixtureTeamText(fixture = {}) {
  return [
    fixture.team,
    fixture.teamName,
    fixture.ageGroup,
    fixture.homeTeam,
    fixture.home,
    fixture.name,
    fixture.title,
  ]
    .filter(Boolean)
    .join(" ");
}

function teamMatchScore(fixtureText, teamName) {
  const fixtureClean = clean(fixtureText);
  const teamClean = clean(teamName);
  if (!fixtureClean || !teamClean) return 0;

  if (fixtureClean === teamClean) return 100;
  if (fixtureClean.includes(teamClean)) return 90;

  const teamParts = teamClean.split(" ").filter((part) => part.length > 1);
  if (!teamParts.length) return 0;

  const matched = teamParts.filter((part) => fixtureClean.includes(part)).length;
  const ratio = matched / teamParts.length;

  if (ratio >= 1) return 80;
  if (ratio >= 0.65) return 60;
  if (ratio >= 0.45) return 35;
  return 0;
}

function findFixtureTeam(fixture = {}, teams = []) {
  const text = getFixtureTeamText(fixture);
  let best = null;
  let bestScore = 0;

  teams.forEach((team) => {
    const score = teamMatchScore(text, team.name);
    if (score > bestScore) {
      best = team;
      bestScore = score;
    }
  });

  if (best && bestScore >= 35) return best;

  const fallbackName = fixture.team || fixture.teamName || fixture.homeTeam || fixture.home || "Unknown team";
  return {
    id: clean(fallbackName),
    name: fallbackName,
    teamType: fixture.teamType || "unknown",
    inferred: true,
  };
}

function getWeatherLocation(club = {}, sites = []) {
  return (
    club.weatherPostcode ||
    club.groundPostcode ||
    club.postcode ||
    club.venuePostcode ||
    sites.find((site) => site.isPrimary)?.postcode ||
    sites[0]?.postcode ||
    ""
  );
}

function domainStatus(score, hasIssue = false) {
  if (hasIssue || score < 60) return "danger";
  if (score < 85) return "warning";
  return "success";
}

function domain({ id, label, score, summary, detail, status, icon }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(toNumber(score, 0))));
  return {
    id,
    label,
    score: safeScore,
    status: status || domainStatus(safeScore),
    summary,
    detail,
    icon,
  };
}

export function buildClubDigitalTwin({
  club = {},
  pitchCfg = [],
  closedPitches = [],
  satFinal = [],
  sunFinal = [],
  satHasRun = false,
  sunHasRun = false,
  officialConflicts = [],
  refWarnings = null,
  fixturesByDay = null,
} = {}) {
  const teams = getConfiguredTeams(club);
  const sites = getSites(club);
  const pitches = getPitches(pitchCfg);
  const closedPitchIds = new Set(asArray(closedPitches).map((pitch) => String(pitch?.id || pitch)));

  const satFixtures = satHasRun ? asArray(satFinal).filter((fixture) => !isPostponed(fixture)) : [];
  const sunFixtures = sunHasRun ? asArray(sunFinal).filter((fixture) => !isPostponed(fixture)) : [];
  const allFixtures = [
    ...(satHasRun ? asArray(satFinal) : []),
    ...(sunHasRun ? asArray(sunFinal) : []),
  ];
  const activeFixtures = [...satFixtures, ...sunFixtures];

  const fixtureTeamLinks = activeFixtures.map((fixture) => ({
    fixture,
    team: findFixtureTeam(fixture, teams),
  }));
  const scheduledTeams = uniqueBy(fixtureTeamLinks.map((link) => link.team), (team) => team.id || clean(team.name));
  const configuredTeamIds = new Set(teams.map((team) => team.id || clean(team.name)));
  const configuredScheduledTeams = scheduledTeams.filter((team) => configuredTeamIds.has(team.id || clean(team.name)));
  const inferredScheduledTeams = scheduledTeams.filter((team) => !configuredTeamIds.has(team.id || clean(team.name)));

  const activePitches = pitches.filter((pitch) => !closedPitchIds.has(String(pitch.id || pitch.label)));
  const weatherLocation = getWeatherLocation(club, sites);
  const parking = getWeekendParkingSnapshot({
    fixturesByDay: fixturesByDay || [
      { key: "saturday", label: "Saturday", fixtures: satFixtures },
      { key: "sunday", label: "Sunday", fixtures: sunFixtures },
    ],
    club,
    pitchCfg: pitches,
  });
  const officials = calculateOfficialsReadiness({
    fixtures: allFixtures,
    active: activeFixtures,
    officialConflicts,
    refWarnings,
  });

  const configurationScore = Math.round(
    ((sites.length > 0 ? 25 : 0) +
      (teams.length > 0 ? 25 : 0) +
      (pitches.length > 0 ? 25 : 0) +
      (weatherLocation ? 25 : 0))
  );
  const matchdayScore = activeFixtures.length > 0 ? 100 : 65;
  const resourceScore = pitches.length ? Math.max(40, Math.round((activePitches.length / pitches.length) * 100)) : 40;
  const weatherScore = weatherLocation ? 100 : 55;
  const communicationsScore = activeFixtures.length ? 95 : 70;

  const domains = [
    domain({
      id: "configuration",
      label: "Configuration",
      score: configurationScore,
      status: configurationScore >= 90 ? "success" : "warning",
      summary: configurationScore >= 90 ? "Ready" : "Review",
      detail: `${sites.length} site${sites.length === 1 ? "" : "s"}, ${teams.length} team${teams.length === 1 ? "" : "s"}, ${pitches.length} pitch${pitches.length === 1 ? "" : "es"} configured.`,
    }),
    domain({
      id: "matchday",
      label: "Matchday",
      score: matchdayScore,
      status: activeFixtures.length ? "success" : "warning",
      summary: activeFixtures.length ? "Ready" : "Waiting",
      detail: `${activeFixtures.length} active fixture${activeFixtures.length === 1 ? "" : "s"} scheduled.`,
    }),
    domain({
      id: "resources",
      label: "Resources",
      score: resourceScore,
      status: closedPitchIds.size ? "warning" : "success",
      summary: closedPitchIds.size ? "Review" : "Ready",
      detail: `${activePitches.length}/${pitches.length} pitches open across ${sites.length} site${sites.length === 1 ? "" : "s"}.`,
    }),
    domain({
      id: "parking",
      label: "Parking",
      score: parking.healthScore,
      status: parking.isOverCapacity ? "danger" : parking.isHighPressure || parking.isOverConcurrentLimit ? "warning" : "success",
      summary: parking.isOverCapacity ? "Action" : parking.isHighPressure || parking.isOverConcurrentLimit ? "Review" : "Ready",
      detail: parking.capacity
        ? parking.scope === "weekend-peak"
          ? `${parking.utilisation}% weekend peak on ${parking.peakDayLabel || "the busiest day"} at ${parking.peakTime}.`
          : `${parking.utilisation}% peak use at ${parking.peakTime}.`
        : "Parking capacity is not configured.",
    }),
    domain({
      id: "officials",
      label: "Officials",
      score: officials.score,
      status: officials.status,
      summary: officials.status === "success" ? "Ready" : officials.status === "warning" ? "Review" : "Action",
      detail: officials.summary,
    }),
    domain({
      id: "weather",
      label: "Weather",
      score: weatherScore,
      status: weatherLocation ? "success" : "warning",
      summary: weatherLocation ? "Ready" : "Review",
      detail: weatherLocation ? `Forecast location: ${weatherLocation}.` : "Add a venue/weather postcode.",
    }),
    domain({
      id: "communications",
      label: "Communications",
      score: communicationsScore,
      status: activeFixtures.length ? "success" : "warning",
      summary: activeFixtures.length ? "Ready" : "Waiting",
      detail: activeFixtures.length ? "Coach messages can be prepared." : "Build the schedule before preparing messages.",
    }),
  ];

  const overallScore = Math.round(domains.reduce((sum, item) => sum + item.score, 0) / Math.max(domains.length, 1));
  const hasDanger = domains.some((item) => item.status === "danger");
  const hasWarning = domains.some((item) => item.status === "warning");

  return {
    score: overallScore,
    status: hasDanger ? "danger" : hasWarning ? "warning" : "success",
    label: hasDanger ? "Action required" : hasWarning ? "Review required" : "Club ready",
    domains,
    metrics: {
      sites: sites.length,
      teamsConfigured: teams.length,
      teamsPlaying: configuredScheduledTeams.length || scheduledTeams.length,
      teamsInferred: inferredScheduledTeams.length,
      pitchesConfigured: pitches.length,
      pitchesAvailable: activePitches.length,
      fixturesScheduled: activeFixtures.length,
      officialsAssigned: officials.metrics.confirmed,
      officialsRequired: officials.metrics.fixtures,
      parkingPeakCars: parking.peakCars,
      parkingCapacity: parking.capacity,
      parkingUtilisation: parking.utilisation,
      parkingPeakDay: parking.peakDayLabel || parking.dayLabel || "Matchday",
      parkingPeakTime: parking.peakTime,
      parkingScope: parking.scope || "single-day",
      parkingDayBreakdown: parking.detailByDay || parking.dayBreakdown || [],
      saturdayParkingUtilisation: parking.detailByDay?.find((day) => day.key === "saturday")?.utilisation || 0,
      sundayParkingUtilisation: parking.detailByDay?.find((day) => day.key === "sunday")?.utilisation || 0,
      weatherLocation,
    },
    collections: {
      sites,
      teams,
      pitches,
      activePitches,
      fixtures: activeFixtures,
      satFixtures,
      sunFixtures,
      scheduledTeams,
      configuredScheduledTeams,
      inferredScheduledTeams,
    },
    parking,
    officials,
  };
}

export default buildClubDigitalTwin;
