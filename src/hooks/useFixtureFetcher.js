import { useCallback, useMemo } from "react";
import { getFixtureDayDefinition, normaliseFixtureDayKey } from "../lib/domain/fixtureDay.js";
import { deduplicateFullTimeFixtures, parseFullTimeHtml, SUN_TEAMS } from "../lib/fullTimeParser.js";

function clean(value) {
  return String(value || "").trim();
}

export function normaliseFixtureSource(source = {}, index = 0) {
  const url = clean(source.url || source.sourceUrl);
  if (!url || source.enabled === false) return null;
  const teamAliases = Array.isArray(source.teamAliases)
    ? source.teamAliases.map(clean).filter(Boolean)
    : clean(source.teamAliases).split(",").map(clean).filter(Boolean);

  return {
    id: clean(source.id || source.clubId || `FULLTIME-${index + 1}`),
    name: clean(source.name || `Full-Time source ${index + 1}`),
    url,
    clubId: clean(source.clubId),
    teamAliases,
  };
}

export function getConfiguredFixtureSources(config = {}) {
  if (!config || config.enabled !== true || config.mode === "manual") return [];
  const configured = Array.isArray(config.sources)
    ? config.sources.map(normaliseFixtureSource).filter(Boolean)
    : [];
  const legacy = normaliseFixtureSource(config, configured.length);
  if (legacy && !configured.some((source) => source.url === legacy.url)) configured.unshift(legacy);
  return configured.filter((source, index, all) => all.findIndex((item) => item.url === source.url) === index);
}

export function hasConfiguredFixtureSource(config = {}) {
  return getConfiguredFixtureSources(config).length > 0;
}

async function fetchLeagueFixtures(source, targetDate) {
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
    return parseFullTimeHtml(data.contents, targetDate, {
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
  const homeTeam = clean(fixture.homeTeam).toLowerCase();
  return SUN_TEAMS.some((keyword) => homeTeam.includes(keyword));
}

export function useFixtureFetcher(fixtureSourceConfig = {}) {
  const fixtureSources = useMemo(() => getConfiguredFixtureSources(fixtureSourceConfig), [fixtureSourceConfig]);

  const fetchFixturesForDate = useCallback(async (targetDate, predicate = null) => {
    if (!fixtureSources.length) {
      return { statuses: [], fixtures: [], skipped: true, reason: "fixture_source_not_configured" };
    }

    const results = await Promise.all(fixtureSources.map(async (source) => {
      try {
        const fixtures = (await fetchLeagueFixtures(source, targetDate)).filter((fixture) =>
          typeof predicate === "function" ? predicate(fixture) : true
        );
        return { source, fixtures, status: { id: source.id, name: source.name, ok: true, count: fixtures.length } };
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
      fixtures: deduplicateFullTimeFixtures(results.flatMap((result) => result.fixtures)),
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
