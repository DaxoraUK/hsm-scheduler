import { getWeatherSnapshot } from "./weatherEngine.js";

export function calculateWeatherIntelligence({ club = {}, fixtures = [], dateLabel = "" } = {}) {
  return getWeatherSnapshot({ club, fixtures, dateLabel });
}

export default calculateWeatherIntelligence;
