const PUBLIC_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const CUSTOMER_FORECAST_URL = "https://customer-api.open-meteo.com/v1/forecast";
const ALLOWED_HOURLY_FIELDS = new Set([
  "temperature_2m",
  "precipitation_probability",
  "precipitation",
  "rain",
  "weather_code",
  "wind_speed_10m",
]);
const ALLOWED_CURRENT_FIELDS = new Set([
  "temperature_2m",
  "precipitation",
  "rain",
  "weather_code",
  "wind_speed_10m",
]);

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function parseNumber(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function parseIsoDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function filterFields(value, allowed) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => allowed.has(item));
}

function isPublicApiAllowed() {
  if (String(process.env.WEATHER_ALLOW_PUBLIC_API || "").toLowerCase() === "true") {
    return true;
  }

  const environment = String(
    process.env.APP_ENVIRONMENT ||
      process.env.VITE_APP_ENVIRONMENT ||
      process.env.VERCEL_ENV ||
      "development",
  ).toLowerCase();
  const branch = String(process.env.VERCEL_GIT_COMMIT_REF || "").toLowerCase();

  return environment !== "production" || branch === "staging";
}

function getUpstreamConfiguration() {
  const apiKey = String(process.env.OPEN_METEO_API_KEY || "").trim();
  const configuredBase = String(process.env.OPEN_METEO_API_BASE_URL || "").trim();

  if (apiKey) {
    return {
      url: configuredBase || CUSTOMER_FORECAST_URL,
      apiKey,
      mode: "commercial",
    };
  }

  if (!isPublicApiAllowed()) {
    return null;
  }

  return {
    url: configuredBase || PUBLIC_FORECAST_URL,
    apiKey: "",
    mode: "evaluation",
  };
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const latitude = parseNumber(requestUrl.searchParams.get("latitude"), -90, 90);
  const longitude = parseNumber(requestUrl.searchParams.get("longitude"), -180, 180);
  const startDate = parseIsoDate(requestUrl.searchParams.get("start_date"));
  const endDate = parseIsoDate(requestUrl.searchParams.get("end_date"));

  if (latitude === null || longitude === null || !startDate || !endDate) {
    return json(
      { error: "A valid location and forecast date are required." },
      400,
    );
  }

  const hourly = filterFields(
    requestUrl.searchParams.get("hourly"),
    ALLOWED_HOURLY_FIELDS,
  );
  const current = filterFields(
    requestUrl.searchParams.get("current"),
    ALLOWED_CURRENT_FIELDS,
  );
  const upstream = getUpstreamConfiguration();

  if (!upstream) {
    return json(
      {
        error:
          "Production weather is not configured. Add the commercial weather provider credentials in Vercel.",
        code: "WEATHER_PROVIDER_NOT_CONFIGURED",
      },
      503,
      { "cache-control": "no-store" },
    );
  }

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: "Europe/London",
    start_date: startDate,
    end_date: endDate,
    temperature_unit: "celsius",
    wind_speed_unit: "mph",
    precipitation_unit: "mm",
  });

  if (hourly.length) params.set("hourly", hourly.join(","));
  if (current.length) params.set("current", current.join(","));
  if (upstream.apiKey) params.set("apikey", upstream.apiKey);

  try {
    const separator = upstream.url.includes("?") ? "&" : "?";
    const response = await fetch(`${upstream.url}${separator}${params.toString()}`, {
      headers: { accept: "application/json" },
    });
    const body = await response.text();

    if (!response.ok) {
      return json(
        {
          error: "The weather provider did not return a usable forecast.",
          code: "WEATHER_PROVIDER_ERROR",
        },
        response.status >= 400 && response.status < 600 ? response.status : 502,
        { "cache-control": "no-store" },
      );
    }

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "public, s-maxage=900, stale-while-revalidate=1800",
        "x-ground-control-weather-mode": upstream.mode,
      },
    });
  } catch {
    return json(
      {
        error: "The weather provider could not be reached.",
        code: "WEATHER_PROVIDER_UNAVAILABLE",
      },
      502,
      { "cache-control": "no-store" },
    );
  }
}
