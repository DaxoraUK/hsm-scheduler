function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function camelRow(row = {}) {
  return {
    ...row,
    publicationFixtureId: row.publication_fixture_id || row.publicationFixtureId || "",
    publicationId: row.publication_id || row.publicationId || "",
    parentClubId: row.parent_club_id || row.parentClubId || "",
    targetType: row.target_type || row.targetType || "schedule_entry",
    targetId: row.target_id || row.targetId || "",
    fixtureKey: row.fixture_key || row.fixtureKey || "",
    competitionType: row.competition_type || row.competitionType || "league",
    competitionId: row.competition_id || row.competitionId || "",
    divisionId: row.division_id || row.divisionId || "",
    cupId: row.cup_id || row.cupId || "",
    seasonId: row.season_id || row.seasonId || "",
    homeTeamId: row.home_team_id || row.homeTeamId || "",
    awayTeamId: row.away_team_id || row.awayTeamId || "",
    winnerTeamId: row.winner_team_id || row.winnerTeamId || "",
    scheduledDate: row.scheduled_date || row.scheduledDate || "",
    kickOff: row.kick_off || row.kickOff || "",
    outcomeType: row.outcome_type || row.outcomeType || "played",
    homeScore: row.home_score ?? row.homeScore ?? "",
    awayScore: row.away_score ?? row.awayScore ?? "",
    homePenalties: row.home_penalties ?? row.homePenalties ?? "",
    awayPenalties: row.away_penalties ?? row.awayPenalties ?? "",
    submittedAt: row.submitted_at || row.submittedAt || null,
    reviewedAt: row.reviewed_at || row.reviewedAt || null,
    verifiedAt: row.verified_at || row.verifiedAt || null,
    submittedBy: row.submitted_by || row.submittedBy || "",
    reviewedBy: row.reviewed_by || row.reviewedBy || "",
    reviewNotes: row.review_notes || row.reviewNotes || "",
    pointsDelta: asNumber(row.points_delta ?? row.pointsDelta),
    goalsForDelta: asNumber(row.goals_for_delta ?? row.goalsForDelta),
    goalsAgainstDelta: asNumber(row.goals_against_delta ?? row.goalsAgainstDelta),
    effectiveOn: row.effective_on || row.effectiveOn || "",
    createdAt: row.created_at || row.createdAt || null,
    revokedAt: row.revoked_at || row.revokedAt || null,
  };
}

function normalisePublishedFixture(row = {}) {
  const snapshot = row.snapshot && typeof row.snapshot === "object" ? row.snapshot : row;
  return camelRow({
    ...snapshot,
    publication_fixture_id: row.publication_fixture_id || row.publicationFixtureId || snapshot.publication_fixture_id,
    publication_id: row.publication_id || row.publicationId || snapshot.publication_id,
    target_type: row.target_type || row.targetType || snapshot.target_type,
    target_id: row.target_id || row.targetId || snapshot.target_id,
    fixture_key: row.fixture_key || row.fixtureKey || snapshot.fixture_key,
  });
}

export function normaliseLeagueResultsData(payload = {}) {
  return {
    access: {
      canManageResults: asBoolean(payload.access?.can_manage_results ?? payload.access?.canManageResults),
      canManage: asBoolean(payload.access?.can_manage ?? payload.access?.canManage),
      canSubmit: asBoolean(payload.access?.can_submit ?? payload.access?.canSubmit),
    },
    results: asArray(payload.results).map(camelRow),
    submissions: asArray(payload.submissions).map(camelRow),
    adjustments: asArray(payload.adjustments).map(camelRow),
    publishedFixtures: asArray(payload.published_fixtures ?? payload.publishedFixtures).map(normalisePublishedFixture),
  };
}

export function fixtureResultKey(fixture = {}) {
  if (fixture.fixtureKey) return fixture.fixtureKey;
  if ((fixture.targetType || fixture.competitionType) === "cup_tie" || fixture.competitionType === "cup") {
    return `cup:${fixture.targetId || fixture.id || "unknown"}`;
  }
  return [
    "league",
    fixture.divisionId || fixture.competitionId || "unknown",
    fixture.homeTeamId || "unknown",
    fixture.awayTeamId || "unknown",
    fixture.meetingNumber || fixture.meeting_number || 1,
  ].join(":");
}

export function buildMissingResultQueue(publishedFixtures = [], results = [], { today = new Date() } = {}) {
  const resultKeys = new Set(asArray(results).map(fixtureResultKey));
  const todayKey = typeof today === "string" ? today.slice(0, 10) : today.toISOString().slice(0, 10);
  return asArray(publishedFixtures)
    .filter((fixture) => fixture.scheduledDate && fixture.scheduledDate <= todayKey)
    .filter((fixture) => !["postponed", "cancelled", "void"].includes(String(fixture.status || "").toLowerCase()))
    .filter((fixture) => !resultKeys.has(fixtureResultKey(fixture)))
    .sort((left, right) => `${left.scheduledDate}T${left.kickOff || ""}`.localeCompare(`${right.scheduledDate}T${right.kickOff || ""}`));
}

function emptyStanding(team) {
  return {
    teamId: team.id,
    teamName: team.name || "Team",
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    adjustments: 0,
  };
}

export function buildLeagueStandings({ divisions = [], teams = [], results = [], adjustments = [] } = {}) {
  const divisionRows = new Map();
  asArray(divisions).forEach((division) => {
    divisionRows.set(division.id, {
      division,
      rows: new Map(asArray(teams)
        .filter((team) => team.divisionId === division.id && !["withdrawn", "inactive"].includes(team.status))
        .map((team) => [team.id, emptyStanding(team)])),
    });
  });

  asArray(results)
    .filter((result) => result.competitionType === "league" && result.status !== "void")
    .filter((result) => ["played", "home_walkover", "away_walkover"].includes(result.outcomeType))
    .forEach((result) => {
      const group = divisionRows.get(result.divisionId || result.competitionId);
      if (!group) return;
      const home = group.rows.get(result.homeTeamId);
      const away = group.rows.get(result.awayTeamId);
      if (!home || !away) return;
      const homeScore = asNumber(result.homeScore);
      const awayScore = asNumber(result.awayScore);
      const winPoints = asNumber(group.division.winPoints, 3);
      const drawPoints = asNumber(group.division.drawPoints, 1);
      const lossPoints = asNumber(group.division.lossPoints, 0);

      home.played += 1;
      away.played += 1;
      home.goalsFor += homeScore;
      home.goalsAgainst += awayScore;
      away.goalsFor += awayScore;
      away.goalsAgainst += homeScore;

      if (homeScore > awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += winPoints;
        away.points += lossPoints;
      } else if (awayScore > homeScore) {
        away.won += 1;
        home.lost += 1;
        away.points += winPoints;
        home.points += lossPoints;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += drawPoints;
        away.points += drawPoints;
      }
    });

  asArray(adjustments)
    .filter((adjustment) => adjustment.status === "active")
    .forEach((adjustment) => {
      const row = divisionRows.get(adjustment.divisionId)?.rows.get(adjustment.teamId);
      if (!row) return;
      row.points += asNumber(adjustment.pointsDelta);
      row.goalsFor += asNumber(adjustment.goalsForDelta);
      row.goalsAgainst += asNumber(adjustment.goalsAgainstDelta);
      row.adjustments += asNumber(adjustment.pointsDelta);
    });

  return [...divisionRows.values()].map(({ division, rows }) => {
    const standings = [...rows.values()].map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
    })).sort((left, right) => (
      right.points - left.points
      || right.goalDifference - left.goalDifference
      || right.goalsFor - left.goalsFor
      || left.teamName.localeCompare(right.teamName)
    )).map((row, index) => ({ ...row, position: index + 1 }));
    return { division, standings };
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(current.trim()); current = "";
    } else current += character;
  }
  values.push(current.trim());
  return values;
}

function normaliseHeader(value) {
  return String(value || "").trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "_").replaceAll(/^_|_$/g, "");
}

function parseDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const uk = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

function normaliseName(value) {
  return String(value || "").trim().toLowerCase().replaceAll(/[’']/g, "").replaceAll(/[^a-z0-9]+/g, " ").trim();
}

export function parseFullTimeResultsCsv(csvText = "") {
  const lines = String(csvText || "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], errors: ["Add a Full-Time results CSV with a header row."] };
  const headers = parseCsvLine(lines[0]).map(normaliseHeader);
  const pick = (row, names) => {
    const index = names.map((name) => headers.indexOf(name)).find((value) => value >= 0);
    return index >= 0 ? row[index] : "";
  };
  const rows = [];
  const errors = [];
  lines.slice(1).forEach((line, offset) => {
    const values = parseCsvLine(line);
    const rowNumber = offset + 2;
    const homeTeam = pick(values, ["home_team", "home", "home_team_name"]);
    const awayTeam = pick(values, ["away_team", "away", "away_team_name"]);
    const date = parseDate(pick(values, ["date", "fixture_date", "match_date"]));
    const homeScore = Number(pick(values, ["home_score", "home_goals", "home_team_score"]));
    const awayScore = Number(pick(values, ["away_score", "away_goals", "away_team_score"]));
    if (!homeTeam || !awayTeam || !date || !Number.isFinite(homeScore) || !Number.isFinite(awayScore)) {
      errors.push(`Row ${rowNumber}: date, home team, away team and both scores are required.`);
      return;
    }
    rows.push({ date, homeTeam, awayTeam, homeScore, awayScore, competition: pick(values, ["competition", "division", "cup"]), rowNumber });
  });
  return { rows, errors };
}

export function reconcileFullTimeResults(csvText, publishedFixtures = [], results = [], workspace = {}) {
  const parsed = parseFullTimeResultsCsv(csvText);
  const teamNames = new Map(asArray(workspace.teams).map((team) => [team.id, team.name]));
  const resultByKey = new Map(asArray(results).map((result) => [fixtureResultKey(result), result]));
  const fixtureCandidates = asArray(publishedFixtures).map((fixture) => ({
    fixture,
    date: fixture.scheduledDate,
    homeName: normaliseName(teamNames.get(fixture.homeTeamId) || fixture.homeTeamName),
    awayName: normaliseName(teamNames.get(fixture.awayTeamId) || fixture.awayTeamName),
  }));
  const matched = [];
  const differences = [];
  const unmatched = [];
  const usedKeys = new Set();

  parsed.rows.forEach((row) => {
    const candidate = fixtureCandidates.find((item) => item.date === row.date
      && item.homeName === normaliseName(row.homeTeam)
      && item.awayName === normaliseName(row.awayTeam));
    if (!candidate) { unmatched.push(row); return; }
    const key = fixtureResultKey(candidate.fixture);
    usedKeys.add(key);
    const recorded = resultByKey.get(key);
    if (!recorded) matched.push({ ...row, fixture: candidate.fixture, status: "new" });
    else if (asNumber(recorded.homeScore) !== row.homeScore || asNumber(recorded.awayScore) !== row.awayScore) {
      differences.push({ ...row, fixture: candidate.fixture, recorded });
    } else matched.push({ ...row, fixture: candidate.fixture, recorded, status: "same" });
  });

  const missing = asArray(results).filter((result) => !usedKeys.has(fixtureResultKey(result)));
  return { ...parsed, matched, differences, unmatched, missing };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function resultsToCsv(results = [], workspace = {}) {
  const teamNames = new Map(asArray(workspace.teams).map((team) => [team.id, team.name]));
  const divisionNames = new Map(asArray(workspace.divisions).map((division) => [division.id, division.name]));
  const cupNames = new Map(asArray(workspace.cups).map((cup) => [cup.id, cup.name]));
  const rows = [["Date", "Competition", "Home Team", "Home Score", "Away Score", "Away Team", "Outcome", "Source", "Verified At"]];
  asArray(results).forEach((result) => rows.push([
    result.scheduledDate,
    result.competitionType === "cup" ? cupNames.get(result.cupId || result.competitionId) : divisionNames.get(result.divisionId || result.competitionId),
    teamNames.get(result.homeTeamId),
    result.homeScore,
    result.awayScore,
    teamNames.get(result.awayTeamId),
    result.outcomeType,
    result.source,
    result.verifiedAt,
  ]));
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
