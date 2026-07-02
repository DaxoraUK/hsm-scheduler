/**
 * Timeline Engine v2
 *
 * Owns all matchday timeline positioning. UI components should render the
 * output from this engine rather than calculating fixture positions locally.
 * This prevents Dashboard/Operations timelines drifting apart visually and
 * gives us one place to improve future drag/drop behaviour.
 */

import { cleanName } from "../scheduler.js";
import { sortPitches } from "../pitches.js";

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 16 * 60;
const MIN_RANGE = 60;
const MIN_VISUAL_WIDTH_PCT = 9;
const MIN_VISUAL_GAP_PCT = 1.15;
const TIMELINE_PADDING_MINS = 30;

export function buildMatchdayTimeline({
  games = [],
  pitchCfg = [],
  club = null,
  startMins = null,
  endMins = null,
  includeEmptyPitches = false,
  padRange = true,
} = {}) {
  const fixtures = normaliseTimelineGames(games, club);

  const earliest = fixtures.length
    ? Math.min(...fixtures.map((game) => game.koMins))
    : DEFAULT_START;
  const latest = fixtures.length
    ? Math.max(...fixtures.map((game) => game.endMins))
    : DEFAULT_END;

  const computedStart =
    Number.isFinite(startMins) && startMins != null
      ? startMins
      : fixtures.length
        ? Math.floor((earliest - (padRange ? TIMELINE_PADDING_MINS : 0)) / 30) * 30
        : DEFAULT_START;

  const computedEnd =
    Number.isFinite(endMins) && endMins != null
      ? endMins
      : fixtures.length
        ? Math.ceil((latest + (padRange ? TIMELINE_PADDING_MINS : 0)) / 30) * 30
        : DEFAULT_END;

  const start = Math.max(0, computedStart);
  const end = Math.max(start + MIN_RANGE, computedEnd);
  const range = Math.max(end - start, MIN_RANGE);
  const ticks = buildTimelineTicks(start, end);
  const halfHourTicks = buildTimelineTicks(start, end, 30).filter(
    (tick) => tick.value % 60 !== 0
  );

  const sortedPitches = sortPitches(pitchCfg || []);

  const rows = sortedPitches
    .map((pitch) => {
      const pitchFixtures = fixtures
        .filter((game) => game.pitchId === pitch.id)
        .sort((a, b) => a.koMins - b.koMins || a.endMins - b.endMins);

      if (!includeEmptyPitches && pitchFixtures.length === 0) {
        return null;
      }

      const positionedFixtures = allocateTimelineLanes(
        pitchFixtures.map((fixture) => {
          const rawLeft = ((fixture.koMins - start) / range) * 100;
          const rawWidth = ((fixture.endMins - fixture.koMins) / range) * 100;

          return {
            ...fixture,
            leftPct: clamp(rawLeft, 0, 100),
            widthPct: clamp(Math.max(rawWidth, MIN_VISUAL_WIDTH_PCT), 5, 100),
            durationMins: Math.max(0, fixture.endMins - fixture.koMins),
          };
        })
      );

      return {
        pitch,
        fixtures: positionedFixtures,
        hasFixtures: positionedFixtures.length > 0,
        laneCount: Math.max(
          1,
          positionedFixtures.reduce((max, item) => Math.max(max, item.lane + 1), 1)
        ),
      };
    })
    .filter(Boolean);

  return {
    start,
    end,
    range,
    ticks,
    halfHourTicks,
    rows,
    fixtureCount: fixtures.length,
    hasFixtures: fixtures.length > 0,
  };
}

export function normaliseTimelineGames(games = [], club = null) {
  return (games || [])
    .filter(
      (game) =>
        game &&
        game.status !== "postponed" &&
        Number.isFinite(game.koMins) &&
        Number.isFinite(game.endMins)
    )
    .map((game, index) => ({
      id:
        game.id ||
        game.fixtureId ||
        `${game.pitchId || "pitch"}-${game.koMins}-${game.homeTeam || "home"}-${index}`,
      source: game,
      pitchId: game.pitchId,
      koMins: game.koMins,
      endMins: game.endMins,
      koTime: game.koTime || formatTimelineTime(game.koMins),
      endTime: game.endTime || formatTimelineTime(game.endMins),
      title: cleanName(game.homeTeam, club?.name),
      opposition: game.awayTeam || "TBC",
      status: game.status || "scheduled",
      usingFallback: Boolean(game.usingFallback),
      usingAstro: Boolean(game.usingAstro),
      usingAlt: Boolean(game.usingAlt),
      cars: Number(game.cars || game.estimatedCars || 0),
      official: game.official || game.referee || "TBC",
      format: game.format || game.pitchFormat || "Fixture",
    }));
}

export function allocateTimelineLanes(fixtures = []) {
  const lanes = [];

  return fixtures.map((fixture) => {
    let lane = lanes.findIndex((laneEndPct) => fixture.leftPct >= laneEndPct);

    if (lane === -1) {
      lane = lanes.length;
      lanes.push(0);
    }

    lanes[lane] = fixture.leftPct + fixture.widthPct + MIN_VISUAL_GAP_PCT;

    return {
      ...fixture,
      lane,
    };
  });
}

export function getTimelineFixtureTone(fixture = {}) {
  if (fixture.usingFallback) return "emergency";
  if (fixture.usingAstro) return "astro";
  if (fixture.usingAlt) return "alternative";
  return "preferred";
}

export function buildTimelineTicks(start, end, interval = 60) {
  const ticks = [];
  const first = Math.floor(start / interval) * interval;
  const last = Math.ceil(end / interval) * interval;

  for (let mins = first; mins <= last; mins += interval) {
    ticks.push({
      value: mins,
      label: formatTimelineTime(mins),
    });
  }

  return ticks;
}

export function formatTimelineTime(totalMins) {
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}


export function buildOperationsTimeline({
  saturdayGames = [],
  sundayGames = [],
  club = null,
  carCap = 0,
  refs = [],
  refWarnings = [],
  closedPitches = {},
  satHasRun = false,
  sunHasRun = false,
} = {}) {
  const combined = [
    ...normaliseOperationsGames(saturdayGames, "Saturday", club),
    ...normaliseOperationsGames(sundayGames, "Sunday", club),
  ].sort((a, b) => a.timeMins - b.timeMins || a.sortOrder - b.sortOrder);

  const fixtureEvents = combined.map((game) => ({
    id: `fixture-${game.day}-${game.id}`,
    type: "fixture",
    tone: getOperationsEventTone(game),
    title: `${game.koTime} ${game.title}`,
    description: `${game.day} • ${game.pitchLabel || game.pitchId || "Pitch TBC"} • v ${game.opposition}`,
    time: game.koTime,
    timeMins: game.timeMins,
    day: game.day,
    meta: [game.format, game.official ? `Official: ${game.official}` : null].filter(Boolean),
    source: game.source,
  }));

  const earliestFixture = combined.length ? Math.min(...combined.map((game) => game.timeMins)) : 9 * 60;
  const latestFixture = combined.length ? Math.max(...combined.map((game) => game.endMins)) : 15 * 60;
  const peakCars = combined.reduce((sum, game) => sum + Number(game.cars || 0), 0);
  const closedPitchCount = Object.values(closedPitches || {}).filter(Boolean).length;
  const officialShortage = Array.isArray(refWarnings) ? refWarnings.length : 0;

  const operationalEvents = [
    {
      id: "site-open",
      type: "site",
      tone: "neutral",
      title: "Grounds open",
      description: "Prepare pitch checks, signage, parking flow and first volunteer arrivals.",
      time: formatTimelineTime(Math.max(6 * 60, earliestFixture - 90)),
      timeMins: Math.max(6 * 60, earliestFixture - 90),
      day: "Operations",
      meta: ["Site readiness"],
    },
    {
      id: "volunteer-briefing",
      type: "people",
      tone: officialShortage ? "warning" : "positive",
      title: officialShortage ? "Volunteer and official pressure" : "Volunteer briefing",
      description: officialShortage
        ? `${officialShortage} official warning${officialShortage === 1 ? "" : "s"} need attention before kick-off.`
        : "Brief coaches, parking helpers and matchday volunteers before arrivals build.",
      time: formatTimelineTime(Math.max(6 * 60, earliestFixture - 45)),
      timeMins: Math.max(6 * 60, earliestFixture - 45),
      day: "Operations",
      meta: [refs?.length ? `${refs.length} officials listed` : "Officials TBC"],
    },
    {
      id: "arrival-peak",
      type: "parking",
      tone: carCap && peakCars > carCap ? "critical" : peakCars > carCap * 0.8 ? "warning" : "positive",
      title: "Arrival pressure window",
      description: carCap
        ? `${peakCars} estimated car movements against ${carCap} available spaces across scheduled fixtures.`
        : `${peakCars} estimated car movements. Add venue capacity to improve parking intelligence.`,
      time: formatTimelineTime(Math.max(6 * 60, earliestFixture - 20)),
      timeMins: Math.max(6 * 60, earliestFixture - 20),
      day: "Operations",
      meta: ["Parking", carCap ? `${Math.round((peakCars / Math.max(carCap, 1)) * 100)}% capacity` : "Capacity missing"],
    },
    {
      id: "pitch-risk",
      type: "facility",
      tone: closedPitchCount ? "warning" : "positive",
      title: closedPitchCount ? "Pitch closure impact" : "Pitch availability clear",
      description: closedPitchCount
        ? `${closedPitchCount} pitch${closedPitchCount === 1 ? " is" : "es are"} closed. Keep an eye on manual changes and fallback allocations.`
        : "No closed pitches currently recorded for the matchday workspace.",
      time: formatTimelineTime(Math.max(6 * 60, earliestFixture - 30)),
      timeMins: Math.max(6 * 60, earliestFixture - 30),
      day: "Operations",
      meta: ["Facilities"],
    },
    {
      id: "site-close",
      type: "site",
      tone: "neutral",
      title: "Site close-down",
      description: "Check pitch condition, incidents, equipment, clubhouse handover and communications follow-up.",
      time: formatTimelineTime(Math.min(22 * 60, latestFixture + 45)),
      timeMins: Math.min(22 * 60, latestFixture + 45),
      day: "Operations",
      meta: ["Close-down"],
    },
  ];

  const events = [...operationalEvents, ...fixtureEvents].sort(
    (a, b) => a.timeMins - b.timeMins || String(a.title).localeCompare(String(b.title))
  );

  const criticalCount = events.filter((event) => event.tone === "critical").length;
  const warningCount = events.filter((event) => event.tone === "warning").length;
  const fixtureCount = combined.length;

  return {
    events,
    fixtureCount,
    criticalCount,
    warningCount,
    hasFixtures: fixtureCount > 0,
    status:
      criticalCount > 0
        ? "Needs control-room attention"
        : warningCount > 0
          ? "Watchlist active"
          : fixtureCount > 0
            ? "Timeline ready"
            : "Waiting for schedules",
    summary: {
      saturday: satHasRun ? saturdayGames.filter((game) => game.status !== "postponed").length : 0,
      sunday: sunHasRun ? sundayGames.filter((game) => game.status !== "postponed").length : 0,
      parking: peakCars,
      officials: refs?.length || 0,
    },
  };
}

function normaliseOperationsGames(games = [], day = "Matchday", club = null) {
  return (games || [])
    .filter((game) => game && game.status !== "postponed" && Number.isFinite(game.koMins))
    .map((game, index) => ({
      id:
        game.id ||
        game.fixtureId ||
        `${day}-${game.pitchId || "pitch"}-${game.koMins}-${game.homeTeam || "home"}-${index}`,
      source: game,
      sortOrder: index,
      day,
      pitchId: game.pitchId,
      pitchLabel: game.pitchLabel || game.pitchName || game.pitch,
      timeMins: game.koMins,
      endMins: Number.isFinite(game.endMins) ? game.endMins : game.koMins + 60,
      koTime: game.koTime || formatTimelineTime(game.koMins),
      title: cleanName(game.homeTeam, club?.name),
      opposition: game.awayTeam || "TBC",
      official: game.official || game.referee || "TBC",
      format: game.format || game.pitchFormat || "Fixture",
      cars: Number(game.cars || game.estimatedCars || 0),
      usingFallback: Boolean(game.usingFallback),
      usingAstro: Boolean(game.usingAstro),
      usingAlt: Boolean(game.usingAlt),
      fixedKO: Boolean(game.fixedKO),
    }));
}

function getOperationsEventTone(game = {}) {
  if (game.usingFallback) return "critical";
  if (game.usingAstro || game.usingAlt || game.fixedKO) return "warning";
  return "positive";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
