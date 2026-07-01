import { AVG_CARS, DEFAULT_CLUB, PITCHES, TEAM_CONFIG_DEFAULT } from "../constants.js";

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function clean(value) {
  return String(value || "").trim();
}

function key(value) {
  return clean(value).toLowerCase();
}

function slug(value, fallback = "site") {
  const base = clean(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function inferTeamType(team = {}) {
  const explicit = key(team.teamType || team.type || team.category);
  if (["adult", "open-age", "open age", "senior", "seniors", "veteran", "veterans", "vets"].includes(explicit)) {
    return "adult";
  }
  if (["youth", "junior", "juniors", "mini", "minis"].includes(explicit)) {
    return "youth";
  }

  const name = key(team.name || team.teamName || team.label || team.homeTeam || team.awayTeam);
  if (/\bu\s?\d{1,2}\b/.test(name)) return "youth";
  if (
    name.includes("1st team") ||
    name.includes("first team") ||
    name.includes("reserves") ||
    name.includes("reserve") ||
    name.includes("open age") ||
    name.includes("open-age") ||
    name.includes("senior") ||
    name.includes("adult") ||
    name.includes("veteran") ||
    name.includes("vets") ||
    name.includes("sunday 1sts")
  ) {
    return "adult";
  }
  return "youth";
}

export function normaliseSites(club = DEFAULT_CLUB) {
  const rawSites = asArray(club.sites);
  const fallbackId = slug(club.primarySiteId || club.venue || club.name || "primary-site", "primary-site");

  const sites = rawSites.length
    ? rawSites.map((site, index) => {
        const id = clean(site.id) || slug(site.name || site.venue || `site-${index + 1}`, `site-${index + 1}`);
        return {
          ...site,
          id,
          name: clean(site.name || site.venue || `Site ${index + 1}`),
          venue: clean(site.venue || site.name || club.venue || ""),
          postcode: clean(site.postcode || site.weatherPostcode || club.postcode || ""),
          weatherPostcode: clean(site.weatherPostcode || site.postcode || club.weatherPostcode || club.postcode || ""),
          carParkSpaces: toNumber(site.carParkSpaces ?? site.parkingSpaces ?? site.capacity, toNumber(club.carParkSpaces, 0)),
          isPrimary: Boolean(site.isPrimary || site.id === club.primarySiteId),
        };
      })
    : [
        {
          id: fallbackId,
          name: clean(club.venue || club.name || "Primary Site"),
          venue: clean(club.venue || ""),
          postcode: clean(club.postcode || ""),
          weatherPostcode: clean(club.weatherPostcode || club.postcode || ""),
          carParkSpaces: toNumber(club.carParkSpaces, 0),
          isPrimary: true,
        },
      ];

  const primaryId = clean(club.primarySiteId) || sites.find((site) => site.isPrimary)?.id || sites[0]?.id || fallbackId;

  return sites.map((site, index) => ({
    ...site,
    isPrimary: site.id === primaryId || (!primaryId && index === 0),
  }));
}

export function normalisePitches(pitchCfg = PITCHES, club = DEFAULT_CLUB) {
  const sites = normaliseSites(club);
  const primarySiteId = sites.find((site) => site.isPrimary)?.id || sites[0]?.id || "primary-site";

  return asArray(pitchCfg, PITCHES).map((pitch) => ({
    ...pitch,
    id: clean(pitch.id || pitch.pitchId || pitch.label),
    label: clean(pitch.label || pitch.name || pitch.id),
    format: clean(pitch.format || pitch.pitchFormat || "11v11"),
    siteId: clean(pitch.siteId || pitch.venueId || pitch.groundId || primarySiteId),
    closed: Boolean(pitch.closed || pitch.isClosed),
  }));
}

export function normaliseTeams(teamCfg = TEAM_CONFIG_DEFAULT, club = DEFAULT_CLUB) {
  const sites = normaliseSites(club);
  const primarySiteId = sites.find((site) => site.isPrimary)?.id || sites[0]?.id || "primary-site";

  return asArray(teamCfg, TEAM_CONFIG_DEFAULT).map((team) => ({
    ...team,
    name: clean(team.name || team.teamName || team.label),
    teamType: inferTeamType(team),
    format: clean(team.format || team.pitchFormat || team.gameFormat || "11v11"),
    homeSiteId: clean(team.homeSiteId || team.siteId || team.venueId || primarySiteId),
  }));
}

export function getTeamForFixture(fixture = {}, teams = []) {
  const home = key(fixture.homeTeam || fixture.team || fixture.name);
  if (!home) return null;

  return teams.find((team) => {
    const teamName = key(team.name);
    if (!teamName) return false;
    return home.includes(teamName) || teamName.includes(home.replace(/^horwich st marys\s*/i, ""));
  }) || null;
}

export function getPitchForFixture(fixture = {}, pitches = []) {
  const pitchId = clean(fixture.pitchId || fixture.pitch || fixture.assignedPitch || fixture.defaultPitch);
  if (!pitchId) return null;

  const pitchKey = key(pitchId);
  return pitches.find((pitch) => key(pitch.id) === pitchKey || key(pitch.label) === pitchKey) || null;
}

export function getSiteForFixture(fixture = {}, config = {}) {
  const sites = config.sites || [];
  const pitches = config.pitches || [];
  const teams = config.teams || [];
  const primarySite = sites.find((site) => site.isPrimary) || sites[0] || null;

  const pitch = getPitchForFixture(fixture, pitches);
  if (pitch?.siteId) return sites.find((site) => site.id === pitch.siteId) || primarySite;

  const team = getTeamForFixture(fixture, teams);
  if (team?.homeSiteId) return sites.find((site) => site.id === team.homeSiteId) || primarySite;

  return primarySite;
}

export function getAvgCarsForFixture(fixture = {}, config = {}) {
  const club = config.club || DEFAULT_CLUB;
  const avgCars = club.avgCars || AVG_CARS;
  const format = clean(fixture.format || fixture.gameFormat || fixture.pitchFormat || getTeamForFixture(fixture, config.teams || [])?.format || "11v11");
  return toNumber(avgCars[format], toNumber(club.defaultCarsPerFixture, 20));
}

export function buildClubConfiguration({ club = DEFAULT_CLUB, teamCfg = TEAM_CONFIG_DEFAULT, pitchCfg = PITCHES } = {}) {
  const mergedClub = { ...DEFAULT_CLUB, ...club };
  const sites = normaliseSites(mergedClub);
  const pitches = normalisePitches(pitchCfg, mergedClub);
  const teams = normaliseTeams(teamCfg, mergedClub);
  const primarySite = sites.find((site) => site.isPrimary) || sites[0] || null;

  const siteMap = Object.fromEntries(sites.map((site) => [site.id, site]));
  const pitchMap = Object.fromEntries(pitches.map((pitch) => [pitch.id, pitch]));
  const teamMap = Object.fromEntries(teams.map((team) => [team.name, team]));

  return {
    club: mergedClub,
    sites,
    pitches,
    teams,
    primarySite,
    siteMap,
    pitchMap,
    teamMap,
    metrics: {
      sites: sites.length,
      teams: teams.length,
      youthTeams: teams.filter((team) => team.teamType === "youth").length,
      adultTeams: teams.filter((team) => team.teamType === "adult").length,
      pitches: pitches.length,
      closedPitches: pitches.filter((pitch) => pitch.closed).length,
      totalParkingCapacity: sites.reduce((total, site) => total + toNumber(site.carParkSpaces, 0), 0),
      primaryWeatherLocation: clean(primarySite?.weatherPostcode || mergedClub.weatherPostcode || mergedClub.postcode),
    },
  };
}

export default buildClubConfiguration;
