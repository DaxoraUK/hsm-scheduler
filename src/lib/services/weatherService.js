import { tenantGetJson, tenantSetJson } from "../storage/tenantStorage.js";

import { createPlatformService } from "./serviceRegistry.js";

const POSTCODE_API_BASE = "https://api.postcodes.io/postcodes";
const OPEN_METEO_FREE_API = "https://api.open-meteo.com/v1/forecast";
const CACHE_PREFIX = "liveWeather:";
const FRESH_CACHE_MS = 15 * 60 * 1000;
const STALE_CACHE_MS = 6 * 60 * 60 * 1000;
const memoryCache = new Map();

function getViteEnv() {
  try {
    return import.meta.env || {};
  } catch (_error) {
    return {};
  }
}

function getForecastEndpoint() {
  const env = getViteEnv();
  const proxyUrl = clean(env.VITE_OPEN_METEO_PROXY_URL || "");
  if (proxyUrl) {
    return { url: proxyUrl, usageMode: "server-proxy" };
  }

  const developmentMode = env.DEV === true || env.MODE === "development" || env.PROD !== true;
  if (developmentMode) {
    return { url: OPEN_METEO_FREE_API, usageMode: "evaluation" };
  }

  const error = new Error(
    "Live weather is temporarily unavailable. Try again later or contact support if the problem continues."
  );
  error.code = "WEATHER_PROVIDER_NOT_CONFIGURED";
  throw error;
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalisePostcode(value) {
  return clean(value).toUpperCase().replace(/\s+/g, " ");
}

function compactPostcode(value) {
  return normalisePostcode(value).replace(/\s+/g, "");
}

function getUkTodayIso() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function toIsoDate(value) {
  if (!value) return getUkTodayIso();
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

function dateDifferenceDays(date) {
  const target = new Date(`${date}T12:00:00Z`);
  const todayIso = getUkTodayIso();
  const today = new Date(`${todayIso}T12:00:00Z`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getWeatherCodeLabel(code) {
  const value = Number(code);
  if (value === 0) return "Clear";
  if ([1, 2].includes(value)) return "Partly cloudy";
  if (value === 3) return "Overcast";
  if ([45, 48].includes(value)) return "Fog";
  if ([51, 53, 55].includes(value)) return "Drizzle";
  if ([56, 57].includes(value)) return "Freezing drizzle";
  if ([61, 63, 65].includes(value)) return "Rain";
  if ([66, 67].includes(value)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(value)) return "Snow";
  if ([80, 81, 82].includes(value)) return "Rain showers";
  if ([85, 86].includes(value)) return "Snow showers";
  if ([95, 96, 99].includes(value)) return "Thunderstorms";
  return "Forecast";
}

function parseKickoffMinutes(fixture = {}) {
  const candidate = fixture.koMins ?? fixture.kickoffMins ?? fixture.ko ?? fixture.koTime ?? fixture.kickOff ?? fixture.time;
  if (Number.isFinite(Number(candidate))) return Number(candidate);
  const match = String(candidate || "").match(/(\d{1,2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function getRepresentativeMinutes(fixtures = []) {
  const kickoffMinutes = fixtures
    .map(parseKickoffMinutes)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  return kickoffMinutes[0] ?? 12 * 60;
}

function readStoredCache(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  if (typeof window === "undefined") return null;

  try {
    const parsed = tenantGetJson(`${CACHE_PREFIX}${key}`, null);
    if (!parsed) return null;
    memoryCache.set(key, parsed);
    return parsed;
  } catch (_error) {
    return null;
  }
}

function writeStoredCache(key, payload) {
  const entry = { savedAt: Date.now(), payload };
  memoryCache.set(key, entry);
  if (typeof window === "undefined") return;

  try {
    tenantSetJson(`${CACHE_PREFIX}${key}`, entry);
  } catch (_error) {
    // Weather still works without persistent caching.
  }
}

function getCachedForecast(key, maxAge = FRESH_CACHE_MS) {
  const entry = readStoredCache(key);
  if (!entry?.payload || !Number.isFinite(Number(entry.savedAt))) return null;
  return Date.now() - Number(entry.savedAt) <= maxAge ? entry.payload : null;
}

async function readJson(response, fallbackMessage) {
  let body = null;
  try {
    body = await response.json();
  } catch (_error) {
    body = null;
  }

  if (!response.ok) {
    const error = new Error(body?.error || body?.reason || fallbackMessage);
    error.status = response.status;
    throw error;
  }

  return body;
}

export function getWeatherConfiguration(club = {}) {
  const sites = Array.isArray(club?.sites) ? club.sites : [];

  if (sites.length) {
    const enabledSites = sites.filter((site) => site?.weatherEnabled !== false);
    const primarySite = sites.find((site) => site?.id === club?.primarySiteId) || sites.find((site) => site?.isPrimary) || sites[0];
    const preferred =
      enabledSites.find((site) => site === primarySite && normalisePostcode(site?.weatherPostcode || site?.postcode)) ||
      enabledSites.find((site) => normalisePostcode(site?.weatherPostcode || site?.postcode)) ||
      enabledSites[0] ||
      null;

    return {
      enabled: Boolean(preferred),
      postcode: normalisePostcode(preferred?.weatherPostcode || preferred?.postcode || ""),
      siteId: preferred?.id || primarySite?.id || null,
      venueName: preferred?.name || preferred?.venue || primarySite?.name || club?.venue || club?.name || "Club ground",
    };
  }

  return {
    enabled: club?.weatherEnabled !== false,
    postcode: normalisePostcode(
      club?.weatherPostcode || club?.groundPostcode || club?.postcode || club?.venuePostcode || ""
    ),
    siteId: club?.primarySiteId || "primary",
    venueName: club?.groundName || club?.venue || club?.name || "Club ground",
  };
}

export async function resolveUkPostcode(postcode, { signal } = {}) {
  const compact = compactPostcode(postcode);
  if (!compact) {
    const error = new Error("Add a venue postcode before connecting live weather.");
    error.code = "POSTCODE_REQUIRED";
    throw error;
  }

  const response = await fetch(`${POSTCODE_API_BASE}/${encodeURIComponent(compact)}`, { signal });
  const payload = await readJson(response, "The venue postcode could not be resolved.");
  const result = payload?.result;

  if (!result || !Number.isFinite(Number(result.latitude)) || !Number.isFinite(Number(result.longitude))) {
    const error = new Error("The venue postcode did not return usable map coordinates.");
    error.code = "POSTCODE_NOT_FOUND";
    throw error;
  }

  return {
    postcode: normalisePostcode(result.postcode || postcode),
    latitude: Number(result.latitude),
    longitude: Number(result.longitude),
    region: result.region || result.admin_county || result.admin_district || "United Kingdom",
  };
}

function buildHourlyForecast(payload = {}) {
  const hourly = payload.hourly || {};
  const times = Array.isArray(hourly.time) ? hourly.time : [];

  return times.map((time, index) => ({
    id: `open-meteo-${time}`,
    time,
    temperatureC: hourly.temperature_2m?.[index] ?? null,
    windMph: hourly.wind_speed_10m?.[index] ?? null,
    rainProbability: hourly.precipitation_probability?.[index] ?? null,
    rainfallMm: hourly.rain?.[index] ?? hourly.precipitation?.[index] ?? null,
    conditions: getWeatherCodeLabel(hourly.weather_code?.[index]),
  }));
}

function getClosestHour(hourly = [], representativeMinutes = 12 * 60) {
  return [...hourly].sort((a, b) => {
    const aMatch = String(a.time || "").match(/T(\d{2}):(\d{2})/);
    const bMatch = String(b.time || "").match(/T(\d{2}):(\d{2})/);
    const aMinutes = aMatch ? Number(aMatch[1]) * 60 + Number(aMatch[2]) : 12 * 60;
    const bMinutes = bMatch ? Number(bMatch[1]) * 60 + Number(bMatch[2]) : 12 * 60;
    return Math.abs(aMinutes - representativeMinutes) - Math.abs(bMinutes - representativeMinutes);
  })[0] || null;
}

function applyRepresentativeCurrent(forecast = {}, fixtures = []) {
  const representative = getClosestHour(forecast.hourly || [], getRepresentativeMinutes(fixtures));
  const isToday = forecast.targetDate === getUkTodayIso();

  if (isToday && forecast.liveCurrent) {
    return {
      ...forecast,
      current: {
        ...forecast.liveCurrent,
        rainProbability: representative?.rainProbability ?? forecast.liveCurrent.rainProbability ?? null,
      },
    };
  }

  return {
    ...forecast,
    current: representative || forecast.current || {},
  };
}

export async function fetchLiveWeather({ postcode, date, fixtures = [], signal, force = false } = {}) {
  const targetDate = toIsoDate(date);
  if (!targetDate) {
    const error = new Error("The selected matchday date is invalid.");
    error.code = "INVALID_DATE";
    throw error;
  }

  const difference = dateDifferenceDays(targetDate);
  if (difference < 0 || difference > 15) {
    const error = new Error("Live forecasts are available from today up to 15 days ahead.");
    error.code = "DATE_OUT_OF_RANGE";
    throw error;
  }

  const cacheKey = `${compactPostcode(postcode)}:${targetDate}`;
  if (!force) {
    const cached = getCachedForecast(cacheKey, FRESH_CACHE_MS);
    if (cached) return { ...applyRepresentativeCurrent(cached, fixtures), cacheStatus: "fresh" };
  }

  try {
    const endpoint = getForecastEndpoint();
    const location = await resolveUkPostcode(postcode, { signal });
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      timezone: "Europe/London",
      start_date: targetDate,
      end_date: targetDate,
      temperature_unit: "celsius",
      wind_speed_unit: "mph",
      precipitation_unit: "mm",
      hourly: [
        "temperature_2m",
        "precipitation_probability",
        "precipitation",
        "rain",
        "weather_code",
        "wind_speed_10m",
      ].join(","),
    });

    if (difference === 0) {
      params.set(
        "current",
        ["temperature_2m", "precipitation", "rain", "weather_code", "wind_speed_10m"].join(",")
      );
    }

    const separator = endpoint.url.includes("?") ? "&" : "?";
    const response = await fetch(`${endpoint.url}${separator}${params.toString()}`, { signal });
    const payload = await readJson(response, "The live weather provider did not return a forecast.");
    const hourly = buildHourlyForecast(payload);
    const representative = getClosestHour(hourly, getRepresentativeMinutes(fixtures));
    const liveCurrent = difference === 0 && payload.current
      ? {
          time: payload.current.time,
          temperatureC: payload.current.temperature_2m ?? representative?.temperatureC ?? null,
          windMph: payload.current.wind_speed_10m ?? representative?.windMph ?? null,
          rainProbability: representative?.rainProbability ?? null,
          rainfallMm: payload.current.rain ?? payload.current.precipitation ?? representative?.rainfallMm ?? null,
          conditions: getWeatherCodeLabel(payload.current.weather_code),
        }
      : null;

    const forecast = applyRepresentativeCurrent({
      provider: "Open-Meteo",
      source: "Open-Meteo",
      usageMode: endpoint.usageMode,
      updatedAt: new Date().toISOString(),
      targetDate,
      location,
      liveCurrent,
      current: representative || liveCurrent || {},
      hourly,
      attribution: "Weather data by Open-Meteo; postcode geocoding by Postcodes.io",
      attributionUrl: "https://open-meteo.com/",
    }, fixtures);

    writeStoredCache(cacheKey, forecast);
    return { ...forecast, cacheStatus: "live" };
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    const stale = getCachedForecast(cacheKey, STALE_CACHE_MS);
    if (stale) {
      return {
        ...applyRepresentativeCurrent(stale, fixtures),
        cacheStatus: "stale",
        warning: "Live refresh failed, so the most recent cached forecast is being shown.",
      };
    }
    throw error;
  }
}

const baseWeatherService = createPlatformService("weather", {
  status: "live",
  readiness: 76,
  description: "Live UK venue weather using postcode geocoding and hourly matchday forecasts.",
  capabilities: ["Live forecast", "Weather risk", "Pitch risk", "Matchday guidance"],
  nextActions: ["Add multi-site forecast fan-out", "Persist provider health", "Add severe-weather alerts"],
  isConfigured: (club) => {
    const config = getWeatherConfiguration(club);
    return config.enabled && Boolean(config.postcode);
  },
  describe: () => "Local evaluation uses the public forecast endpoint; production requires a server-side commercial provider proxy.",
});

export const weatherService = Object.freeze({
  ...baseWeatherService,
  getConfiguration: getWeatherConfiguration,
  resolvePostcode: resolveUkPostcode,
  getForecast: fetchLiveWeather,
});

export default weatherService;
