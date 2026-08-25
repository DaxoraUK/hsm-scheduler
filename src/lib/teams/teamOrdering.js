const TEAM_COLLATOR = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
  ignorePunctuation: true,
});

export function getTeamDisplayName(team) {
  return String(team?.name || team?.teamName || team?.label || "").trim();
}

export function compareTeamsAlphabetically(left, right) {
  return TEAM_COLLATOR.compare(getTeamDisplayName(left), getTeamDisplayName(right));
}

export function sortTeamsAlphabetically(teams) {
  return [...(Array.isArray(teams) ? teams : [])].sort(compareTeamsAlphabetically);
}

export function sortTeamEntriesAlphabetically(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort((left, right) => (
    compareTeamsAlphabetically(left?.team, right?.team)
  ));
}
