export const DEFAULT_WORKSPACE_FEATURES = Object.freeze({
  midweekEnabled: true,
  parkingEnabled: true,
});

export function getWorkspaceFeatures(club = {}) {
  const features = club?.features && typeof club.features === "object" ? club.features : {};

  return {
    ...DEFAULT_WORKSPACE_FEATURES,
    ...features,
    midweekEnabled: features.midweekEnabled !== false,
    parkingEnabled: features.parkingEnabled !== false,
  };
}

export function isMidweekEnabled(club = {}) {
  return getWorkspaceFeatures(club).midweekEnabled;
}

export function isParkingEnabled(club = {}) {
  return getWorkspaceFeatures(club).parkingEnabled;
}

export function withWorkspaceFeature(club = {}, feature, enabled) {
  return {
    ...club,
    features: {
      ...getWorkspaceFeatures(club),
      [feature]: Boolean(enabled),
    },
  };
}
