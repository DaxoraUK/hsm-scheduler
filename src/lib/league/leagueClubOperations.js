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
    parentClubId: row.parent_club_id || row.parentClubId || "",
    scheduleVersionId: row.schedule_version_id || row.scheduleVersionId || "",
    publicationId: row.publication_id || row.publicationId || "",
    publicationFixtureId: row.publication_fixture_id || row.publicationFixtureId || "",
    targetType: row.target_type || row.targetType || "",
    targetId: row.target_id || row.targetId || "",
    homeTeamId: row.home_team_id || row.homeTeamId || "",
    awayTeamId: row.away_team_id || row.awayTeamId || "",
    homeTeamName: row.home_team_name || row.homeTeamName || "",
    awayTeamName: row.away_team_name || row.awayTeamName || "",
    venueId: row.venue_id || row.venueId || "",
    venueName: row.venue_name || row.venueName || "",
    divisionId: row.division_id || row.divisionId || "",
    competitionType: row.competition_type || row.competitionType || "league",
    competitionId: row.competition_id || row.competitionId || row.division_id || row.divisionId || "",
    scheduledDate: row.scheduled_date || row.scheduledDate || "",
    kickOff: row.kick_off || row.kickOff || "",
    scopeType: row.scope_type || row.scopeType || "league",
    scopeId: row.scope_id || row.scopeId || "",
    requestType: row.request_type || row.requestType || "date_change",
    requestedDate: row.requested_date || row.requestedDate || "",
    requestedKickOff: row.requested_kick_off || row.requestedKickOff || "",
    requestedVenueId: row.requested_venue_id || row.requestedVenueId || "",
    resolutionVersionId: row.resolution_version_id || row.resolutionVersionId || "",
    recipientType: row.recipient_type || row.recipientType || "club",
    recipientId: row.recipient_id || row.recipientId || "",
    recipientLabel: row.recipient_label || row.recipientLabel || "",
    recipientEmail: row.recipient_email || row.recipientEmail || "",
    templateKey: row.template_key || row.templateKey || "custom",
    subject: row.subject || "",
    body: row.body || "",
    requiresAcknowledgement: asBoolean(row.requires_acknowledgement ?? row.requiresAcknowledgement),
    status: row.status || "draft",
    role: row.role || "club_viewer",
    email: row.email || "",
    displayName: row.display_name || row.displayName || "",
    invitedBy: row.invited_by || row.invitedBy || "",
    expiresAt: row.expires_at || row.expiresAt || null,
    publishedAt: row.published_at || row.publishedAt || null,
    sentAt: row.sent_at || row.sentAt || null,
    respondedAt: row.responded_at || row.respondedAt || null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    revokedAt: row.revoked_at || row.revokedAt || null,
    userId: row.user_id || row.userId || "",
    snapshot: row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {},
    summary: row.summary && typeof row.summary === "object" ? row.summary : {},
    evidence: row.evidence && typeof row.evidence === "object" ? row.evidence : {},
    notes: row.notes || "",
    feedType: row.feed_type || row.feedType || row.scope_type || row.scopeType || "club",
    feedLabel: row.feed_label || row.feedLabel || "",
    feedUrl: row.feed_url || row.feedUrl || "",
  };
}

export function normaliseLeagueClubOperationsData(payload = {}) {
  return {
    access: {
      canManage: asBoolean(payload.access?.can_manage ?? payload.access?.canManage),
      canOperate: asBoolean(payload.access?.can_operate ?? payload.access?.canOperate),
      canManageClubs: asBoolean(payload.access?.can_manage_clubs ?? payload.access?.canManageClubs),
    },
    publications: asArray(payload.publications).map(normaliseRow),
    publicationFixtures: asArray(payload.publication_fixtures ?? payload.publicationFixtures).map(normaliseRow),
    acknowledgements: asArray(payload.acknowledgements).map(normaliseRow),
    changeRequests: asArray(payload.change_requests ?? payload.changeRequests).map(normaliseRow),
    communications: asArray(payload.communications).map(normaliseRow),
    clubMemberships: asArray(payload.club_memberships ?? payload.clubMemberships).map(normaliseRow),
    clubInvitations: asArray(payload.club_invitations ?? payload.clubInvitations).map(normaliseRow),
    calendarFeeds: asArray(payload.calendar_feeds ?? payload.calendarFeeds).map(normaliseRow),
  };
}

export function normaliseLeagueClubPortalData(payload = {}) {
  return {
    league: normaliseRow(payload.league || {}),
    club: normaliseRow(payload.club || {}),
    access: {
      role: payload.access?.role || "club_viewer",
      canRespond: asBoolean(payload.access?.can_respond ?? payload.access?.canRespond),
      canRequestChanges: asBoolean(payload.access?.can_request_changes ?? payload.access?.canRequestChanges),
    },
    teams: asArray(payload.teams).map(normaliseRow),
    venues: asArray(payload.venues).map(normaliseRow),
    fixtures: asArray(payload.fixtures).map(normaliseRow),
    acknowledgements: asArray(payload.acknowledgements).map(normaliseRow),
    changeRequests: asArray(payload.change_requests ?? payload.changeRequests).map(normaliseRow),
    communications: asArray(payload.communications).map(normaliseRow),
    calendarFeeds: asArray(payload.calendar_feeds ?? payload.calendarFeeds).map(normaliseRow),
  };
}

function snapshotKey(row = {}) {
  return `${row.targetType || row.target_type || "fixture"}:${row.targetId || row.target_id || row.id || ""}`;
}

function comparableSnapshot(row = {}) {
  const snapshot = row.snapshot && typeof row.snapshot === "object" ? row.snapshot : row;
  return {
    date: snapshot.scheduled_date || snapshot.scheduledDate || snapshot.date || "",
    kickOff: String(snapshot.kick_off || snapshot.kickOff || "").slice(0, 5),
    venueId: snapshot.venue_id || snapshot.venueId || "",
    homeTeamId: snapshot.home_team_id || snapshot.homeTeamId || "",
    awayTeamId: snapshot.away_team_id || snapshot.awayTeamId || "",
    status: snapshot.status || "scheduled",
  };
}

export function compareLeaguePublications(currentRows = [], previousRows = []) {
  const current = new Map(asArray(currentRows).map((row) => [snapshotKey(row), row]));
  const previous = new Map(asArray(previousRows).map((row) => [snapshotKey(row), row]));
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  current.forEach((row, key) => {
    const prior = previous.get(key);
    if (!prior) {
      added.push(row);
      return;
    }
    const left = comparableSnapshot(row);
    const right = comparableSnapshot(prior);
    if (JSON.stringify(left) === JSON.stringify(right)) unchanged.push(row);
    else changed.push({ current: row, previous: prior, fields: Object.keys(left).filter((field) => left[field] !== right[field]) });
  });
  previous.forEach((row, key) => {
    if (!current.has(key)) removed.push(row);
  });

  return {
    added,
    removed,
    changed,
    unchanged,
    counts: { added: added.length, removed: removed.length, changed: changed.length, unchanged: unchanged.length },
  };
}


function normaliseFixtureDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  return text;
}

function fullTimeDate(value) {
  const normalised = normaliseFixtureDate(value);
  const match = normalised.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : normalised;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildFullTimeFixtureCsv(rows = [], workspace = {}) {
  const teams = new Map(asArray(workspace.teams).map((row) => [row.id, row.name]));
  const divisions = new Map(asArray(workspace.divisions).map((row) => [row.id, row.name]));
  const venues = new Map(asArray(workspace.venues).map((row) => [row.id, row.name]));
  const cups = new Map(asArray(workspace.cups).map((row) => [row.id, row.name]));
  const header = ["Date", "Time", "Competition", "Home Team", "Away Team", "Venue", "Status", "External Reference"];
  const body = asArray(rows).map((row) => {
    const snapshot = row.snapshot && typeof row.snapshot === "object" ? row.snapshot : row;
    const competitionType = snapshot.competition_type || snapshot.competitionType || "league";
    const competitionId = snapshot.competition_id || snapshot.competitionId || snapshot.division_id || snapshot.divisionId || "";
    return [
      fullTimeDate(snapshot.scheduled_date || snapshot.scheduledDate || snapshot.date || ""),
      String(snapshot.kick_off || snapshot.kickOff || "").slice(0, 5),
      competitionType === "cup" ? (cups.get(competitionId) || "Cup") : (divisions.get(competitionId) || "League"),
      teams.get(snapshot.home_team_id || snapshot.homeTeamId) || snapshot.home_team_name || snapshot.homeTeamName || "",
      teams.get(snapshot.away_team_id || snapshot.awayTeamId) || snapshot.away_team_name || snapshot.awayTeamName || "",
      venues.get(snapshot.venue_id || snapshot.venueId) || snapshot.venue_name || snapshot.venueName || "",
      snapshot.status || "scheduled",
      `${row.targetType || row.target_type || "fixture"}:${row.targetId || row.target_id || row.id || ""}`,
    ].map(csvCell).join(",");
  });
  return [header.map(csvCell).join(","), ...body].join("\r\n");
}

function normaliseText(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += character;
  }
  cells.push(current.trim());
  return cells;
}

export function reconcileFullTimeFixtureCsv(csvText, publicationRows = [], workspace = {}) {
  const lines = String(csvText || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], matched: [], missing: asArray(publicationRows), extras: [], differences: [], errors: ["The CSV contains no fixture rows."] };
  const headers = parseCsvLine(lines[0]).map((value) => normaliseText(value).replaceAll(" ", "_"));
  const index = (names) => names.map((name) => headers.indexOf(name)).find((position) => position >= 0) ?? -1;
  const positions = {
    date: index(["date", "fixture_date"]),
    time: index(["time", "kick_off", "kickoff"]),
    home: index(["home_team", "home"]),
    away: index(["away_team", "away"]),
    venue: index(["venue", "ground"]),
  };
  if ([positions.date, positions.home, positions.away].some((position) => position < 0)) {
    return { rows: [], matched: [], missing: asArray(publicationRows), extras: [], differences: [], errors: ["The CSV must include Date, Home Team and Away Team columns."] };
  }
  const imported = lines.slice(1).map((line, rowIndex) => {
    const cells = parseCsvLine(line);
    return {
      row: rowIndex + 2,
      date: normaliseFixtureDate(cells[positions.date] || ""),
      kickOff: positions.time >= 0 ? String(cells[positions.time] || "").slice(0, 5) : "",
      home: positions.home >= 0 ? cells[positions.home] || "" : "",
      away: positions.away >= 0 ? cells[positions.away] || "" : "",
      venue: positions.venue >= 0 ? cells[positions.venue] || "" : "",
    };
  });
  const teams = new Map(asArray(workspace.teams).map((row) => [row.id, row.name]));
  const venues = new Map(asArray(workspace.venues).map((row) => [row.id, row.name]));
  const published = asArray(publicationRows).map((row) => {
    const snapshot = row.snapshot && typeof row.snapshot === "object" ? row.snapshot : row;
    return {
      row,
      date: normaliseFixtureDate(snapshot.scheduled_date || snapshot.scheduledDate || ""),
      kickOff: String(snapshot.kick_off || snapshot.kickOff || "").slice(0, 5),
      home: teams.get(snapshot.home_team_id || snapshot.homeTeamId) || snapshot.home_team_name || "",
      away: teams.get(snapshot.away_team_id || snapshot.awayTeamId) || snapshot.away_team_name || "",
      venue: venues.get(snapshot.venue_id || snapshot.venueId) || snapshot.venue_name || "",
    };
  });
  const used = new Set();
  const matched = [];
  const extras = [];
  const differences = [];
  imported.forEach((candidate) => {
    const foundIndex = published.findIndex((fixture, fixtureIndex) => !used.has(fixtureIndex)
      && normaliseText(fixture.home) === normaliseText(candidate.home)
      && normaliseText(fixture.away) === normaliseText(candidate.away));
    if (foundIndex < 0) { extras.push(candidate); return; }
    used.add(foundIndex);
    const fixture = published[foundIndex];
    const fields = [];
    if (fixture.date !== candidate.date) fields.push("date");
    if (candidate.kickOff && fixture.kickOff !== candidate.kickOff) fields.push("kick-off");
    if (candidate.venue && normaliseText(fixture.venue) !== normaliseText(candidate.venue)) fields.push("venue");
    if (fields.length) differences.push({ imported: candidate, published: fixture.row, fields });
    else matched.push({ imported: candidate, published: fixture.row });
  });
  const missing = published.filter((_, fixtureIndex) => !used.has(fixtureIndex)).map((fixture) => fixture.row);
  return { rows: imported, matched, missing, extras, differences, errors: [] };
}

export function publicationStatusLabel(status) {
  return ({ draft: "Draft", published: "Published", superseded: "Superseded", withdrawn: "Withdrawn" }[status] || status || "Unknown");
}
