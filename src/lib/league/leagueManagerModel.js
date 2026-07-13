const ARRAY_KEYS = Object.freeze([
  "seasons",
  "divisions",
  "clubs",
  "venues",
  "teams",
  "blackouts",
  "playingDates",
  "fixtures",
  "members",
  "invitations",
  "audit",
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normaliseRow(row = {}) {
  return {
    ...row,
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    seasonId: row.season_id || row.seasonId || "",
    divisionId: row.division_id || row.divisionId || "",
    parentClubId: row.parent_club_id || row.parentClubId || "",
    homeVenueId: row.home_venue_id || row.homeVenueId || "",
    homeTeamId: row.home_team_id || row.homeTeamId || "",
    awayTeamId: row.away_team_id || row.awayTeamId || "",
    venueId: row.venue_id || row.venueId || "",
    scopeType: row.scope_type || row.scopeType || "",
    scopeId: row.scope_id || row.scopeId || "",
    startsOn: row.starts_on || row.startsOn || "",
    endsOn: row.ends_on || row.endsOn || "",
    scheduledDate: row.scheduled_date || row.scheduledDate || "",
    kickOff: row.kick_off || row.kickOff || "",
    playingDate: row.playing_date || row.playingDate || "",
    defaultKickOff: row.default_kick_off || row.defaultKickOff || "",
    shortName: row.short_name || row.shortName || "",
    externalRef: row.external_ref || row.externalRef || "",
    governingBody: row.governing_body || row.governingBody || "",
    countryCode: row.country_code || row.countryCode || "GB-ENG",
    productStatus: row.product_status || row.productStatus || "pilot",
    groundShareKey: row.ground_share_key || row.groundShareKey || "",
    simultaneousFixtureLimit: Number(row.simultaneous_fixture_limit ?? row.simultaneousFixtureLimit ?? 1) || 1,
    teamLimit: row.team_limit ?? row.teamLimit ?? "",
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    isCurrent: asBoolean(row.is_current ?? row.isCurrent),
    locked: asBoolean(row.locked),
    readOnly: asBoolean(row.read_only ?? row.readOnly),
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    expiresAt: row.expires_at || row.expiresAt || null,
    displayName: row.display_name || row.displayName || "",
    userId: row.user_id || row.userId || "",
    actorLabel: row.actor_label || row.actorLabel || "",
    actorRole: row.actor_role || row.actorRole || "",
    entityType: row.entity_type || row.entityType || "",
    entityId: row.entity_id || row.entityId || "",
  };
}

export function normaliseLeagueAccess(row = {}) {
  return {
    leagueId: row.league_id || row.leagueId || "",
    name: row.league_name || row.leagueName || row.name || "League workspace",
    slug: row.league_slug || row.leagueSlug || row.slug || "",
    productStatus: row.product_status || row.productStatus || "pilot",
    status: row.league_status || row.leagueStatus || row.status || "active",
    countryCode: row.country_code || row.countryCode || "GB-ENG",
    governingBody: row.governing_body || row.governingBody || "",
    timezone: row.timezone || "Europe/London",
    role: row.access_role || row.accessRole || row.role || "viewer",
    readOnly: asBoolean(row.read_only ?? row.readOnly),
  };
}

export function normaliseLeagueWorkspace(payload = {}) {
  const result = {
    league: normaliseRow(payload.league || {}),
    access: {
      role: payload.access?.role || "viewer",
      canManage: asBoolean(payload.access?.can_manage ?? payload.access?.canManage),
      canOperate: asBoolean(payload.access?.can_operate ?? payload.access?.canOperate),
      readOnly: asBoolean(payload.access?.read_only ?? payload.access?.readOnly),
    },
  };

  ARRAY_KEYS.forEach((key) => {
    const payloadKey = key === "playingDates" ? "playing_dates" : key;
    result[key] = asArray(payload[payloadKey] ?? payload[key]).map(normaliseRow);
  });

  return result;
}

export function getCurrentLeagueSeason(workspace = {}) {
  const seasons = asArray(workspace.seasons);
  return seasons.find((season) => season.isCurrent)
    || seasons.find((season) => season.status === "active")
    || seasons[0]
    || null;
}

export function getLeagueReadiness(workspace = {}) {
  const season = getCurrentLeagueSeason(workspace);
  const divisions = asArray(workspace.divisions).filter((row) => !season || row.seasonId === season.id);
  const teams = asArray(workspace.teams).filter((row) => !season || row.seasonId === season.id);
  const clubs = asArray(workspace.clubs).filter((row) => row.status !== "withdrawn");
  const venues = asArray(workspace.venues).filter((row) => row.status === "active");
  const playingDates = asArray(workspace.playingDates).filter((row) => !season || row.seasonId === season.id);
  const fixtures = asArray(workspace.fixtures).filter((row) => !season || row.seasonId === season.id);

  const checks = [
    {
      id: "season",
      label: "Current season",
      complete: Boolean(season),
      detail: season ? season.name : "Create the pilot season",
    },
    {
      id: "divisions",
      label: "Division structure",
      complete: divisions.length > 0,
      detail: divisions.length ? `${divisions.length} configured` : "Add at least one division",
    },
    {
      id: "clubs",
      label: "Parent clubs",
      complete: clubs.length > 1,
      detail: clubs.length ? `${clubs.length} loaded` : "Load the participating clubs",
    },
    {
      id: "teams",
      label: "Teams and divisions",
      complete: teams.length > 1 && teams.every((team) => team.parentClubId && team.divisionId),
      detail: teams.length ? `${teams.length} loaded` : "Load teams and assign divisions",
    },
    {
      id: "venues",
      label: "Home venues",
      complete: venues.length > 0 && teams.every((team) => team.homeVenueId),
      detail: venues.length ? `${venues.length} venues` : "Add home grounds and ground shares",
    },
    {
      id: "playing_dates",
      label: "Playing-date calendar",
      complete: playingDates.some((row) => row.status === "available"),
      detail: playingDates.length ? `${playingDates.length} dates configured` : "Add the standard league playing dates",
    },
    {
      id: "fixture_registry",
      label: "Fixture registry",
      complete: fixtures.length > 0,
      detail: fixtures.length ? `${fixtures.length} fixtures` : "Import or add pilot fixtures",
      optionalForSetup: true,
    },
  ];

  const setupChecks = checks.filter((check) => !check.optionalForSetup);
  const completed = setupChecks.filter((check) => check.complete).length;
  const percentage = Math.round((completed / setupChecks.length) * 100);

  return {
    season,
    checks,
    percentage,
    readyForScheduling: setupChecks.every((check) => check.complete),
    totals: {
      seasons: asArray(workspace.seasons).length,
      divisions: divisions.length,
      clubs: clubs.length,
      teams: teams.length,
      venues: venues.length,
      blackouts: asArray(workspace.blackouts).length,
      playingDates: playingDates.length,
      fixtures: fixtures.length,
      postponed: fixtures.filter((fixture) => fixture.status === "postponed").length,
      unplaced: fixtures.filter((fixture) => !fixture.scheduledDate).length,
    },
  };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normaliseHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normaliseLookup(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function headerValue(row, aliases) {
  for (const alias of aliases) {
    if (row[alias] !== undefined && String(row[alias]).trim()) return String(row[alias]).trim();
  }
  return "";
}

function indexByName(rows) {
  const map = new Map();
  asArray(rows).forEach((row) => {
    [row.name, row.shortName, row.externalRef].filter(Boolean).forEach((value) => {
      map.set(normaliseLookup(value), row);
    });
  });
  return map;
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(value || ""));
}

export function parseLeagueStructureCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return { records: [], errors: ["The setup CSV must contain a header and at least one team row."] };
  }
  if (lines.length > 1001) {
    return { records: [], errors: ["A maximum of 1000 team rows can be imported at once."] };
  }

  const headers = parseCsvLine(lines[0]).map(normaliseHeader);
  const records = [];
  const errors = [];
  const seenTeams = new Set();

  lines.slice(1).forEach((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    const rowNumber = rowIndex + 2;
    const division = headerValue(row, ["division", "division_name", "competition"]);
    const parentClub = headerValue(row, ["parent_club", "club", "club_name"]);
    const team = headerValue(row, ["team", "team_name"]);
    const homeVenue = headerValue(row, ["home_venue", "venue", "ground"]);

    if (!division) errors.push(`Row ${rowNumber}: division is required.`);
    if (!parentClub) errors.push(`Row ${rowNumber}: parent club is required.`);
    if (!team) errors.push(`Row ${rowNumber}: team is required.`);
    if (!homeVenue) errors.push(`Row ${rowNumber}: home venue is required.`);

    const teamKey = normaliseLookup(team);
    if (teamKey && seenTeams.has(teamKey)) errors.push(`Row ${rowNumber}: team “${team}” appears more than once.`);
    if (teamKey) seenTeams.add(teamKey);
    if (!division || !parentClub || !team || !homeVenue) return;

    records.push({
      division,
      division_code: headerValue(row, ["division_code", "division_short_code"]),
      parent_club: parentClub,
      club_short_name: headerValue(row, ["club_short_name", "parent_club_short_name"]),
      club_external_ref: headerValue(row, ["club_external_ref", "club_id"]),
      team,
      team_short_name: headerValue(row, ["team_short_name"]),
      team_external_ref: headerValue(row, ["team_external_ref", "team_id", "external_ref"]),
      home_venue: homeVenue,
      address: headerValue(row, ["address", "venue_address"]),
      postcode: headerValue(row, ["postcode", "venue_postcode"]),
      surface: headerValue(row, ["surface", "venue_surface"]),
      ground_share_key: headerValue(row, ["ground_share_key", "ground_share", "shared_ground_key"]),
    });
  });

  return { records, errors };
}

export function parseLeagueFixtureCsv(text, workspace = {}) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length < 2) {
    return { records: [], errors: ["The CSV must contain a header and at least one fixture row."] };
  }
  if (lines.length > 2001) {
    return { records: [], errors: ["A maximum of 2000 fixtures can be imported at once."] };
  }

  const headers = parseCsvLine(lines[0]).map(normaliseHeader);
  const teamLookup = indexByName(workspace.teams);
  const divisionLookup = indexByName(workspace.divisions);
  const venueLookup = indexByName(workspace.venues);
  const currentSeason = getCurrentLeagueSeason(workspace);
  const records = [];
  const errors = [];
  const allowedStatuses = new Set(["draft", "scheduled", "postponed", "rearranged", "played", "cancelled"]);
  const seenExternalRefs = new Set();

  lines.slice(1).forEach((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    const homeName = headerValue(row, ["home_team", "home", "home_team_name"]);
    const awayName = headerValue(row, ["away_team", "away", "away_team_name"]);
    const divisionName = headerValue(row, ["division", "competition"]);
    const venueName = headerValue(row, ["venue", "ground", "home_venue"]);
    const scheduledDate = headerValue(row, ["date", "scheduled_date", "fixture_date"]);
    const kickOff = headerValue(row, ["kick_off", "kickoff", "time"]);
    const status = normaliseLookup(headerValue(row, ["status"]) || "draft");
    const externalRef = headerValue(row, ["external_ref", "fixture_id", "id"]);
    const homeTeam = teamLookup.get(normaliseLookup(homeName));
    const awayTeam = teamLookup.get(normaliseLookup(awayName));
    const division = divisionName ? divisionLookup.get(normaliseLookup(divisionName)) : null;
    const venue = venueName ? venueLookup.get(normaliseLookup(venueName)) : null;
    const rowNumber = rowIndex + 2;
    const rowErrors = [];

    if (!currentSeason) rowErrors.push(`Row ${rowNumber}: no current season is configured.`);
    if (!homeTeam) rowErrors.push(`Row ${rowNumber}: home team “${homeName || "blank"}” was not found.`);
    if (!awayTeam) rowErrors.push(`Row ${rowNumber}: away team “${awayName || "blank"}” was not found.`);
    if (homeTeam && awayTeam && homeTeam.id === awayTeam.id) rowErrors.push(`Row ${rowNumber}: home and away teams are the same.`);
    if (divisionName && !division) rowErrors.push(`Row ${rowNumber}: division “${divisionName}” was not found.`);
    if (venueName && !venue) rowErrors.push(`Row ${rowNumber}: venue “${venueName}” was not found.`);
    if (scheduledDate && !validIsoDate(scheduledDate)) rowErrors.push(`Row ${rowNumber}: date must be a real YYYY-MM-DD value.`);
    if (kickOff && !validTime(kickOff)) rowErrors.push(`Row ${rowNumber}: kick-off must use HH:MM in 24-hour time.`);
    if (!allowedStatuses.has(status)) rowErrors.push(`Row ${rowNumber}: status “${status}” is not supported.`);
    if (externalRef && seenExternalRefs.has(normaliseLookup(externalRef))) rowErrors.push(`Row ${rowNumber}: external reference “${externalRef}” is duplicated in this file.`);
    if (externalRef) seenExternalRefs.add(normaliseLookup(externalRef));

    if (currentSeason && homeTeam && homeTeam.seasonId !== currentSeason.id) rowErrors.push(`Row ${rowNumber}: home team is not in the current season.`);
    if (currentSeason && awayTeam && awayTeam.seasonId !== currentSeason.id) rowErrors.push(`Row ${rowNumber}: away team is not in the current season.`);
    const resolvedDivisionId = division?.id || homeTeam?.divisionId || awayTeam?.divisionId || "";
    if (homeTeam && awayTeam && homeTeam.divisionId !== awayTeam.divisionId) rowErrors.push(`Row ${rowNumber}: teams are assigned to different divisions.`);
    if (division && homeTeam && homeTeam.divisionId !== division.id) rowErrors.push(`Row ${rowNumber}: home team is not assigned to “${division.name}”.`);
    if (division && awayTeam && awayTeam.divisionId !== division.id) rowErrors.push(`Row ${rowNumber}: away team is not assigned to “${division.name}”.`);

    errors.push(...rowErrors);
    if (rowErrors.length) return;

    records.push({
      season_id: currentSeason.id,
      division_id: resolvedDivisionId,
      home_team_id: homeTeam.id,
      away_team_id: awayTeam.id,
      venue_id: venue?.id || homeTeam.homeVenueId || "",
      scheduled_date: scheduledDate,
      kick_off: kickOff,
      status,
      locked: ["true", "yes", "1", "locked"].includes(normaliseLookup(headerValue(row, ["locked", "is_locked"]))),
      source: "csv",
      external_ref: externalRef,
      notes: headerValue(row, ["notes", "note"]),
    });
  });

  return { records, errors };
}

export function getBlackoutScopeOptions(workspace = {}, scopeType = "league") {
  const map = {
    league: [{ id: "", name: workspace.league?.name || "Whole league" }],
    division: asArray(workspace.divisions),
    club: asArray(workspace.clubs),
    team: asArray(workspace.teams),
    venue: asArray(workspace.venues),
  };
  return map[scopeType] || [];
}

export function getEntityName(workspace = {}, type, id) {
  if (!id) return "—";
  const map = {
    season: workspace.seasons,
    division: workspace.divisions,
    club: workspace.clubs,
    parent_club: workspace.clubs,
    team: workspace.teams,
    venue: workspace.venues,
  };
  return asArray(map[type]).find((row) => row.id === id)?.name || "Unknown";
}

export function serialiseLeagueEntity(type, draft = {}) {
  const common = draft.id ? { id: draft.id } : {};
  switch (type) {
    case "season":
      return {
        ...common,
        name: String(draft.name || "").trim(),
        starts_on: draft.startsOn || draft.starts_on || null,
        ends_on: draft.endsOn || draft.ends_on || null,
        status: draft.status || "draft",
        is_current: Boolean(draft.isCurrent ?? draft.is_current),
      };
    case "division":
      return {
        ...common,
        season_id: draft.seasonId || draft.season_id || "",
        name: String(draft.name || "").trim(),
        code: String(draft.code || "").trim(),
        sort_order: Number(draft.sortOrder ?? draft.sort_order ?? 0),
        team_limit: draft.teamLimit ?? draft.team_limit ?? "",
      };
    case "parent_club":
      return {
        ...common,
        name: String(draft.name || "").trim(),
        short_name: String(draft.shortName || draft.short_name || "").trim(),
        external_ref: String(draft.externalRef || draft.external_ref || "").trim(),
        status: draft.status || "active",
      };
    case "venue":
      return {
        ...common,
        parent_club_id: draft.parentClubId || draft.parent_club_id || "",
        name: String(draft.name || "").trim(),
        address: String(draft.address || "").trim(),
        postcode: String(draft.postcode || "").trim(),
        surface: String(draft.surface || "").trim(),
        capacity: draft.capacity ?? "",
        ground_share_key: String(draft.groundShareKey || draft.ground_share_key || "").trim(),
        simultaneous_fixture_limit: Math.max(1, Number(draft.simultaneousFixtureLimit ?? draft.simultaneous_fixture_limit ?? 1) || 1),
        status: draft.status || "active",
      };
    case "team":
      return {
        ...common,
        season_id: draft.seasonId || draft.season_id || "",
        division_id: draft.divisionId || draft.division_id || "",
        parent_club_id: draft.parentClubId || draft.parent_club_id || "",
        home_venue_id: draft.homeVenueId || draft.home_venue_id || "",
        name: String(draft.name || "").trim(),
        short_name: String(draft.shortName || draft.short_name || "").trim(),
        external_ref: String(draft.externalRef || draft.external_ref || "").trim(),
        status: draft.status || "active",
      };
    case "blackout":
      return {
        ...common,
        season_id: draft.seasonId || draft.season_id || "",
        scope_type: draft.scopeType || draft.scope_type || "league",
        scope_id: draft.scopeId || draft.scope_id || "",
        starts_on: draft.startsOn || draft.starts_on || "",
        ends_on: draft.endsOn || draft.ends_on || draft.startsOn || draft.starts_on || "",
        reason: String(draft.reason || "").trim(),
        source: draft.source || "manual",
      };
    case "playing_date":
      return {
        ...common,
        season_id: draft.seasonId || draft.season_id || "",
        division_id: draft.divisionId || draft.division_id || "",
        playing_date: draft.playingDate || draft.playing_date || "",
        default_kick_off: draft.defaultKickOff || draft.default_kick_off || "",
        status: draft.status || "available",
        notes: String(draft.notes || "").trim(),
      };
    case "fixture":
      return {
        ...common,
        season_id: draft.seasonId || draft.season_id || "",
        division_id: draft.divisionId || draft.division_id || "",
        home_team_id: draft.homeTeamId || draft.home_team_id || "",
        away_team_id: draft.awayTeamId || draft.away_team_id || "",
        venue_id: draft.venueId || draft.venue_id || "",
        scheduled_date: draft.scheduledDate || draft.scheduled_date || "",
        kick_off: draft.kickOff || draft.kick_off || "",
        status: draft.status || "draft",
        locked: Boolean(draft.locked),
        source: draft.source || "manual",
        external_ref: String(draft.externalRef || draft.external_ref || "").trim(),
        notes: String(draft.notes || "").trim(),
      };
    default:
      return { ...common, ...draft };
  }
}
