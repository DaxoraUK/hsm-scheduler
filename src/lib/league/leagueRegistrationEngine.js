import { neutraliseSpreadsheetFormula } from "../export/spreadsheetSafety.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function isoDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function isoDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normaliseName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalisePlayer(row = {}) {
  const firstName = normaliseName(row.first_name || row.firstName);
  const lastName = normaliseName(row.last_name || row.lastName);
  return {
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    firstName,
    lastName,
    displayName: normaliseName(row.display_name || row.displayName) || `${firstName} ${lastName}`.trim() || "Unnamed player",
    dateOfBirth: isoDate(row.date_of_birth || row.dateOfBirth),
    externalRef: row.external_ref || row.externalRef || "",
    status: row.status || "active",
    confidentialNotes: row.confidential_notes || row.confidentialNotes || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseRegistration(row = {}) {
  return {
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    seasonId: row.season_id || row.seasonId || "",
    playerId: row.player_id || row.playerId || "",
    parentClubId: row.parent_club_id || row.parentClubId || "",
    teamId: row.team_id || row.teamId || "",
    registrationType: row.registration_type || row.registrationType || "new",
    status: row.status || "draft",
    submittedAt: isoDateTime(row.submitted_at || row.submittedAt),
    reviewedAt: isoDateTime(row.reviewed_at || row.reviewedAt),
    effectiveFrom: isoDate(row.effective_from || row.effectiveFrom),
    effectiveTo: isoDate(row.effective_to || row.effectiveTo),
    decisionNotes: row.decision_notes || row.decisionNotes || "",
    correctionNotes: row.correction_notes || row.correctionNotes || "",
    playerName: row.player_name || row.playerName || "",
    clubName: row.club_name || row.clubName || "",
    teamName: row.team_name || row.teamName || "",
    seasonName: row.season_name || row.seasonName || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseTransfer(row = {}) {
  return {
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    seasonId: row.season_id || row.seasonId || "",
    playerId: row.player_id || row.playerId || "",
    fromClubId: row.from_club_id || row.fromClubId || "",
    toClubId: row.to_club_id || row.toClubId || "",
    toTeamId: row.to_team_id || row.toTeamId || "",
    status: row.status || "submitted",
    requestedOn: isoDate(row.requested_on || row.requestedOn),
    effectiveOn: isoDate(row.effective_on || row.effectiveOn),
    reason: row.reason || "",
    decisionNotes: row.decision_notes || row.decisionNotes || "",
    playerName: row.player_name || row.playerName || "",
    fromClubName: row.from_club_name || row.fromClubName || "",
    toClubName: row.to_club_name || row.toClubName || "",
    toTeamName: row.to_team_name || row.toTeamName || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseRule(row = {}) {
  return {
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    seasonId: row.season_id || row.seasonId || "",
    divisionId: row.division_id || row.divisionId || "",
    competitionType: row.competition_type || row.competitionType || "all",
    competitionId: row.competition_id || row.competitionId || "",
    ruleType: row.rule_type || row.ruleType || "registration_deadline",
    name: row.name || "Eligibility rule",
    severity: row.severity || "block",
    config: row.config && typeof row.config === "object" ? row.config : {},
    active: asBoolean(row.active ?? true),
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseDispensation(row = {}) {
  return {
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    seasonId: row.season_id || row.seasonId || "",
    playerId: row.player_id || row.playerId || "",
    teamId: row.team_id || row.teamId || "",
    ruleType: row.rule_type || row.ruleType || "other",
    status: row.status || "submitted",
    reason: row.reason || "",
    decisionNotes: row.decision_notes || row.decisionNotes || "",
    startsOn: isoDate(row.starts_on || row.startsOn),
    endsOn: isoDate(row.ends_on || row.endsOn),
    playerName: row.player_name || row.playerName || "",
    teamName: row.team_name || row.teamName || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseTeamSheet(row = {}) {
  return {
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    publicationFixtureId: row.publication_fixture_id || row.publicationFixtureId || "",
    teamId: row.team_id || row.teamId || "",
    parentClubId: row.parent_club_id || row.parentClubId || "",
    status: row.status || "draft",
    fixtureLabel: row.fixture_label || row.fixtureLabel || "",
    scheduledDate: isoDate(row.scheduled_date || row.scheduledDate),
    teamName: row.team_name || row.teamName || "",
    submittedAt: isoDateTime(row.submitted_at || row.submittedAt),
    verifiedAt: isoDateTime(row.verified_at || row.verifiedAt),
    validationStatus: row.validation_status || row.validationStatus || "not_checked",
    validationSummary: row.validation_summary || row.validationSummary || {},
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseTeamSheetPlayer(row = {}) {
  return {
    id: row.id || "",
    teamSheetId: row.team_sheet_id || row.teamSheetId || "",
    playerId: row.player_id || row.playerId || "",
    registrationId: row.registration_id || row.registrationId || "",
    squadRole: row.squad_role || row.squadRole || "starter",
    shirtNumber: row.shirt_number ?? row.shirtNumber ?? "",
    eligibilityStatus: row.eligibility_status || row.eligibilityStatus || "not_checked",
    eligibilityReasons: asArray(row.eligibility_reasons || row.eligibilityReasons),
    playerName: row.player_name || row.playerName || "",
    createdAt: isoDateTime(row.created_at || row.createdAt),
    updatedAt: isoDateTime(row.updated_at || row.updatedAt),
  };
}

function normaliseFixture(row = {}) {
  const snapshot = row.snapshot && typeof row.snapshot === "object" ? row.snapshot : {};
  return {
    id: row.id || row.publication_fixture_id || row.publicationFixtureId || "",
    publicationFixtureId: row.publication_fixture_id || row.publicationFixtureId || row.id || "",
    seasonId: row.season_id || row.seasonId || snapshot.season_id || snapshot.seasonId || "",
    divisionId: row.division_id || row.divisionId || snapshot.division_id || snapshot.divisionId || "",
    competitionType: row.competition_type || row.competitionType || snapshot.competition_type || snapshot.competitionType || "league",
    competitionId: row.competition_id || row.competitionId || snapshot.competition_id || snapshot.competitionId || "",
    competitionName: row.competition_name || row.competitionName || snapshot.competition_name || snapshot.competitionName || "League",
    homeTeamId: row.home_team_id || row.homeTeamId || snapshot.home_team_id || snapshot.homeTeamId || "",
    awayTeamId: row.away_team_id || row.awayTeamId || snapshot.away_team_id || snapshot.awayTeamId || "",
    homeTeamName: row.home_team_name || row.homeTeamName || snapshot.home_team_name || snapshot.homeTeamName || "Home",
    awayTeamName: row.away_team_name || row.awayTeamName || snapshot.away_team_name || snapshot.awayTeamName || "Away",
    scheduledDate: isoDate(row.scheduled_date || row.scheduledDate || snapshot.scheduled_date || snapshot.scheduledDate),
    kickOff: row.kick_off || row.kickOff || snapshot.kick_off || snapshot.kickOff || "",
    snapshot,
  };
}

export function playerAgeOn(dateOfBirth, onDate) {
  if (!dateOfBirth || !onDate) return null;
  const birth = new Date(`${isoDate(dateOfBirth)}T12:00:00Z`);
  const target = new Date(`${isoDate(onDate)}T12:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(target.getTime())) return null;
  let age = target.getUTCFullYear() - birth.getUTCFullYear();
  const monthDifference = target.getUTCMonth() - birth.getUTCMonth();
  if (monthDifference < 0 || (monthDifference === 0 && target.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function ruleApplies(rule, { fixture, team, registration }) {
  if (!rule.active) return false;
  if (rule.seasonId && fixture?.seasonId && rule.seasonId !== fixture.seasonId) return false;
  if (rule.divisionId && fixture?.divisionId && rule.divisionId !== fixture.divisionId) return false;
  if (rule.competitionType && rule.competitionType !== "all" && rule.competitionType !== fixture?.competitionType) return false;
  if (rule.competitionId && rule.competitionId !== fixture?.competitionId) return false;
  const configuredTeamId = String(rule.config?.teamId || "");
  if (configuredTeamId && configuredTeamId !== team?.id && configuredTeamId !== registration?.teamId) return false;
  return true;
}

function hasDispensation(dispensations, ruleType, { playerId, teamId, onDate }) {
  return asArray(dispensations).some((row) => row.status === "approved"
    && row.playerId === playerId
    && (!row.teamId || row.teamId === teamId)
    && (!row.ruleType || row.ruleType === ruleType || row.ruleType === "all")
    && (!row.startsOn || row.startsOn <= onDate)
    && (!row.endsOn || row.endsOn >= onDate));
}

export function assessLeaguePlayerEligibility({
  player,
  registration,
  team,
  fixture,
  rules = [],
  dispensations = [],
  sanctions = [],
  appearances = [],
  today = new Date(),
} = {}) {
  const onDate = fixture?.scheduledDate || isoDate(today instanceof Date ? today.toISOString() : today) || new Date().toISOString().slice(0, 10);
  const reasons = [];
  const warnings = [];
  const playerId = player?.id || registration?.playerId || "";
  const teamId = team?.id || registration?.teamId || "";

  if (!playerId) reasons.push({ code: "PLAYER_MISSING", label: "Player record is missing" });
  if (!registration) reasons.push({ code: "REGISTRATION_MISSING", label: "No registration exists for this player" });
  else {
    if (registration.status !== "approved") reasons.push({ code: "REGISTRATION_NOT_APPROVED", label: `Registration is ${String(registration.status || "not approved").replaceAll("_", " ")}` });
    if (registration.teamId && teamId && registration.teamId !== teamId) reasons.push({ code: "WRONG_TEAM", label: "Registration belongs to a different team" });
    if (registration.effectiveFrom && registration.effectiveFrom > onDate) reasons.push({ code: "REGISTRATION_NOT_STARTED", label: `Registration starts on ${registration.effectiveFrom}` });
    if (registration.effectiveTo && registration.effectiveTo < onDate) reasons.push({ code: "REGISTRATION_EXPIRED", label: `Registration expired on ${registration.effectiveTo}` });
  }

  const activeSuspension = asArray(sanctions).find((row) => row.subjectType === "person"
    && row.subjectId === playerId
    && ["active", "unpaid", "appealed"].includes(row.status)
    && (!row.startsOn || row.startsOn <= onDate)
    && (!row.endsOn || row.endsOn >= onDate)
    && (!Number(row.matchCount || 0) || Number(row.matchesServed || 0) < Number(row.matchCount || 0)));
  if (activeSuspension && !hasDispensation(dispensations, "suspension", { playerId, teamId, onDate })) {
    reasons.push({ code: "ACTIVE_SUSPENSION", label: "Player has an active suspension" });
  }

  asArray(rules).filter((rule) => ruleApplies(rule, { fixture, team, registration })).forEach((rule) => {
    if (hasDispensation(dispensations, rule.ruleType, { playerId, teamId, onDate })) return;
    const config = rule.config || {};
    const age = playerAgeOn(player?.dateOfBirth, onDate);
    let failed = false;
    let label = rule.name;

    if (rule.ruleType === "minimum_age" && Number.isFinite(Number(config.age)) && age !== null && age < Number(config.age)) {
      failed = true;
      label = `${rule.name}: minimum age is ${Number(config.age)}`;
    }
    if (rule.ruleType === "maximum_age" && Number.isFinite(Number(config.age)) && age !== null && age > Number(config.age)) {
      failed = true;
      label = `${rule.name}: maximum age is ${Number(config.age)}`;
    }
    if (rule.ruleType === "registration_deadline" && config.deadline && registration?.submittedAt && isoDate(registration.submittedAt) > isoDate(config.deadline)) {
      failed = true;
      label = `${rule.name}: registration was submitted after ${isoDate(config.deadline)}`;
    }
    if (rule.ruleType === "cup_tied" && fixture?.competitionType === "cup") {
      const otherCupAppearance = asArray(appearances).find((row) => row.playerId === playerId
        && row.competitionType === "cup"
        && row.competitionId === fixture.competitionId
        && row.teamId !== teamId
        && ["submitted", "verified"].includes(row.teamSheetStatus || row.status));
      if (otherCupAppearance) {
        failed = true;
        label = `${rule.name}: player has already appeared for another team in this cup`;
      }
    }
    if (rule.ruleType === "transfer_clearance") {
      const pendingTransfer = asArray(config.pendingTransfers).some((row) => row.playerId === playerId && ["submitted", "under_review"].includes(row.status));
      if (pendingTransfer) {
        failed = true;
        label = `${rule.name}: transfer clearance is still pending`;
      }
    }

    if (failed) {
      const issue = { code: `RULE_${String(rule.ruleType || "OTHER").toUpperCase()}`, label, ruleId: rule.id };
      if (rule.severity === "warn") warnings.push(issue);
      else reasons.push(issue);
    }
  });

  return {
    status: reasons.length ? "ineligible" : warnings.length ? "warning" : "eligible",
    eligible: reasons.length === 0,
    reasons,
    warnings,
    checkedOn: onDate,
  };
}

export function buildLeagueRegistrationSummary(data = {}, { today = new Date(), expiryDays = 30 } = {}) {
  const todayKey = isoDate(today instanceof Date ? today.toISOString() : today) || new Date().toISOString().slice(0, 10);
  const expiryDate = new Date(`${todayKey}T12:00:00Z`);
  expiryDate.setUTCDate(expiryDate.getUTCDate() + expiryDays);
  const expiryKey = expiryDate.toISOString().slice(0, 10);
  const players = asArray(data.players);
  const registrations = asArray(data.registrations);
  const transfers = asArray(data.transfers);
  const dispensations = asArray(data.dispensations);
  const sheets = asArray(data.teamSheets);

  const pendingRegistrations = registrations.filter((row) => ["submitted", "under_review"].includes(row.status));
  const correctionRequired = registrations.filter((row) => row.status === "correction_required");
  const approvedRegistrations = registrations.filter((row) => row.status === "approved");
  const expiringRegistrations = approvedRegistrations.filter((row) => row.effectiveTo && row.effectiveTo >= todayKey && row.effectiveTo <= expiryKey);
  const pendingTransfers = transfers.filter((row) => ["submitted", "under_review"].includes(row.status));
  const openDispensations = dispensations.filter((row) => ["submitted", "under_review"].includes(row.status));
  const invalidTeamSheets = sheets.filter((row) => row.validationStatus === "failed" || row.status === "rejected");

  const duplicateKeys = new Map();
  players.forEach((row) => {
    const key = `${normaliseName(row.firstName).toLowerCase()}|${normaliseName(row.lastName).toLowerCase()}|${row.dateOfBirth}`;
    if (!row.dateOfBirth || key === "||") return;
    duplicateKeys.set(key, (duplicateKeys.get(key) || 0) + 1);
  });
  const duplicateWarnings = [...duplicateKeys.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  const critical = correctionRequired.length + invalidTeamSheets.length;
  const attention = pendingRegistrations.length + pendingTransfers.length + openDispensations.length + expiringRegistrations.length + duplicateWarnings;

  return {
    status: critical > 0 ? "action_required" : attention > 0 ? "needs_review" : "ready",
    activePlayers: players.filter((row) => row.status === "active").length,
    approvedRegistrations: approvedRegistrations.length,
    pendingRegistrations: pendingRegistrations.length,
    correctionRequired: correctionRequired.length,
    pendingTransfers: pendingTransfers.length,
    expiringRegistrations: expiringRegistrations.length,
    duplicateWarnings,
    openDispensations: openDispensations.length,
    invalidTeamSheets: invalidTeamSheets.length,
  };
}

export function normaliseLeagueRegistrationData(payload = {}) {
  const data = {
    access: {
      role: payload.access?.role || "viewer",
      canView: asBoolean(payload.access?.can_view ?? payload.access?.canView),
      canManage: asBoolean(payload.access?.can_manage ?? payload.access?.canManage),
      canSubmit: asBoolean(payload.access?.can_submit ?? payload.access?.canSubmit),
      isClubPortal: asBoolean(payload.access?.is_club_portal ?? payload.access?.isClubPortal),
      clubId: payload.access?.club_id || payload.access?.clubId || "",
    },
    players: asArray(payload.players).map(normalisePlayer),
    registrations: asArray(payload.registrations).map(normaliseRegistration),
    transfers: asArray(payload.transfers).map(normaliseTransfer),
    rules: asArray(payload.rules).map(normaliseRule),
    dispensations: asArray(payload.dispensations).map(normaliseDispensation),
    teamSheets: asArray(payload.team_sheets ?? payload.teamSheets).map(normaliseTeamSheet),
    teamSheetPlayers: asArray(payload.team_sheet_players ?? payload.teamSheetPlayers).map(normaliseTeamSheetPlayer),
    fixtures: asArray(payload.fixtures).map(normaliseFixture),
    sanctions: asArray(payload.sanctions).map((row) => ({
      id: row.id || "",
      subjectType: row.subject_type || row.subjectType || "",
      subjectId: row.subject_id || row.subjectId || "",
      status: row.status || "",
      startsOn: isoDate(row.starts_on || row.startsOn),
      endsOn: isoDate(row.ends_on || row.endsOn),
      matchCount: Number(row.match_count ?? row.matchCount ?? 0),
      matchesServed: Number(row.matches_served ?? row.matchesServed ?? 0),
    })),
  };
  data.summary = buildLeagueRegistrationSummary(data);
  return data;
}

function csvCell(value) {
  const text = String(neutraliseSpreadsheetFormula(value) ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function leagueRegistrationsToCsv(data = {}) {
  const players = new Map(asArray(data.players).map((row) => [row.id, row]));
  const rows = [["Player", "Date of birth", "Club", "Team", "Season", "Type", "Status", "Effective from", "Effective to", "Decision notes"]];
  asArray(data.registrations).forEach((registration) => {
    const player = players.get(registration.playerId);
    rows.push([
      registration.playerName || player?.displayName || "",
      player?.dateOfBirth || "",
      registration.clubName,
      registration.teamName,
      registration.seasonName,
      registration.registrationType,
      registration.status,
      registration.effectiveFrom,
      registration.effectiveTo,
      registration.decisionNotes || registration.correctionNotes,
    ]);
  });
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function leagueEligibilityExceptionsToCsv(data = {}) {
  const rows = [["Player", "Team", "Rule", "Status", "Starts", "Ends", "Reason", "Decision notes"]];
  asArray(data.dispensations).forEach((row) => rows.push([
    row.playerName,
    row.teamName,
    row.ruleType,
    row.status,
    row.startsOn,
    row.endsOn,
    row.reason,
    row.decisionNotes,
  ]));
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
