import { compareLeagueDivisions } from "./leagueOrdering.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || "").trim();
}

function asPositiveInteger(value, fallback = 1, maximum = 999) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.min(Math.floor(number), maximum) : fallback;
}

function clampMeetings(value, fallback = 2) {
  return Math.max(1, Math.min(asPositiveInteger(value, fallback, 4), 4));
}

function toTime(value, fallback = "") {
  const text = asText(value);
  if (!text) return fallback;
  return text.slice(0, 5);
}

function isoDate(value) {
  const text = asText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function dateWithin(date, startsOn, endsOn) {
  if (!date || !startsOn || !endsOn) return false;
  return date >= startsOn && date <= endsOn;
}

function unorderedPairKey(teamAId, teamBId) {
  return [teamAId, teamBId].sort().join("::");
}


function fixtureIdentity(entry) {
  const competitionType = entry.competitionType || "league";
  if (competitionType === "cup") {
    return `cup:${entry.cupId || entry.competitionId || ""}:${entry.cupTieId || entry.id || entry.clientKey || ""}`;
  }
  return `league:${entry.divisionId || ""}:${unorderedPairKey(entry.homeTeamId, entry.awayTeamId)}:${Number(entry.meetingNumber || 1)}`;
}

function stableEntryKey(entry) {
  return entry.id || entry.clientKey || fixtureIdentity(entry);
}

function getSeason(workspace, seasonId = "") {
  const seasons = asArray(workspace?.seasons);
  return seasons.find((season) => season.id === seasonId)
    || seasons.find((season) => season.isCurrent)
    || seasons.find((season) => season.status === "active")
    || seasons[0]
    || null;
}

function getDivision(workspace, divisionId) {
  return asArray(workspace?.divisions).find((division) => division.id === divisionId) || null;
}

function getDivisionTeams(workspace, divisionId, seasonId) {
  return asArray(workspace?.teams)
    .filter((team) => team.seasonId === seasonId && team.divisionId === divisionId && !["withdrawn", "inactive"].includes(team.status))
    .sort((left, right) => left.name.localeCompare(right.name, "en-GB"));
}

function seasonRotationSeed(season, division) {
  const startYear = Number(String(season?.startsOn || season?.name || "").match(/\d{4}/)?.[0] || 0);
  const offset = Number(division?.extraHomeRotationOffset ?? 0) === 1 ? 1 : 0;
  return Math.abs(startYear + offset) % 2;
}

function divisionRule(workspace, division, season) {
  const defaultKickOff = toTime(division?.defaultKickOff, toTime(season?.defaultKickOff, ""));
  return {
    startsOn: division?.startsOn || season?.startsOn || "",
    endsOn: division?.endsOn || season?.endsOn || "",
    meetings: clampMeetings(division?.meetingsPerPairing ?? division?.meetings ?? 2),
    defaultKickOff,
    weekday: Number.isInteger(Number(division?.playingWeekday)) ? Number(division.playingWeekday) : Number(season?.primaryWeekday ?? 6),
    maxConsecutive: asPositiveInteger(division?.maxConsecutiveHomeAway ?? season?.maxConsecutiveHomeAway ?? 2, 2, 6),
    rotationSeed: seasonRotationSeed(season, division),
    extraHomeRotationOffset: Number(division?.extraHomeRotationOffset ?? 0) === 1 ? 1 : 0,
  };
}

function rotateRoundRobin(list) {
  if (list.length <= 2) return [...list];
  return [list[0], list[list.length - 1], ...list.slice(1, -1)];
}

function orientationPenalty(fixtures, teamIds, maxRun, meetings) {
  let penalty = 0;
  teamIds.forEach((teamId) => {
    const rows = fixtures
      .filter((fixture) => fixture.homeTeamId === teamId || fixture.awayTeamId === teamId)
      .sort((left, right) => Number(left.roundNumber || 0) - Number(right.roundNumber || 0) || Number(left.meetingNumber || 1) - Number(right.meetingNumber || 1));
    let run = 0;
    let side = "";
    let homes = 0;
    let aways = 0;
    rows.forEach((fixture) => {
      const nextSide = fixture.homeTeamId === teamId ? "home" : "away";
      if (nextSide === "home") homes += 1;
      else aways += 1;
      if (nextSide === side) run += 1;
      else {
        side = nextSide;
        run = 1;
      }
      if (run > maxRun) penalty += (run - maxRun) * (run - maxRun) * 40;
      if (run > 2) penalty += 4;
    });
    const games = rows.length;
    const allowedDifference = games % 2;
    const imbalance = Math.max(0, Math.abs(homes - aways) - allowedDifference);
    penalty += imbalance * imbalance * 60;
    if (meetings % 2 === 0 && homes !== aways) penalty += Math.abs(homes - aways) * 100;
  });
  return penalty;
}

function flipFixture(fixture) {
  return { ...fixture, homeTeamId: fixture.awayTeamId, awayTeamId: fixture.homeTeamId };
}


function balanceSingleCycleOrientation(fixtures, teams) {
  const result = fixtures.map((fixture) => ({ ...fixture }));
  const activeTeams = asArray(teams).filter((team) => team?.id);
  if (result.length === 0 || activeTeams.length < 2) return result;

  const currentHomeCounts = new Map(activeTeams.map((team) => [team.id, 0]));
  result.forEach((fixture) => currentHomeCounts.set(fixture.homeTeamId, (currentHomeCounts.get(fixture.homeTeamId) || 0) + 1));

  const gamesPerTeam = activeTeams.length - 1;
  const lowTarget = Math.floor(gamesPerTeam / 2);
  const highTargetCount = gamesPerTeam % 2 === 0 ? 0 : activeTeams.length / 2;
  const highTargetTeams = new Set(
    [...activeTeams]
      .sort((left, right) => {
        const countDifference = (currentHomeCounts.get(right.id) || 0) - (currentHomeCounts.get(left.id) || 0);
        if (countDifference !== 0) return countDifference;
        return String(left.id).localeCompare(String(right.id), "en-GB");
      })
      .slice(0, highTargetCount)
      .map((team) => team.id),
  );
  const targets = new Map(activeTeams.map((team) => [team.id, lowTarget + (highTargetTeams.has(team.id) ? 1 : 0)]));

  const source = 0;
  const fixtureOffset = 1;
  const teamOffset = fixtureOffset + result.length;
  const sink = teamOffset + activeTeams.length;
  const graph = Array.from({ length: sink + 1 }, () => []);
  const addEdge = (from, to, capacity, cost) => {
    const forward = { to, reverse: graph[to].length, capacity, cost, originalCapacity: capacity };
    const backward = { to: from, reverse: graph[from].length, capacity: 0, cost: -cost, originalCapacity: 0 };
    graph[from].push(forward);
    graph[to].push(backward);
    return forward;
  };

  const teamNodeById = new Map(activeTeams.map((team, index) => [team.id, teamOffset + index]));
  const choiceEdges = [];
  result.forEach((fixture, index) => {
    const fixtureNode = fixtureOffset + index;
    addEdge(source, fixtureNode, 1, 0);
    choiceEdges[index] = [
      { teamId: fixture.homeTeamId, edge: addEdge(fixtureNode, teamNodeById.get(fixture.homeTeamId), 1, 0) },
      { teamId: fixture.awayTeamId, edge: addEdge(fixtureNode, teamNodeById.get(fixture.awayTeamId), 1, 1) },
    ];
  });
  activeTeams.forEach((team) => addEdge(teamNodeById.get(team.id), sink, targets.get(team.id), 0));

  let flow = 0;
  while (flow < result.length) {
    const distance = Array(graph.length).fill(Number.POSITIVE_INFINITY);
    const previousNode = Array(graph.length).fill(-1);
    const previousEdge = Array(graph.length).fill(-1);
    const inQueue = Array(graph.length).fill(false);
    const queue = [source];
    distance[source] = 0;
    inQueue[source] = true;

    while (queue.length > 0) {
      const node = queue.shift();
      inQueue[node] = false;
      graph[node].forEach((edge, edgeIndex) => {
        if (edge.capacity <= 0 || distance[node] + edge.cost >= distance[edge.to]) return;
        distance[edge.to] = distance[node] + edge.cost;
        previousNode[edge.to] = node;
        previousEdge[edge.to] = edgeIndex;
        if (!inQueue[edge.to]) {
          queue.push(edge.to);
          inQueue[edge.to] = true;
        }
      });
    }

    if (previousNode[sink] < 0) return result;
    let node = sink;
    while (node !== source) {
      const from = previousNode[node];
      const edge = graph[from][previousEdge[node]];
      edge.capacity -= 1;
      graph[node][edge.reverse].capacity += 1;
      node = from;
    }
    flow += 1;
  }

  choiceEdges.forEach((choices, index) => {
    const selected = choices.find((choice) => choice.edge.originalCapacity === 1 && choice.edge.capacity === 0);
    if (!selected || selected.teamId === result[index].homeTeamId) return;
    result[index] = flipFixture(result[index]);
  });
  return result;
}

function optimiseFixtureOrientation(fixtures, teams, { maxRun = 2, meetings = 2, allowSingles = false } = {}) {
  const result = fixtures.map((fixture) => ({ ...fixture }));
  const teamIds = teams.map((team) => team.id);
  const groups = [];
  const groupedByPair = new Map();
  result.forEach((fixture, index) => {
    const key = unorderedPairKey(fixture.homeTeamId, fixture.awayTeamId);
    if (!groupedByPair.has(key)) groupedByPair.set(key, []);
    groupedByPair.get(key).push(index);
  });
  groupedByPair.forEach((indices) => {
    const ordered = indices.sort((a, b) => result[a].meetingNumber - result[b].meetingNumber);
    for (let index = 0; index < ordered.length; index += 2) {
      const pair = ordered.slice(index, index + 2);
      if (pair.length === 2 || (allowSingles && pair.length === 1)) groups.push(pair);
    }
  });

  let currentPenalty = orientationPenalty(result, teamIds, maxRun, meetings);
  for (let pass = 0; pass < 8; pass += 1) {
    let improved = false;
    for (const indexes of groups) {
      const candidate = result.map((fixture, index) => indexes.includes(index) ? flipFixture(fixture) : fixture);
      const nextPenalty = orientationPenalty(candidate, teamIds, maxRun, meetings);
      if (nextPenalty < currentPenalty) {
        indexes.forEach((index) => { result[index] = flipFixture(result[index]); });
        currentPenalty = nextPenalty;
        improved = true;
      }
    }
    if (!improved) break;
  }
  return result;
}

/**
 * Builds a deterministic round-robin matrix supporting one to four meetings per pairing.
 * Meeting numbers are stable and are part of the fixture identity.
 */
export function buildDivisionFixtureMatrix(teams = [], { meetings = 2, maxConsecutive = 2, rotationSeed = 0 } = {}) {
  const activeTeams = asArray(teams).filter((team) => team?.id);
  if (activeTeams.length < 2) return [];

  const meetingCount = clampMeetings(meetings);
  const rotation = [...activeTeams];
  if (rotation.length % 2 === 1) rotation.push(null);
  const roundsPerCycle = rotation.length - 1;
  let current = [...rotation];
  const firstCycle = [];

  for (let roundIndex = 0; roundIndex < roundsPerCycle; roundIndex += 1) {
    for (let pairIndex = 0; pairIndex < current.length / 2; pairIndex += 1) {
      const left = current[pairIndex];
      const right = current[current.length - 1 - pairIndex];
      if (!left || !right) continue;
      const flip = pairIndex === 0 ? roundIndex % 2 === 1 : (roundIndex + pairIndex) % 2 === 0;
      firstCycle.push({
        roundNumber: roundIndex + 1,
        pairIndex,
        homeTeamId: flip ? right.id : left.id,
        awayTeamId: flip ? left.id : right.id,
        meetingNumber: 1,
      });
    }
    current = rotateRoundRobin(current);
  }

  const balancedFirstCycle = balanceSingleCycleOrientation(
    optimiseFixtureOrientation(firstCycle, activeTeams, {
      maxRun: asPositiveInteger(maxConsecutive, 2, 6),
      meetings: 1,
      allowSingles: true,
    }),
    activeTeams,
  );

  const fixtures = [];
  const oddMeetingUsesReverseCycle = Math.abs(Number(rotationSeed) || 0) % 2 === 1;
  for (let meetingNumber = 1; meetingNumber <= meetingCount; meetingNumber += 1) {
    const cycleIndex = meetingNumber - 1;
    balancedFirstCycle.forEach((baseFixture) => {
      let shouldFlip = meetingNumber % 2 === 0;
      if (meetingNumber === 3) shouldFlip = oddMeetingUsesReverseCycle;
      if (meetingNumber === 4) shouldFlip = !oddMeetingUsesReverseCycle;
      fixtures.push({
        roundNumber: baseFixture.roundNumber + (cycleIndex * roundsPerCycle),
        homeTeamId: shouldFlip ? baseFixture.awayTeamId : baseFixture.homeTeamId,
        awayTeamId: shouldFlip ? baseFixture.homeTeamId : baseFixture.awayTeamId,
        meetingNumber,
      });
    });
  }

  return optimiseFixtureOrientation(fixtures, activeTeams, {
    maxRun: asPositiveInteger(maxConsecutive, 2, 6),
    meetings: meetingCount,
    allowSingles: meetingCount === 1,
  });
}

function playingDatesForDivision(workspace, seasonId, divisionId) {
  const season = getSeason(workspace, seasonId);
  const division = getDivision(workspace, divisionId);
  const rule = divisionRule(workspace, division, season);
  const rows = asArray(workspace?.playingDates)
    .filter((row) => row.seasonId === seasonId)
    .filter((row) => !row.divisionId || row.divisionId === divisionId)
    .filter((row) => row.status === "available")
    .filter((row) => !rule.startsOn || !rule.endsOn || dateWithin(row.playingDate, rule.startsOn, rule.endsOn));

  const byDate = new Map();
  rows.forEach((row) => {
    const normalised = { ...row, defaultKickOff: toTime(row.defaultKickOff, rule.defaultKickOff) };
    const existing = byDate.get(row.playingDate);
    if (!existing || (!existing.divisionId && row.divisionId === divisionId)) byDate.set(row.playingDate, normalised);
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
    if (!venue?.id || ["inactive", "unavailable"].includes(venue.status)) return;
    const key = groundKeyForVenue(venue);
    capacities.set(key, (capacities.get(key) || 0) + asPositiveInteger(venue.simultaneousFixtureLimit, 1, 20));
  });
  return capacities;
}

function applicableBlackouts(workspace, { seasonId, divisionId, homeTeam, awayTeam, venueId, scheduledDate }) {
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

function cupReservations(workspace, seasonId) {
  return asArray(workspace?.cupTies)
    .filter((tie) => tie.seasonId === seasonId && tie.scheduledDate && !["cancelled", "void", "bye", "postponed"].includes(tie.status))
    .filter((tie) => tie.homeTeamId || tie.awayTeamId)
    .map((tie) => ({
      id: tie.id,
      clientKey: `cup:${tie.cupId}:${tie.id}`,
      competitionType: "cup",
      cupId: tie.cupId,
      cupTieId: tie.id,
      seasonId: tie.seasonId,
      divisionId: "",
      homeTeamId: tie.homeTeamId || tie.winnerTeamId || "",
      awayTeamId: tie.awayTeamId || "",
      venueId: tie.venueId || "",
      scheduledDate: tie.scheduledDate,
      kickOff: tie.kickOff || "",
      locked: true,
    }));
}

function createResourceState(workspace, reservedEntries = []) {
  const state = {
    teamDates: new Set(),
    venueSlots: new Map(),
    groundSlots: new Map(),
    venueById: venueMap(workspace),
    teamById: teamMap(workspace),
    groundCapacities: groundCapacityMap(workspace),
  };
  reservedEntries.forEach((entry) => reserveEntry(state, entry));
  return state;
}

function reserveEntry(state, entry) {
  if (!entry.scheduledDate) return;
  const kickOff = toTime(entry.kickOff);
  if (entry.homeTeamId) state.teamDates.add(`${entry.scheduledDate}|${entry.homeTeamId}`);
  if (entry.awayTeamId) state.teamDates.add(`${entry.scheduledDate}|${entry.awayTeamId}`);
  const venue = state.venueById.get(entry.venueId);
  if (!venue?.id) return;
  const venueSlotKey = `${entry.scheduledDate}|${kickOff}|${venue.id}`;
  state.venueSlots.set(venueSlotKey, (state.venueSlots.get(venueSlotKey) || 0) + 1);
  const groundKey = groundKeyForVenue(venue);
  const slotKey = `${entry.scheduledDate}|${kickOff}|${groundKey}`;
  state.groundSlots.set(slotKey, (state.groundSlots.get(slotKey) || 0) + 1);
}

function checkPlacement(workspace, state, fixture, dateRow) {
  const scheduledDate = dateRow.playingDate;
  const season = getSeason(workspace, fixture.seasonId);
  const division = getDivision(workspace, fixture.divisionId);
  const rule = divisionRule(workspace, division, season);
  const kickOff = toTime(dateRow.defaultKickOff, rule.defaultKickOff);
  const homeTeam = state.teamById.get(fixture.homeTeamId);
  const awayTeam = state.teamById.get(fixture.awayTeamId);
  const venueId = fixture.venueId || homeTeam?.homeVenueId || "";
  const venue = state.venueById.get(venueId);
  const blockers = [];

  if (!homeTeam || !awayTeam) blockers.push({ code: "missing-team", label: "team record missing" });
  if (!venue) blockers.push({ code: "missing-venue", label: "home venue missing" });
  if (!kickOff) blockers.push({ code: "missing-kick-off", label: "league kick-off setting missing" });
  if (rule.startsOn && scheduledDate < rule.startsOn) blockers.push({ code: "before-division-start", label: `${division?.name || "Division"} has not started` });
  if (rule.endsOn && scheduledDate > rule.endsOn) blockers.push({ code: "after-division-end", label: `${division?.name || "Division"} has ended` });
  if (state.teamDates.has(`${scheduledDate}|${fixture.homeTeamId}`)) blockers.push({ code: "home-team-clash", label: `${homeTeam?.name || "Home team"} already plays` });
  if (state.teamDates.has(`${scheduledDate}|${fixture.awayTeamId}`)) blockers.push({ code: "away-team-clash", label: `${awayTeam?.name || "Away team"} already plays` });

  applicableBlackouts(workspace, { seasonId: fixture.seasonId, divisionId: fixture.divisionId, homeTeam, awayTeam, venueId, scheduledDate })
    .forEach((blackout) => blockers.push({ code: `blackout-${blackout.scopeType}`, label: blackout.reason || `${blackout.scopeType} blackout` }));

  if (venue) {
    const venueSlotKey = `${scheduledDate}|${kickOff}|${venue.id}`;
    const venueUsed = state.venueSlots.get(venueSlotKey) || 0;
    const venueCapacity = asPositiveInteger(venue.simultaneousFixtureLimit, 1, 20);
    if (venueUsed >= venueCapacity) blockers.push({ code: "venue-capacity", label: `${venue.name} is already in use` });
    const groundKey = groundKeyForVenue(venue);
    const slotKey = `${scheduledDate}|${kickOff}|${groundKey}`;
    const used = state.groundSlots.get(slotKey) || 0;
    const capacity = state.groundCapacities.get(groundKey) || 1;
    if (used >= capacity) blockers.push({ code: "ground-capacity", label: `${venue.name} has no simultaneous-fixture capacity` });
  }
  return { blockers, scheduledDate, kickOff, venueId };
}

function reasonFromBlockers(blockerCounts, datesCount) {
  if (!datesCount) return "No available playing dates are configured inside this division's start and end dates.";
  const ranked = [...blockerCounts.entries()].sort((left, right) => right[1] - left[1]);
  if (!ranked.length) return "No valid playing date remained for this fixture.";
  return `No valid playing date remained: ${ranked.slice(0, 2).map(([label, count]) => `${label}${count > 1 ? ` (${count} dates)` : ""}`).join("; ")}.`;
}

function candidateRowsForRound(rows, roundNumber, totalRounds) {
  if (!rows.length) return [];
  const targetIndex = totalRounds > 1
    ? Math.min(rows.length - 1, Math.max(0, Math.round(((roundNumber - 1) / (totalRounds - 1)) * (rows.length - 1))))
    : 0;
  return rows
    .map((row, index) => ({ row, index, distance: Math.abs(index - targetIndex), earlierPenalty: index < targetIndex ? 1 : 0 }))
    .sort((left, right) => left.distance - right.distance || left.earlierPenalty - right.earlierPenalty || left.index - right.index)
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
    competitionType: entry.competitionType || "league",
    competitionId: entry.competitionId || entry.cupId || "",
    cupId: entry.cupId || entry.competitionId || "",
    cupTieId: entry.cupTieId || "",
    homeTeamId: entry.homeTeamId || "",
    awayTeamId: entry.awayTeamId || "",
    venueId: entry.venueId || "",
    scheduledDate: isoDate(entry.scheduledDate),
    kickOff: toTime(entry.kickOff, ""),
    roundNumber: Number(entry.roundNumber || 0),
    meetingNumber: Number(entry.meetingNumber || 1),
    placementStatus: entry.scheduledDate ? "placed" : "unplaced",
    locked: Boolean(entry.locked),
    unresolvedReason: entry.unresolvedReason || "",
    notes: entry.notes || "",
  };
}

function existingFixtureLookup(workspace, seasonId) {
  const lookup = new Map();
  asArray(workspace?.fixtures)
    .filter((fixture) => fixture.seasonId === seasonId && !["cancelled", "played"].includes(fixture.status))
    .forEach((fixture) => {
      const key = `league:${fixture.divisionId || ""}:${unorderedPairKey(fixture.homeTeamId, fixture.awayTeamId)}:${Number(fixture.meetingNumber || 1)}`;
      if (!lookup.has(key) || fixture.locked) lookup.set(key, fixture);
    });
  return lookup;
}

function selectedDivisions(workspace, season, divisionIds = []) {
  const selected = new Set(asArray(divisionIds).filter(Boolean));
  return asArray(workspace?.divisions)
    .filter((division) => division.seasonId === season.id)
    .filter((division) => !selected.size || selected.has(division.id))
    .sort(compareLeagueDivisions);
}

export function getLeagueSchedulePreflight(workspace = {}, options = {}) {
  const season = getSeason(workspace, options.seasonId);
  if (!season) return { ready: false, season: null, divisions: [], totalFixtures: 0, minimumDates: 0, configuredDates: 0, dateShortfalls: [], errors: ["Create a current season before generating a schedule."] };
  const divisions = selectedDivisions(workspace, season, options.divisionIds).map((division) => {
    const rule = divisionRule(workspace, division, season);
    const teams = getDivisionTeams(workspace, division.id, season.id);
    const matrix = buildDivisionFixtureMatrix(teams, { meetings: rule.meetings, maxConsecutive: rule.maxConsecutive, rotationSeed: rule.rotationSeed });
    const requiredRounds = matrix.reduce((maximum, fixture) => Math.max(maximum, fixture.roundNumber), 0);
    const availableDates = playingDatesForDivision(workspace, season.id, division.id).length;
    const scopedDates = asArray(workspace?.playingDates)
      .filter((row) => row.seasonId === season.id)
      .filter((row) => !row.divisionId || row.divisionId === division.id);
    const reservedDates = new Set(scopedDates.filter((row) => row.status === "reserved").map((row) => row.playingDate)).size;
    const closedDates = new Set(scopedDates.filter((row) => row.status === "closed").map((row) => row.playingDate)).size;
    return {
      id: division.id,
      name: division.name,
      teams: teams.length,
      fixtures: matrix.length,
      fixturesPerTeam: teams.length > 1 ? (teams.length - 1) * rule.meetings : 0,
      requiredRounds,
      availableDates,
      reservedDates,
      closedDates,
      shortfall: Math.max(requiredRounds - availableDates, 0),
      oddMeetingRotation: rule.meetings % 2 === 1 ? (rule.rotationSeed ? "inverted" : "standard") : "balanced",
      ...rule,
    };
  });
  const errors = [];
  if (!season.startsOn || !season.endsOn) errors.push("Set the season start and end dates.");
  if (!season.defaultKickOff) errors.push("Set the league default kick-off in the season settings.");
  if (season.primaryWeekday === null || season.primaryWeekday === undefined || season.primaryWeekday === "") errors.push("Set the league primary playing day.");
  divisions.forEach((division) => {
    if (division.teams < 2) errors.push(`${division.name} needs at least two active teams.`);
    if (!division.startsOn || !division.endsOn) errors.push(`${division.name} needs a valid start and end date.`);
    if (division.startsOn && division.endsOn && division.endsOn < division.startsOn) errors.push(`${division.name} ends before it starts.`);
    if (!division.defaultKickOff) errors.push(`${division.name} has no kick-off setting to inherit or override.`);
  });
  const dateShortfalls = divisions.filter((division) => division.shortfall > 0);
  return {
    ready: divisions.length > 0 && errors.length === 0 && dateShortfalls.length === 0,
    season,
    divisions,
    totalFixtures: divisions.reduce((total, division) => total + division.fixtures, 0),
    minimumDates: divisions.reduce((maximum, division) => Math.max(maximum, division.requiredRounds), 0),
    configuredDates: divisions.length ? Math.min(...divisions.map((division) => division.availableDates)) : 0,
    dateShortfalls,
    errors,
  };
}

/** Generates the full league programme in one shared allocation pass. */
export function generateLeagueSchedule(workspace = {}, options = {}) {
  const season = getSeason(workspace, options.seasonId);
  if (!season) return { entries: [], config: {}, summary: { divisions: 0, fixtures: 0, placed: 0, unplaced: 0, locked: 0 }, errors: ["Create a current season before generating a schedule."] };

  const divisions = selectedDivisions(workspace, season, options.divisionIds);
  const baseEntries = asArray(options.baseEntries).map(normaliseBaseEntry);
  const preservePlacedBaseEntries = Boolean(options.preservePlacedBaseEntries);
  const baseByIdentity = new Map(baseEntries.filter((entry) => entry.homeTeamId && entry.awayTeamId).map((entry) => [fixtureIdentity(entry), entry]));
  const existingByIdentity = existingFixtureLookup(workspace, season.id);
  const reservations = [
    ...cupReservations(workspace, season.id),
    ...asArray(options.reservedEntries).map(normaliseBaseEntry),
  ];
  const state = createResourceState(workspace, reservations);
  const entries = [];
  const errors = [];
  const queue = [];
  const divisionRules = {};

  divisions.forEach((division) => {
    const teams = getDivisionTeams(workspace, division.id, season.id);
    const rule = divisionRule(workspace, division, season);
    divisionRules[division.id] = rule;
    if (teams.length < 2) {
      errors.push(`${division.name} needs at least two active teams.`);
      return;
    }
    const matrix = buildDivisionFixtureMatrix(teams, { meetings: rule.meetings, maxConsecutive: rule.maxConsecutive, rotationSeed: rule.rotationSeed });
    const dates = playingDatesForDivision(workspace, season.id, division.id);
    const totalRounds = matrix.reduce((max, fixture) => Math.max(max, fixture.roundNumber), 0);

    matrix.forEach((fixture) => {
      const template = { ...fixture, seasonId: season.id, divisionId: division.id, competitionType: "league" };
      const identity = fixtureIdentity(template);
      const base = baseByIdentity.get(identity);
      const existing = existingByIdentity.get(identity);
      const fixed = base && preservePlacedBaseEntries && base.scheduledDate
        ? base
        : existing?.locked
          ? normaliseBaseEntry({ ...existing, meetingNumber: fixture.meetingNumber, roundNumber: fixture.roundNumber, sourceFixtureId: existing.id })
          : null;
      if (fixed?.scheduledDate) {
        const entry = {
          ...fixed,
          clientKey: fixed.clientKey || identity,
          seasonId: season.id,
          divisionId: division.id,
          competitionType: "league",
          meetingNumber: fixture.meetingNumber,
          roundNumber: fixed.roundNumber || fixture.roundNumber,
          kickOff: fixed.kickOff || rule.defaultKickOff,
          placementStatus: "placed",
        };
        entries.push(entry);
        reserveEntry(state, entry);
        return;
      }
      queue.push({ division, teams, rule, dates, totalRounds, fixture, identity, base, existing });
    });
  });

  queue.sort((left, right) => (
    left.fixture.roundNumber - right.fixture.roundNumber
    || left.dates.length - right.dates.length
    || compareLeagueDivisions(left.division, right.division)
    || left.identity.localeCompare(right.identity)
  ));

  queue.forEach(({ division, rule, dates, totalRounds, fixture, identity, base, existing }) => {
    const homeTeam = state.teamById.get(fixture.homeTeamId);
    const placementFixture = { ...fixture, seasonId: season.id, divisionId: division.id, venueId: homeTeam?.homeVenueId || existing?.venueId || base?.venueId || "" };
    const blockerCounts = new Map();
    let placed = null;
    for (const dateRow of candidateRowsForRound(dates, fixture.roundNumber, totalRounds)) {
      const result = checkPlacement(workspace, state, placementFixture, dateRow);
      if (!result.blockers.length) {
        placed = {
          clientKey: identity,
          sourceFixtureId: existing?.id || base?.sourceFixtureId || "",
          seasonId: season.id,
          divisionId: division.id,
          competitionType: "league",
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          venueId: result.venueId,
          scheduledDate: result.scheduledDate,
          kickOff: result.kickOff || rule.defaultKickOff,
          roundNumber: fixture.roundNumber,
          meetingNumber: fixture.meetingNumber,
          placementStatus: "placed",
          locked: false,
          unresolvedReason: "",
          notes: base?.notes || "",
        };
        break;
      }
      result.blockers.forEach((blocker) => blockerCounts.set(blocker.label, (blockerCounts.get(blocker.label) || 0) + 1));
    }
    const entry = placed || {
      clientKey: identity,
      sourceFixtureId: existing?.id || base?.sourceFixtureId || "",
      seasonId: season.id,
      divisionId: division.id,
      competitionType: "league",
      homeTeamId: fixture.homeTeamId,
      awayTeamId: fixture.awayTeamId,
      venueId: placementFixture.venueId,
      scheduledDate: "",
      kickOff: "",
      roundNumber: fixture.roundNumber,
      meetingNumber: fixture.meetingNumber,
      placementStatus: "unplaced",
      locked: false,
      unresolvedReason: reasonFromBlockers(blockerCounts, dates.length),
      notes: base?.notes || "",
    };
    entries.push(entry);
    if (placed) reserveEntry(state, entry);
  });

  entries.sort((left, right) => Number(left.roundNumber || 0) - Number(right.roundNumber || 0)
    || String(left.scheduledDate || "9999-12-31").localeCompare(String(right.scheduledDate || "9999-12-31"))
    || left.divisionId.localeCompare(right.divisionId)
    || left.homeTeamId.localeCompare(right.homeTeamId));

  return {
    entries,
    config: {
      seasonId: season.id,
      allDivisions: !asArray(options.divisionIds).length,
      divisionIds: divisions.map((division) => division.id),
      divisionRules,
      defaultKickOff: toTime(season.defaultKickOff, ""),
      primaryWeekday: Number(season.primaryWeekday ?? 6),
      cupReservations: reservations.length,
    },
    summary: {
      divisions: divisions.length,
      fixtures: entries.length,
      placed: entries.filter((entry) => entry.scheduledDate).length,
      unplaced: entries.filter((entry) => !entry.scheduledDate).length,
      locked: entries.filter((entry) => entry.locked).length,
      cupReservations: reservations.length,
    },
    errors,
  };
}

function issue({ code, severity = "blocking", message, entryIds = [], teamId = "", divisionId = "", date = "" }) {
  return { id: `${code}:${divisionId}:${teamId}:${date}:${entryIds.join("-")}`, code, severity, message, entryIds, teamId, divisionId, date };
}

function nameOf(map, id, fallback) {
  return map.get(id)?.name || fallback;
}

function consecutiveRunIssues(entries, workspace) {
  const teams = teamMap(workspace);
  const divisions = divisionMap(workspace);
  const fixturesByTeam = new Map();
  entries.filter((entry) => entry.scheduledDate && entry.competitionType !== "cup").forEach((entry) => {
    [entry.homeTeamId, entry.awayTeamId].forEach((teamId) => {
      if (!fixturesByTeam.has(teamId)) fixturesByTeam.set(teamId, []);
      fixturesByTeam.get(teamId).push(entry);
    });
  });
  const issues = [];
  fixturesByTeam.forEach((teamEntries, teamId) => {
    const division = divisions.get(teamEntries[0]?.divisionId);
    const season = getSeason(workspace, teamEntries[0]?.seasonId);
    const maxRun = divisionRule(workspace, division, season).maxConsecutive;
    const sorted = [...teamEntries].sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate) || left.kickOff.localeCompare(right.kickOff));
    let lastSide = "";
    let run = 0;
    let maxObserved = 0;
    sorted.forEach((entry) => {
      const side = entry.homeTeamId === teamId ? "home" : "away";
      if (side === lastSide) run += 1;
      else { lastSide = side; run = 1; }
      maxObserved = Math.max(maxObserved, run);
    });
    if (maxObserved > maxRun) issues.push(issue({
      code: "long-home-away-run",
      severity: "warning",
      teamId,
      divisionId: division?.id || "",
      message: `${nameOf(teams, teamId, "Team")} has a run of ${maxObserved} consecutive home or away league fixtures; the division target is ${maxRun}.`,
    }));
  });
  return issues;
}

export function validateLeagueSchedule(workspace = {}, entriesInput = [], config = {}) {
  const entries = asArray(entriesInput).map(normaliseBaseEntry);
  const season = getSeason(workspace, config.seasonId || entries[0]?.seasonId);
  const teams = teamMap(workspace);
  const venues = venueMap(workspace);
  const divisions = divisionMap(workspace);
  const capacities = groundCapacityMap(workspace);
  const issues = [];
  const reservations = cupReservations(workspace, season?.id || "");

  entries.forEach((entry) => {
    if (!entry.scheduledDate) {
      issues.push(issue({ code: "unplaced-fixture", message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} is unplaced. ${entry.unresolvedReason || ""}`.trim(), entryIds: [stableEntryKey(entry)], divisionId: entry.divisionId }));
      return;
    }
    const division = divisions.get(entry.divisionId);
    const rule = divisionRule(workspace, division, season);
    if (rule.startsOn && entry.scheduledDate < rule.startsOn) issues.push(issue({ code: "before-division-start", message: `${nameOf(divisions, entry.divisionId, "Division")} fixture is scheduled before its ${rule.startsOn} start date.`, entryIds: [stableEntryKey(entry)], divisionId: entry.divisionId, date: entry.scheduledDate }));
    if (rule.endsOn && entry.scheduledDate > rule.endsOn) issues.push(issue({ code: "after-division-end", message: `${nameOf(divisions, entry.divisionId, "Division")} fixture is scheduled after its ${rule.endsOn} end date.`, entryIds: [stableEntryKey(entry)], divisionId: entry.divisionId, date: entry.scheduledDate }));
    if (!entry.venueId || !venues.has(entry.venueId)) issues.push(issue({ code: "missing-venue", message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} has no valid venue.`, entryIds: [stableEntryKey(entry)], divisionId: entry.divisionId, date: entry.scheduledDate }));
    if (!toTime(entry.kickOff, rule.defaultKickOff)) issues.push(issue({ code: "missing-kick-off", message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} has no kick-off time and the league/division default is blank.`, entryIds: [stableEntryKey(entry)], divisionId: entry.divisionId, date: entry.scheduledDate }));
    const availableDates = playingDatesForDivision(workspace, entry.seasonId || season?.id, entry.divisionId);
    if (!availableDates.some((row) => row.playingDate === entry.scheduledDate)) issues.push(issue({ code: "unavailable-playing-date", message: `${entry.scheduledDate} is not an available playing date for ${nameOf(divisions, entry.divisionId, "this division")}.`, entryIds: [stableEntryKey(entry)], divisionId: entry.divisionId, date: entry.scheduledDate }));
    const homeTeam = teams.get(entry.homeTeamId);
    const awayTeam = teams.get(entry.awayTeamId);
    applicableBlackouts(workspace, { seasonId: entry.seasonId || season?.id, divisionId: entry.divisionId, homeTeam, awayTeam, venueId: entry.venueId, scheduledDate: entry.scheduledDate })
      .forEach((blackout) => issues.push(issue({ code: "blackout-violation", message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} conflicts with “${blackout.reason}”.`, entryIds: [stableEntryKey(entry)], divisionId: entry.divisionId, date: entry.scheduledDate })));
    reservations.filter((cup) => cup.scheduledDate === entry.scheduledDate && [cup.homeTeamId, cup.awayTeamId].some((teamId) => teamId && [entry.homeTeamId, entry.awayTeamId].includes(teamId)))
      .forEach(() => issues.push(issue({ code: "cup-team-conflict", message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} clashes with a cup tie on ${entry.scheduledDate}.`, entryIds: [stableEntryKey(entry)], divisionId: entry.divisionId, date: entry.scheduledDate })));
  });

  const allResourceEntries = [...entries.filter((entry) => entry.scheduledDate), ...reservations];
  const teamDateGroups = new Map();
  allResourceEntries.forEach((entry) => [entry.homeTeamId, entry.awayTeamId].filter(Boolean).forEach((teamId) => {
    const key = `${entry.scheduledDate}|${teamId}`;
    if (!teamDateGroups.has(key)) teamDateGroups.set(key, []);
    teamDateGroups.get(key).push(entry);
  }));
  teamDateGroups.forEach((group, key) => {
    if (group.length < 2) return;
    const [date, teamId] = key.split("|");
    issues.push(issue({ code: "team-double-booking", message: `${nameOf(teams, teamId, "Team")} has ${group.length} league/cup fixtures on ${date}.`, entryIds: group.filter((entry) => entry.competitionType !== "cup").map(stableEntryKey), teamId, date }));
  });

  const venueGroups = new Map();
  allResourceEntries.filter((entry) => entry.venueId).forEach((entry) => {
    const key = `${entry.scheduledDate}|${toTime(entry.kickOff)}|${entry.venueId}`;
    if (!venueGroups.has(key)) venueGroups.set(key, []);
    venueGroups.get(key).push(entry);
  });
  venueGroups.forEach((group, key) => {
    const [date, kickOff, venueId] = key.split("|");
    const venue = venues.get(venueId);
    if (group.length > asPositiveInteger(venue?.simultaneousFixtureLimit, 1, 20)) issues.push(issue({ code: "venue-capacity-conflict", message: `${venue?.name || "Venue"} has ${group.length} simultaneous league/cup fixtures at ${kickOff} on ${date}.`, entryIds: group.filter((entry) => entry.competitionType !== "cup").map(stableEntryKey), date }));
  });

  const groundGroups = new Map();
  allResourceEntries.filter((entry) => entry.venueId).forEach((entry) => {
    const venue = venues.get(entry.venueId);
    const groundKey = groundKeyForVenue(venue);
    const key = `${entry.scheduledDate}|${toTime(entry.kickOff)}|${groundKey}`;
    if (!groundGroups.has(key)) groundGroups.set(key, { entries: [], venue, groundKey });
    groundGroups.get(key).entries.push(entry);
  });
  groundGroups.forEach(({ entries: group, venue, groundKey }, key) => {
    const capacity = capacities.get(groundKey) || 1;
    if (group.length <= capacity) return;
    const [date, kickOff] = key.split("|");
    issues.push(issue({ code: "ground-capacity-conflict", message: `${venue?.name || "Shared ground"} has ${group.length} simultaneous league/cup fixtures at ${kickOff} on ${date}, above its limit of ${capacity}.`, entryIds: group.filter((entry) => entry.competitionType !== "cup").map(stableEntryKey), date }));
  });

  const identityGroups = new Map();
  entries.forEach((entry) => {
    const key = fixtureIdentity(entry);
    if (!identityGroups.has(key)) identityGroups.set(key, []);
    identityGroups.get(key).push(entry);
  });
  identityGroups.forEach((group) => {
    if (group.length > 1) issues.push(issue({ code: "duplicate-pairing", message: `A league pairing and meeting number appears more than once.`, entryIds: group.map(stableEntryKey), divisionId: group[0].divisionId }));
  });

  selectedDivisions(workspace, season || { id: "" }, config.divisionIds).forEach((division) => {
    const rule = divisionRule(workspace, division, season);
    const divisionTeams = getDivisionTeams(workspace, division.id, season?.id || "");
    const expected = buildDivisionFixtureMatrix(divisionTeams, { meetings: rule.meetings, maxConsecutive: rule.maxConsecutive, rotationSeed: rule.rotationSeed });
    const expectedByIdentity = new Map(expected.map((fixture) => {
      const withDivision = { ...fixture, divisionId: division.id };
      return [fixtureIdentity(withDivision), withDivision];
    }));
    const actualRows = entries.filter((entry) => entry.divisionId === division.id);
    const actualKeys = new Set(actualRows.map(fixtureIdentity));
    const missing = expected.filter((fixture) => !actualKeys.has(fixtureIdentity({ ...fixture, divisionId: division.id })));
    const unexpected = actualRows.filter((entry) => !expectedByIdentity.has(fixtureIdentity(entry)));
    if (missing.length) issues.push(issue({ code: "missing-required-fixtures", message: `${division.name} is missing ${missing.length} required fixture${missing.length === 1 ? "" : "s"}.`, divisionId: division.id }));
    if (unexpected.length) issues.push(issue({ code: "unexpected-fixture", message: `${division.name} contains ${unexpected.length} fixture${unexpected.length === 1 ? "" : "s"} outside its ${rule.meetings}-meeting competition format.`, divisionId: division.id, entryIds: unexpected.map(stableEntryKey) }));

    actualRows.forEach((entry) => {
      const expectedEntry = expectedByIdentity.get(fixtureIdentity(entry));
      if (expectedEntry && expectedEntry.homeTeamId !== entry.homeTeamId) {
        issues.push(issue({
          code: "home-allocation-mismatch",
          message: `${nameOf(teams, entry.homeTeamId, "Home team")} v ${nameOf(teams, entry.awayTeamId, "Away team")} does not follow ${division.name}'s season home-allocation cycle for meeting ${entry.meetingNumber || 1}.`,
          entryIds: [stableEntryKey(entry)],
          divisionId: division.id,
        }));
      }
    });

    const expectedPerTeam = Math.max(0, (divisionTeams.length - 1) * rule.meetings);
    divisionTeams.forEach((team) => {
      const rows = actualRows.filter((entry) => [entry.homeTeamId, entry.awayTeamId].includes(team.id));
      const homeCount = rows.filter((entry) => entry.homeTeamId === team.id).length;
      const awayCount = rows.filter((entry) => entry.awayTeamId === team.id).length;
      const allowed = expectedPerTeam % 2;
      if (rows.length !== expectedPerTeam) issues.push(issue({
        code: "team-fixture-total-mismatch",
        message: `${team.name} has ${rows.length} league fixtures; ${division.name} requires ${expectedPerTeam}.`,
        teamId: team.id,
        divisionId: division.id,
        entryIds: rows.map(stableEntryKey),
      }));
      if (Math.abs(homeCount - awayCount) > allowed) issues.push(issue({ code: "home-away-imbalance", severity: "warning", message: `${team.name} has ${homeCount} home and ${awayCount} away league fixtures.`, teamId: team.id, divisionId: division.id }));
    });
  });

  issues.push(...consecutiveRunIssues(entries, workspace));
  const blocking = issues.filter((item) => item.severity === "blocking");
  const warnings = issues.filter((item) => item.severity === "warning");
  return { valid: blocking.length === 0, blockingCount: blocking.length, warningCount: warnings.length, issues, totals: { fixtures: entries.length, placed: entries.filter((entry) => entry.scheduledDate).length, unplaced: entries.filter((entry) => !entry.scheduledDate).length, locked: entries.filter((entry) => entry.locked).length } };
}

export function compareLeagueScheduleVersions(leftEntries = [], rightEntries = []) {
  const left = new Map(asArray(leftEntries).map((entry) => [fixtureIdentity(entry), normaliseBaseEntry(entry)]));
  const right = new Map(asArray(rightEntries).map((entry) => [fixtureIdentity(entry), normaliseBaseEntry(entry)]));
  const keys = new Set([...left.keys(), ...right.keys()]);
  const details = [];
  let unchanged = 0;
  let moved = 0;
  let added = 0;
  let removed = 0;
  keys.forEach((key) => {
    const before = left.get(key);
    const after = right.get(key);
    if (!before) { added += 1; details.push({ type: "added", key, before: null, after }); return; }
    if (!after) { removed += 1; details.push({ type: "removed", key, before, after: null }); return; }
    const changed = ["scheduledDate", "kickOff", "venueId", "locked", "homeTeamId", "awayTeamId"].some((field) => before[field] !== after[field]);
    if (changed) { moved += 1; details.push({ type: "moved", key, before, after }); } else unchanged += 1;
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
  const rows = [["schedule_version", "division", "meeting", "round", "date", "kick_off", "home_team", "away_team", "venue", "locked", "status", "unresolved_reason"]];
  asArray(entriesInput).map(normaliseBaseEntry)
    .sort((left, right) => String(left.scheduledDate || "9999-12-31").localeCompare(String(right.scheduledDate || "9999-12-31")) || left.roundNumber - right.roundNumber)
    .forEach((entry) => rows.push([
      version.name || `Version ${version.versionNumber || ""}`.trim(),
      divisions.get(entry.divisionId)?.name || "",
      entry.meetingNumber || 1,
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
    competition_type: entry.competitionType || "league",
    competition_id: entry.competitionId || entry.cupId || null,
    cup_tie_id: entry.cupTieId || null,
    home_team_id: entry.homeTeamId,
    away_team_id: entry.awayTeamId,
    venue_id: entry.venueId || null,
    scheduled_date: entry.scheduledDate || null,
    kick_off: entry.kickOff || null,
    round_number: Number(entry.roundNumber || 0),
    meeting_number: Number(entry.meetingNumber || 1),
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
    competitionType: row.competition_type || row.competitionType || "league",
    competitionId: row.competition_id || row.competitionId || "",
    cupId: row.competition_id || row.cupId || "",
    cupTieId: row.cup_tie_id || row.cupTieId || "",
    homeTeamId: row.home_team_id || row.homeTeamId || "",
    awayTeamId: row.away_team_id || row.awayTeamId || "",
    venueId: row.venue_id || row.venueId || "",
    scheduledDate: row.scheduled_date || row.scheduledDate || "",
    kickOff: row.kick_off || row.kickOff || "",
    roundNumber: row.round_number ?? row.roundNumber ?? 0,
    meetingNumber: row.meeting_number ?? row.meetingNumber ?? 1,
    placementStatus: row.placement_status || row.placementStatus || "",
    unresolvedReason: row.unresolved_reason || row.unresolvedReason || "",
  });
}

export function normaliseScheduleVersionPayload(payload = {}) {
  return { version: normaliseScheduleVersion(payload.version || {}), entries: asArray(payload.entries).map(normaliseScheduleEntry) };
}

export function daysBetween(left, right) {
  const leftDate = new Date(`${left}T00:00:00Z`);
  const rightDate = new Date(`${right}T00:00:00Z`);
  if (Number.isNaN(leftDate.getTime()) || Number.isNaN(rightDate.getTime())) return null;
  return Math.round((rightDate.getTime() - leftDate.getTime()) / DAY_MS);
}
