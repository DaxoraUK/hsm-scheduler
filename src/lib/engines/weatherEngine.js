function clean(value) {
  return String(value || "").trim();
}

function normalisePostcode(value) {
  return clean(value).toUpperCase().replace(/\s+/g, " ");
}

function getSites(club = {}) {
  const sites = Array.isArray(club.sites) ? club.sites : [];

  if (sites.length) {
    return sites.map((site, index) => ({
      ...site,
      id: site.id || `site-${index + 1}`,
      name: site.name || site.label || (index === 0 ? "Primary" : `Site ${index + 1}`),
      postcode: normalisePostcode(site.postcode || site.weatherPostcode || ""),
      weatherPostcode: normalisePostcode(site.weatherPostcode || site.postcode || ""),
      weatherEnabled: site.weatherEnabled !== false,
      isPrimary: Boolean(site.isPrimary),
    }));
  }

  const fallbackPostcode = normalisePostcode(
    club.weatherPostcode || club.groundPostcode || club.postcode || club.venuePostcode || ""
  );

  return [
    {
      id: "primary",
      name: club.groundName || club.venue || club.name || "Primary",
      postcode: fallbackPostcode,
      weatherPostcode: fallbackPostcode,
      weatherEnabled: true,
      isPrimary: true,
      parkingCapacity: club.carParkCapacity || club.parkingCapacity || club.carCap,
    },
  ];
}

function getPrimarySite(club = {}, sites = getSites(club)) {
  return (
    sites.find((site) => site.id && site.id === club.primarySiteId) ||
    sites.find((site) => site.isPrimary) ||
    sites[0] ||
    null
  );
}

function getFixtureSiteIds(fixtures = [], primarySiteId) {
  const ids = new Set();

  fixtures.forEach((fixture) => {
    const siteId = fixture?.siteId || fixture?.venueId || fixture?.groundId || fixture?.homeSiteId || primarySiteId;
    if (siteId) ids.add(siteId);
  });

  return Array.from(ids);
}

function buildFoundationForecast(hasLocation) {
  if (!hasLocation) {
    return {
      temperature: "--",
      conditions: "Pending",
      wind: "--",
      rain: "Pending",
      pitchRisk: "Set",
      groundRisk: "Set",
    };
  }

  return {
    temperature: "18°",
    conditions: "Dry",
    wind: "9 mph",
    rain: "Low",
    pitchRisk: "Low",
    groundRisk: "Low",
  };
}

export function getWeatherSnapshot({ club = {}, fixtures = [], dateLabel = "" } = {}) {
  const sites = getSites(club);
  const primarySite = getPrimarySite(club, sites);
  const enabledSites = sites.filter((site) => site.weatherEnabled !== false);
  const primaryWeatherPostcode = normalisePostcode(
    club.weatherPostcode ||
      primarySite?.weatherPostcode ||
      primarySite?.postcode ||
      club.groundPostcode ||
      club.postcode ||
      club.venuePostcode ||
      ""
  );
  const clubPostcode = normalisePostcode(
    club.groundPostcode || club.postcode || club.venuePostcode || primarySite?.postcode || ""
  );

  const fixtureSiteIds = getFixtureSiteIds(fixtures, club.primarySiteId || primarySite?.id);
  const fixtureSites = fixtureSiteIds
    .map((siteId) => sites.find((site) => site.id === siteId) || null)
    .filter(Boolean);
  const activeWeatherSites = fixtureSites.length ? fixtureSites : enabledSites;
  const missingPostcodeSites = activeWeatherSites.filter(
    (site) => !normalisePostcode(site.weatherPostcode || site.postcode)
  );

  const hasLocation = Boolean(primaryWeatherPostcode || clubPostcode);
  const multiSite = sites.length > 1;
  const warnings = [
    !hasLocation,
    !clubPostcode,
    missingPostcodeSites.length > 0,
  ].filter(Boolean).length;

  const status = warnings ? "warning" : "success";
  const label = warnings ? "Setup needed" : "Ready";
  const score = Math.max(0, 100 - warnings * 25);
  const location = primaryWeatherPostcode || clubPostcode || "Not set";
  const venueName = primarySite?.name || club.groundName || club.venue || club.name || "Club ground";
  const provider = "Foundation";
  const forecast = buildFoundationForecast(hasLocation);

  const checks = [
    {
      id: "weather-location",
      label: "Weather location",
      status: hasLocation ? "ok" : "warn",
      message: hasLocation
        ? `Forecast location ready: ${location}.`
        : "Add a weather postcode in Settings before live weather can be used.",
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
          ? `${missingPostcodeSites.length} active site${missingPostcodeSites.length === 1 ? " needs" : "s need"} a postcode before site-specific weather can run.`
          : `${activeWeatherSites.length || sites.length} site${(activeWeatherSites.length || sites.length) === 1 ? "" : "s"} ready for site-specific weather.`
        : "Single-site weather is ready for the primary ground.",
    },
  ];

  return {
    status,
    label,
    score,
    location,
    postcode: location,
    venueName,
    dateLabel,
    hasLocation,
    multiSite,
    siteCount: sites.length || 1,
    fixtureSiteCount: fixtureSites.length || (fixtures.length ? 1 : 0),
    missingPostcodeSites,
    checks,
    warnings,
    provider,
    forecast,
    nextSteps: hasLocation
      ? [
          "Connect a weather provider to fetch live matchday forecasts.",
          "Use weather risk to flag waterlogged pitches, high wind and unsafe travel conditions.",
          "Feed weather risk into the Day Optimiser before fixture moves are suggested.",
        ]
      : [
          "Add a venue/weather postcode in Settings.",
          "Assign pitches to sites for multi-site clubs.",
          "Connect a weather provider once locations are ready.",
        ],
    debug: {
      source: "weatherEngine.getWeatherSnapshot",
      calculation: "foundation location/readiness only; no live provider call yet",
    },
  };
}

export default getWeatherSnapshot;
