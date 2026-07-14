import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, GripVertical, Save, ShieldX, Sparkles } from "lucide-react";
import Card from "@/ui/Card.jsx";
import StatusChip from "@/ui/StatusChip.jsx";
import { buildMatchdayTimeline, getTimelineFixtureTone } from "../../../lib/engines/timelineEngine.js";
import {
  buildTimelineMoveCandidate,
  getTimelineCandidateSummary,
  getTimelinePitchState,
  rankTimelinePitches,
} from "../../../lib/engines/timelineDragEngine.js";
import { getPitchDisplayFormat } from "../../../lib/intelligence/pitch/pitchService.js";

export default function MatchdayTimelineCard({
  title = "Operations Timeline",
  subtitle = "Pitch usage across the day.",
  games = [],
  pitchCfg = [],
  closedPitches = [],
  club,
  variant = "full",
  readOnly = false,
  dirty = false,
  saving = false,
  onSave,
  onMoveRequest,
  onFixtureClick = () => {},
}) {
  const isCompact = variant === "compact";
  const canEdit = !readOnly && typeof onMoveRequest === "function";
  const [dragState, setDragState] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const rowRefs = useRef(new Map());

  const timeline = useMemo(
    () =>
      buildMatchdayTimeline({
        games,
        pitchCfg,
        club,
        includeEmptyPitches: canEdit,
      }),
    [canEdit, club, games, pitchCfg],
  );

  const rankedTargets = useMemo(() => {
    if (!dragState?.fixture) return [];
    return rankTimelinePitches({
      pitchCfg,
      fixture: dragState.fixture,
      closedPitches,
      currentPitchId: dragState.fixture.pitchId,
    });
  }, [closedPitches, dragState?.fixture, pitchCfg]);

  function clearDrag() {
    setDragState(null);
    setCandidate(null);
  }

  function startDrag(event, fixture) {
    if (!canEdit) return;
    const fixtureIndex = games.indexOf(fixture.source);
    if (fixtureIndex < 0) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fixture.id);
    setDragState({ fixtureIndex, fixture: fixture.source, timelineFixture: fixture });
  }

  function previewDrop(event, pitch) {
    if (!dragState || !canEdit) return;
    event.preventDefault();
    const row = rowRefs.current.get(pitch.id);
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
    const rawMins = timeline.start + ratio * timeline.range;
    const next = buildTimelineMoveCandidate({
      fixtures: games,
      fixtureIndex: dragState.fixtureIndex,
      pitchCfg,
      closedPitches,
      club,
      pitchId: pitch.id,
      koMins: rawMins,
      start: timeline.start,
      end: timeline.end,
    });
    event.dataTransfer.dropEffect = next.blocked ? "none" : "move";
    setCandidate(next);
  }

  function completeDrop(event, pitch) {
    if (!dragState || !canEdit) return;
    event.preventDefault();
    const next = candidate?.pitchId === pitch.id
      ? candidate
      : buildTimelineMoveCandidate({
          fixtures: games,
          fixtureIndex: dragState.fixtureIndex,
          pitchCfg,
          closedPitches,
          club,
          pitchId: pitch.id,
          koMins: dragState.fixture.koMins,
          start: timeline.start,
          end: timeline.end,
        });
    onMoveRequest(next);
    clearDrag();
  }

  return (
    <Card
      eyebrow="Interactive timeline"
      title={title}
      subtitle={canEdit ? `${subtitle} Drag a fixture to a suitable pitch and 15-minute slot.` : subtitle}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {dirty && typeof onSave === "function" ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
            >
              <Save size={14} /> {saving ? "Saving…" : "Save changes"}
            </button>
          ) : null}
          <StatusChip variant={dirty ? "warning" : "neutral"}>
            {dirty ? "Unsaved changes" : `${timeline.fixtureCount} fixtures`}
          </StatusChip>
        </div>
      }
    >
      {!timeline.hasFixtures ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
          No scheduled fixtures yet. Run the scheduler to populate the timeline.
        </div>
      ) : (
        <>
          {dragState ? (
            <DragGuidance candidate={candidate} rankedTargets={rankedTargets} />
          ) : canEdit ? (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-950">
              <GripVertical className="mt-0.5 shrink-0" size={18} />
              <div>
                <div className="text-sm font-black">Drag to reschedule</div>
                <div className="mt-1 text-xs font-bold leading-5 text-emerald-800">
                  Ground Control checks pitch format, closures, linked-pitch clashes, officials, timing and parking before a move is accepted.
                </div>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <div className="min-w-[920px]">
              <div
                className={`grid border-b border-slate-100 ${
                  isCompact ? "grid-cols-[160px_1fr] gap-3 pb-2" : "grid-cols-[190px_1fr] gap-4 pb-3"
                }`}
              >
                <div />
                <div className="relative h-8">
                  {timeline.ticks.map((tick) => (
                    <div
                      key={tick.value}
                      className="absolute top-0 -translate-x-1/2 text-xs font-black text-slate-400"
                      style={{ left: `${((tick.value - timeline.start) / timeline.range) * 100}%` }}
                    >
                      {tick.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className={`mt-3 ${isCompact ? "space-y-2" : "space-y-3"}`}>
                {timeline.rows.map((row) => {
                  const pitchState = dragState
                    ? getTimelinePitchState({ pitch: row.pitch, fixture: dragState.fixture, closedPitches })
                    : null;
                  const isCandidateRow = candidate?.pitchId === row.pitch.id;
                  const rowTone = !dragState
                    ? "border-transparent"
                    : pitchState?.allowed
                      ? isCandidateRow
                        ? candidate?.blocked
                          ? "border-rose-400 bg-rose-50"
                          : candidate?.advisory
                            ? "border-amber-400 bg-amber-50"
                            : "border-emerald-400 bg-emerald-50"
                        : "border-emerald-200 bg-emerald-50/40"
                      : "border-slate-200 bg-slate-100/70 opacity-65";

                  return (
                    <div
                      key={row.pitch.id}
                      className={`grid items-center rounded-2xl border p-1.5 transition ${rowTone} ${
                        isCompact ? "grid-cols-[160px_1fr] gap-3" : "grid-cols-[190px_1fr] gap-4"
                      }`}
                    >
                      <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-[13px] font-extrabold leading-5 tracking-tight text-slate-900">
                            {formatPitchLabel(row.pitch.label || row.pitch.id)}
                          </div>
                          {dragState ? (
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] ${
                              pitchState?.allowed ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                            }`}>
                              {pitchState?.label}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] font-bold leading-4 text-slate-500">
                          {formatPitchFormat(getPitchDisplayFormat(row.pitch))}
                        </div>
                      </div>

                      <div
                        ref={(node) => {
                          if (node) rowRefs.current.set(row.pitch.id, node);
                          else rowRefs.current.delete(row.pitch.id);
                        }}
                        onDragOver={(event) => previewDrop(event, row.pitch)}
                        onDrop={(event) => completeDrop(event, row.pitch)}
                        className={`relative overflow-hidden rounded-2xl bg-slate-100 ${isCompact ? "h-12" : ""}`}
                        style={!isCompact ? { height: `${Math.max(64, row.laneCount * 48 + 8)}px` } : undefined}
                        aria-label={`${row.pitch.label || row.pitch.id} timeline`}
                      >
                        {timeline.halfHourTicks.map((tick) => (
                          <div
                            key={`half-${tick.value}`}
                            className="absolute top-0 h-full w-px bg-white/45"
                            style={{ left: `${((tick.value - timeline.start) / timeline.range) * 100}%` }}
                          />
                        ))}
                        {timeline.ticks.map((tick) => (
                          <div
                            key={tick.value}
                            className="absolute top-0 h-full w-px bg-white"
                            style={{ left: `${((tick.value - timeline.start) / timeline.range) * 100}%` }}
                          />
                        ))}

                        {isCandidateRow && candidate?.patch ? (
                          <div
                            className={`pointer-events-none absolute inset-y-0 z-20 w-1 rounded-full ${
                              candidate.blocked ? "bg-rose-500" : candidate.advisory ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ left: `${((candidate.koMins - timeline.start) / timeline.range) * 100}%` }}
                          >
                            <span className="absolute left-1/2 top-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-950 px-2 py-1 text-[10px] font-black text-white shadow-lg">
                              {candidate.koTime}
                            </span>
                          </div>
                        ) : null}

                        {row.fixtures.map((fixture) => {
                          const sourceIndex = games.indexOf(fixture.source);
                          const label = fixture.title;
                          const opposition = fixture.opposition;
                          const colour = getGameColour(fixture);
                          const isDragging = dragState?.fixtureIndex === sourceIndex;

                          return (
                            <button
                              key={fixture.id}
                              type="button"
                              draggable={canEdit}
                              onDragStart={(event) => startDrag(event, fixture)}
                              onDragEnd={clearDrag}
                              onClick={() => onFixtureClick?.(fixture.source, sourceIndex)}
                              className={`absolute z-10 flex items-center overflow-hidden rounded-2xl border px-3 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${colour} ${
                                isDragging ? "opacity-30 ring-4 ring-slate-300" : ""
                              } ${isCompact ? "h-8 min-w-[110px]" : "h-10 min-w-[120px]"}`}
                              style={{
                                left: `${fixture.leftPct}%`,
                                width: `${Math.max(fixture.widthPct, 10)}%`,
                                top: isCompact ? "8px" : `${6 + fixture.lane * 48}px`,
                              }}
                              title={`${label} vs ${opposition} • ${fixture.koTime}${canEdit ? " • Drag to move" : ""}`}
                            >
                              {canEdit ? <GripVertical size={13} className="mr-1 shrink-0 text-white/75" /> : null}
                              <div className="min-w-0">
                                <div className={`truncate font-black ${isCompact ? "text-[10px]" : "text-xs"}`}>{label}</div>
                                <div className={`truncate font-bold text-white/80 ${isCompact ? "text-[9px]" : "text-[10px]"}`}>
                                  {fixture.koTime} · {opposition}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
            <LegendItem colour="bg-emerald-600" label="Preferred" />
            <LegendItem colour="bg-amber-500" label="Alternative" />
            <LegendItem colour="bg-blue-600" label="Astro" />
            <LegendItem colour="bg-red-600" label="Emergency" />
          </div>
        </>
      )}
    </Card>
  );
}

function DragGuidance({ candidate, rankedTargets = [] }) {
  if (!candidate) {
    return (
      <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-950">
        Drag across a suitable pitch row. Kick-off times snap to 15-minute intervals.
      </div>
    );
  }

  const Icon = candidate.blocked ? ShieldX : candidate.advisory ? AlertTriangle : CheckCircle2;
  const tone = candidate.blocked
    ? "border-rose-200 bg-rose-50 text-rose-950"
    : candidate.advisory
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-emerald-200 bg-emerald-50 text-emerald-950";

  return (
    <div className={`mb-4 rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon size={19} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black">{candidate.title || (candidate.ok ? "Move available" : "Move blocked")}</div>
          <div className="mt-1 text-xs font-bold leading-5 opacity-80">
            {candidate.message || getTimelineCandidateSummary(candidate)}
          </div>
          {candidate.patch ? (
            <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-1.5 text-xs font-black shadow-sm">
              <Sparkles size={13} /> {getTimelineCandidateSummary(candidate)}
            </div>
          ) : null}
          {candidate.blocked && candidate.timeSuggestions?.length ? (
            <div className="mt-3 text-[11px] font-black uppercase tracking-[0.13em] opacity-70">
              Available times: {candidate.timeSuggestions.slice(0, 4).map((item) => item.time || item.koTime || item.label || item).join(" · ")}
            </div>
          ) : null}
          {candidate.blocked && candidate.pitchSuggestions?.length ? (
            <div className="mt-2 text-[11px] font-black uppercase tracking-[0.13em] opacity-70">
              Available pitches: {candidate.pitchSuggestions.slice(0, 3).map((item) => item.label || item.pitchLabel || item.pitchId || item.id).join(" · ")}
            </div>
          ) : candidate.blocked && rankedTargets.some((item) => item.state.allowed) ? (
            <div className="mt-3 text-[11px] font-black uppercase tracking-[0.13em] opacity-70">
              Best suitable pitches: {rankedTargets.filter((item) => item.state.allowed).slice(0, 3).map((item) => item.pitch.label || item.pitch.id).join(" · ")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function getGameColour(game) {
  const tone = getTimelineFixtureTone(game);
  if (tone === "emergency") return "border-red-700 bg-red-600";
  if (tone === "astro") return "border-blue-700 bg-blue-600";
  if (tone === "alternative") return "border-amber-600 bg-amber-500";
  return "border-emerald-700 bg-emerald-600";
}

function LegendItem({ colour, label }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded ${colour}`} />
      <span>{label}</span>
    </div>
  );
}

function formatPitchLabel(value) {
  return String(value || "Pitch").replace(/[.·,:;\-\s]+$/g, "").replace(/\s+/g, " ").trim();
}

function formatPitchFormat(value) {
  const text = String(value || "Unconfigured").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return text
    .split(" ")
    .map((part) => (/^\d+v\d+$/i.test(part) ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join(" ");
}
