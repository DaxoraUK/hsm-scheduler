function clean(value) {
  return String(value ?? "").trim();
}

export function normaliseSiteKey(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getClubSites(club = {}) {
  const source = Array.isArray(club.sites) ? club.sites : [];
  if (source.length) {
    return source.map((site, index) => ({
      ...site,
      id: clean(site.id) || normaliseSiteKey(site.name || site.venue) || `site-${index + 1}`,
      name: clean(site.name || site.venue) || `Site ${index + 1}`,
      venue: clean(site.venue || site.name),
      postcode: clean(site.postcode).toUpperCase(),
      isPrimary: Boolean(site.isPrimary) || clean(site.id) === clean(club.primarySiteId) || (!club.primarySiteId && index === 0),
      carParkSpaces: Math.max(0, Number(site.carParkSpaces ?? club.carParkSpaces) || 0),
      weatherEnabled: site.weatherEnabled !== false,
      notes: clean(site.notes),
    }));
  }

  return [{
    id: clean(club.primarySiteId) || "main-ground",
    name: clean(club.venue) || "Main Ground",
    venue: clean(club.venue),
    postcode: clean(club.postcode || club.weatherPostcode).toUpperCase(),
    isPrimary: true,
    carParkSpaces: Math.max(0, Number(club.carParkSpaces) || 0),
    weatherEnabled: true,
    notes: "",
  }];
}

export function getPrimarySite(sites = []) {
  return sites.find((site) => site?.isPrimary) || sites[0] || null;
}

const PRIMARY_ALIASES = new Set([
  "primary",
  "main",
  "main-ground",
  "main-site",
  "default",
  "home-ground",
  "home-site",
]);

export function resolveSiteId(value, sites = [], fallbackSiteId = "") {
  const rows = Array.isArray(sites) ? sites.filter(Boolean) : [];
  const primary = getPrimarySite(rows);
  const fallback = clean(fallbackSiteId) || clean(primary?.id);
  const raw = clean(value);

  if (!raw) return fallback;

  const exact = rows.find((site) => clean(site.id) === raw);
  if (exact) return exact.id;

  const key = normaliseSiteKey(raw);
  const semantic = rows.find((site) => [site.id, site.name, site.venue]
    .some((candidate) => normaliseSiteKey(candidate) === key));
  if (semantic) return semantic.id;

  if (PRIMARY_ALIASES.has(key)) return fallback || raw;

  // A one-site club cannot have a meaningful alternative assignment. This
  // safely repairs historic identifiers such as "scholes-bank" after the
  // primary venue record has been recreated as "main-ground".
  if (rows.length === 1) return rows[0].id;

  return raw;
}

export function reconcileSiteAssignments({ club = {}, teams = [], pitches = [] } = {}) {
  const sites = getClubSites(club);
  const primary = getPrimarySite(sites);
  const primarySiteId = primary?.id || clean(club.primarySiteId) || "main-ground";
  let repairedTeams = 0;
  let repairedPitches = 0;

  const nextTeams = (Array.isArray(teams) ? teams : []).map((team) => {
    const current = clean(team?.siteId || team?.homeSiteId || team?.venueId || team?.groundId);
    const resolved = resolveSiteId(current, sites, primarySiteId);
    if (resolved && resolved !== current) repairedTeams += 1;
    return { ...team, siteId: resolved || primarySiteId };
  });

  const nextPitches = (Array.isArray(pitches) ? pitches : []).map((pitch) => {
    const current = clean(pitch?.siteId || pitch?.venueId || pitch?.groundId);
    const resolved = resolveSiteId(current, sites, primarySiteId);
    if (resolved && resolved !== current) repairedPitches += 1;
    return { ...pitch, siteId: resolved || primarySiteId };
  });

  return {
    sites,
    primarySiteId,
    teams: nextTeams,
    pitches: nextPitches,
    repairedTeams,
    repairedPitches,
  };
}
