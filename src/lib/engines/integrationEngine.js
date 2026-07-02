import {
  calculateServiceReadiness,
  getPlatformServiceDefinitions,
  getServiceRoadmap,
} from "../services/index.js";

export function getIntegrationProviders() {
  return getPlatformServiceDefinitions().filter((service) =>
    ["fulltime-fa", "teamfeepay", "pitchero", "spond", "google-calendar"].includes(service.id)
  );
}

export function calculateIntegrationReadiness(providers = getIntegrationProviders()) {
  return calculateServiceReadiness(providers);
}

export function getIntegrationRoadmap(providers = getIntegrationProviders()) {
  return getServiceRoadmap(providers);
}
