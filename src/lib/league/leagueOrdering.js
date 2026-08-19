const NATURAL_COLLATOR = new Intl.Collator("en-GB", {
  numeric: true,
  sensitivity: "base",
});

const NUMBER_WORDS = Object.freeze({
  zero: 0,
  one: 1,
  first: 1,
  two: 2,
  second: 2,
  three: 3,
  third: 3,
  four: 4,
  fourth: 4,
  five: 5,
  fifth: 5,
  six: 6,
  sixth: 6,
  seven: 7,
  seventh: 7,
  eight: 8,
  eighth: 8,
  nine: 9,
  ninth: 9,
  ten: 10,
  tenth: 10,
  eleven: 11,
  eleventh: 11,
  twelve: 12,
  twelfth: 12,
  thirteen: 13,
  thirteenth: 13,
  fourteen: 14,
  fourteenth: 14,
  fifteen: 15,
  fifteenth: 15,
  sixteen: 16,
  sixteenth: 16,
  seventeen: 17,
  seventeenth: 17,
  eighteen: 18,
  eighteenth: 18,
  nineteen: 19,
  nineteenth: 19,
  twenty: 20,
  twentieth: 20,
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeName(value) {
  return String(value || "").trim();
}

function romanToNumber(value) {
  const roman = String(value || "").toUpperCase();
  if (!/^[IVXLCDM]+$/.test(roman)) return null;
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  let previous = 0;
  for (let index = roman.length - 1; index >= 0; index -= 1) {
    const current = values[roman[index]];
    total += current < previous ? -current : current;
    previous = current;
  }
  return total > 0 && total <= 100 ? total : null;
}

function divisionNumberFromName(name) {
  const normalised = safeName(name)
    .toLowerCase()
    .replace(/[–—_-]+/g, " ")
    .replace(/\s+/g, " ");

  const divisionMatch = normalised.match(/\b(?:division|div)\s+([a-z0-9]+)\b/);
  const tierMatch = normalised.match(/\b(?:tier|section)\s+([a-z0-9]+)\b/);
  const token = divisionMatch?.[1] || tierMatch?.[1] || "";
  if (!token) return null;
  if (/^\d+$/.test(token)) return Number(token);
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, token)) return NUMBER_WORDS[token];
  return romanToNumber(token);
}

export function getDivisionNameRank(name) {
  const normalised = safeName(name).toLowerCase();
  if (!normalised) return 100000;
  if (/\b(premier|premiership|prem)\b/.test(normalised)) return 0;
  if (/\bchampionship\b/.test(normalised)) return 50;

  const divisionNumber = divisionNumberFromName(normalised);
  if (Number.isFinite(divisionNumber)) return 100 + divisionNumber;

  if (/\b(division|section|tier)\b/.test(normalised)) return 500;
  if (/\b(reserve|reserves)\b/.test(normalised)) return 700;
  if (/\b(development|academy)\b/.test(normalised)) return 750;
  if (/\b(veteran|veterans|vets)\b/.test(normalised)) return 800;
  return 1000;
}

export function compareLeagueDivisions(left = {}, right = {}) {
  const leftRank = getDivisionNameRank(left.name);
  const rightRank = getDivisionNameRank(right.name);
  const leftHasSportingRank = leftRank < 500;
  const rightHasSportingRank = rightRank < 500;

  if (leftHasSportingRank && rightHasSportingRank && leftRank !== rightRank) return leftRank - rightRank;
  if (leftHasSportingRank !== rightHasSportingRank) return leftHasSportingRank ? -1 : 1;

  const leftOrder = Number(left.sortOrder ?? left.sort_order);
  const rightOrder = Number(right.sortOrder ?? right.sort_order);
  const leftHasOrder = Number.isFinite(leftOrder);
  const rightHasOrder = Number.isFinite(rightOrder);
  if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
  if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;

  if (leftRank !== rightRank) return leftRank - rightRank;
  return NATURAL_COLLATOR.compare(safeName(left.name), safeName(right.name));
}

export function orderLeagueDivisions(divisions) {
  return [...asArray(divisions)].sort(compareLeagueDivisions);
}

export function orderLeagueTeams(teams, divisions = []) {
  const orderedDivisions = orderLeagueDivisions(divisions);
  const divisionIndex = new Map(orderedDivisions.map((division, index) => [division.id, index]));
  return [...asArray(teams)].sort((left, right) => {
    const leftIndex = divisionIndex.has(left.divisionId) ? divisionIndex.get(left.divisionId) : Number.MAX_SAFE_INTEGER;
    const rightIndex = divisionIndex.has(right.divisionId) ? divisionIndex.get(right.divisionId) : Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || NATURAL_COLLATOR.compare(safeName(left.name), safeName(right.name));
  });
}

export function orderLeagueCompetitionRows(rows) {
  return [...asArray(rows)].sort((left, right) => {
    if (left.competitionType === "league" && right.competitionType !== "league") return -1;
    if (right.competitionType === "league" && left.competitionType !== "league") return 1;
    return NATURAL_COLLATOR.compare(safeName(left.name || left.competitionName), safeName(right.name || right.competitionName));
  });
}
