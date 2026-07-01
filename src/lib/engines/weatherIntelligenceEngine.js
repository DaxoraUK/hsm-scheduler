function normaliseText(value) {
  return String(value || "").trim();
}

function normalisePostcode(value) {
  return normaliseText(value).toUpperCase().replace(/\s+/g, " ");
}

function getPrimarySite(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];
  if (!sites.length) return null;
  return (
    sites.find((site) => site?.id && site.id === club.primarySiteId) ||
    sites.find((site) => site?.isPrimary) ||
    sites[0]
  );
}

function getFixtureSiteIds(fixtures = [], primarySiteId) {
  const ids = new Set();

  fixtures.forEach((fixture) => {
    const siteId = fixture?.siteId || fixture?.venueId || fixture?.groundId || primarySiteId;
    if (siteId) ids.add(siteId);
  });

  return Array.from(ids);
}

export function calculateWeatherIntelligence({ club = {}, fixtures = [], dateLabel = "" } = {}) {
  const primarySite = getPrimarySite(club);
  const primaryPostcode = normalisePostcode(
    club.weatherPostcode || primarySite?.weatherPostcode || primarySite?.postcode || club.postcode
  );
  const clubPostcode = normalisePostcode(club.postcode || primarySite?.postcode);
  const sites = Array.isArray(club.sites) ? club.sites : [];
  const fixtureSiteIds = getFixtureSiteIds(fixtures, club.primarySiteId || primarySite?.id);
  const fixtureSites = fixtureSiteIds
    .map((siteId) => sites.find((site) => site?.id === siteId) || null)
    .filter(Boolean);
  const missingPostcodeSites = fixtureSites.filter((site) => !normalisePostcode(site.postcode || site.weatherPostcode));
  const multiSite = sites.length > 1;

  const checks = [
    {
      id: "weather-location",
      label: "Weather location",
      status: primaryPostcode ? "ok" : "warn",
      message: primaryPostcode
        ? `Forecast location ready: ${primaryPostcode}.`
        : "Add a weather postcode in Club Settings before live weather can be used.",
    },
    {
      id: "club-postcode",
      label: "Ground postcode",
      status: clubPostcode ? "ok" : "warn",
      message: clubPostcode
        ? `Primary ground postcode set: ${clubPostcode}.`
        : "Add a ground postcode so weather, travel and site intelligence can use the venue location.",
    },
    {
      id: "multi-site",
      label: "Multi-site coverage",
      status: missingPostcodeSites.length ? "warn" : "ok",
      message: multiSite
        ? missingPostcodeSites.length
          ? `${missingPostcodeSites.length} active site needs a postcode before site-specific weather can run.`
          : `${fixtureSites.length || sites.length} site${(fixtureSites.length || sites.length) === 1 ? "" : "s"} ready for site-specific weather.`
        : "Single-site weather is ready for the primary ground.",
    },
  ];

  const warnings = checks.filter((check) => check.status === "warn").length;
  const status = warnings ? "warning" : "success";

  return {
    status,
    label: warnings ? "Setup needed" : "Ready",
    score: Math.max(0, 100 - warnings * 25),
    location: primaryPostcode || clubPostcode || "Not set",
    dateLabel,
    multiSite,
    siteCount: sites.length || 1,
    fixtureSiteCount: fixtureSites.length || (fixtures.length ? 1 : 0),
    checks,
    warnings,
    provider: "Foundation",
    forecast: null,
    nextSteps: primaryPostcode
      ? [
          "Connect a weather provider to fetch live matchday forecasts.",
          "Use weather risk to flag waterlogged pitches, high wind and unsafe travel conditions.",
          "Feed weather risk into the Day Optimiser before fixture moves are suggested.",
        ]
      : [
          "Add a venue/weather postcode in Club Settings.",
          "Assign pitches to sites for multi-site clubs.",
          "Connect a weather provider once locations are ready.",
        ],
  };
}
