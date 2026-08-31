import { useCallback, useMemo } from "react";
import { getFixtureDayDefinition, normaliseFixtureDayKey } from "../lib/domain/fixtureDay.js";
import { parseFullTimeHtml, SUN_TEAMS } from "../lib/fullTimeParser.js";
import { loadFullTimeFeedHtml, normaliseFullTimeFeedId } from "../lib/fullTimeFeed.js";
import { deduplicateFixtureSet as deduplicateBySourceIdentity } from "../lib/domain/fixtureVenueFlow.js";

function clean(value) {
  return String(value || "").trim();
}

function matchupIdentity(fixture = {}) {
  return [clean(fixture.homeTeam).toLowerCase(), clean(fixture.awayTeam).toLowerCase()].join("|");
}

function sourceFixtureIdentity(fixture = {}) {
  const value = fixture.sourceFixtureUrl ? `url:${clean(fixture.sourceFixtureUrl).toLowerCase()}` : (fixture.sourceFixtureKey || fixture.fixtureId || fixture.fullTimeId || fixture.id);
  return value == null || !clean(value) ? "" : clean(value);
}

function mergeFixtureRecords(current = {}, incoming = {}) {
  const merged = { ...current };
  Object.entries(incoming).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") merged[key] = value;
  });
  return merged;
}

export const deduplicateFixtureSet = deduplicateBySourceIdentity;

const REVIEW_FIELDS = Object.freeze(["date", "kickOff", "venue", "referee", "status"]);

export function reconcileFullTimeFixtureSnapshot(previous = [], incoming = [], today = new Date().toISOString().slice(0, 10), ignoredKeys = []) {
  const retained = previous.filter((fixture) => fixture?.date >= today);
  const ignored = new Set(ignoredKeys);
  const changes = [];
  const snapshot = retained.slice();
  incoming.filter((fixture) => fixture?.date >= today).forEach((fixture) => {
    const sourceIdentity = sourceFixtureIdentity(fixture);
    let currentIndex = sourceIdentity
      ? snapshot.findIndex((candidate) => sourceFixtureIdentity(candidate) === sourceIdentity || (fixture.sourceFixtureUrl && clean(candidate.sourceFixtureUrl).toLowerCase() === clean(fixture.sourceFixtureUrl).toLowerCase()))
      : -1;
    const matchup = matchupIdentity(fixture);
    if (currentIndex < 0) {
      const candidates = snapshot
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => matchupIdentity(candidate) === matchup);
      currentIndex = candidates.length === 1 ? candidates[0].index : -1;
    }
    const current = currentIndex >= 0 ? snapshot[currentIndex] : null;
    if (!current) {
      snapshot.push(fixture);
      return;
    }
    const fields = REVIEW_FIELDS.filter((field) => clean(current[field]) !== clean(fixture[field]));
    if (!fields.length) {
      snapshot[currentIndex] = mergeFixtureRecords(current, fixture);
      return;
    }
    const key = `${matchup}|${fields.map((field) => `${field}:${clean(current[field])}>${clean(fixture[field])}`).join("|")}`;
    if (!ignored.has(key)) changes.push({ key, fields, before: current, after: fixture });
    else snapshot[currentIndex] = mergeFixtureRecords(current, fixture);
  });
  return {
    snapshot: deduplicateBySourceIdentity(snapshot).sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.kickOff).localeCompare(String(b.kickOff))),
    changes,
  };
}

export function mergeFullTimeFixtureSnapshot(previous = [], incoming = [], today = new Date().toISOString().slice(0, 10)) {
  return reconcileFullTimeFixtureSnapshot(previous, incoming, today).snapshot;
}

export function normaliseFixtureSource(source = {}, index = 0) {
  const url = clean(source.url || source.sourceUrl);
  const feedId = normaliseFullTimeFeedId(source.feedId || url);
  if ((!url && !feedId) || source.enabled === false) return null;
  const teamAliases = Array.isArray(source.teamAliases)
    ? source.teamAliases.map(clean).filter(Boolean)
    : clean(source.teamAliases).split(",").map(clean).filter(Boolean);
  if (feedId === "167398131" && !teamAliases.some((alias) => alias.toLowerCase() === "horwich")) teamAliases.push("Horwich");

  return {
    id: clean(source.id || source.clubId || `FULLTIME-${index + 1}`),
    name: feedId === "167398131" ? "BBDFL U14 - Horwich St. Mary's fixtures" : clean(source.name || `Full-Time source ${index + 1}`),
    url,
    feedId,
    clubId: clean(source.clubId),
    teamAliases,
    fixtureSnapshot: Array.isArray(source.fixtureSnapshot) ? source.fixtureSnapshot : [],
    ignoredChangeKeys: Array.isArray(source.ignoredChangeKeys) ? source.ignoredChangeKeys : [],
  };
}

export function getConfiguredFixtureSources(config = {}) {
  if (!config || config.enabled !== true || config.mode === "manual") return [];
  const configured = Array.isArray(config.sources)
    ? config.sources.map(normaliseFixtureSource).filter(Boolean)
    : [];
  const legacy = normaliseFixtureSource(config, configured.length);
  if (legacy && !configured.some((source) => source.url === legacy.url)) configured.unshift(legacy);
  return configured.filter((source, index, all) => all.findIndex((item) =>
    (source.feedId && item.feedId === source.feedId) || (!source.feedId && item.url === source.url)
  ) === index);
}

export function hasConfiguredFixtureSource(config = {}) {
  return getConfiguredFixtureSources(config).length > 0;
}

async function fetchLeagueFixtures(source) {
  if (source.feedId) {
    const contents = await loadFullTimeFeedHtml(source.feedId);
    return parseFullTimeHtml(contents, "", {
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: `https://fulltime.thefa.com/js/cs1.html?cs=${source.feedId}`,
      teamAliases: source.teamAliases,
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api/full-time?source=${encodeURIComponent(source.url)}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Full-Time returned HTTP ${response.status}`);
    if (!data.contents) throw new Error("Full-Time returned an empty fixture page.");
    return parseFullTimeHtml(data.contents, "", {
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.url,
      teamAliases: source.teamAliases,
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Full-Time did not respond within 15 seconds.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isSundayTeam(fixture = {}) {
  const clubTeam = clean(fixture.clubTeamName || fixture.homeTeam).toLowerCase();
  return SUN_TEAMS.some((keyword) => clubTeam.includes(keyword));
}

export function useFixtureFetcher(fixtureSourceConfig = {}) {
  const fixtureSources = useMemo(() => getConfiguredFixtureSources(fixtureSourceConfig), [fixtureSourceConfig]);

  const fetchFixturesForDate = useCallback(async (targetDate, predicate = null) => {
    if (!fixtureSources.length) {
      return { statuses: [], fixtures: [], skipped: true, reason: "fixture_source_not_configured" };
    }

    const results = await Promise.all(fixtureSources.map(async (source) => {
      try {
        const imported = await fetchLeagueFixtures(source);
        const reconciliation = reconcileFullTimeFixtureSnapshot(source.fixtureSnapshot, imported, undefined, source.ignoredChangeKeys);
        const snapshot = reconciliation.snapshot;
        const fixtures = snapshot.filter((fixture) => fixture.date === targetDate).filter((fixture) =>
          typeof predicate === "function" ? predicate(fixture) : true
        );
        return { source, fixtures, snapshot, changes: reconciliation.changes, status: { id: source.id, name: source.name, ok: true, count: fixtures.length, snapshotCount: snapshot.length, changeCount: reconciliation.changes.length } };
      } catch (error) {
        return { source, fixtures: [], status: { id: source.id, name: source.name, ok: false, error: error.message, count: 0 } };
      }
    }));

    const statuses = results.map((result) => result.status);
    if (!statuses.some((status) => status.ok)) {
      const failure = new Error(statuses.map((status) => `${status.name}: ${status.error}`).join(" "));
      failure.code = "FULL_TIME_ALL_SOURCES_FAILED";
      failure.statuses = statuses;
      throw failure;
    }

    return {
      statuses,
      fixtures: deduplicateBySourceIdentity(results.flatMap((result) => result.fixtures)),
      snapshots: results.filter((result) => result.status.ok).map((result) => ({ id: result.source.id, fixtures: result.snapshot })),
      changes: results.filter((result) => result.status.ok && result.changes.length).map((result) => ({ id: result.source.id, changes: result.changes })),
      skipped: false,
      partial: statuses.some((status) => !status.ok),
    };
  }, [fixtureSources]);

  const fetchFixtureDayFixtures = useCallback(async (fixtureDayOrKey, suppliedDate = "") => {
    const key = normaliseFixtureDayKey(typeof fixtureDayOrKey === "string" ? fixtureDayOrKey : fixtureDayOrKey?.key);
    const definition = getFixtureDayDefinition(key);
    const targetDate = suppliedDate || (typeof fixtureDayOrKey === "object" ? fixtureDayOrKey?.date : "");
    let predicate = null;
    if (definition.fetchStrategy === "saturday") predicate = (fixture) => !isSundayTeam(fixture);
    else if (definition.fetchStrategy === "sunday") predicate = isSundayTeam;
    const result = await fetchFixturesForDate(targetDate, predicate);
    return {
      ...result,
      fixtures: result.fixtures.map((fixture) => ({ ...fixture, fixtureDayKey: key, __day: key })),
      fixtureDayKey: key,
    };
  }, [fetchFixturesForDate]);

  return {
    fetchFixturesForDate,
    fetchFixtureDayFixtures,
    fetchSaturdayFixtures: (date) => fetchFixtureDayFixtures("saturday", date),
    fetchSundayFixtures: (date) => fetchFixtureDayFixtures("sunday", date),
    fetchMidweekFixtures: (date) => fetchFixtureDayFixtures("midweek", date),
    fixtureSources,
    fixtureSourceEnabled: fixtureSources.length > 0,
  };
}
