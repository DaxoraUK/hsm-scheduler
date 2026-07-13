const DAY_MS = 24 * 60 * 60 * 1000;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || "").trim();
}

function asPositiveInteger(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function toTime(value, fallback = "15:00") {
  const text = asText(value);
  if (!text) return fallback;
  return text.slice(0, 5);
}

function pairKey(homeTeamId, awayTeamId) {
  return `${homeTeamId}::${awayTeamId}`;
}

function unorderedPairKey(teamAId, teamBId) {
  return [teamAId, teamBId].sort().join("::");
}

function entryPairKey(entry, meetings = 2) {
  return meetings === 1
    ? unorderedPairKey(entry.homeTeamId, entry.awayTeamId)
    : pairKey(entry.homeTeamId, entry.awayTeamId);
}

function isoDate(value) {
  const text = asText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function dateWithin(date, startsOn, endsOn) {
  if (!date || !startsOn || !endsOn) return false;
  return date >= startsOn && date <= endsOn;
}

function stableEntryKey(entry) {
  return entry.id || entry.clientKey || `${entry.divisionId}:${entry.homeTeamId}:${entry.awayTeamId}`;
}

function getSeason(workspace, seasonId = "") {
  const seasons = asArray(workspace?.seasons);
  return seasons.find((season) => season.id === seasonId)
    || seasons.find((season) => season.isCurrent)
    || seasons.find((season) => season.status === "active")
    || seasons[0]
    || null;
}

function getDivisionTeams(workspace, divisionId, seasonId) {
  return asArray(workspace?.teams)
    .filter((team) => team.seasonId === seasonId && team.divisionId === divisionId && team.status !== "withdrawn" && team.status !== "inactive")
    .sort((left, right) => left.name.localeCompare(right.name, "en-GB"));
}

function rotateRoundRobin(list) {
  if (list.length <= 2) return [...list];
  return [list[0], list[list.length - 1], ...list.slice(1, -1)];
}

/**
 * Builds a deterministic Berger-style fixture matrix.
 * `meetings` is either one (single round robin) or two (home and away).
 */
export function buildDivisionFixtureMatrix(teams = [], { meetings = 2 } = {}) {
  const activeTeams = asArray(teams).filter((team) => team?.id);
  if (activeTeams.length < 2) return [];

  const matchCount = Number(meetings) === 1 ? 1 : 2;
  const rotation = [...activeTeams];
  if (rotation.length % 2 === 1) rotation.push(null);

  const pairings = [];
  const rounds = rotation.length - 1;
  let current = [...rotation];

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    for (let pairIndex = 0; pairIndex < current.length / 2; pairIndex += 1) {
      const left = current[pairIndex];
      const right = current[current.length - 1 - pairIndex];
      if (!left || !right) continue;
      pairings.push({ roundNumber: roundIndex + 1, pairIndex, left, right });
    }
    current = rotateRoundRobin(current);
  }

  // Orient each pairing greedily so every team finishes a single round robin
  // with an equal home/away split (odd team count) or a one-game difference.
  const balance = new Map(activeTeams.map((team) => [team.id, 0]));
  const firstLeg = pairings.map(({ roundNumber, pairIndex, left, right }) => {
    const leftBalance = balance.get(left.id) || 0;
    const rightBalance = balance.get(right.id) || 0;
    let home = left;
    let away = right;
    if (rightBalance < leftBalance || (rightBalance === leftBalance && (roundNumber + pairIndex) % 2 === 1)) {
      home = right;
      away = left;
    }
    balance.set(home.id, (balance.get(home.id) || 0) + 1);
    balance.set(away.id, (balance.get(away.id) || 0) - 1);
    return { roundNumber, homeTeamId: home.id, awayTeamId: away.id };
  });

  if (matchCount === 1) return firstLeg;

  const secondLeg = firstLeg.map((fixture) => ({
    roundNumber: fixture.roundNumber + rounds,
    homeTeamId: fixture.awayTeamId,
    awayTeamId: fixture.homeTeamId,
  }));

  return [...firstLeg, ...secondLeg];
}

function playingDatesForDivision(workspace, seasonId, divisionId) {
  const season = getSeason(workspace, seasonId);
  const rows = asArray(workspace?.playingDates)
    .filter((row) => row.seasonId === seasonId)
    .filter((row) => !row.divisionId || row.divisionId === divisionId)
    .filter((row) => row.status === "available")
    .filter((row) => {
      if (!season?.startsOn || !season?.endsOn) return true;
      return dateWithin(row.playingDate, season.startsOn, season.endsOn);
    });

  const byDate = new Map();
  rows.forEach((row) => {
    const existing = byDate.get(row.playingDate);
    if (!existing || (!existing.divisionId && row.divisionId === divisionId)) {
      byDate.set(row.playingDate, row);
    }
  });

  return [...byDate.values()].sort((left, right) => left.playingDate.localeCompare(right.playingDate));
}

function venueMap(workspace) {
  return new Map(asArray(workspace?.venues).map((venue) => [venue.id, venue]));
}

function teamMap(workspace) {
  return new Map(asArray(workspace?.teams).map((team) => [team.id, team]));
}

function divisionMap(workspace) {
  return new Map(asArray(workspace?.divisions).map((division) => [division.id, division]));
}

function groundKeyForVenue(venue) {
  if (!venue) return "missing-venue";
  return asText(venue.groundShareKey) || `venue:${venue.id}`;
}

function groundCapacityMap(workspace) {
  const capacities = new Map();
  asArray(workspace?.venues).forEach((venue) => {
    const key = groundKeyForVenue(venue);
    capacities.set(key, Math.max(
      capacities.get(key) || 1,
      asPositiveInteger(venue.simultaneousFixtureLimit, 1),
    ));
  });
  return capacities;
}

function applicableBlackouts(workspace, {
  seasonId,
  divisionId,
  homeTeam,
  awayTeam,
  venueId,
  scheduledDate,
}) {
  if (!scheduledDate) return [];
  const clubIds = new Set([homeTeam?.parentClubId, awayTeam?.parentClubId].filter(Boolean));
  const teamIds = new Set([homeTeam?.id, awayTeam?.id].filter(Boolean));

  return asArray(workspace?.blackouts).filter((blackout) => {
    if (blackout.seasonId && blackout.seasonId !== seasonId) return false;
    if (!dateWithin(scheduledDate, blackout.startsOn, blackout.endsOn || blackout.startsOn)) return false;
    if (blackout.scopeType === "league") return true;
    if (blackout.scopeType === "division") return blackout.scopeId === divisionId;
    if (blackout.scopeType === "club") return clubIds.has(blackout.scopeId);
    if (blackout.scopeType === "team") return teamIds.has(blackout.scopeId);
    if (blackout.scopeType === "venue") return blackout.scopeId === venueId;
    return false;
  });
}

function createResourceState(workspace) {
  return {
    teamDates: new Set(),
    groundSlots: new Map(),
    venueById: venueMap(workspace),
    teamById: teamMap(workspace),
    groundCapacities: groundCapacityMap(workspace),
  };
}

function reserveEntry(state, entry) {
  if (!entry.scheduledDate) return;
  const kickOff = toTime(entry.kickOff);
  state.teamDates.add(`${entry.scheduledDate}|${entry.homeTeamId}`);
  state.teamDates.add(`${entry.scheduledDate}|${entry.awayTeamId}`);
  const venue = state.venueById.get(entry.venueId);
  const groundKey = groundKeyForVenue(venue);
  const slotKey = `${entry.scheduledDate}|${kickOff}|${groundKey}`;
  state.groundSlots.set(slotKey, (state.groundSlots.get(slotKey) || 0) + 1);
}

function checkPlacement(workspace, state, fixture, dateRow) {
  const scheduledDate = dateRow.playingDate;
  const kickOff = toTime(dateRow.defaultKickOff);
  const homeTeam = state.teamById.get(fixture.homeTeamId);
  const awayTeam = state.teamById.get(fixture.awayTeamId);
  const venueId = fixture.venueId || homeTeam?.homeVenueId || "";
  const venue = state.venueById.get(venueId);
  const blockers = [];

  if (!homeTeam || !awayTeam) blockers.push({ code: "missing-team", label: "team record missing" });
  if (!venue) blockers.push({ code: "missing-venue", label: "home venue missing" });
  if (state.teamDates.has(`${scheduledDate}|${fixture.homeTeamId}`)) blockers.push({ code: "home-team-clash", label: `${homeTeam?.name || "Home team"} already plays` });
  if (state.teamDates.has(`${scheduledDate}|${fixture.awayTeamId}`)) blockers.push({ code: "away-team-clash", label: `${awayTeam?.name || "Away team"} already plays` });

  const blackouts = applicableBlackouts(workspace, {
    seasonId: fixture.seasonId,
    divisionId: fixture.divisionId,
    homeTeam,
    awayTeam,
    venueId,
    scheduledDate,
  });
  blackouts.forEach((blackout) => blockers.push({
    code: `blackout-${blackout.scopeType}`,
    label: blackout.reason || `${blackout.scopeType} blackout`,
  }));

  if (venue) {
    const groundKey = groundKeyForVenue(venue);
    const slotKey = `${scheduledDate}|${kickOff}|${groundKey}`;
    const used = state.groundSlots.get(slotKey) || 0;
    const capacity = state.groundCapacities.get(groundKey) || 1;
    if (used >= capacity) blockers.push({ code: "ground-capacity", label: `${venue.name} has no simultaneous-fixture capacity` });
  }

  return { blockers, scheduledDate, kickOff, venueId };
}

function reasonFromBlockers(blockerCounts, datesCount) {
  if (!datesCount) return "No available playing dates are configured for this division.";
  const ranked = [...blockerCounts.entries()].sort((left, right) => right[1] - left[1]);
  if (!ranked.length) return "No valid playing date remained for this fixture.";
  const labels = ranked.slice(0, 2).map(([label, count]) => `${label}${count > 1 ? ` (${count} dates)` : ""}`);
  return `No valid playing date remained: ${labels.join("; ")}.`;
}

function candidateRowsForRound(rows, roundNumber) {
  if (!rows.length) return [];
  const targetIndex = Math.min(Math.max(roundNumber - 1, 0), rows.length - 1);
  return rows
    .map((row, index) => ({ row, index, distance: Math.abs(index - targetIndex), later: index >= targetIndex ? 0 : 1 }))
    .sort((left, right) => left.distance - right.distance || left.later - right.later || left.index - right.index)
    .map((item) => item.row);
}

function normaliseBaseEntry(entry = {}) {
  return {
    id: entry.id || "",
    clientKey: entry.clientKey || entry.id || "",
    versionId: entry.versionId || "",
    sourceFixtureId: entry.sourceFixtureId || "",
    seasonId: entry.seasonId || "",
    divisionId: entry.divisionId || "",
    homeTeamId: entry.homeTeamId || "",
    awayTeamId: entry.awayTeamId || "",
    venueId: entry.venueId || "",
    scheduledDate: isoDate(entry.scheduledDate),
    kickOff: toTime(entry.kickOff),
    roundNumber: Number(entry.roundNumber || 0),
    placementStatus: entry.scheduledDate ? "placed" : "unplaced",
    locked: Boolean(entry.locked),
    unresolvedReason: entry.unresolvedReason || "",
    notes: entry.notes || "",
  };
}

function existingFixtureLookup(workspace, seasonId, meetings) {
  const lookup = new Map();
  asArray(workspace?.fixtures)
    .filter((fixture) => fixture.seasonId === seasonId && !["cancelled", "played"].includes(fixture.status))
    .forEach((fixture) => {
      const key = meetings === 1
        ? unorderedPairKey(fixture.homeTeamId, fixture.awayTeamId)
        : pairKey(fixture.homeTeamId, fixture.awayTeamId);
      if (!lookup.has(key) || fixture.locked) lookup.set(key, fixture);
    });
  return lookup;
}

/**
 * Generates a complete draft schedule in memory. The result is deterministic for
 * the same workspace and options, which makes schedule comparisons auditable.
 */
export function generateLeagueSchedule(workspace = {}, options = {}) {
  const season = getSeason(workspace, options.seasonId);
  if (!season) {
    return {
      entries: [],
      config: { meetings: Number(options.meetings) === 1 ? 1 : 2 },
      summary: { divisions: 0, fixtures: 0, placed: 0, unplaced: 0, locked: 0 },
      errors: ["Create a current season before generating a schedule."],
    };
  }

  const meetings = Number(options.meetings) === 1 ? 1 : 2;
  const selectedDivisionIds = new Set(asArray(options.divisionIds).filter(Boolean));
  const divisions = asArray(workspace.divisions)
    .filter((division) => division.seasonId === season.id)
    .filter((division) => !selectedDivisionIds.size || selectedDivisionIds.has(division.id))
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0) || left.name.localeCompare(right.name, "en-GB"));

  const baseEntries = asArray(options.baseEntries).map(normaliseBaseEntry);
  const preservePlacedBaseEntries = Boolean(options.preservePlacedBaseEntries);
  const baseByPair = new Map();
  baseEntries.forEach((entry) => {
    if (!entry.homeTeamId || !entry.awayTeamId) return;
    if (preservePlacedBaseEntries && !entry.scheduledDate) return;
    baseByPair.set(entryPairKey(entry, meetings), entry);
  });

  const state = createResourceState(workspace);
  const existingByPair = existingFixtureLookup(workspace, season.id, meetings);
  const entries = [];
  const errors = [];

  divisions.forEach((division) => {
    const teams = getDivisionTeams(workspace, division.id, season.id);
    if (teams.length < 2) {
      errors.push(`${division.name} needs at least two active teams.`);
      return;
    }

    const dates = playingDatesForDivision(workspace, season.id, division.id);
    const matrix = buildDivisionFixtureMatrix(teams, { meetings });
    const matrixPairKeys = new Set(matrix.map((fixture) => entryPairKey(fixture, meetings)));

    // Preserve placed entries from the selected version before allocating new work.
    matrix.forEach((fixture) => {
      const key = entryPairKey(fixture, meetings);
      const base = baseByPair.get(key);
      const existing = existingByPair.get(key);
      const fixed = base || (existing?.locked ? normaliseBaseEntry({
        ...existing,
        sourceFixtureId: existing.id,
        roundNumber: fixture.roundNumber,
      }) : null);
      if (!fixed || !fixed.scheduledDate) return;

      const entry = {
        ...fixed,
        clientKey: fixed.clientKey || `${division.id}:${fixture.homeTeamId}:${fixture.awayTeamId}`,
        seasonId: season.id,
        divisionId: division.id,
        roundNumber: fixed.roundNumber || fixture.roundNumber,
        placementStatus: "placed",
        sourceFixtureId: fixed.sourceFixtureId || existing?.id || "",
      };
      entries.push(entry);
      reserveEntry(state, entry);
    });

    matrix.forEach((fixture) => {
      const key = entryPairKey(fixture, meetings);
      if (entries.some((entry) => entry.divisionId === division.id && entryPairKey(entry, meetings) === key)) return;

      const homeTeam = state.teamById.get(fixture.homeTeamId);
      const existing = existingByPair.get(key);
      const placementFixture = {
        ...fixture,
        seasonId: season.id,
        divisionId: division.id,
        venueId: homeTeam?.homeVenueId || existing?.venueId || "",
      };
      const blockerCounts = new Map();
      let placed = null;

      for (const dateRow of candidateRowsForRound(dates, fixture.roundNumber)) {
        const result = checkPlacement(workspace, state, placementFixture, dateRow);
        if (!result.blockers.length) {
          placed = {
            clientKey: `${division.id}:${fixture.homeTeamId}:${fixture.awayTeamId}`,
            sourceFixtureId: existing?.id || "",
            seasonId: season.id,
            divisionId: division.id,
            homeTeamId: fixture.homeTeamId,
            awayTeamId: fixture.awayTeamId,
            venueId: result.venueId,
            scheduledDate: result.scheduledDate,
            kickOff: result.kickOff,
            roundNumber: fixture.roundNumber,
            placementStatus: "placed",
            locked: false,
            unresolvedReason: "",
            notes: "",
          };
          break;
        }
        result.blockers.forEach((blocker) => {
          blockerCounts.set(blocker.label, (blockerCounts.get(blocker.label) || 0) + 1);
        });
      }

      if (!placed) {
        placed = {
          clientKey: `${division.id}:${fixture.homeTeamId}:${fixture.awayTeamId}`,
          sourceFixtureId: existing?.id || "",
          seasonId: season.id,
          divisionId: division.id,
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          venueId: homeTeam?.homeVenueId || existing?.venueId || "",
          scheduledDate: "",
          kickOff: "",
          roundNumber: fixture.roundNumber,
          placementStatus: "unplaced",
          locked: false,
          unresolvedReason: reasonFromBlockers(blockerCounts, dates.length),
          notes: "",
        };
      } else {
        reserveEntry(state, placed);
      }

      entries.push(placed);
    });

    // Surface base entries that no longer belong to the matrix instead of silently losing them.
    baseEntries
      .filter((entry) => entry.divisionId === division.id)
      .filter((entry) => !matrixPairKeys.has(entryPairKey(entry, meetings)))
      .forEach(() => errors.push(`A preserved fixture in ${division.name} no longer matches the active team matrix.`));
  });

  entries.sort((left, right) => (
    Number(left.roundNumber || 0) - Number(right.roundNumber || 0)
    || String(left.scheduledDate || "9999-12-31").localeCompare(String(right.scheduledDate || "9999-12-31"))
    || left.homeTeamId.localeCompare(right.homeTeamId)
  ));

  return {
    entries,
    config: {
      seasonId: season.id,
      meetings,
      divisionIds: divisions.map((division) => division.id),
      preservePlacedBaseEntries,
      generatedAt: new Date().toISOString(),
    },
    summary: {
      divisions: divisions.length,
      fixtures: entries.length,
      placed: entries.filter((entry) => entry.scheduledDate).length,
      unplaced: entries.filter((entry) => !entry.scheduledDate).length,
      locked: entries.filter((entry) => entry.locked).length,
    },
    errors,
  };
}

function issue({ code, severity = "blocking", message, entryIds = [], divisionId = "", teamId = "", date = "" }) {
  return {
    id: `${code}:${divisionId || teamId || date || entryIds.join("-") || message}`,
    code,
    severity,
    message,
    entryIds,
    divisionId,
    teamId,
    date,
  };
}

function nameOf(map, id, fallback) {
  return map.get(id)?.name || fallback || id || "Unknown";
}

function consecutiveRunIssues(entries, workspace, maxRun = 3) {
  const teams = teamMap(workspace);
  const fixturesByTeam = new Map();
  entries.filter((entry) => entry.scheduledDate).forEach((entry) => {
    for (const teamId of [entry.homeTeamId, entry.awayTeamId]) {
      if (!fixturesByTeam.has(teamId)) fixturesByTeam.set(teamId, []);
      fixturesByTeam.get(teamId).push(entry);
    }
  });

  const issues = [];
  fixturesByTeam.forEach((teamEntries, teamId) => {
    const sorted = [...teamEntries].sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.kickOff.localeCompare(right.kickOff));
    let lastSide = "";
    let run = 0;
    let maxObserved = 0;
    sorted.forEach((entry) => {
      const side = entry.homeTeamId === teamId ? "home" : "away";
      if (side === lastSide) run += 1;
      else {
        lastSide = side;
        run = 1;
      }
      maxObserved = Math.max(maxObserved, run);
    });
    if (maxObserved > maxRun) {
      issues.push(issue({
        code: "long-home-away-run",
        severity: "warning",
        teamId,
        message: `${nameOf(teams, teamId, "Team")} has a run of ${maxObserved} consecutive home or away fixtures.`,
      }));
    }
  });
  return issues;
}

/** Validates a generated or persisted schedule version. */
export function validateLeagueSchedule(workspace = {}, entriesInput = [], config = {}) {
  const entries = asArray(entriesInput).map(normaliseBaseEntry);
  const meetings = Number(config.meetings) === 1 ? 1 : 2;
  const season = getSeason(workspace, config.seasonId || entries[0]?.seasonId);
  const teams = teamMap(workspace);
  const venues = venueMap(workspace);
  const divisions = divisionMap(workspace);
  const capacities = groundCapacityMap(workspace);
  const issues = [];

  entries.forEach((entry) => {
    if (!entry.scheduledDate) {
      issues.push(issue({
        code: "unplaced-fixture",
        message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} is unplaced. ${entry.unresolvedReason || ""}`.trim(),
        entryIds: [stableEntryKey(entry)],
        divisionId: entry.divisionId,
      }));
      return;
    }
    if (!entry.venueId || !venues.has(entry.venueId)) {
      issues.push(issue({
        code: "missing-venue",
        message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} has no valid venue.`,
        entryIds: [stableEntryKey(entry)],
        divisionId: entry.divisionId,
        date: entry.scheduledDate,
      }));
    }

    const availableDates = playingDatesForDivision(workspace, entry.seasonId || season?.id, entry.divisionId);
    if (!availableDates.some((row) => row.playingDate === entry.scheduledDate)) {
      issues.push(issue({
        code: "unavailable-playing-date",
        message: `${entry.scheduledDate} is not an available playing date for ${nameOf(divisions, entry.divisionId, "this division")}.`,
        entryIds: [stableEntryKey(entry)],
        divisionId: entry.divisionId,
        date: entry.scheduledDate,
      }));
    }

    const homeTeam = teams.get(entry.homeTeamId);
    const awayTeam = teams.get(entry.awayTeamId);
    const blackouts = applicableBlackouts(workspace, {
      seasonId: entry.seasonId || season?.id,
      divisionId: entry.divisionId,
      homeTeam,
      awayTeam,
      venueId: entry.venueId,
      scheduledDate: entry.scheduledDate,
    });
    blackouts.forEach((blackout) => issues.push(issue({
      code: "blackout-violation",
      message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} conflicts with “${blackout.reason}”.`,
      entryIds: [stableEntryKey(entry)],
      divisionId: entry.divisionId,
      date: entry.scheduledDate,
    })));
  });

  const teamDateGroups = new Map();
  entries.filter((entry) => entry.scheduledDate).forEach((entry) => {
    for (const teamId of [entry.homeTeamId, entry.awayTeamId]) {
      const key = `${entry.scheduledDate}|${teamId}`;
      if (!teamDateGroups.has(key)) teamDateGroups.set(key, []);
      teamDateGroups.get(key).push(entry);
    }
  });
  teamDateGroups.forEach((group, key) => {
    if (group.length < 2) return;
    const [date, teamId] = key.split("|");
    issues.push(issue({
      code: "team-double-booking",
      message: `${nameOf(teams, teamId, "Team")} has ${group.length} fixtures on ${date}.`,
      entryIds: group.map(stableEntryKey),
      teamId,
      date,
    }));
  });

  const groundGroups = new Map();
  entries.filter((entry) => entry.scheduledDate && entry.venueId).forEach((entry) => {
    const venue = venues.get(entry.venueId);
    const groundKey = groundKeyForVenue(venue);
    const key = `${entry.scheduledDate}|${toTime(entry.kickOff)}|${groundKey}`;
    if (!groundGroups.has(key)) groundGroups.set(key, { entries: [], venue, groundKey });
    groundGroups.get(key).entries.push(entry);
  });
  groundGroups.forEach(({ entries: groupedEntries, venue, groundKey }, key) => {
    const capacity = capacities.get(groundKey) || 1;
    if (groupedEntries.length <= capacity) return;
    const [date, kickOff] = key.split("|");
    issues.push(issue({
      code: "ground-capacity-conflict",
      message: `${venue?.name || "Shared ground"} has ${groupedEntries.length} simultaneous fixtures at ${kickOff} on ${date}, above its limit of ${capacity}.`,
      entryIds: groupedEntries.map(stableEntryKey),
      date,
    }));
  });

  const pairGroups = new Map();
  entries.forEach((entry) => {
    const key = entryPairKey(entry, meetings);
    if (!pairGroups.has(key)) pairGroups.set(key, []);
    pairGroups.get(key).push(entry);
  });
  pairGroups.forEach((group) => {
    if (group.length < 2) return;
    issues.push(issue({
      code: "duplicate-pairing",
      message: `${nameOf(teams, group[0].homeTeamId, "Home team")} and ${nameOf(teams, group[0].awayTeamId, "Away team")} appear more than once for the selected fixture frequency.`,
      entryIds: group.map(stableEntryKey),
      divisionId: group[0].divisionId,
    }));
  });

  const selectedDivisionIds = new Set(asArray(config.divisionIds).filter(Boolean));
  const activeDivisions = asArray(workspace.divisions)
    .filter((division) => !season || division.seasonId === season.id)
    .filter((division) => !selectedDivisionIds.size || selectedDivisionIds.has(division.id));

  activeDivisions.forEach((division) => {
    const divisionTeams = getDivisionTeams(workspace, division.id, season?.id || "");
    const expected = buildDivisionFixtureMatrix(divisionTeams, { meetings });
    const actualKeys = new Set(entries.filter((entry) => entry.divisionId === division.id).map((entry) => entryPairKey(entry, meetings)));
    const missing = expected.filter((fixture) => !actualKeys.has(entryPairKey(fixture, meetings)));
    if (missing.length) {
      issues.push(issue({
        code: "missing-required-fixtures",
        message: `${division.name} is missing ${missing.length} required fixture${missing.length === 1 ? "" : "s"}.`,
        divisionId: division.id,
      }));
    }

    divisionTeams.forEach((team) => {
      const teamEntries = entries.filter((entry) => entry.divisionId === division.id && (entry.homeTeamId === team.id || entry.awayTeamId === team.id));
      const homeCount = teamEntries.filter((entry) => entry.homeTeamId === team.id).length;
      const awayCount = teamEntries.filter((entry) => entry.awayTeamId === team.id).length;
      const allowedDifference = meetings === 1 ? 1 : 0;
      if (Math.abs(homeCount - awayCount) > allowedDifference) {
        issues.push(issue({
          code: "home-away-imbalance",
          severity: "warning",
          message: `${team.name} has ${homeCount} home and ${awayCount} away fixtures.`,
          teamId: team.id,
          divisionId: division.id,
        }));
      }
    });
  });

  issues.push(...consecutiveRunIssues(entries, workspace));

  const blocking = issues.filter((item) => item.severity === "blocking");
  const warnings = issues.filter((item) => item.severity === "warning");
  return {
    valid: blocking.length === 0,
    blockingCount: blocking.length,
    warningCount: warnings.length,
    issues,
    totals: {
      fixtures: entries.length,
      placed: entries.filter((entry) => entry.scheduledDate).length,
      unplaced: entries.filter((entry) => !entry.scheduledDate).length,
      locked: entries.filter((entry) => entry.locked).length,
    },
  };
}

export function compareLeagueScheduleVersions(leftEntries = [], rightEntries = []) {
  const left = new Map(asArray(leftEntries).map((entry) => [pairKey(entry.homeTeamId, entry.awayTeamId), normaliseBaseEntry(entry)]));
  const right = new Map(asArray(rightEntries).map((entry) => [pairKey(entry.homeTeamId, entry.awayTeamId), normaliseBaseEntry(entry)]));
  const keys = new Set([...left.keys(), ...right.keys()]);
  const details = [];
  let unchanged = 0;
  let moved = 0;
  let added = 0;
  let removed = 0;

  keys.forEach((key) => {
    const before = left.get(key);
    const after = right.get(key);
    if (!before) {
      added += 1;
      details.push({ type: "added", key, before: null, after });
      return;
    }
    if (!after) {
      removed += 1;
      details.push({ type: "removed", key, before, after: null });
      return;
    }
    const changed = ["scheduledDate", "kickOff", "venueId", "locked"].some((field) => before[field] !== after[field]);
    if (changed) {
      moved += 1;
      details.push({ type: "moved", key, before, after });
    } else {
      unchanged += 1;
    }
  });

  return { unchanged, moved, added, removed, total: keys.size, details };
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function leagueScheduleToCsv(entriesInput = [], workspace = {}, version = {}) {
  const teams = teamMap(workspace);
  const venues = venueMap(workspace);
  const divisions = divisionMap(workspace);
  const rows = [
    ["schedule_version", "division", "round", "date", "kick_off", "home_team", "away_team", "venue", "locked", "status", "unresolved_reason"],
  ];

  asArray(entriesInput)
    .map(normaliseBaseEntry)
    .sort((left, right) => String(left.scheduledDate || "9999-12-31").localeCompare(String(right.scheduledDate || "9999-12-31")) || Number(left.roundNumber || 0) - Number(right.roundNumber || 0))
    .forEach((entry) => rows.push([
      version.name || `Version ${version.versionNumber || ""}`.trim(),
      divisions.get(entry.divisionId)?.name || "",
      entry.roundNumber || "",
      entry.scheduledDate || "",
      entry.kickOff || "",
      teams.get(entry.homeTeamId)?.name || entry.homeTeamId,
      teams.get(entry.awayTeamId)?.name || entry.awayTeamId,
      venues.get(entry.venueId)?.name || "",
      entry.locked ? "true" : "false",
      entry.scheduledDate ? "placed" : "unplaced",
      entry.unresolvedReason || "",
    ]));

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function serialiseScheduleEntries(entries = []) {
  return asArray(entries).map((entry) => ({
    source_fixture_id: entry.sourceFixtureId || null,
    division_id: entry.divisionId || null,
    home_team_id: entry.homeTeamId,
    away_team_id: entry.awayTeamId,
    venue_id: entry.venueId || null,
    scheduled_date: entry.scheduledDate || null,
    kick_off: entry.kickOff || null,
    round_number: Number(entry.roundNumber || 0),
    placement_status: entry.scheduledDate ? "placed" : "unplaced",
    locked: Boolean(entry.locked),
    unresolved_reason: entry.unresolvedReason || null,
    notes: entry.notes || null,
  }));
}

export function normaliseScheduleVersion(payload = {}) {
  const row = payload.version || payload;
  return {
    id: row.id || "",
    leagueId: row.league_id || row.leagueId || "",
    seasonId: row.season_id || row.seasonId || "",
    parentVersionId: row.parent_version_id || row.parentVersionId || "",
    versionNumber: Number(row.version_number ?? row.versionNumber ?? 0),
    name: row.name || `Version ${row.version_number || row.versionNumber || ""}`.trim(),
    status: row.status || "draft",
    source: row.source || "generated",
    generationConfig: row.generation_config || row.generationConfig || {},
    validationSummary: row.validation_summary || row.validationSummary || {},
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
    publishedAt: row.published_at || row.publishedAt || null,
    createdByLabel: row.created_by_label || row.createdByLabel || "",
  };
}

export function normaliseScheduleEntry(row = {}) {
  return normaliseBaseEntry({
    ...row,
    versionId: row.version_id || row.versionId || "",
    sourceFixtureId: row.source_fixture_id || row.sourceFixtureId || "",
    seasonId: row.season_id || row.seasonId || "",
    divisionId: row.division_id || row.divisionId || "",
    homeTeamId: row.home_team_id || row.homeTeamId || "",
    awayTeamId: row.away_team_id || row.awayTeamId || "",
    venueId: row.venue_id || row.venueId || "",
    scheduledDate: row.scheduled_date || row.scheduledDate || "",
    kickOff: row.kick_off || row.kickOff || "",
    roundNumber: row.round_number ?? row.roundNumber ?? 0,
    placementStatus: row.placement_status || row.placementStatus || "",
    unresolvedReason: row.unresolved_reason || row.unresolvedReason || "",
  });
}

export function normaliseScheduleVersionPayload(payload = {}) {
  return {
    version: normaliseScheduleVersion(payload.version || {}),
    entries: asArray(payload.entries).map(normaliseScheduleEntry),
  };
}

export function daysBetween(left, right) {
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return null;
  return Math.round((rightDate.getTime() - leftDate.getTime()) / DAY_MS);
}
