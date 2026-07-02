export const DEFAULT_WORKSPACE_FEATURES = Object.freeze({
  midweekEnabled: true,
});

export function getWorkspaceFeatures(club = {}) {
  const features = club?.features && typeof club.features === "object" ? club.features : {};

  return {
    ...DEFAULT_WORKSPACE_FEATURES,
    ...features,
    midweekEnabled: features.midweekEnabled !== false,
  };
}

export function isMidweekEnabled(club = {}) {
  return getWorkspaceFeatures(club).midweekEnabled;
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
