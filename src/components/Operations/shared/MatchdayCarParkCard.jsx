import React, { useMemo } from "react";
import Card from "../../ui/Card.jsx";
import StatusChip from "../../ui/StatusChip.jsx";
import { getParkingSnapshot } from "../../../lib/engines/parkingEngine.js";
import { getValidatedFixRecommendations } from "../../../lib/engines/recommendationEngine.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function getStatusVariant(analysis) {
  if (analysis.isOverCapacity) return "danger";
  if (analysis.isHighPressure || (analysis.peakSlot?.occupancyPct || 0) >= 85) return "warning";
  return "success";
}

function getStatusLabel(analysis) {
  if (analysis.isOverCapacity) return "Over capacity";
  if (analysis.isHighPressure || (analysis.peakSlot?.occupancyPct || 0) >= 85) return "High pressure";
  return "Healthy";
}

function getHealthLabel(percentage) {
  if (percentage >= 90) return "Excellent";
  if (percentage >= 75) return "Healthy";
  if (percentage >= 60) return "Watch";
  return "Critical";
}

function getHealthScore(analysis) {
  const occupancy = analysis.peakSlot?.occupancyPct || 0;

  if (!analysis.peakSlot) return 100;
  if (analysis.isOverCapacity) return clamp(100 - (occupancy - 100) * 2, 20, 55);
  if (occupancy >= 85) return clamp(100 - (occupancy - 80), 70, 84);

  return clamp(100 - Math.max(0, occupancy - 65) * 0.4, 86, 100);
}

function ParkingBadgeIcon({ variant = "success", size = "md" }) {
  const tone =
    variant === "danger"
      ? "bg-red-50 text-red-700 ring-red-100"
      : variant === "warning"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-emerald-50 text-emerald-700 ring-emerald-100";

  const boxSize = size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-2xl";
  const iconSize = size === "lg" ? "h-6 w-6" : "h-5 w-5";

  return (
    <div className={`flex ${boxSize} items-center justify-center ${tone} ring-1`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={iconSize}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 16h14" />
        <path d="M7 16l1.4-5.2A2.5 2.5 0 0 1 10.8 9h2.4a2.5 2.5 0 0 1 2.4 1.8L17 16" />
        <path d="M7.5 16.5v1.2" />
        <path d="M16.5 16.5v1.2" />
        <path d="M8.5 13h7" />
        <circle cx="8" cy="18" r="1.5" />
        <circle cx="16" cy="18" r="1.5" />
      </svg>
    </div>
  );
}

function ParkingHeaderAction({ analysis }) {
  const variant = getStatusVariant(analysis);

  return <StatusChip variant={variant}>{getStatusLabel(analysis)}</StatusChip>;
}


function ParkingMetric({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs font-bold text-slate-500">{hint}</div> : null}
    </div>
  );
}
function ParkingHealthBar({ score }) {
  const safeScore = clamp(score);
  const variant = safeScore >= 85 ? "success" : safeScore >= 65 ? "warning" : "danger";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Parking Health
          </div>
          <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {Math.round(safeScore)}%
          </div>
          <div className="mt-1 text-sm font-bold text-slate-500">
            {getHealthLabel(safeScore)} operational readiness
          </div>
        </div>
        <StatusChip variant={variant}>
          {getHealthLabel(safeScore)}
        </StatusChip>
      </div>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${
            safeScore >= 85
              ? "bg-emerald-500"
              : safeScore >= 65
                ? "bg-amber-500"
                : "bg-red-500"
          }`}
          style={{ width: `${safeScore}%` }}
        />
      </div>
    </div>
  );
}

function ParkingTimeline({ slots = [], capacity }) {
  if (!slots.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
        No parking timeline available yet.
      </div>
    );
  }

  const visibleSlots = slots.filter((_, index) => index % 2 === 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Pressure Timeline
          </div>
          <div className="mt-1 text-sm font-bold text-slate-500">
            Estimated vehicles against {capacity} available spaces.
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${visibleSlots.length}, minmax(0, 1fr))` }}>
        {visibleSlots.map((slot) => {
          const pct = clamp(slot.occupancyPct);
          const isPeak = slot.estimatedCars === Math.max(...slots.map((item) => item.estimatedCars));
          const barClass = slot.overCapacity
            ? "bg-red-500"
            : pct >= 85
              ? "bg-amber-500"
              : "bg-emerald-500";

          return (
            <div key={slot.label} className="flex min-w-0 flex-col items-center gap-2">
              <div className={`text-[10px] font-black ${isPeak ? "text-slate-950" : "text-slate-400"}`}>
                {slot.estimatedCars}
              </div>
              <div className="flex h-28 w-full items-end rounded-xl bg-slate-100 p-1">
                <div
                  className={`w-full rounded-lg ${barClass}`}
                  style={{ height: `${Math.max(6, pct)}%` }}
                  title={`${slot.label}: ${slot.estimatedCars} cars, ${slot.fixtureCount} games`}
                />
              </div>
              <div className="truncate text-[10px] font-bold text-slate-400">{slot.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-emerald-500" /> Controlled
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-amber-500" /> 85%+
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-red-500" /> Over capacity
        </span>
      </div>
    </div>
  );
}

function getPeakFixtureNames(slot = {}) {
  const fixtures = slot.parkingFixtures || slot.fixtures || [];
  return fixtures
    .slice(0, 3)
    .map((fixture) => fixture.homeTeam || fixture.team || fixture.fixture || "Fixture")
    .join(", ");
}

function ParkingPeakStory({ analysis, capacity }) {
  const peak = analysis.peakSlot;
  const variant = getStatusVariant(analysis);

  if (!peak) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-start gap-4">
        <ParkingBadgeIcon variant={variant} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Parking Peak
          </div>
          <div className="mt-2 text-4xl font-black tracking-tight text-slate-950">
            {peak.occupancyPct}%
          </div>
          <div className="mt-1 text-sm font-bold text-slate-500">
            {peak.estimatedCars}/{capacity} spaces at {peak.label}
          </div>
          {getPeakFixtureNames(peak) ? (
            <div className="mt-4 rounded-2xl border border-white bg-white p-4 text-sm font-bold leading-6 text-slate-600 shadow-sm">
              Highest pressure comes from {getPeakFixtureNames(peak)}
              {peak.parkingFixtures?.length > 3 ? ` and ${peak.parkingFixtures.length - 3} more` : ""}.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ParkingMessage({ analysis }) {
  if (analysis.isOverCapacity) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-6 text-red-900">
        Parking is projected to exceed capacity at {analysis.overCapacitySlots.map((slot) => slot.label).join(", ")}. Spread kick-offs, reduce concurrent fixtures, or open overflow parking.
      </div>
    );
  }

  if (analysis.isHighPressure) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
        Parking is within physical capacity, but peak pressure is high. Consider changing kick-off times or using parking-exempt pitches where suitable.
      </div>
    );
  }

  if (analysis.canIncreaseConcurrentLimit) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
        Parking remains within capacity. More concurrent games may be possible if pitch suitability and officials also allow it.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
      Parking demand is controlled across the current matchday schedule.
    </div>
  );
}


function RecommendationButton({ recommendation, onApplyRecommendation }) {
  if (typeof onApplyRecommendation !== "function") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => onApplyRecommendation(recommendation)}
      className="shrink-0 rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
    >
      {recommendation.resolvesParking ? "Fix now" : "Improve"}
    </button>
  );
}

function ParkingRecommendations({ recommendations = [], onApplyRecommendation }) {
  if (!recommendations.length) return null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">
            Recommended Actions
          </div>
          <div className="mt-1 text-sm font-bold text-slate-500">
            Specific changes that reduce peak parking pressure.
          </div>
        </div>
        <StatusChip variant="warning">Review</StatusChip>
      </div>

      <div className="mt-4 grid gap-3">
        {recommendations.map((recommendation, index) => (
          <div
            key={`${recommendation.type}-${recommendation.fixtureIndex}-${recommendation.koTime || recommendation.pitchId || index}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-black text-slate-950">
                  {recommendation.title}
                </div>
                {recommendation.actionTitle ? (
                  <div className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                    {recommendation.actionTitle}
                  </div>
                ) : null}
                <div className="mt-1 text-xs font-bold leading-5 text-slate-500">
                  {recommendation.detail}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {Number(recommendation.reduction || 0) > 0 ? (
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700 ring-1 ring-emerald-100">
                    -{recommendation.reduction} cars
                  </div>
                ) : null}
                <RecommendationButton
                  recommendation={recommendation}
                  onApplyRecommendation={onApplyRecommendation}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function applyParkingRecommendation(recommendation, onOverride) {
  if (!recommendation || typeof onOverride !== "function") return;

  const index = recommendation.fixtureIndex;

  if (typeof index !== "number" || index < 0) return;

  if (recommendation.patch && typeof recommendation.patch === "object") {
    Object.entries(recommendation.patch).forEach(([field, value]) => {
      onOverride(index, field, value);
    });
    return;
  }

  if (recommendation.type === "time" && recommendation.koTime) {
    onOverride(index, "koTime", recommendation.koTime);

    if (typeof recommendation.koMins === "number") {
      onOverride(index, "koMins", recommendation.koMins);
    }

    if (typeof recommendation.endMins === "number") {
      onOverride(index, "endMins", recommendation.endMins);
    }

    return;
  }

  if (recommendation.type === "pitch" && recommendation.pitchId) {
    onOverride(index, "pitchId", recommendation.pitchId);
    onOverride(index, "pitchLabel", recommendation.pitchLabel || recommendation.pitchId);
  }
}
export default function MatchdayCarParkCard({
  club,
  satHasRun,
  satFinal = [],
  pitchCfg = [],
  closedPitches = [],
  startHour = 8,
  startMin = 30,
  endHour = 11,
  endMin = 30,
  day = "Matchday",
  onOverride,
}) {
  const startMins = startHour * 60 + startMin;
  const youthEndTime = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

  const parkingSnapshot = useMemo(
    () =>
      getParkingSnapshot({
        fixtures: satFinal,
        club,
        pitchCfg,
        startMins,
      }),
    [satFinal, club, pitchCfg, startMins]
  );

  const analysis = parkingSnapshot.analysis;
  const capacity = parkingSnapshot.capacity;

  const parkingRecommendations = useMemo(() => {
    const peakFixtures = analysis.peakSlot?.parkingFixtures || [];

    if (!peakFixtures.length || (!analysis.isOverCapacity && !analysis.isHighPressure && !analysis.isOverConcurrentLimit)) {
      return [];
    }

    const seen = new Set();
    const recommendations = [];

    peakFixtures.forEach((fixture) => {
      const fixtureIndex = satFinal.indexOf(fixture);
      if (fixtureIndex < 0) return;

      const fixes = getValidatedFixRecommendations({
        fixtures: satFinal,
        fixtureIndex,
        pitchCfg,
        closedPitches,
        club,
        start: `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`,
        end: youthEndTime,
        interval: 15,
        limit: 3,
        allowParkingImprovement: true,
        minimumCarReduction: 1,
      });

      fixes.forEach((fix) => {
        const key = `${fixtureIndex}-${fix.id}`;
        if (seen.has(key)) return;
        seen.add(key);

        recommendations.push({
          ...fix,
          type: "validated",
          fixtureIndex,
          reduction: Math.max(0, Number(fix.reduction || 0)),
        });
      });
    });

    return recommendations.sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 4);
  }, [analysis, club, closedPitches, endHour, endMin, pitchCfg, satFinal, startHour, startMin, youthEndTime]);

  const peak = analysis.peakSlot;
  const healthScore = getHealthScore(analysis);

  return (
    <Card
      eyebrow="Parking Intelligence"
      title={`${day} Car Park`}
      subtitle="Peak demand, pressure windows and matchday parking readiness."
      action={<ParkingHeaderAction analysis={analysis} />}
    >
      <ParkingPeakStory analysis={analysis} capacity={capacity} />

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <ParkingHealthBar score={healthScore} />
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
          <ParkingMetric label="Capacity" value={capacity} hint="available spaces" />
          <ParkingMetric
            label="Peak demand"
            value={peak?.estimatedCars || 0}
            hint={peak ? `${peak.occupancyPct}% at ${peak.label}` : "No fixtures"}
          />
          <ParkingMetric
            label="Peak window"
            value={peak?.label || "—"}
            hint={peak ? `${peak.fixtureCount} parking-impact fixtures` : "No peak found"}
          />
        </div>
      </div>

      <div className="mt-5">
        <ParkingMessage analysis={analysis} />
      </div>

      <div className="mt-5">
        <ParkingRecommendations
          recommendations={parkingRecommendations}
          onApplyRecommendation={(recommendation) =>
            applyParkingRecommendation(recommendation, onOverride)
          }
        />
      </div>

      {analysis.exemptFixtures?.length ? (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
          {analysis.exemptFixtures.length} fixture{analysis.exemptFixtures.length === 1 ? " is" : "s are"} on pitches configured as not affecting this car park.
        </div>
      ) : null}

      <div className="mt-5">
        <ParkingTimeline slots={analysis.slots} capacity={capacity} />
      </div>
    </Card>
  );
}
