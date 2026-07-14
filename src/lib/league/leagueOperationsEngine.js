const OFFICIAL_ROLES = Object.freeze(["referee", "assistant_1", "assistant_2", "fourth_official", "observer"]);
const ROLE_LABELS = Object.freeze({
  referee: "Referee",
  assistant_1: "Assistant 1",
  assistant_2: "Assistant 2",
  fourth_official: "Fourth official",
  observer: "Observer / mentor",
});

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
    officialId: row.official_id || row.officialId || "",
    divisionId: row.division_id || row.divisionId || "",
    cupId: row.cup_id || row.cupId || "",
    parentClubId: row.parent_club_id || row.parentClubId || "",
    teamId: row.team_id || row.teamId || "",
    targetType: row.target_type || row.targetType || "",
    targetId: row.target_id || row.targetId || "",
    targetDate: row.target_date || row.targetDate || "",
    kickOff: row.kick_off || row.kickOff || "",
    venueId: row.venue_id || row.venueId || "",
    role: row.role || "referee",
    status: row.status || "active",
    grade: row.grade || "",
    email: row.email || "",
    phone: row.phone || "",
    homePostcode: row.home_postcode || row.homePostcode || "",
    travelRadiusMiles: Number(row.travel_radius_miles ?? row.travelRadiusMiles ?? 35),
    maxAppointmentsPerDay: Number(row.max_appointments_per_day ?? row.maxAppointmentsPerDay ?? 1),
    maxAppointmentsPerWeek: Number(row.max_appointments_per_week ?? row.maxAppointmentsPerWeek ?? 2),
    canReferee: asBoolean(row.can_referee ?? row.canReferee),
    canAssistant: asBoolean(row.can_assistant ?? row.canAssistant),
    canFourth: asBoolean(row.can_fourth ?? row.canFourth),
    canObserve: asBoolean(row.can_observe ?? row.canObserve),
    availableOn: row.available_on || row.availableOn || "",
    startsAt: row.starts_at || row.startsAt || "",
    endsAt: row.ends_at || row.endsAt || "",
    availabilityStatus: row.availability_status || row.availabilityStatus || row.status || "available",
    conflictType: row.conflict_type || row.conflictType || "club",
    reason: row.reason || "",
    scopeType: row.scope_type || row.scopeType || "league",
    scopeId: row.scope_id || row.scopeId || "",
    refereeCount: Number(row.referee_count ?? row.refereeCount ?? 1),
    assistantCount: Number(row.assistant_count ?? row.assistantCount ?? 0),
    fourthOfficialCount: Number(row.fourth_official_count ?? row.fourthOfficialCount ?? 0),
    observerCount: Number(row.observer_count ?? row.observerCount ?? 0),
    minimumGrade: row.minimum_grade || row.minimumGrade || "",
    responseToken: row.response_token || row.responseToken || "",
    responseExpiresAt: row.response_expires_at || row.responseExpiresAt || null,
    requestedByClubId: row.requested_by_club_id || row.requestedByClubId || "",
    originalDate: row.original_date || row.originalDate || "",
    originalKickOff: row.original_kick_off || row.originalKickOff || "",
    originalVenueId: row.original_venue_id || row.originalVenueId || "",
    proposedDates: asArray(row.proposed_dates ?? row.proposedDates),
    deadlineOn: row.deadline_on || row.deadlineOn || "",
    notes: row.notes || "",
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
  };
}

export function normaliseLeagueOperationsData(payload = {}) {
  return {
    access: {
      canManageOfficials: asBoolean(payload.access?.can_manage_officials ?? payload.access?.canManageOfficials),
      canOperate: asBoolean(payload.access?.can_operate ?? payload.access?.canOperate),
      canManage: asBoolean(payload.access?.can_manage ?? payload.access?.canManage),
    },
    officials: asArray(payload.officials).map(normaliseRow),
    availability: asArray(payload.availability).map(normaliseRow),
    conflicts: asArray(payload.conflicts).map(normaliseRow),
    requirements: asArray(payload.requirements).map(normaliseRow),
    assignments: asArray(payload.assignments).map(normaliseRow),
    postponements: asArray(payload.postponements).map(normaliseRow),
    venuePositions: asArray(payload.venue_positions ?? payload.venuePositions).map(normaliseRow),
  };
}

function entityName(rows, id, fallback = "Unknown") {
  return asArray(rows).find((row) => row.id === id)?.name || fallback;
}

function timeValue(value) {
  const [hours, minutes] = String(value || "00:00").slice(0, 5).split(":").map(Number);
  return (hours * 60) + minutes;
}

function appointmentKey(targetType, targetId, role) {
  return `${targetType}:${targetId}:${role}`;
}

export function getRequiredOfficialRoles(requirement = {}) {
  const roles = [];
  if (Number(requirement.refereeCount ?? 1) > 0) roles.push("referee");
  if (Number(requirement.assistantCount ?? 0) > 0) roles.push("assistant_1");
  if (Number(requirement.assistantCount ?? 0) > 1) roles.push("assistant_2");
  if (Number(requirement.fourthOfficialCount ?? 0) > 0) roles.push("fourth_official");
  if (Number(requirement.observerCount ?? 0) > 0) roles.push("observer");
  return roles;
}

export function getFixtureOfficialRequirement(fixture, requirements = []) {
  const rows = asArray(requirements);
  const exactRound = fixture.competitionType === "cup"
    ? rows.find((row) => row.scopeType === "cup_round" && row.scopeId === fixture.cupRoundId)
    : null;
  const cup = fixture.competitionType === "cup"
    ? rows.find((row) => row.scopeType === "cup" && row.scopeId === fixture.competitionId)
    : null;
  const division = rows.find((row) => row.scopeType === "division" && row.scopeId === fixture.divisionId);
  const league = rows.find((row) => row.scopeType === "league");
  return exactRound || cup || division || league || {
    scopeType: "default",
    refereeCount: 1,
    assistantCount: 0,
    fourthOfficialCount: 0,
    observerCount: 0,
    minimumGrade: "",
  };
}

export function buildLeagueOperationalFixtures(workspace = {}, scheduleVersion = null) {
  const entries = asArray(scheduleVersion?.entries);
  const leagueFixtures = entries.map((entry) => ({
    id: entry.id,
    targetType: "schedule_entry",
    targetId: entry.id,
    competitionType: "league",
    competitionId: entry.divisionId,
    competitionName: entityName(workspace.divisions, entry.divisionId, "League"),
    divisionId: entry.divisionId,
    cupRoundId: "",
    date: entry.scheduledDate || "",
    kickOff: String(entry.kickOff || "").slice(0, 5),
    venueId: entry.venueId || "",
    homeTeamId: entry.homeTeamId,
    awayTeamId: entry.awayTeamId,
    homeTeamName: entityName(workspace.teams, entry.homeTeamId, "Home team"),
    awayTeamName: entityName(workspace.teams, entry.awayTeamId, "Away team"),
    venueName: entityName(workspace.venues, entry.venueId, "Venue TBC"),
    placementStatus: entry.placementStatus || (entry.scheduledDate ? "placed" : "unplaced"),
    status: entry.status || "scheduled",
    locked: Boolean(entry.locked),
    source: "schedule",
  }));

  const cupFixtures = asArray(workspace.cupTies).map((tie) => ({
    id: tie.id,
    targetType: "cup_tie",
    targetId: tie.id,
    competitionType: "cup",
    competitionId: tie.cupId,
    competitionName: entityName(workspace.cups, tie.cupId, "Cup"),
    divisionId: "",
    cupRoundId: tie.cupRoundId,
    date: tie.scheduledDate || "",
    kickOff: String(tie.kickOff || "").slice(0, 5),
    venueId: tie.venueId || "",
    homeTeamId: tie.homeTeamId,
    awayTeamId: tie.awayTeamId,
    homeTeamName: entityName(workspace.teams, tie.homeTeamId, "TBC"),
    awayTeamName: entityName(workspace.teams, tie.awayTeamId, "TBC"),
    venueName: entityName(workspace.venues, tie.venueId, "Venue TBC"),
    placementStatus: tie.scheduledDate ? "placed" : "unplaced",
    status: tie.status || "draft",
    locked: Boolean(tie.locked),
    source: "cup",
  }));

  return [...leagueFixtures, ...cupFixtures].sort((left, right) => {
    const leftKey = `${left.date || "9999-99-99"}T${left.kickOff || "99:99"}`;
    const rightKey = `${right.date || "9999-99-99"}T${right.kickOff || "99:99"}`;
    return leftKey.localeCompare(rightKey) || left.competitionName.localeCompare(right.competitionName);
  });
}

function officialSupportsRole(official, role) {
  if (role === "referee") return official.canReferee;
  if (["assistant_1", "assistant_2"].includes(role)) return official.canAssistant;
  if (role === "fourth_official") return official.canFourth;
  if (role === "observer") return official.canObserve;
  return false;
}

function officialMeetsMinimumGrade(official, requirement = {}) {
  const minimum = String(requirement.minimumGrade || "").trim();
  if (!minimum) return true;
  const actual = String(official.grade || "").trim();
  if (!actual) return false;
  const minimumNumber = Number(minimum.match(/\d+/)?.[0]);
  const actualNumber = Number(actual.match(/\d+/)?.[0]);
  if (Number.isFinite(minimumNumber) && Number.isFinite(actualNumber)) {
    // FA referee levels use lower numbers for higher grades.
    return actualNumber <= minimumNumber;
  }
  return actual.toLowerCase() === minimum.toLowerCase();
}

function officialAvailable(official, fixture, availability = []) {
  const dateRows = asArray(availability).filter((row) => row.officialId === official.id && row.availableOn === fixture.date);
  if (!dateRows.length) return true;
  if (dateRows.some((row) => row.availabilityStatus === "unavailable")) return false;
  return dateRows.some((row) => {
    if (row.availabilityStatus === "unavailable") return false;
    if (!row.startsAt && !row.endsAt) return true;
    const kickOff = timeValue(fixture.kickOff);
    return (!row.startsAt || kickOff >= timeValue(row.startsAt)) && (!row.endsAt || kickOff <= timeValue(row.endsAt));
  });
}

function officialHasConflict(official, fixture, conflicts = [], workspace = {}) {
  const home = asArray(workspace.teams).find((row) => row.id === fixture.homeTeamId);
  const away = asArray(workspace.teams).find((row) => row.id === fixture.awayTeamId);
  return asArray(conflicts).some((row) => {
    if (row.officialId !== official.id) return false;
    if (row.teamId && [fixture.homeTeamId, fixture.awayTeamId].includes(row.teamId)) return true;
    if (row.parentClubId && [home?.parentClubId, away?.parentClubId].includes(row.parentClubId)) return true;
    return false;
  });
}

function officialBusy(official, fixture, assignments = [], fixturesByTarget = new Map()) {
  return asArray(assignments).some((assignment) => {
    if (assignment.officialId !== official.id || ["declined", "withdrawn", "replacement_required"].includes(assignment.status)) return false;
    const other = fixturesByTarget.get(`${assignment.targetType}:${assignment.targetId}`);
    if (!other || !other.date || other.date !== fixture.date) return false;
    const minutes = Math.abs(timeValue(other.kickOff) - timeValue(fixture.kickOff));
    return minutes < 180;
  });
}

function appointmentCounts(assignments = [], fixturesByTarget = new Map()) {
  const daily = new Map();
  const weekly = new Map();
  asArray(assignments).forEach((assignment) => {
    if (["declined", "withdrawn", "replacement_required"].includes(assignment.status)) return;
    const fixture = fixturesByTarget.get(`${assignment.targetType}:${assignment.targetId}`);
    if (!fixture?.date) return;
    const date = new Date(`${fixture.date}T12:00:00`);
    const monday = new Date(date);
    const day = (date.getDay() + 6) % 7;
    monday.setDate(date.getDate() - day);
    const weekKey = monday.toISOString().slice(0, 10);
    const dayKey = `${assignment.officialId}:${fixture.date}`;
    const weeklyKey = `${assignment.officialId}:${weekKey}`;
    daily.set(dayKey, (daily.get(dayKey) || 0) + 1);
    weekly.set(weeklyKey, (weekly.get(weeklyKey) || 0) + 1);
  });
  return { daily, weekly };
}

function postcodeArea(postcode) {
  return String(postcode || "").trim().toUpperCase().split(/\s+/)[0].replace(/\d+.*$/, "");
}

function candidateScore(official, fixture, assignments, fixturesByTarget, counts, workspace) {
  const date = new Date(`${fixture.date}T12:00:00`);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const weekKey = monday.toISOString().slice(0, 10);
  const dayCount = counts.daily.get(`${official.id}:${fixture.date}`) || 0;
  const weekCount = counts.weekly.get(`${official.id}:${weekKey}`) || 0;
  const venue = asArray(workspace.venues).find((row) => row.id === fixture.venueId);
  const sameArea = postcodeArea(official.homePostcode) && postcodeArea(official.homePostcode) === postcodeArea(venue?.postcode);
  const repeatedClubCount = asArray(assignments).filter((assignment) => {
    if (assignment.officialId !== official.id) return false;
    const other = fixturesByTarget.get(`${assignment.targetType}:${assignment.targetId}`);
    return other && [other.homeTeamId, other.awayTeamId].some((id) => [fixture.homeTeamId, fixture.awayTeamId].includes(id));
  }).length;
  return (weekCount * 20) + (dayCount * 50) + (repeatedClubCount * 8) - (sameArea ? 5 : 0);
}

export function suggestLeagueOfficialAssignments({ fixtures = [], officials = [], availability = [], conflicts = [], requirements = [], assignments = [], workspace = {} } = {}) {
  const activeOfficials = asArray(officials).filter((row) => row.status === "active");
  const fixturesByTarget = new Map(asArray(fixtures).map((fixture) => [`${fixture.targetType}:${fixture.targetId}`, fixture]));
  const nextAssignments = asArray(assignments).map((row) => ({ ...row }));
  const counts = appointmentCounts(nextAssignments, fixturesByTarget);
  const suggestions = [];
  const unresolved = [];

  asArray(fixtures).filter((fixture) => fixture.date && fixture.kickOff && fixture.venueId && !["postponed", "cancelled", "played"].includes(fixture.status)).forEach((fixture) => {
    const requirement = getFixtureOfficialRequirement(fixture, requirements);
    getRequiredOfficialRoles(requirement).forEach((role) => {
      const key = appointmentKey(fixture.targetType, fixture.targetId, role);
      const existing = nextAssignments.find((row) => appointmentKey(row.targetType, row.targetId, row.role) === key && !["declined", "withdrawn", "replacement_required"].includes(row.status));
      if (existing) return;
      const candidates = activeOfficials
        .filter((official) => officialSupportsRole(official, role))
        .filter((official) => officialMeetsMinimumGrade(official, requirement))
        .filter((official) => officialAvailable(official, fixture, availability))
        .filter((official) => !officialHasConflict(official, fixture, conflicts, workspace))
        .filter((official) => !officialBusy(official, fixture, nextAssignments, fixturesByTarget))
        .filter((official) => {
          const date = new Date(`${fixture.date}T12:00:00`);
          const monday = new Date(date);
          monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
          const weekKey = monday.toISOString().slice(0, 10);
          return (counts.daily.get(`${official.id}:${fixture.date}`) || 0) < official.maxAppointmentsPerDay
            && (counts.weekly.get(`${official.id}:${weekKey}`) || 0) < official.maxAppointmentsPerWeek;
        })
        .sort((left, right) => candidateScore(left, fixture, nextAssignments, fixturesByTarget, counts, workspace) - candidateScore(right, fixture, nextAssignments, fixturesByTarget, counts, workspace));

      const selected = candidates[0];
      if (!selected) {
        unresolved.push({ fixture, role, reason: `No eligible ${ROLE_LABELS[role].toLowerCase()} is available.` });
        return;
      }
      const suggestion = {
        targetType: fixture.targetType,
        targetId: fixture.targetId,
        targetDate: fixture.date,
        kickOff: fixture.kickOff,
        venueId: fixture.venueId,
        officialId: selected.id,
        role,
        status: "proposed",
      };
      suggestions.push(suggestion);
      nextAssignments.push(suggestion);
      const date = new Date(`${fixture.date}T12:00:00`);
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const weekKey = monday.toISOString().slice(0, 10);
      counts.daily.set(`${selected.id}:${fixture.date}`, (counts.daily.get(`${selected.id}:${fixture.date}`) || 0) + 1);
      counts.weekly.set(`${selected.id}:${weekKey}`, (counts.weekly.get(`${selected.id}:${weekKey}`) || 0) + 1);
    });
  });

  return { suggestions, unresolved };
}

export function getLeagueOfficialCoverage(fixtures = [], requirements = [], assignments = []) {
  let required = 0;
  let filled = 0;
  const missing = [];
  asArray(fixtures).filter((fixture) => fixture.date && !["postponed", "cancelled"].includes(fixture.status)).forEach((fixture) => {
    const roles = getRequiredOfficialRoles(getFixtureOfficialRequirement(fixture, requirements));
    roles.forEach((role) => {
      required += 1;
      const assignment = asArray(assignments).find((row) => row.targetType === fixture.targetType && row.targetId === fixture.targetId && row.role === role && !["declined", "withdrawn", "replacement_required"].includes(row.status));
      if (assignment) filled += 1;
      else missing.push({ fixture, role });
    });
  });
  return {
    required,
    filled,
    missing,
    percentage: required ? Math.round((filled / required) * 100) : 100,
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function leagueAppointmentsToCsv(fixtures = [], assignments = [], officials = []) {
  const fixtureMap = new Map(asArray(fixtures).map((fixture) => [`${fixture.targetType}:${fixture.targetId}`, fixture]));
  const officialMap = new Map(asArray(officials).map((official) => [official.id, official]));
  const header = ["date", "kick_off", "competition", "home_team", "away_team", "venue", "role", "official", "status"];
  const rows = asArray(assignments).map((assignment) => {
    const fixture = fixtureMap.get(`${assignment.targetType}:${assignment.targetId}`) || {};
    const official = officialMap.get(assignment.officialId) || {};
    return [fixture.date, fixture.kickOff, fixture.competitionName, fixture.homeTeamName, fixture.awayTeamName, fixture.venueName, ROLE_LABELS[assignment.role] || assignment.role, official.name, assignment.status];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export { OFFICIAL_ROLES, ROLE_LABELS };
