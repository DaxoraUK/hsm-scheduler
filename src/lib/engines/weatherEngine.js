function clean(value) {
  return String(value ?? "").trim();
}

function normalisePostcode(value) {
  return clean(value).toUpperCase().replace(/\s+/g, " ");
}

function toNumber(value, fallback = null) {
  if (value === "" || value == null) return fallback;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
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
      weatherForecast: club.weatherForecast || club.forecast || club.weather || null,
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

function parseTimeMinutes(value) {
  if (Number.isFinite(Number(value))) return Number(value);
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutes(value) {
  if (!Number.isFinite(Number(value))) return "TBC";
  const minutes = Math.max(0, Number(value));
  const hours = Math.floor(minutes / 60) % 24;
  const mins = Math.floor(minutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getFixtureMinutes(fixture = {}) {
  return parseTimeMinutes(
    firstValue(fixture.koMins, fixture.kickoffMins, fixture.ko, fixture.koTime, fixture.kickOff, fixture.time)
  );
}

function fixtureLabel(fixture = {}) {
  const home = fixture.homeTeam || fixture.team || fixture.home || "Fixture";
  const away = fixture.awayTeam || fixture.opponent || fixture.away || "";
  return away ? `${home} vs ${away}` : home;
}

function isPostponed(fixture = {}) {
  return clean(fixture.status).toLowerCase() === "postponed";
}

function extractForecastSource(club = {}, primarySite = null) {
  const candidates = [
    club.weatherForecast,
    club.matchdayWeather,
    club.forecast,
    club.weather,
    primarySite?.weatherForecast,
    primarySite?.matchdayWeather,
    primarySite?.forecast,
    primarySite?.weather,
  ];

  return candidates.find((candidate) => candidate && typeof candidate === "object") || null;
}

function normaliseForecast(source = null) {
  if (!source || typeof source !== "object") {
    return {
      available: false,
      provider: "Not connected",
      temperatureC: null,
      windMph: null,
      rainProbability: null,
      rainfallMm: null,
      conditions: "Forecast unavailable",
      updatedAt: null,
      hourly: [],
    };
  }

  const current = source.current && typeof source.current === "object" ? source.current : source;
  const hourlySource = firstValue(source.hourly, source.hours, source.timeline, current.hourly);

  const hourly = asArray(hourlySource)
    .map((hour, index) => {
      const timeValue = firstValue(hour.time, hour.datetime, hour.dateTime, hour.label, hour.hour, hour.koMins);
      const timeMins = parseTimeMinutes(timeValue);
      const temperatureC = toNumber(firstValue(hour.temperatureC, hour.tempC, hour.temperature, hour.temp));
      const windMph = toNumber(firstValue(hour.windMph, hour.windSpeedMph, hour.windSpeed, hour.wind));
      const rainProbability = toNumber(firstValue(
        hour.rainProbability,
        hour.precipitationProbability,
        hour.chanceOfRain,
        hour.rainPercent,
        hour.pop
      ));
      const rainfallMm = toNumber(firstValue(hour.rainfallMm, hour.precipitationMm, hour.rainMm, hour.precipitation));

      return {
        id: hour.id || `weather-hour-${index}`,
        time: clean(timeValue) || (timeMins != null ? formatMinutes(timeMins) : `Hour ${index + 1}`),
        timeMins,
        temperatureC,
        windMph,
        rainProbability: rainProbability == null ? null : clamp(rainProbability),
        rainfallMm,
        conditions: clean(firstValue(hour.conditions, hour.condition, hour.summary, hour.description)) || "Forecast",
      };
    })
    .filter((hour) => hour.timeMins != null || hour.temperatureC != null || hour.windMph != null || hour.rainProbability != null);

  const temperatureC = toNumber(firstValue(current.temperatureC, current.tempC, current.temperature, current.temp));
  const windMph = toNumber(firstValue(current.windMph, current.windSpeedMph, current.windSpeed, current.wind));
  const rainProbability = toNumber(firstValue(
    current.rainProbability,
    current.precipitationProbability,
    current.chanceOfRain,
    current.rainPercent,
    current.pop
  ));
  const rainfallMm = toNumber(firstValue(current.rainfallMm, current.precipitationMm, current.rainMm, current.precipitation));
  const conditions = clean(firstValue(current.conditions, current.condition, current.summary, current.description)) || "Forecast available";
  const provider = clean(firstValue(source.provider, source.source, current.provider, current.source)) || "Connected feed";
  const updatedAt = firstValue(source.updatedAt, source.generatedAt, source.observedAt, current.updatedAt, current.time) || null;

  const available = Boolean(
    hourly.length ||
      temperatureC != null ||
      windMph != null ||
      rainProbability != null ||
      rainfallMm != null ||
      conditions !== "Forecast available"
  );

  return {
    available,
    provider,
    temperatureC,
    windMph,
    rainProbability: rainProbability == null ? null : clamp(rainProbability),
    rainfallMm,
    conditions,
    updatedAt,
    hourly,
  };
}

function getRiskLevel({ temperatureC, windMph, rainProbability, rainfallMm } = {}) {
  const reasons = [];
  let points = 0;

  if (rainProbability != null) {
    if (rainProbability >= 80) {
      points += 4;
      reasons.push("very high rain probability");
    } else if (rainProbability >= 55) {
      points += 2;
      reasons.push("elevated rain probability");
    } else if (rainProbability >= 35) {
      points += 1;
      reasons.push("possible rain");
    }
  }

  if (rainfallMm != null) {
    if (rainfallMm >= 8) {
      points += 4;
      reasons.push("heavy rainfall");
    } else if (rainfallMm >= 3) {
      points += 2;
      reasons.push("meaningful rainfall");
    } else if (rainfallMm >= 1) {
      points += 1;
      reasons.push("light rainfall");
    }
  }

  if (windMph != null) {
    if (windMph >= 40) {
      points += 4;
      reasons.push("very strong wind");
    } else if (windMph >= 28) {
      points += 2;
      reasons.push("strong wind");
    } else if (windMph >= 20) {
      points += 1;
      reasons.push("breezy conditions");
    }
  }

  if (temperatureC != null) {
    if (temperatureC <= 0) {
      points += 4;
      reasons.push("freezing temperature");
    } else if (temperatureC <= 3) {
      points += 2;
      reasons.push("frost risk");
    } else if (temperatureC >= 32) {
      points += 4;
      reasons.push("extreme heat");
    } else if (temperatureC >= 28) {
      points += 2;
      reasons.push("high heat");
    }
  }

  if (points >= 6) return { key: "high", label: "High risk", status: "danger", points, reasons };
  if (points >= 3) return { key: "medium", label: "Watch", status: "warning", points, reasons };
  return { key: "low", label: "Low risk", status: "success", points, reasons };
}

function findClosestHour(hourly = [], fixtureMinutes = null) {
  if (fixtureMinutes == null || !hourly.length) return null;

  return [...hourly]
    .filter((hour) => hour.timeMins != null)
    .sort((a, b) => Math.abs(a.timeMins - fixtureMinutes) - Math.abs(b.timeMins - fixtureMinutes))[0] || null;
}

function analyseFixtureExposure(fixtures = [], forecast = {}) {
  const activeFixtures = asArray(fixtures).filter((fixture) => !isPostponed(fixture));

  return activeFixtures.map((fixture, index) => {
    const timeMins = getFixtureMinutes(fixture);
    const hour = findClosestHour(forecast.hourly, timeMins);
    const source = hour || forecast;
    const risk = getRiskLevel(source);

    return {
      id: fixture.id || fixture.fixtureId || `weather-fixture-${index}`,
      label: fixtureLabel(fixture),
      time: timeMins == null ? "TBC" : formatMinutes(timeMins),
      timeMins,
      forecastTime: hour?.time || null,
      conditions: source.conditions || forecast.conditions,
      temperatureC: source.temperatureC,
      windMph: source.windMph,
      rainProbability: source.rainProbability,
      rainfallMm: source.rainfallMm,
      risk,
      fixture,
    };
  });
}

function buildRiskWindows(exposures = []) {
  const groups = new Map();

  exposures.forEach((exposure) => {
    if (exposure.risk.key === "low") return;
    const key = exposure.forecastTime || exposure.time || "Matchday";
    const current = groups.get(key) || {
      id: `weather-window-${String(key).replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
      label: key,
      risk: exposure.risk,
      fixtures: [],
      conditions: exposure.conditions,
      temperatureC: exposure.temperatureC,
      windMph: exposure.windMph,
      rainProbability: exposure.rainProbability,
      rainfallMm: exposure.rainfallMm,
    };

    current.fixtures.push(exposure);
    if (exposure.risk.points > current.risk.points) current.risk = exposure.risk;
    groups.set(key, current);
  });

  return [...groups.values()].sort((a, b) => {
    if (b.risk.points !== a.risk.points) return b.risk.points - a.risk.points;
    return (a.fixtures[0]?.timeMins ?? Number.MAX_SAFE_INTEGER) - (b.fixtures[0]?.timeMins ?? Number.MAX_SAFE_INTEGER);
  });
}

function buildActions({ hasLocation, forecast, overallRisk, exposures, missingPostcodeSites } = {}) {
  const actions = [];

  if (!hasLocation) {
    actions.push({
      id: "weather-set-location",
      priority: "high",
      title: "Set the ground weather location",
      detail: "Add a venue postcode so Ground Control can connect forecasts to the correct site.",
    });
  }

  if (hasLocation && !forecast.available) {
    actions.push({
      id: "weather-connect-provider",
      priority: "medium",
      title: "Connect a live forecast provider",
      detail: "The venue is ready, but no live weather data is currently available to assess fixture risk.",
    });
  }

  if (missingPostcodeSites?.length) {
    actions.push({
      id: "weather-complete-sites",
      priority: "medium",
      title: "Complete site weather coverage",
      detail: `${missingPostcodeSites.length} active site${missingPostcodeSites.length === 1 ? " needs" : "s need"} a postcode for site-specific forecasting.`,
    });
  }

  const highRiskFixtures = exposures.filter((item) => item.risk.key === "high");
  const watchFixtures = exposures.filter((item) => item.risk.key === "medium");

  if (highRiskFixtures.length) {
    actions.push({
      id: "weather-inspect-high-risk",
      priority: "high",
      title: "Inspect high-risk fixtures before publishing",
      detail: `${highRiskFixtures.length} fixture${highRiskFixtures.length === 1 ? " is" : "s are"} exposed to high weather risk. Confirm surface condition and contingency options.`,
    });
  } else if (watchFixtures.length) {
    actions.push({
      id: "weather-monitor-watch",
      priority: "medium",
      title: "Monitor the forecast before matchday",
      detail: `${watchFixtures.length} fixture${watchFixtures.length === 1 ? " sits" : "s sit"} in a weather watch window. Recheck before coach communications are sent.`,
    });
  }

  const windMph = forecast.windMph;
  const rainProbability = forecast.rainProbability;
  const rainfallMm = forecast.rainfallMm;
  const temperatureC = forecast.temperatureC;

  if ((windMph ?? 0) >= 28) {
    actions.push({
      id: "weather-secure-site",
      priority: overallRisk.key === "high" ? "high" : "medium",
      title: "Secure portable equipment",
      detail: "Check goals, corner flags, gazebos, signs and temporary barriers before teams arrive.",
    });
  }

  if ((rainProbability ?? 0) >= 55 || (rainfallMm ?? 0) >= 3) {
    actions.push({
      id: "weather-pitch-inspection",
      priority: overallRisk.key === "high" ? "high" : "medium",
      title: "Schedule a pitch inspection",
      detail: "Prioritise grass surfaces, drainage trouble spots and the earliest kick-offs.",
    });
  }

  if (temperatureC != null && temperatureC <= 3) {
    actions.push({
      id: "weather-frost-check",
      priority: temperatureC <= 0 ? "high" : "medium",
      title: "Plan a frost inspection",
      detail: "Inspect shaded areas and high-wear goalmouths before opening the site.",
    });
  }

  if (temperatureC != null && temperatureC >= 28) {
    actions.push({
      id: "weather-heat-plan",
      priority: temperatureC >= 32 ? "high" : "medium",
      title: "Activate the heat plan",
      detail: "Prepare water points, shade, additional breaks and coach guidance.",
    });
  }

  if (!actions.length) {
    actions.push({
      id: "weather-ready",
      priority: "low",
      title: "Weather conditions look manageable",
      detail: "Keep the forecast under review and complete the normal pre-matchday site inspection.",
    });
  }

  return actions.slice(0, 6);
}

function formatMetric(value, suffix = "", fallback = "—") {
  return value == null ? fallback : `${Math.round(value)}${suffix}`;
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
  const location = primaryWeatherPostcode || clubPostcode || "Not set";
  const venueName = primarySite?.name || club.groundName || club.venue || club.name || "Club ground";
  const source = extractForecastSource(club, primarySite);
  const forecastData = normaliseForecast(source);
  const overallRisk = forecastData.available ? getRiskLevel(forecastData) : {
    key: "unknown",
    label: "Not assessed",
    status: hasLocation ? "warning" : "warning",
    points: 0,
    reasons: [],
  };
  const exposures = forecastData.available ? analyseFixtureExposure(fixtures, forecastData) : [];
  const riskWindows = buildRiskWindows(exposures);
  const highRiskFixtures = exposures.filter((item) => item.risk.key === "high");
  const watchFixtures = exposures.filter((item) => item.risk.key === "medium");
  const warnings = [
    !hasLocation,
    !clubPostcode,
    missingPostcodeSites.length > 0,
    !forecastData.available,
    highRiskFixtures.length > 0,
    watchFixtures.length > 0,
  ].filter(Boolean).length;

  let status = "success";
  let label = "Ready";
  if (!hasLocation || !forecastData.available || watchFixtures.length || missingPostcodeSites.length) {
    status = "warning";
    label = !forecastData.available ? "Forecast needed" : "Watch";
  }
  if (highRiskFixtures.length || overallRisk.key === "high") {
    status = "danger";
    label = "Action needed";
  }

  const setupPenalty = (!hasLocation ? 35 : 0) + (!forecastData.available ? 30 : 0) + (missingPostcodeSites.length ? 10 : 0);
  const riskPenalty = highRiskFixtures.length * 8 + watchFixtures.length * 3 + (overallRisk.key === "high" ? 15 : overallRisk.key === "medium" ? 7 : 0);
  const score = Math.max(0, 100 - setupPenalty - Math.min(35, riskPenalty));

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
      id: "weather-provider",
      label: "Forecast feed",
      status: forecastData.available ? "ok" : "warn",
      message: forecastData.available
        ? `${forecastData.provider} data is available for operational assessment.`
        : "No live forecast feed is connected yet. Ground Control will not invent weather conditions.",
    },
    {
      id: "multi-site",
      label: "Site coverage",
      status: missingPostcodeSites.length ? "warn" : "ok",
      message: multiSite
        ? missingPostcodeSites.length
          ? `${missingPostcodeSites.length} active site${missingPostcodeSites.length === 1 ? " needs" : "s need"} a postcode before site-specific weather can run.`
          : `${activeWeatherSites.length || sites.length} site${(activeWeatherSites.length || sites.length) === 1 ? "" : "s"} ready for site-specific weather.`
        : "Single-site weather is ready for the primary ground.",
    },
  ];

  const actions = buildActions({
    hasLocation,
    forecast: forecastData,
    overallRisk,
    exposures,
    missingPostcodeSites,
  });

  const decision = !hasLocation
    ? {
        headline: "Set the venue location before relying on weather intelligence",
        detail: "Ground Control needs a postcode to connect forecasts to the correct site.",
      }
    : !forecastData.available
      ? {
          headline: "Venue ready — live forecast still required",
          detail: "The location is configured, but there is no provider data to assess rain, wind, frost or heat risk.",
        }
      : highRiskFixtures.length
        ? {
            headline: `${highRiskFixtures.length} fixture${highRiskFixtures.length === 1 ? " needs" : "s need"} a weather decision`,
            detail: "Review the highest-risk time windows before confirming pitches and sending coach messages.",
          }
        : watchFixtures.length
          ? {
              headline: `${watchFixtures.length} fixture${watchFixtures.length === 1 ? " is" : "s are"} in a weather watch window`,
              detail: "Conditions may be manageable, but a forecast recheck and site inspection are advised.",
            }
          : {
              headline: "No material weather risk detected",
              detail: "Continue with normal site checks and keep the forecast under review.",
            };

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
    provider: forecastData.provider,
    forecastAvailable: forecastData.available,
    updatedAt: forecastData.updatedAt,
    overallRisk,
    decision,
    actions,
    riskWindows,
    fixtureExposure: exposures,
    highRiskFixtures,
    watchFixtures,
    metrics: {
      fixtures: exposures.length,
      highRisk: highRiskFixtures.length,
      watch: watchFixtures.length,
      riskWindows: riskWindows.length,
    },
    forecast: {
      temperature: formatMetric(forecastData.temperatureC, "°"),
      temperatureC: forecastData.temperatureC,
      conditions: forecastData.available ? forecastData.conditions : "Not connected",
      wind: formatMetric(forecastData.windMph, " mph"),
      windMph: forecastData.windMph,
      rain: forecastData.rainProbability == null ? "—" : `${Math.round(forecastData.rainProbability)}%`,
      rainProbability: forecastData.rainProbability,
      rainfall: formatMetric(forecastData.rainfallMm, " mm"),
      rainfallMm: forecastData.rainfallMm,
      pitchRisk: overallRisk.label,
      groundRisk: overallRisk.label,
      hourly: forecastData.hourly,
    },
    nextSteps: actions.map((action) => action.title),
    debug: {
      source: "weatherEngine.getWeatherSnapshot",
      calculation: forecastData.available
        ? "location readiness plus supplied forecast risk assessment"
        : "location readiness only; no forecast provider data supplied",
    },
  };
}

export default getWeatherSnapshot;
