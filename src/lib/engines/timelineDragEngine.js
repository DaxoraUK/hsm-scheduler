import { getOperationsImpact } from "./recommendationEngine.js";
import { getFixtureDuration } from "../operationsEngine.js";
import {
  getPitchDisplayFormat,
  getPitchSuitabilityScore,
  isPitchSuitableForFixture,
} from "../intelligence/pitch/pitchService.js";
import { formatTimelineTime } from "./timelineEngine.js";
import { detectAnnualPlannerConflicts, getMatchdayFixtureSourceId, normaliseAnnualBooking } from "../planning/annualPlannerEngine.js";
import { SCHEDULING_TIME_INCREMENT_MINS } from "../domain/fixtureOccupancy.js";

export const TIMELINE_SNAP_MINUTES = SCHEDULING_TIME_INCREMENT_MINS;
const PARKING_ADVISORY_TYPES = new Set(["parking_capacity", "parking_concurrency"]);

function asClosedPitchSet(closedPitches = []) {
  if (Array.isArray(closedPitches)) {
    return new Set(
      closedPitches
        .map((item) => (typeof item === "string" ? item : item?.pitchId || item?.id))
        .filter(Boolean),
    );
  }

  return new Set(
    Object.entries(closedPitches || {})
      .filter(([, closed]) => Boolean(closed))
      .map(([pitchId]) => pitchId),
  );
}

export function snapTimelineMinutes(value, interval = TIMELINE_SNAP_MINUTES) {
  const numeric = Number(value);
  const safeInterval = Math.max(1, Number(interval) || TIMELINE_SNAP_MINUTES);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric / safeInterval) * safeInterval;
}

export function clampTimelineMinutes(value, start, end, duration = 0) {
  const minimum = Number.isFinite(start) ? Number(start) : 0;
  const maximum = Number.isFinite(end) ? Math.max(minimum, Number(end) - Math.max(0, duration)) : value;
  return Math.min(Math.max(Number(value) || minimum, minimum), maximum);
}

export function getTimelinePitchState({ pitch = {}, fixture = {}, closedPitches = [] } = {}) {
  const closed = asClosedPitchSet(closedPitches).has(pitch.id) || Boolean(pitch.closed || pitch.isClosed);
  const suitable = isPitchSuitableForFixture(pitch, fixture);

  if (closed) {
    return {
      allowed: false,
      tone: "closed",
      label: "Closed",
      reason: `${pitch.label || pitch.id || "Pitch"} is closed for this matchday.`,
    };
  }

  if (!suitable) {
    return {
      allowed: false,
      tone: "unsuitable",
      label: "Unsuitable",
      reason: `${pitch.label || pitch.id || "Pitch"} is not configured for ${fixture.cfg?.format || fixture.manualFormat || fixture.format || "this fixture"}.`,
    };
  }

  return {
    allowed: true,
    tone: "available",
    label: "Available",
    reason: `${pitch.label || pitch.id || "Pitch"} is suitable for this fixture.`,
  };
}

export function rankTimelinePitches({ pitchCfg = [], fixture = {}, closedPitches = [], currentPitchId = "" } = {}) {
  return (pitchCfg || [])
    .map((pitch) => ({
      pitch,
      state: getTimelinePitchState({ pitch, fixture, closedPitches }),
      score: getPitchSuitabilityScore(pitch, fixture, currentPitchId),
      format: getPitchDisplayFormat(pitch),
    }))
    .sort((left, right) => {
      if (left.state.allowed !== right.state.allowed) return left.state.allowed ? -1 : 1;
      return left.score - right.score || String(left.pitch.label || left.pitch.id).localeCompare(String(right.pitch.label || right.pitch.id));
    });
}

export function buildTimelineMovePatch({ fixture = {}, pitch = {}, koMins } = {}) {
  const snappedKo = snapTimelineMinutes(koMins);
  const duration = getFixtureDuration({
    ...fixture,
    koMins: snappedKo,
    koTime: formatTimelineTime(snappedKo),
    endMins: null,
  });
  const endMins = snappedKo + duration;

  return {
    pitchId: pitch.id,
    pitchLabel: pitch.label || pitch.id,
    koMins: snappedKo,
    koTime: formatTimelineTime(snappedKo),
    endMins,
    endTime: formatTimelineTime(endMins),
  };
}

export function buildTimelineMoveCandidate({
  fixtures = [],
  fixtureIndex,
  pitchCfg = [],
  closedPitches = [],
  club = {},
  pitchId,
  koMins,
  start,
  end,
  matchDate = "",
  resourceBookings = [],
  resourceBlackouts = [],
} = {}) {
  const fixture = fixtures[fixtureIndex];
  const pitch = (pitchCfg || []).find((item) => item.id === pitchId);

  if (!fixture || !pitch) {
    return {
      ok: false,
      blocked: true,
      severity: "blocked",
      title: "Move unavailable",
      message: "Ground Control could not identify the fixture or target pitch.",
      fixtureIndex,
      pitchId,
      koMins,
      patch: null,
    };
  }

  const pitchState = getTimelinePitchState({ pitch, fixture, closedPitches });
  if (!pitchState.allowed) {
    return {
      ok: false,
      blocked: true,
      severity: "blocked",
      type: pitchState.tone,
      title: pitchState.label === "Closed" ? "Pitch closed" : "Pitch unsuitable",
      message: pitchState.reason,
      fixture,
      fixtureIndex,
      pitch,
      pitchId,
      koMins,
      patch: null,
      pitchState,
      alternatives: rankTimelinePitches({ pitchCfg, fixture, closedPitches, currentPitchId: fixture.pitchId })
        .filter((item) => item.state.allowed)
        .slice(0, 3),
    };
  }

  const duration = getFixtureDuration(fixture);
  const safeKo = clampTimelineMinutes(snapTimelineMinutes(koMins), start, end, duration);
  const patch = buildTimelineMovePatch({ fixture, pitch, koMins: safeKo });
  const noChange = patch.pitchId === fixture.pitchId && patch.koMins === fixture.koMins;
  if (noChange) {
    return {
      ok: false,
      blocked: false,
      advisory: false,
      noChange: true,
      severity: "neutral",
      type: "no_change",
      title: "Fixture already here",
      message: "Choose a different pitch or kick-off slot to move this fixture.",
      fixture,
      fixtureIndex,
      pitch,
      pitchId,
      koMins: safeKo,
      koTime: patch.koTime,
      endMins: patch.endMins,
      patch,
      pitchState,
      previousPatch: {
        pitchId: fixture.pitchId,
        pitchLabel: fixture.pitchLabel || fixture.pitchId,
        koMins: fixture.koMins,
        koTime: fixture.koTime || formatTimelineTime(fixture.koMins),
        endMins: fixture.endMins,
        endTime: fixture.endTime || formatTimelineTime(fixture.endMins),
      },
    };
  }
  const resourceCandidate = normaliseAnnualBooking({
    title: `${fixture.homeTeam || fixture.team || "Fixture"} vs ${fixture.awayTeam || "TBC"}`,
    bookingType: "match",
    status: "confirmed",
    teamKey: fixture.cfg?.id || fixture.teamId || fixture.homeTeam || fixture.team || "",
    teamName: fixture.homeTeam || fixture.team || "",
    opponentName: fixture.awayTeam || "",
    pitchId: patch.pitchId,
    pitchName: patch.pitchLabel,
    startDate: matchDate || fixture.date || fixture.fixtureDate || "",
    startTime: patch.koTime,
    endTime: patch.endTime,
    sourceType: "matchday_candidate",
    sourceId: getMatchdayFixtureSourceId(fixture, { date: matchDate }),
  });
  const resourceConflicts = matchDate
    ? detectAnnualPlannerConflicts(resourceCandidate, {
        bookings: resourceBookings,
        blackouts: resourceBlackouts,
        ignoreSourceId: resourceCandidate.sourceId,
      })
    : [];

  if (resourceConflicts.length) {
    const safeAlternatives = rankTimelinePitches({ pitchCfg, fixture, closedPitches, currentPitchId: fixture.pitchId })
      .filter((item) => item.state.allowed)
      .filter((item) => !detectAnnualPlannerConflicts({ ...resourceCandidate, pitchId: item.pitch.id, pitchName: item.pitch.label || item.pitch.id }, {
        bookings: resourceBookings,
        blackouts: resourceBlackouts,
        ignoreSourceId: resourceCandidate.sourceId,
      }).length)
      .slice(0, 3);
    return {
      ok: false,
      blocked: true,
      advisory: false,
      severity: "blocked",
      type: "annual_planner_conflict",
      title: resourceConflicts[0].title || "Facility already booked",
      message: resourceConflicts[0].message || "The annual planner already protects this pitch and time.",
      conflicts: resourceConflicts,
      fixture,
      fixtureIndex,
      pitch,
      pitchId,
      koMins: safeKo,
      koTime: patch.koTime,
      endMins: patch.endMins,
      patch,
      pitchState,
      alternatives: safeAlternatives,
      previousPatch: {
        pitchId: fixture.pitchId,
        pitchLabel: fixture.pitchLabel || fixture.pitchId,
        koMins: fixture.koMins,
        koTime: fixture.koTime || formatTimelineTime(fixture.koMins),
        endMins: fixture.endMins,
        endTime: fixture.endTime || formatTimelineTime(fixture.endMins),
      },
    };
  }

  const impact = getOperationsImpact({
    fixtures,
    fixtureIndex,
    pitchCfg,
    patch,
    closedPitches,
    club,
    start: Number.isFinite(start) ? formatTimelineTime(start) : club?.startTime,
    end: Number.isFinite(end) ? formatTimelineTime(end) : club?.endTime,
  });
  const advisory = !impact.ok && PARKING_ADVISORY_TYPES.has(String(impact.type || ""));

  return {
    ...impact,
    ok: Boolean(impact.ok),
    blocked: !impact.ok && !advisory,
    advisory,
    severity: advisory ? "warning" : impact.severity || (impact.ok ? "success" : "blocked"),
    fixture,
    fixtureIndex,
    pitch,
    pitchId,
    koMins: safeKo,
    koTime: patch.koTime,
    endMins: patch.endMins,
    patch,
    pitchState,
    previousPatch: {
      pitchId: fixture.pitchId,
      pitchLabel: fixture.pitchLabel || fixture.pitchId,
      koMins: fixture.koMins,
      koTime: fixture.koTime || formatTimelineTime(fixture.koMins),
      endMins: fixture.endMins,
      endTime: fixture.endTime || formatTimelineTime(fixture.endMins),
    },
  };
}

export function getTimelineCandidateSummary(candidate = {}) {
  if (!candidate.fixture) return "Move fixture";
  const team = candidate.fixture.homeTeam || candidate.fixture.team || "Fixture";
  const opposition = candidate.fixture.awayTeam || "TBC";
  const pitch = candidate.pitch?.label || candidate.pitchId || "pitch";
  const time = candidate.koTime || formatTimelineTime(candidate.koMins || 0);
  return `${team} vs ${opposition} · ${time} · ${pitch}`;
}
