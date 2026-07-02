import { useCallback } from "react";
import { FA_LEAGUES } from "../lib/constants.js";
import { getFixtureDayDefinition, normaliseFixtureDayKey } from "../lib/domain/fixtureDay.js";
import { parseFullTimeHtml, SUN_TEAMS } from "../lib/fullTimeParser.js";

const PROXY = "https://api.allorigins.win/get?url=";

async function fetchLeagueFixtures(league, targetDate) {
  const response = await fetch(PROXY + encodeURIComponent(league.url));

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  return parseFullTimeHtml(data.contents, targetDate).map((fixture) => ({
    ...fixture,
    league: league.id,
  }));
}

function isSundayTeam(fixture = {}) {
  const homeTeam = String(fixture.homeTeam || "").toLowerCase();
  return SUN_TEAMS.some((keyword) => homeTeam.includes(keyword));
}

export function useFixtureFetcher() {
  const fetchFixturesForDate = useCallback(async (targetDate, predicate = null) => {
    const statuses = [];
    const fixtures = [];

    await Promise.all(
      FA_LEAGUES.map(async (league) => {
        try {
          const found = (await fetchLeagueFixtures(league, targetDate)).filter((fixture) =>
            typeof predicate === "function" ? predicate(fixture) : true
          );

          statuses.push({
            id: league.id,
            name: league.name,
            ok: true,
            count: found.length,
          });

          fixtures.push(...found);
        } catch (error) {
          statuses.push({
            id: league.id,
            name: league.name,
            ok: false,
            error: error.message,
            count: 0,
          });
        }
      })
    );

    return { statuses, fixtures };
  }, []);

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
  };
}
