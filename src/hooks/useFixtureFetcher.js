import { useCallback } from "react";
import { FA_LEAGUES } from "../lib/constants.js";
import { parseFullTimeHtml, SUN_TEAMS } from "../lib/fullTimeParser.js";

const PROXY = "https://api.allorigins.win/get?url=";

export function useFixtureFetcher() {
  const fetchSaturdayFixtures = useCallback(async (satDate) => {
    const statuses = [];
    const fixtures = [];

    await Promise.all(
      FA_LEAGUES.map(async (league) => {
        try {
          const res = await fetch(PROXY + encodeURIComponent(league.url));

          if (!res.ok) {
            throw new Error("HTTP " + res.status);
          }

          const data = await res.json();

          const found = parseFullTimeHtml(data.contents, satDate).filter(
            (fixture) =>
              !SUN_TEAMS.some((keyword) =>
                fixture.homeTeam.toLowerCase().includes(keyword)
              )
          );

          statuses.push({
            id: league.id,
            name: league.name,
            ok: true,
            count: found.length,
          });

          fixtures.push(
            ...found.map((fixture) => ({
              ...fixture,
              league: league.id,
            }))
          );
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

  const fetchSundayFixtures = useCallback(async (sunDate) => {
    const fixtures = [];

    await Promise.all(
      FA_LEAGUES.map(async (league) => {
        try {
          const res = await fetch(PROXY + encodeURIComponent(league.url));
          const data = await res.json();

          const found = parseFullTimeHtml(data.contents, sunDate).filter(
            (fixture) =>
              SUN_TEAMS.some((keyword) =>
                fixture.homeTeam.toLowerCase().includes(keyword)
              )
          );

          fixtures.push(
            ...found.map((fixture) => ({
              ...fixture,
              league: league.id,
            }))
          );
        } catch (error) {}
      })
    );

    return fixtures;
  }, []);

  return {
    fetchSaturdayFixtures,
    fetchSundayFixtures,
  };
}