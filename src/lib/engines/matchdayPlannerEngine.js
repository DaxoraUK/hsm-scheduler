import { formatTimelineTime } from "./timelineEngine.js";
import { snapTimelineMinutes, TIMELINE_SNAP_MINUTES } from "./timelineDragEngine.js";
import { getFixtureFlowIdentity } from "../domain/fixtureVenueFlow.js";

export const MATCHDAY_PLANNER_ZOOM = Object.freeze({
  fit: { id: "fit", label: "Fit day", slotMinutes: 15, slotWidth: 0 },
  quarter: { id: "quarter", label: "15 min", slotMinutes: 15, slotWidth: 48 },
  half: { id: "half", label: "30 min", slotMinutes: 30, slotWidth: 64 },
  hour: { id: "hour", label: "60 min", slotMinutes: 60, slotWidth: 96 },
});

export const MATCHDAY_PLANNER_OVERLAYS = Object.freeze([
  { id: "closures", label: "Closures" },
  { id: "parking", label: "Parking" },
  { id: "officials", label: "Officials" },
  { id: "warnings", label: "Warnings" },
]);

export function buildPlannerSlots(start, end, interval = TIMELINE_SNAP_MINUTES) {
  const safeInterval = Math.max(1, Number(interval) || TIMELINE_SNAP_MINUTES);
  const first = Math.ceil(Number(start || 0) / safeInterval) * safeInterval;
  const last = Math.floor(Number(end || first) / safeInterval) * safeInterval;
  const slots = [];

  for (let value = first; value <= last; value += safeInterval) {
    slots.push({
      value,
      label: formatTimelineTime(value),
      major: value % 60 === 0,
      half: value % 30 === 0,
    });
  }

  return slots;
}

export function getPlannerCanvasWidth({ start, end, zoom = "fit", viewportWidth = 0 } = {}) {
  const mode = MATCHDAY_PLANNER_ZOOM[zoom] || MATCHDAY_PLANNER_ZOOM.fit;
  const range = Math.max(60, Number(end || 0) - Number(start || 0));

  if (mode.id === "fit") {
    return Math.max(520, Number(viewportWidth || 0));
  }

  return Math.max(720, Math.ceil(range / mode.slotMinutes) * mode.slotWidth);
}

export function getPlannerFixtureIdentity(fixture = {}, fallbackIndex = 0) {
  return String(
    getFixtureFlowIdentity(fixture) ||
      fixture.id ||
      fixture.fixtureId ||
      fixture.externalId ||
      `${fixture.pitchId || "pitch"}-${fixture.koMins || "time"}-${fixture.homeTeam || fixture.team || "fixture"}-${fallbackIndex}`,
  );
}

export function buildPlannerChangeRecord(candidate = {}) {
  if (!candidate?.patch || !candidate?.fixture) return null;

  const fixture = candidate.fixture;
  const previous = candidate.previousPatch || {};
  const next = candidate.patch || {};
  const home = fixture.homeTeam || fixture.team || "Fixture";
  const away = fixture.awayTeam || "TBC";

  return {
    id: `${getPlannerFixtureIdentity(fixture, candidate.fixtureIndex)}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fixtureId: getPlannerFixtureIdentity(fixture, candidate.fixtureIndex),
    fixtureIndex: candidate.fixtureIndex,
    fixtureTitle: `${home} vs ${away}`,
    previousPatch: previous,
    patch: next,
    warning: candidate.advisory ? candidate.message || candidate.title : "",
    changedPitch: previous.pitchId !== next.pitchId,
    changedTime: previous.koMins !== next.koMins,
    summary: buildPlannerChangeSummary({ fixture, previous, next }),
    createdAt: new Date().toISOString(),
  };
}

export function buildPlannerChangeSummary({ fixture = {}, previous = {}, next = {} } = {}) {
  const home = fixture.homeTeam || fixture.team || "Fixture";
  const away = fixture.awayTeam || "TBC";
  const changes = [];

  if (previous.koMins !== next.koMins) {
    changes.push(`${previous.koTime || formatTimelineTime(previous.koMins || 0)} → ${next.koTime || formatTimelineTime(next.koMins || 0)}`);
  }

  if (previous.pitchId !== next.pitchId) {
    changes.push(`${previous.pitchLabel || previous.pitchId || "Pitch TBC"} → ${next.pitchLabel || next.pitchId || "Pitch TBC"}`);
  }

  return `${home} vs ${away}${changes.length ? ` · ${changes.join(" · ")}` : ""}`;
}

export function getPlannerFixtureRisk(fixture = {}) {
  const warnings = [];

  if (!fixture.pitchId) warnings.push("Pitch missing");
  if (!fixture.referee && !fixture.official) warnings.push("Official missing");
  if (fixture.usingFallback) warnings.push("Emergency pitch");
  if (fixture.usingAlt) warnings.push("Alternative pitch");
  if (fixture.refStatus && fixture.refStatus !== "Confirmed") warnings.push(`Official ${String(fixture.refStatus).toLowerCase()}`);
  if (fixture.status === "unresolved") warnings.push("Unresolved");

  return {
    count: warnings.length,
    warnings,
    severity: fixture.usingFallback || fixture.status === "unresolved" ? "danger" : warnings.length ? "warning" : "ready",
  };
}

export function buildPlannerPitchGroups(rows = []) {
  const groups = new Map();

  (rows || []).forEach((row) => {
    const pitch = row.pitch || {};
    const format = String(pitch.format || pitch.pitchFormat || "other").toLowerCase();
    let id = "other";
    let label = "Other pitches";

    if (format.includes("5v5")) {
      id = "5v5";
      label = "5v5 pitches";
    } else if (format.includes("7v7")) {
      id = "7v7";
      label = "7v7 pitches";
    } else if (format.includes("9v9")) {
      id = "9v9";
      label = "9v9 pitches";
    } else if (format.includes("11v11")) {
      id = "11v11";
      label = "11v11 pitches";
    }

    if (String(pitch.surface || "").toLowerCase().includes("astro")) {
      id = "astro";
      label = "Astro pitches";
    }

    if (!groups.has(id)) groups.set(id, { id, label, rows: [] });
    groups.get(id).rows.push(row);
  });

  const order = ["11v11", "9v9", "7v7", "5v5", "astro", "other"];
  return Array.from(groups.values()).sort((left, right) => order.indexOf(left.id) - order.indexOf(right.id));
}

export function buildPlannerOverlayMetrics({ fixtures = [], club = {}, start, end, interval = 15 } = {}) {
  const slots = buildPlannerSlots(start, end, interval);
  const parkingCapacity = Number(club.carCapacity || club.parkingCapacity || club.carCap || 0);

  return slots.map((slot) => {
    const active = fixtures.filter((fixture) => {
      const fixtureStart = Number(fixture.koMins);
      const fixtureEnd = Number(fixture.endMins);
      return Number.isFinite(fixtureStart) && Number.isFinite(fixtureEnd) && fixtureStart <= slot.value && fixtureEnd > slot.value;
    });
    const cars = active.reduce((sum, fixture) => sum + Number(fixture.cars || fixture.estimatedCars || 0), 0);
    const missingOfficials = active.filter((fixture) => !fixture.referee && !fixture.official).length;
    const warningFixtures = active.filter((fixture) => getPlannerFixtureRisk(fixture).count > 0).length;
    const parkingPercent = parkingCapacity > 0 ? Math.round((cars / parkingCapacity) * 100) : 0;

    return {
      ...slot,
      fixtureCount: active.length,
      cars,
      parkingPercent,
      parkingTone: parkingCapacity > 0 && parkingPercent > 100 ? "danger" : parkingCapacity > 0 && parkingPercent >= 80 ? "warning" : "ready",
      missingOfficials,
      warningFixtures,
    };
  });
}

export function getPlannerCandidateTone(candidate = {}) {
  if (!candidate) return "neutral";
  if (candidate.blocked) return "danger";
  if (candidate.advisory) return "warning";
  if (candidate.noChange) return "neutral";
  return "success";
}

export function getPlannerCandidateLabel(candidate = {}) {
  if (!candidate) return "Choose a slot";
  if (candidate.blocked) return "Move blocked";
  if (candidate.advisory) return "Warning requires review";
  if (candidate.noChange) return "Already allocated here";
  return "Move available";
}

export function normalisePlannerTimeInput(value, fallback = 0) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return snapTimelineMinutes(fallback);
  return snapTimelineMinutes(Number(match[1]) * 60 + Number(match[2]));
}
