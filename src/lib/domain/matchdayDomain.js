/**
 * Matchday Domain
 *
 * Shared helpers for turning Saturday/Sunday specific data into a generic
 * matchday shape. This supports the long-term move away from duplicated
 * Saturday/Sunday presentation logic.
 */

export function createMatchdayContext({
  day = "Saturday",
  dateLabel = "Matchday",
  games = [],
  hasRun = false,
  overrides = {},
  closedPitches = [],
  club = {},
  pitchCfg = [],
} = {}) {
  const activeGames = (games || []).filter((game) => game.status !== "postponed");

  return {
    day,
    dateLabel,
    games: games || [],
    activeGames,
    hasRun: Boolean(hasRun),
    overrides: overrides || {},
    closedPitches: closedPitches || [],
    club: club || {},
    pitchCfg: pitchCfg || [],
    counts: {
      fixtures: games?.length || 0,
      active: activeGames.length,
      closedPitches: closedPitches?.length || 0,
    },
  };
}

export function getActiveFixtures(games = []) {
  return (games || []).filter((game) => game.status !== "postponed");
}

export function getScheduledFixtures(games = []) {
  return getActiveFixtures(games).filter(
    (game) => game.koMins != null && game.endMins != null && game.pitchId
  );
}
