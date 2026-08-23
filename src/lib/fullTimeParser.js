const DEFAULT_CLUB_ALIASES = Object.freeze(["horwich", "st mary", "st. mary", "hsm"]);

export const SUN_TEAMS = Object.freeze(["lionesses", "sunday 1sts", "sunday firsts"]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalise(value) {
  return clean(value).toLowerCase().replace(/[.'’]/g, "");
}

function normaliseProviderName(value) {
  return clean(value).toLowerCase().replace(/\\+['’]?/g, "").replace(/[.'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function aliases(values = DEFAULT_CLUB_ALIASES) {
  const source = Array.isArray(values) ? values : String(values || "").split(",");
  const cleaned = source.map(normaliseProviderName).filter(Boolean);
  return cleaned.length ? cleaned : [...DEFAULT_CLUB_ALIASES];
}

function fullTimeFixtureUrl(row) {
  const href = row?.querySelector("a[href*='displayFixture']")?.getAttribute("href") || "";
  if (!href) return "";
  try {
    const url = new URL(href, "https://fulltime.thefa.com/");
    if (!["fulltime.thefa.com", "www.fulltime.thefa.com"].includes(url.hostname.toLowerCase())) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function isHSMHome(teamName, clubAliases = DEFAULT_CLUB_ALIASES) {
  const candidate = normaliseProviderName(teamName);
  return aliases(clubAliases).some((keyword) => candidate.includes(keyword));
}

export function parseFullTimeDate(value) {
  const text = clean(value);
  const match = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  const named = text.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{2,4})\b/i);
  if (!match && !named) return "";
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const day = match?.[1] || named[1];
  const month = match?.[2] || String(monthNames.indexOf(named[2].slice(0, 3).toLowerCase()) + 1);
  const rawYear = match?.[3] || named[3];
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? "" : iso;
}

function rowFixture(cells = [], groupedDate = "", columns = {}) {
  const values = cells.map(clean);
  const versusIndex = values.findIndex((value) => /^(?:v|vs|v\.|-)$/i.test(value));
  const dateCell = values.find((value) => parseFullTimeDate(value)) || groupedDate;
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
  const venue = columns.venueIndex >= 0 ? values[columns.venueIndex] : values[versusIndex + 2] || "";
  const referee = columns.refereeIndex >= 0 ? values[columns.refereeIndex] : "";

  return {
    homeTeam: home,
    awayTeam: away,
    date: parseFullTimeDate(dateCell),
    kickOff: time,
    venue,
    referee,
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

  doc.querySelectorAll("table").forEach((table) => {
    let groupedDate = "";
    const headers = [...table.querySelectorAll("tr th")].map((cell) => clean(cell.textContent).toLowerCase());
    const columns = {
      venueIndex: headers.findIndex((header) => /venue|ground/.test(header)),
      refereeIndex: headers.findIndex((header) => /referee|match official|official/.test(header)),
    };
    table.querySelectorAll("tr").forEach((row) => {
      const cells = [...row.querySelectorAll("td")].map((cell) => cell.textContent);
      const rowText = clean(row.textContent);
      if (cells.length <= 1 && parseFullTimeDate(rowText)) {
        groupedDate = rowText;
        return;
      }
      const parsed = rowFixture(cells, groupedDate, columns);
      if (!parsed || (target && parsed.date !== target) || !isHSMHome(parsed.homeTeam, clubAliases)) return;

      const fixture = {
        ...parsed,
        referee: parsed.referee || "",
        refPhone: "",
        refStatus: parsed.referee ? "assigned" : "TBC",
        league: options.sourceId || "",
        sourceId: options.sourceId || "",
        sourceName: options.sourceName || "Full-Time FA",
        sourceUrl: options.sourceUrl || "",
        sourceFixtureUrl: fullTimeFixtureUrl(row),
      };
      fixture.sourceFixtureKey = getFullTimeFixtureKey(fixture);
      out.push(fixture);
    });
  });

  return deduplicateFullTimeFixtures(out);
}
