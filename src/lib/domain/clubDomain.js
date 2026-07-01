/**
 * Club Domain
 *
 * Canonical club model. Engines and pages should use these helpers rather than
 * reading raw settings directly. This keeps venue/site/team/pitch lookups in
 * one place and supports the Club Digital Twin work.
 */

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getClubName(club = {}) {
  return club?.name || club?.clubName || club?.displayName || "Ground Control Club";
}

export function getClubTeams(club = {}, fallbackTeams = []) {
  const teams = asArray(club?.teams).length ? club.teams : fallbackTeams;
  return asArray(teams).map((team, index) => {
    const name = team.name || team.teamName || team.label || `Team ${index + 1}`;
    return {
      ...team,
      id: team.id || team.teamId || name,
      name,
      type: team.type || team.teamType || "youth",
      siteId: team.siteId || team.homeSiteId || team.venueId || "primary",
      competitionId: team.competitionId || team.leagueId || null,
    };
  });
}

export function getClubSites(club = {}) {
  const sites = Array.isArray(club?.sites) ? club.sites : [];

  if (sites.length > 0) {
    return sites.map((site, index) => ({
      ...site,
      id: site.id || site.key || `site-${index + 1}`,
      name: site.name || site.label || `Site ${index + 1}`,
      postcode: site.postcode || site.weatherPostcode || site.venuePostcode || "",
      weatherPostcode: site.weatherPostcode || site.postcode || "",
      isPrimary: Boolean(site.isPrimary || site.primary),
      parkingCapacity: safeNumber(site.parkingCapacity || site.spaces || site.carParkSpaces, 0),
      facilities: asArray(site.facilities),
      raw: site,
    }));
  }

  return [
    {
      id: "primary",
      name: club?.venue || club?.groundName || club?.siteName || "Primary Site",
      postcode: club?.weatherPostcode || club?.postcode || club?.venuePostcode || "",
      weatherPostcode: club?.weatherPostcode || club?.postcode || club?.venuePostcode || "",
      isPrimary: true,
      parkingCapacity: safeNumber(club?.parkingCapacity || club?.carParkSpaces, 0),
      facilities: asArray(club?.facilities),
      raw: club,
    },
  ];
}

export function getPrimarySite(club = {}) {
  const sites = getClubSites(club);
  return sites.find((site) => site.isPrimary) || sites[0] || null;
}

export function getSiteById(club = {}, siteId = "primary") {
  return getClubSites(club).find((site) => site.id === siteId) || getPrimarySite(club);
}

export function getWeatherPostcode(club = {}) {
  const primary = getPrimarySite(club);
  return (
    club?.weatherPostcode ||
    primary?.weatherPostcode ||
    primary?.postcode ||
    club?.postcode ||
    club?.venuePostcode ||
    ""
  );
}

export function getParkingCapacity(club = {}, fallback = 0) {
  const primary = getPrimarySite(club);
  const capacity = safeNumber(
    club?.parkingCapacity || club?.carParkSpaces || primary?.parkingCapacity || fallback,
    fallback
  );

  return Number.isFinite(capacity) ? capacity : 0;
}

export function getClubPitches(club = {}, fallbackPitches = []) {
  const pitches = asArray(club?.pitches).length ? club.pitches : fallbackPitches;
  return asArray(pitches).map((pitch, index) => ({
    ...pitch,
    id: pitch.id || pitch.pitchId || pitch.name || `pitch-${index + 1}`,
    name: pitch.name || pitch.label || `Pitch ${index + 1}`,
    siteId: pitch.siteId || pitch.venueId || pitch.groundId || "primary",
    format: pitch.format || pitch.type || pitch.size || "Unknown",
    isClosed: Boolean(pitch.closed || pitch.isClosed || pitch.status === "closed"),
  }));
}

export function createClubDomain({
  club = {},
  teams = [],
  pitches = [],
  competitions = [],
  officials = [],
  resources = {},
  matchdays = [],
} = {}) {
  const sites = getClubSites(club);
  const normalisedTeams = getClubTeams(club, teams);
  const normalisedPitches = getClubPitches(club, pitches);

  return {
    kind: "club",
    id: club.id || club.clubId || "club",
    name: getClubName(club),
    raw: club,
    sites,
    primarySite: getPrimarySite(club),
    teams: normalisedTeams,
    pitches: normalisedPitches,
    competitions: asArray(club.competitions).length ? club.competitions : asArray(competitions),
    officials: asArray(club.officials).length ? club.officials : asArray(officials),
    resources: resources || {},
    matchdays: asArray(matchdays),
    readiness: {
      hasSites: sites.length > 0,
      hasWeatherPostcode: Boolean(getWeatherPostcode(club)),
      hasParkingCapacity: getParkingCapacity(club) > 0,
      hasTeams: normalisedTeams.length > 0,
      hasPitches: normalisedPitches.length > 0,
    },
    counts: {
      sites: sites.length,
      teams: normalisedTeams.length,
      pitches: normalisedPitches.length,
      competitions: asArray(competitions).length,
      officials: asArray(officials).length,
      matchdays: asArray(matchdays).length,
    },
  };
}

export default createClubDomain;
