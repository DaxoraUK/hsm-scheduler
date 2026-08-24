const SCENARIO_COUNTS = Object.freeze({
  light: Object.freeze({ saturday: 5, sunday: 2, midweek: 2 }),
  standard: Object.freeze({ saturday: 10, sunday: 3, midweek: 4 }),
  busy: Object.freeze({ saturday: 16, sunday: 6, midweek: 8 }),
});

export const TEST_DATA_SCENARIOS = Object.freeze([
  { value: "light", label: "Light", description: "A quieter fixture day with spare capacity." },
  { value: "standard", label: "Standard", description: "A realistic club matchday with mixed formats." },
  { value: "busy", label: "Busy", description: "A high-pressure day for testing clashes and capacity." },
]);

const OPPONENT_PLACES = [
  "Atherton Town",
  "Bolton United",
  "Bury Juniors",
  "Eagley",
  "Farnworth Town",
  "Leigh Rangers",
  "Radcliffe Borough",
  "Rochdale Athletic",
  "Salford Victoria",
  "Westhoughton Juniors",
  "Wigan Community",
  "Prestwich Athletic",
  "Darwen Rangers",
  "Chorley Town",
  "Blackrod Juniors",
  "Little Lever",
];

function configuredOfficialNames(officials = []) {
  return officials
    .map((official) => typeof official === "string" ? official : official?.name)
    .map((name) => String(name || "").trim())
    .filter(Boolean);
}

function hashSeed(value) {
  const text = String(value || "ground-control-demo");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(items, random) {
  if (!items.length) return null;
  return items[Math.floor(random() * items.length)];
}

function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normaliseDayKey(value) {
  const key = String(value || "saturday").toLowerCase();
  if (["sun", "sunday"].includes(key)) return "sunday";
  if (["mid", "midweek", "weekday"].includes(key)) return "midweek";
  return "saturday";
}

export function createFixtureTeamKey(team = {}) {
  return String(team.name || "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function teamDay(team = {}) {
  return String(team.day || "Saturday").toLowerCase();
}

function eligibleTeams(teams = [], dayKey) {
  const safeTeams = Array.isArray(teams) ? teams.filter((team) => team?.name) : [];
  if (dayKey === "midweek") return safeTeams;
  const matching = safeTeams.filter((team) => teamDay(team) === dayKey);
  return matching.length ? matching : safeTeams;
}

function ageLabel(team = {}) {
  const match = String(team.name || "").match(/\bU\s?\d{1,2}\b/i);
  return match ? match[0].replace(/\s+/g, "").toUpperCase() : "";
}

function opponentFor(team, random, usedOpponents) {
  const age = ageLabel(team);
  const adult = ["adult", "veterans", "women"].includes(String(team.teamType || "").toLowerCase());
  let base = pick(OPPONENT_PLACES, random) || "Community FC";
  let attempts = 0;
  while (usedOpponents.has(`${base}-${age}`) && attempts < OPPONENT_PLACES.length) {
    base = pick(OPPONENT_PLACES, random) || base;
    attempts += 1;
  }
  usedOpponents.add(`${base}-${age}`);
  if (age) return `${base} ${age}`;
  return adult ? `${base} FC` : `${base} Juniors`;
}

function leagueFor(team = {}, dayKey, random) {
  const type = String(team.teamType || "youth").toLowerCase();
  if (["girls", "women"].includes(type)) return random() > 0.5 ? "Girls & Women's League" : "County Women's League";
  if (["adult", "veterans"].includes(type)) return dayKey === "sunday" ? "Sunday League" : "County League";
  return random() > 0.35 ? "Youth Football League" : "District Junior League";
}

function refereeData(random, officials = []) {
  const availableOfficials = configuredOfficialNames(officials);
  const roll = random();
  if (roll < 0.42 || availableOfficials.length === 0) {
    return { referee: "", refPhone: "", refStatus: "TBC" };
  }
  const referee = pick(availableOfficials, random);
  if (roll < 0.68) {
    return { referee, refPhone: "", refStatus: "Awaiting" };
  }
  return { referee, refPhone: "", refStatus: "Confirmed" };
}

export function createTestDataSeed(dayKey = "saturday") {
  return `${normaliseDayKey(dayKey)}-${Date.now().toString(36)}`;
}

export function generateTestFixtures({
  dayKey = "saturday",
  seed = "ground-control-demo",
  scenario = "standard",
  club = {},
  teams = [],
  officials = [],
} = {}) {
  const normalisedDay = normaliseDayKey(dayKey);
  const selectedScenario = SCENARIO_COUNTS[scenario] ? scenario : "standard";
  const random = seededRandom(`${seed}:${normalisedDay}:${selectedScenario}`);
  const candidates = shuffled(eligibleTeams(teams, normalisedDay), random);
  const targetCount = SCENARIO_COUNTS[selectedScenario][normalisedDay];
  const count = Math.min(targetCount, candidates.length);
  const clubName = String(club?.name || "Ground Control FC").trim();
  const usedOpponents = new Set();

  return candidates.slice(0, count).map((team, index) => {
    const stableTeamId = team.id || team.teamId || "";
    return {
      id: `demo-${normalisedDay}-${hashSeed(`${seed}-${team.name}-${index}`).toString(36)}`,
      homeTeam: `${clubName} ${team.name}`.trim(),
      homeTeamId: stableTeamId,
      homeTeamKey: createFixtureTeamKey(team),
      teamId: stableTeamId,
      awayTeam: opponentFor(team, random, usedOpponents),
      league: leagueFor(team, normalisedDay, random),
      isCup: random() < 0.16,
      status: "active",
      ...refereeData(random, officials),
      fixtureDayKey: normalisedDay,
      __day: normalisedDay,
      demoSeed: seed,
    };
  });
}

export default generateTestFixtures;
