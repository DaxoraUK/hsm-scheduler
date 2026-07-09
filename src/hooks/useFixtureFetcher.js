import { useCallback, useMemo } from "react";
import { getFixtureDayDefinition, normaliseFixtureDayKey } from "../lib/domain/fixtureDay.js";
import { parseFullTimeHtml, SUN_TEAMS } from "../lib/fullTimeParser.js";

const PROXY = "https://api.allorigins.win/get?url=";

function normaliseSource(source = {}, index = 0) {
  const url = String(source.url || source.sourceUrl || "").trim();
  if (!url || source.enabled === false) return null;

  return {
    id: String(source.id || source.clubId || `FULLTIME-${index + 1}`),
    name: String(source.name || "Full-Time FA"),
    url,
  };
}

export function getConfiguredFixtureSources(config = {}) {
  if (!config || config.enabled !== true || config.mode === "manual") return [];

  const configured = Array.isArray(config.sources)
    ? config.sources.map(normaliseSource).filter(Boolean)
    : [];

  const primary = normaliseSource(config, configured.length);
  if (primary && !configured.some((source) => source.url === primary.url)) {
    configured.unshift(primary);
  }

  return configured;
}

export function hasConfiguredFixtureSource(config = {}) {
  return getConfiguredFixtureSources(config).length > 0;
}

async function fetchLeagueFixtures(source, targetDate) {
  const response = await fetch(PROXY + encodeURIComponent(source.url));

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return parseFullTimeHtml(data.contents, targetDate).map((fixture) => ({
    ...fixture,
    league: source.id,
  }));
}

function isSundayTeam(fixture = {}) {
  const homeTeam = String(fixture.homeTeam || "").toLowerCase();
  return SUN_TEAMS.some((keyword) => homeTeam.includes(keyword));
}

export function useFixtureFetcher(fixtureSourceConfig = {}) {
  const fixtureSources = useMemo(
    () => getConfiguredFixtureSources(fixtureSourceConfig),
    [fixtureSourceConfig]
  );

  const fetchFixturesForDate = useCallback(async (targetDate, predicate = null) => {
    const statuses = [];
    const fixtures = [];

    if (!fixtureSources.length) {
      return { statuses, fixtures, skipped: true, reason: "fixture_source_not_configured" };
    }

    await Promise.all(
      fixtureSources.map(async (source) => {
        try {
          const found = (await fetchLeagueFixtures(source, targetDate)).filter((fixture) =>
            typeof predicate === "function" ? predicate(fixture) : true
          );

          statuses.push({
            id: source.id,
            name: source.name,
            ok: true,
            count: found.length,
          });

          fixtures.push(...found);
        } catch (error) {
          statuses.push({
            id: source.id,
            name: source.name,
            ok: false,
            error: error.message,
            count: 0,
          });
        }
      })
    );

    return { statuses, fixtures, skipped: false };
  }, [fixtureSources]);

  const fetchFixtureDayFixtures = useCallback(
    async (fixtureDayOrKey, suppliedDate = "") => {
      const key = normaliseFixtureDayKey(
        typeof fixtureDayOrKey === "string" ? fixtureDayOrKey : fixtureDayOrKey?.key
      );
      const definition = getFixtureDayDefinition(key);
      const targetDate =
        suppliedDate ||
        (typeof fixtureDayOrKey === "object" ? fixtureDayOrKey?.date : "");

      let predicate = null;
      if (definition.fetchStrategy === "saturday") {
        predicate = (fixture) => !isSundayTeam(fixture);
      } else if (definition.fetchStrategy === "sunday") {
        predicate = isSundayTeam;
      }

      const result = await fetchFixturesForDate(targetDate, predicate);
      return {
        ...result,
        fixtures: result.fixtures.map((fixture) => ({
          ...fixture,
          fixtureDayKey: key,
          __day: key,
        })),
        fixtureDayKey: key,
      };
    },
    [fetchFixturesForDate]
  );

  const fetchSaturdayFixtures = useCallback(
    (satDate) => fetchFixtureDayFixtures("saturday", satDate),
    [fetchFixtureDayFixtures]
  );

  // Compatibility wrapper keeps the older array-only Sunday return shape.
  const fetchSundayFixtures = useCallback(
    async (sunDate) => {
      const { fixtures } = await fetchFixtureDayFixtures("sunday", sunDate);
      return fixtures;
    },
    [fetchFixtureDayFixtures]
  );

  const fetchMidweekFixtures = useCallback(
    (midweekDate) => fetchFixtureDayFixtures("midweek", midweekDate),
    [fetchFixtureDayFixtures]
  );

  return {
    fetchFixturesForDate,
    fetchFixtureDayFixtures,
    fetchSaturdayFixtures,
    fetchSundayFixtures,
    fetchMidweekFixtures,
    fixtureSourceEnabled: fixtureSources.length > 0,
  };
}
