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

function explicitAge(value, configured = false) {
  const text = String(value ?? '').trim();
  const match = text.match(/\b(?:u\s*-?\s*|under\s*-?\s*)(\d{1,2})\b/i);
  const age = match ? Number(match[1]) : configured && /^\d{1,2}$/.test(text) ? Number(text) : null;
  return age != null && age > 0 ? age : null;
}

export function getTeamDisplayAge(team) {
  const configured = team?.ageGroup ?? team?.age_group;
  if (/\b(?:adult|open[ -]?age|senior)\b/i.test(String(configured ?? ''))) return null;
  return explicitAge(configured, true) ?? explicitAge(getTeamDisplayName(team));
}

function displayAgeBucket(team) {
  const age = getTeamDisplayAge(team);
  if (age != null) return [0, age];
  const metadata = [team?.ageGroup, team?.age_group, team?.teamType, team?.type, getTeamDisplayName(team)].filter(Boolean).join(' ');
  return /\b(?:adult|open[ -]?age|senior|first team|1st team|reserves)\b/i.test(metadata) ? [1, 0] : [2, 0];
}

export function compareTeamsByAgeGroup(left, right) {
  const a = displayAgeBucket(left), b = displayAgeBucket(right);
  return a[0] - b[0] || a[1] - b[1] || compareTeamsAlphabetically(left, right);
}

export function sortTeamsByAgeGroup(teams) {
  return [...(Array.isArray(teams) ? teams : [])].sort(compareTeamsByAgeGroup);
}

export function sortTeamEntriesByAgeGroup(entries) {
  return [...(Array.isArray(entries) ? entries : [])].sort((left, right) => compareTeamsByAgeGroup(left?.team, right?.team));
}
