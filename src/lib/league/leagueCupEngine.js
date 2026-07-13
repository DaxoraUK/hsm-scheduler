function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value) {
  return String(value || "").trim();
}

function deterministicHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicShuffle(rows, seed) {
  const result = [...rows];
  let state = deterministicHash(seed) || 1;
  const random = () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

export function getCupEligibleTeams(workspace = {}, cupId) {
  const cup = asArray(workspace.cups).find((row) => row.id === cupId);
  if (!cup) return [];
  const divisionIds = new Set(asArray(workspace.cupDivisions).filter((row) => row.cupId === cupId).map((row) => row.divisionId));
  const overrides = new Map(asArray(workspace.cupTeamOverrides).filter((row) => row.cupId === cupId).map((row) => [row.teamId, Boolean(row.included)]));
  return asArray(workspace.teams)
    .filter((team) => team.seasonId === cup.seasonId && !["withdrawn", "inactive"].includes(team.status))
    .filter((team) => overrides.has(team.id) ? overrides.get(team.id) : divisionIds.has(team.divisionId))
    .sort((left, right) => left.name.localeCompare(right.name, "en-GB"));
}

function pairingPenalty(left, right, avoidSameParentClub) {
  if (!left || !right) return 0;
  if (avoidSameParentClub && left.parentClubId && left.parentClubId === right.parentClubId) return 1000;
  if (left.divisionId && left.divisionId === right.divisionId) return 2;
  return 0;
}

function pairTeams(teams, avoidSameParentClub) {
  const remaining = [...teams];
  const pairs = [];
  while (remaining.length > 1) {
    const left = remaining.shift();
    let bestIndex = 0;
    let bestPenalty = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const penalty = pairingPenalty(left, candidate, avoidSameParentClub);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestIndex = index;
      }
    });
    const [right] = remaining.splice(bestIndex, 1);
    pairs.push([left, right]);
  }
  if (remaining.length) pairs.push([remaining[0], null]);
  return pairs;
}

export function cupRoundLabel(teamCount, roundNumber = 1) {
  const remaining = Math.max(2, Math.ceil(teamCount / (2 ** Math.max(0, roundNumber - 1))));
  if (remaining <= 2) return "Final";
  if (remaining <= 4) return "Semi-finals";
  if (remaining <= 8) return "Quarter-finals";
  if (remaining <= 16) return "Round of 16";
  if (remaining <= 32) return "Round of 32";
  return `Round ${roundNumber}`;
}

export function buildCupOpeningRound(teamsInput = [], cup = {}, { scheduledDate = "", kickOff = "", venueId = "" } = {}) {
  const teams = asArray(teamsInput).filter((team) => team?.id);
  if (teams.length < 2) return { round: null, ties: [], errors: ["Select at least two eligible teams."] };
  const ordered = cup.drawMode === "seeded"
    ? [...teams].sort((left, right) => Number(left.seed || 9999) - Number(right.seed || 9999) || left.name.localeCompare(right.name, "en-GB"))
    : deterministicShuffle(teams, `${cup.id || cup.name}:${scheduledDate}:1`);
  const bracketSize = nextPowerOfTwo(ordered.length);
  const byeCount = bracketSize - ordered.length;
  const byeTeams = ordered.slice(0, byeCount);
  const matchTeams = ordered.slice(byeCount);
  const avoidSameParentClub = Number(cup.sameClubAvoidUntilRound || 0) >= 1;
  const pairs = pairTeams(matchTeams, avoidSameParentClub);
  const ties = [];
  let tieNumber = 1;
  byeTeams.forEach((team) => {
    ties.push({
      clientKey: `cup:${cup.id}:1:${tieNumber}`,
      cupId: cup.id,
      seasonId: cup.seasonId,
      roundNumber: 1,
      tieNumber,
      homeTeamId: team.id,
      awayTeamId: "",
      venueId: team.homeVenueId || venueId || "",
      scheduledDate,
      kickOff,
      status: "bye",
      winnerTeamId: team.id,
      locked: true,
    });
    tieNumber += 1;
  });
  pairs.forEach(([left, right]) => {
    if (!left || !right) return;
    const flip = deterministicHash(`${cup.id}:${left.id}:${right.id}`) % 2 === 1;
    const home = flip ? right : left;
    const away = flip ? left : right;
    ties.push({
      clientKey: `cup:${cup.id}:1:${tieNumber}`,
      cupId: cup.id,
      seasonId: cup.seasonId,
      roundNumber: 1,
      tieNumber,
      homeTeamId: home.id,
      awayTeamId: away.id,
      venueId: home.homeVenueId || venueId || "",
      scheduledDate,
      kickOff,
      status: scheduledDate ? "scheduled" : "draft",
      winnerTeamId: "",
      locked: false,
    });
    tieNumber += 1;
  });
  return {
    round: {
      cupId: cup.id,
      seasonId: cup.seasonId,
      roundNumber: 1,
      name: cupRoundLabel(ordered.length, 1),
      scheduledDate,
      status: "drawn",
    },
    ties,
    errors: [],
    summary: { teams: ordered.length, bracketSize, byes: byeCount, ties: ties.length },
  };
}

export function buildNextCupRound(previousTiesInput = [], cup = {}, { scheduledDate = "", kickOff = "", venueId = "" } = {}) {
  const previousTies = asArray(previousTiesInput).sort((left, right) => Number(left.tieNumber || 0) - Number(right.tieNumber || 0));
  if (!previousTies.length) return { round: null, ties: [], errors: ["The previous round has no ties."] };
  const missingWinners = previousTies.filter((tie) => !tie.winnerTeamId);
  if (missingWinners.length) return { round: null, ties: [], errors: [`Record ${missingWinners.length} winner${missingWinners.length === 1 ? "" : "s"} before creating the next round.`] };
  const winners = previousTies.map((tie) => ({ id: tie.winnerTeamId, parentClubId: tie.winnerParentClubId || "", homeVenueId: tie.winnerVenueId || "" }));
  if (winners.length < 2) return { round: null, ties: [], errors: ["The cup is complete."] };
  const roundNumber = Math.max(...previousTies.map((tie) => Number(tie.roundNumber || 1))) + 1;
  const ordered = deterministicShuffle(winners, `${cup.id}:${scheduledDate}:${roundNumber}`);
  const avoidSameParentClub = Number(cup.sameClubAvoidUntilRound || 0) >= roundNumber;
  const pairs = pairTeams(ordered, avoidSameParentClub);
  const ties = pairs.map(([left, right], index) => {
    const final = ordered.length === 2;
    return {
      clientKey: `cup:${cup.id}:${roundNumber}:${index + 1}`,
      cupId: cup.id,
      seasonId: cup.seasonId,
      roundNumber,
      tieNumber: index + 1,
      homeTeamId: left?.id || "",
      awayTeamId: right?.id || "",
      venueId: final ? (cup.finalVenueId || venueId || left?.homeVenueId || "") : (left?.homeVenueId || venueId || ""),
      scheduledDate: final && cup.finalDate ? cup.finalDate : scheduledDate,
      kickOff,
      status: right ? ((final && cup.finalDate ? cup.finalDate : scheduledDate) ? "scheduled" : "draft") : "bye",
      winnerTeamId: right ? "" : left?.id || "",
      locked: final && Boolean(cup.finalVenueId),
    };
  });
  return {
    round: { cupId: cup.id, seasonId: cup.seasonId, roundNumber, name: cupRoundLabel(winners.length, roundNumber), scheduledDate, status: "drawn" },
    ties,
    errors: [],
  };
}

export function findCupLeagueConflicts(scheduleEntries = [], cupTies = []) {
  const conflicts = [];
  asArray(cupTies).filter((tie) => tie.scheduledDate && !["cancelled", "void", "bye", "postponed"].includes(tie.status)).forEach((tie) => {
    asArray(scheduleEntries).filter((entry) => entry.scheduledDate === tie.scheduledDate).forEach((entry) => {
      const sharedTeamIds = [tie.homeTeamId, tie.awayTeamId].filter(Boolean).filter((teamId) => [entry.homeTeamId, entry.awayTeamId].includes(teamId));
      const venueConflict = tie.venueId && entry.venueId && tie.venueId === entry.venueId && (tie.kickOff || "").slice(0, 5) === (entry.kickOff || "").slice(0, 5);
      if (sharedTeamIds.length || venueConflict) conflicts.push({ tie, entry, sharedTeamIds, venueConflict, locked: Boolean(entry.locked) });
    });
  });
  return conflicts;
}

export function prepareLeagueRebalanceForCups(scheduleEntries = [], cupTies = []) {
  const conflicts = findCupLeagueConflicts(scheduleEntries, cupTies);
  const conflictingIds = new Set(conflicts.filter((conflict) => !conflict.locked).map((conflict) => conflict.entry.id || conflict.entry.clientKey));
  return {
    baseEntries: asArray(scheduleEntries).map((entry) => conflictingIds.has(entry.id || entry.clientKey)
      ? { ...entry, scheduledDate: "", kickOff: "", placementStatus: "unplaced", unresolvedReason: "Displaced by a cup tie and queued for rearrangement." }
      : entry),
    conflicts,
    lockedConflicts: conflicts.filter((conflict) => conflict.locked),
    movedCount: conflictingIds.size,
  };
}

export function cupTiesToCsv(cup, ties = [], workspace = {}) {
  const teamNames = new Map(asArray(workspace.teams).map((team) => [team.id, team.name]));
  const venueNames = new Map(asArray(workspace.venues).map((venue) => [venue.id, venue.name]));
  const lines = [["cup", "round", "tie", "date", "kick_off", "home_team", "away_team", "venue", "status", "home_score", "away_score", "winner"]];
  asArray(ties).sort((left, right) => Number(left.roundNumber || 0) - Number(right.roundNumber || 0) || Number(left.tieNumber || 0) - Number(right.tieNumber || 0)).forEach((tie) => lines.push([
    cup?.name || "Cup",
    tie.roundNumber || "",
    tie.tieNumber || "",
    tie.scheduledDate || "",
    tie.kickOff || "",
    teamNames.get(tie.homeTeamId) || "BYE",
    teamNames.get(tie.awayTeamId) || "BYE",
    venueNames.get(tie.venueId) || "",
    tie.status || "",
    tie.homeScore ?? "",
    tie.awayScore ?? "",
    teamNames.get(tie.winnerTeamId) || "",
  ]));
  return lines.map((row) => row.map((value) => {
    const text = asText(value);
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(",")).join("\n");
}
