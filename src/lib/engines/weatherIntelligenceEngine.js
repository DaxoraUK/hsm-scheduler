import { getWeatherSnapshot } from "./weatherEngine.js";

export function calculateWeatherIntelligence({
  club = {},
  fixtures = [],
  dateLabel = "",
  forecastSource = null,
  connectionStatus = "idle",
  connectionError = null,
} = {}) {
  return getWeatherSnapshot({
    club,
    fixtures,
    dateLabel,
    forecastSource,
    connectionStatus,
    connectionError,
  });
}

export default calculateWeatherIntelligence;
