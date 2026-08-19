const DEFAULT_CLUB_ALIASES = Object.freeze(["horwich", "st mary", "st. mary", "hsm"]);

export const SUN_TEAMS = Object.freeze(["lionesses", "sunday 1sts", "sunday firsts"]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalise(value) {
  return clean(value).toLowerCase().replace(/[.'’]/g, "");
}

function aliases(values = DEFAULT_CLUB_ALIASES) {
  const source = Array.isArray(values) ? values : String(values || "").split(",");
  const cleaned = source.map(normalise).filter(Boolean);
  return cleaned.length ? cleaned : [...DEFAULT_CLUB_ALIASES];
}

export function isHSMHome(teamName, clubAliases = DEFAULT_CLUB_ALIASES) {
  const candidate = normalise(teamName);
  return aliases(clubAliases).some((keyword) => candidate.includes(keyword));
}

export function parseFullTimeDate(value) {
  const text = clean(value);
  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  const iso = `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : iso;
}

function rowFixture(cells = []) {
  const values = cells.map(clean);
  const versusIndex = values.findIndex((value) => /^(?:v|vs|v\.|-)$/i.test(value));
  const dateCell = values.find((value) => parseFullTimeDate(value));
  if (versusIndex < 0 || !dateCell) return null;

  const home = values.slice(0, versusIndex).reverse().find((value) =>
    value && value !== dateCell && !/^\d{1,2}:\d{2}$/.test(value) && !parseFullTimeDate(value)
  );
  const away = values.slice(versusIndex + 1).find(Boolean);
  if (!home || !away) return null;

  const time = dateCell.match(/\b(\d{1,2}:\d{2})\b/)?.[1]
    || values.find((value) => /^\d{1,2}:\d{2}$/.test(value))
    || "";
  const type = values[0] === dateCell ? "" : values[0];
  const statusText = values.join(" ").toLowerCase();

  return {
    homeTeam: home,
    awayTeam: away,
    date: parseFullTimeDate(dateCell),
    kickOff: time,
    type,
    isCup: /\bcup\b/i.test(type),
    status: /postponed|cancelled|canceled|abandoned/.test(statusText) ? "postponed" : "active",
  };
}

export function getFullTimeFixtureKey(fixture = {}) {
  return [fixture.date, normalise(fixture.homeTeam), normalise(fixture.awayTeam), fixture.kickOff].join("|");
}

export function deduplicateFullTimeFixtures(fixtures = []) {
  const seen = new Set();
  return fixtures.filter((fixture) => {
    const key = fixture.sourceFixtureKey || getFullTimeFixtureKey(fixture);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseFullTimeHtml(html, targetDate, options = {}) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const target = parseFullTimeDate(targetDate) || String(targetDate || "").slice(0, 10);
  const clubAliases = options.clubAliases || options.teamAliases || DEFAULT_CLUB_ALIASES;
  const out = [];

  doc.querySelectorAll("table tr").forEach((row) => {
    const cells = [...row.querySelectorAll("td")].map((cell) => cell.textContent);
    const parsed = rowFixture(cells);
    if (!parsed || (target && parsed.date !== target) || !isHSMHome(parsed.homeTeam, clubAliases)) return;

    const fixture = {
      ...parsed,
      referee: "",
      refPhone: "",
      refStatus: "TBC",
      league: options.sourceId || "",
      sourceId: options.sourceId || "",
      sourceName: options.sourceName || "Full-Time FA",
      sourceUrl: options.sourceUrl || "",
    };
    fixture.sourceFixtureKey = getFullTimeFixtureKey(fixture);
    out.push(fixture);
  });

  return deduplicateFullTimeFixtures(out);
}
