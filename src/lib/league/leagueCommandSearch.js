function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || "").trim();
}

function searchable(...values) {
  return values.map(text).filter(Boolean).join(" ").toLowerCase();
}

function fixtureLabel(row, teamNames) {
  return `${teamNames.get(row.homeTeamId) || "Home team"} v ${teamNames.get(row.awayTeamId) || "Away team"}`;
}

export function buildLeagueCommandSearchIndex(workspace = {}, operations = {}) {
  const divisions = new Map(asArray(workspace.divisions).map((row) => [row.id, row.name]));
  const clubs = new Map(asArray(workspace.clubs).map((row) => [row.id, row.name]));
  const teams = new Map(asArray(workspace.teams).map((row) => [row.id, row.name]));
  const venues = new Map(asArray(workspace.venues).map((row) => [row.id, row.name]));
  const items = [];

  asArray(workspace.divisions).forEach((row) => items.push({
    id: `division:${row.id}`,
    type: "Division",
    label: row.name,
    detail: `${asArray(workspace.teams).filter((team) => team.divisionId === row.id && !["inactive", "withdrawn"].includes(team.status)).length} active teams · ${row.meetingsPerPairing || 2} meetings per pairing`,
    tab: "structure",
    child: "division",
    searchText: searchable(row.name, row.code, "division competition"),
  }));

  asArray(workspace.clubs).forEach((row) => items.push({
    id: `club:${row.id}`,
    type: "Club",
    label: row.name,
    detail: row.shortName || row.externalRef || row.status || "Parent club",
    tab: "clubs",
    child: "directory",
    searchText: searchable(row.name, row.shortName, row.externalRef, "club"),
  }));

  asArray(workspace.teams).forEach((row) => items.push({
    id: `team:${row.id}`,
    type: "Team",
    label: row.name,
    detail: `${divisions.get(row.divisionId) || "Unassigned division"} · ${clubs.get(row.parentClubId) || "Unknown club"}`,
    tab: "structure",
    child: "team",
    searchText: searchable(row.name, row.shortName, row.externalRef, divisions.get(row.divisionId), clubs.get(row.parentClubId), "team"),
  }));

  asArray(workspace.venues).forEach((row) => items.push({
    id: `venue:${row.id}`,
    type: "Venue",
    label: row.name,
    detail: [row.postcode, clubs.get(row.parentClubId), row.surface].filter(Boolean).join(" · ") || "League venue",
    tab: "availability",
    child: "venue",
    searchText: searchable(row.name, row.address, row.postcode, row.groundShareKey, clubs.get(row.parentClubId), "venue ground"),
  }));

  asArray(workspace.fixtures).forEach((row) => {
    const label = fixtureLabel(row, teams);
    items.push({
      id: `fixture:${row.id}`,
      type: "Fixture",
      label,
      detail: [row.scheduledDate || "Unplaced", divisions.get(row.divisionId), venues.get(row.venueId)].filter(Boolean).join(" · "),
      tab: "fixtures",
      child: row.scheduledDate ? "all" : "unplaced",
      searchText: searchable(label, row.externalRef, row.scheduledDate, divisions.get(row.divisionId), venues.get(row.venueId), "fixture"),
    });
  });

  asArray(workspace.cupTies).forEach((row) => {
    const label = fixtureLabel(row, teams);
    const cupName = asArray(workspace.cups).find((cup) => cup.id === row.cupId)?.name || "Cup";
    items.push({
      id: `cup-tie:${row.id}`,
      type: "Cup tie",
      label,
      detail: [row.scheduledDate || "Unplaced", cupName, venues.get(row.venueId)].filter(Boolean).join(" · "),
      tab: "cups",
      child: "ties",
      searchText: searchable(label, cupName, row.scheduledDate, venues.get(row.venueId), "cup tie fixture"),
    });
  });

  asArray(operations.officials).forEach((row) => items.push({
    id: `official:${row.id}`,
    type: "Official",
    label: row.name || row.displayName || "Match official",
    detail: [row.email, row.phone, row.grade, row.status].filter(Boolean).join(" · ") || "Official pool",
    tab: "officials",
    child: "pool",
    searchText: searchable(row.name, row.displayName, row.email, row.phone, row.grade, row.status, "official referee assistant"),
  }));

  return items;
}

export function searchLeagueCommandIndex(index = [], query = "", limit = 8) {
  const terms = text(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return asArray(index)
    .map((item) => {
      const haystack = item.searchText || searchable(item.type, item.label, item.detail);
      if (!terms.every((term) => haystack.includes(term))) return null;
      const label = text(item.label).toLowerCase();
      const exact = label === terms.join(" ") ? 100 : 0;
      const prefix = label.startsWith(terms[0]) ? 25 : 0;
      const typeMatch = text(item.type).toLowerCase().includes(terms[0]) ? 8 : 0;
      return { ...item, score: exact + prefix + typeMatch - label.length / 1000 };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "en-GB", { numeric: true }))
    .slice(0, Math.max(1, Number(limit) || 8));
}
