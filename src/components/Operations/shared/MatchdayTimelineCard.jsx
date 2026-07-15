import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  GripVertical,
  History,
  LayoutGrid,
  ListRestart,
  MapPin,
  MousePointer2,
  ParkingCircle,
  Redo2,
  RotateCcw,
  Save,
  ShieldAlert,
  ShieldX,
  SlidersHorizontal,
  Undo2,
  Users,
  X,
} from "lucide-react";
import Card from "@/ui/Card.jsx";
import StatusChip from "@/ui/StatusChip.jsx";
import { buildMatchdayTimeline, formatTimelineTime, getTimelineFixtureTone } from "../../../lib/engines/timelineEngine.js";
import {
  buildTimelineMoveCandidate,
  getTimelineCandidateSummary,
  getTimelinePitchState,
  rankTimelinePitches,
} from "../../../lib/engines/timelineDragEngine.js";
import {
  buildPlannerOverlayMetrics,
  buildPlannerPitchGroups,
  buildPlannerSlots,
  getPlannerCandidateLabel,
  getPlannerCandidateTone,
  getPlannerCanvasWidth,
  getPlannerFixtureRisk,
  MATCHDAY_PLANNER_OVERLAYS,
  MATCHDAY_PLANNER_ZOOM,
  normalisePlannerTimeInput,
} from "../../../lib/engines/matchdayPlannerEngine.js";
import { getPitchDisplayFormat } from "../../../lib/intelligence/pitch/pitchService.js";

const PITCH_COLUMN_WIDTH = 184;
const EDGE_SCROLL_DISTANCE = 68;
const EDGE_SCROLL_SPEED = 18;

export default function MatchdayTimelineCard({
  title = "Matchday Planner",
  subtitle = "Plan pitch usage and kick-off flow across the day.",
  games = [],
  pitchCfg = [],
  closedPitches = [],
  club,
  variant = "full",
  readOnly = false,
  dirty = false,
  saving = false,
  changeHistory = [],
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onDiscard,
  onSave,
  onMoveRequest,
  onFixtureClick = () => {},
}) {
  const isCompact = variant === "compact";
  const canEdit = !readOnly && typeof onMoveRequest === "function";
  const [view, setView] = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "board" : "timeline"));
  const [zoom, setZoom] = useState("fit");
  const [activeOverlays, setActiveOverlays] = useState(new Set(["closures", "warnings"]));
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(900);
  const scrollRef = useRef(null);
  const rowRefs = useRef(new Map());
  const dragRef = useRef(null);
  const candidateRef = useRef(null);

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

  const slots = useMemo(() => buildPlannerSlots(timeline.start, timeline.end, 15), [timeline.end, timeline.start]);
  const overlayMetrics = useMemo(
    () => buildPlannerOverlayMetrics({ fixtures: games, club, start: timeline.start, end: timeline.end, interval: 15 }),
    [club, games, timeline.end, timeline.start],
  );
  const groups = useMemo(() => buildPlannerPitchGroups(timeline.rows), [timeline.rows]);
  const canvasWidth = getPlannerCanvasWidth({
    start: timeline.start,
    end: timeline.end,
    zoom,
    viewportWidth: Math.max(520, viewportWidth - PITCH_COLUMN_WIDTH - 4),
  });

  const selectedFixture = selected?.fixture || null;
  const selectedFixtureIndex = selected?.fixtureIndex ?? -1;
  const selectedRankedPitches = useMemo(() => {
    if (!selectedFixture) return [];
    return rankTimelinePitches({
      pitchCfg,
      fixture: selectedFixture,
      closedPitches,
      currentPitchId: selectedFixture.pitchId,
    });
  }, [closedPitches, pitchCfg, selectedFixture]);

  useEffect(() => {
    if (!scrollRef.current || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (Number.isFinite(width)) setViewportWidth(width);
    });
    observer.observe(scrollRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    candidateRef.current = candidate;
  }, [candidate]);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    candidateRef.current = null;
    setCandidate(null);
    document.body.style.removeProperty("user-select");
    document.body.style.removeProperty("cursor");
  }, []);

  const buildCandidate = useCallback(
    ({ fixtureIndex, pitchId, koMins }) =>
      buildTimelineMoveCandidate({
        fixtures: games,
        fixtureIndex,
        pitchCfg,
        closedPitches,
        club,
        pitchId,
        koMins,
        start: timeline.start,
        end: timeline.end,
      }),
    [closedPitches, club, games, pitchCfg, timeline.end, timeline.start],
  );

  const commitCandidate = useCallback(
    (next, { requireReview = false } = {}) => {
      if (!next) return;
      if (next.blocked || next.noChange || requireReview) {
        setSelected({ fixture: next.fixture, fixtureIndex: next.fixtureIndex });
        setProposal(next);
        setCandidate(next);
        return;
      }
      onMoveRequest(next);
      setCandidate(null);
      setProposal(null);
    },
    [onMoveRequest],
  );

  useEffect(() => {
    function onPointerMove(event) {
      const session = dragRef.current;
      if (!session) return;

      const moved = session.moved || Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 5;
      dragRef.current = { ...session, moved, clientX: event.clientX, clientY: event.clientY };
      if (!moved) return;

      const scroll = scrollRef.current;
      if (scroll) {
        const rect = scroll.getBoundingClientRect();
        if (event.clientX < rect.left + EDGE_SCROLL_DISTANCE) scroll.scrollLeft -= EDGE_SCROLL_SPEED;
        if (event.clientX > rect.right - EDGE_SCROLL_DISTANCE) scroll.scrollLeft += EDGE_SCROLL_SPEED;
        if (event.clientY < rect.top + EDGE_SCROLL_DISTANCE) scroll.scrollTop -= EDGE_SCROLL_SPEED;
        if (event.clientY > rect.bottom - EDGE_SCROLL_DISTANCE) scroll.scrollTop += EDGE_SCROLL_SPEED;
      }

      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-planner-pitch-id]");
      const pitchId = target?.dataset?.plannerPitchId;
      const row = pitchId ? rowRefs.current.get(pitchId) : null;
      if (!pitchId || !row) {
        candidateRef.current = null;
        setCandidate(null);
        return;
      }

      const rect = row.getBoundingClientRect();
      const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
      const koMins = timeline.start + ratio * timeline.range;
      const next = buildCandidate({ fixtureIndex: session.fixtureIndex, pitchId, koMins });
      candidateRef.current = next;
      setCandidate(next);
    }

    function onPointerUp() {
      const session = dragRef.current;
      const next = candidateRef.current;
      clearDrag();
      if (!session?.moved || !next) return;
      commitCandidate(next);
    }

    function onKeyDown(event) {
      if (event.key === "Escape" && dragRef.current) clearDrag();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", clearDrag);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", clearDrag);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [buildCandidate, clearDrag, commitCandidate, timeline.range, timeline.start]);

  function startPointerDrag(event, fixture, fixtureIndex) {
    if (!canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    setProposal(null);
    dragRef.current = {
      fixtureIndex,
      fixture: fixture.source,
      timelineFixture: fixture,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
  }

  function previewSlotForSelected(pitchId, koMins) {
    if (!selectedFixture || selectedFixtureIndex < 0 || !canEdit) return;
    const next = buildCandidate({ fixtureIndex: selectedFixtureIndex, pitchId, koMins });
    setProposal(next);
    setCandidate(next);
  }

  function applyProposal() {
    if (!proposal || proposal.blocked || proposal.noChange) return;
    onMoveRequest(proposal);
    setProposal(null);
    setCandidate(null);
  }

  function applyRecommendation(recommendation) {
    if (!recommendation?.patch || selectedFixtureIndex < 0) return;
    const next = buildCandidate({
      fixtureIndex: selectedFixtureIndex,
      pitchId: recommendation.patch.pitchId || selectedFixture.pitchId,
      koMins: recommendation.patch.koMins ?? normalisePlannerTimeInput(recommendation.patch.koTime, selectedFixture.koMins),
    });
    if (next.blocked || next.advisory) {
      setProposal(next);
      setCandidate(next);
      return;
    }
    onMoveRequest(next);
    setProposal(null);
    setCandidate(null);
  }

  function toggleOverlay(id) {
    setActiveOverlays((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(id) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeCandidate = proposal || candidate;

  return (
    <Card
      eyebrow="Ground Control planner"
      title={title}
      subtitle={canEdit ? `${subtitle} Move fixtures with live operational validation.` : subtitle}
      padded={false}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatusChip variant={dirty ? "warning" : "neutral"}>
            {dirty ? `${changeHistory.length || 1} unpublished change${changeHistory.length === 1 ? "" : "s"}` : `${timeline.fixtureCount} fixtures`}
          </StatusChip>
        </div>
      }
    >
      {!timeline.hasFixtures ? (
        <div className="m-4 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500 sm:m-6">
          No scheduled fixtures yet. Run the scheduler to populate the planner.
        </div>
      ) : (
        <div className="relative">
          <PlannerToolbar
            view={view}
            setView={setView}
            zoom={zoom}
            setZoom={setZoom}
            activeOverlays={activeOverlays}
            toggleOverlay={toggleOverlay}
            canEdit={canEdit}
          />

          {view === "timeline" ? (
            <div ref={scrollRef} className="max-h-[720px] overflow-auto bg-slate-50/70">
              <div style={{ width: `${PITCH_COLUMN_WIDTH + canvasWidth}px` }}>
                <PlannerHeader
                  timeline={timeline}
                  canvasWidth={canvasWidth}
                  overlayMetrics={overlayMetrics}
                  activeOverlays={activeOverlays}
                />

                {groups.map((group) => {
                  const collapsed = collapsedGroups.has(group.id);
                  return (
                    <div key={group.id}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        className="sticky left-0 z-30 flex w-full items-center gap-2 border-y border-slate-200 bg-slate-100/95 px-3 py-1.5 text-left text-[9px] font-black uppercase tracking-[0.16em] text-slate-600 backdrop-blur"
                      >
                        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        {group.label}
                        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-500 shadow-sm">{group.rows.length}</span>
                      </button>

                      {!collapsed
                        ? group.rows.map((row) => (
                            <PlannerRow
                              key={row.pitch.id}
                              row={row}
                              games={games}
                              timeline={timeline}
                              canvasWidth={canvasWidth}
                              closedPitches={closedPitches}
                              activeOverlays={activeOverlays}
                              canEdit={canEdit}
                              isCompact={isCompact}
                              dragFixture={dragRef.current?.fixture}
                              candidate={activeCandidate}
                              selected={selected}
                              slots={slots}
                              rowRefs={rowRefs}
                              onFixtureSelect={(fixture, fixtureIndex) => {
                                setSelected({ fixture, fixtureIndex });
                                setProposal(null);
                              }}
                              onPointerDrag={startPointerDrag}
                              onSlotSelect={previewSlotForSelected}
                            />
                          ))
                        : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <PitchBoard
              groups={groups}
              closedPitches={closedPitches}
              selected={selected}
              canEdit={canEdit}
              onFixtureSelect={(fixture, fixtureIndex) => {
                setSelected({ fixture, fixtureIndex });
                setProposal(null);
              }}
              games={games}
            />
          )}

          <PlannerLegend activeOverlays={activeOverlays} />

          {dirty ? (
            <DraftActionBar
              count={changeHistory.length || 1}
              saving={saving}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={onUndo}
              onRedo={onRedo}
              onReview={() => setReviewOpen(true)}
              onDiscard={onDiscard}
              onSave={onSave}
            />
          ) : null}

          <FixturePlannerDrawer
            selected={selected}
            rankedPitches={selectedRankedPitches}
            timeline={timeline}
            candidate={proposal}
            canEdit={canEdit}
            onClose={() => {
              setSelected(null);
              setProposal(null);
              setCandidate(null);
            }}
            onPreview={({ pitchId, koMins }) => previewSlotForSelected(pitchId, koMins)}
            onApply={applyProposal}
            onRecommendation={applyRecommendation}
            onOpenFixture={() => {
              if (selectedFixture) onFixtureClick?.(selectedFixture, selectedFixtureIndex);
            }}
          />

          <ChangeReviewDrawer
            open={reviewOpen}
            changes={changeHistory}
            onClose={() => setReviewOpen(false)}
            onUndo={onUndo}
            onDiscard={onDiscard}
            onSave={onSave}
            saving={saving}
          />
        </div>
      )}
    </Card>
  );
}

function PlannerToolbar({ view, setView, zoom, setZoom, activeOverlays, toggleOverlay, canEdit }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentButton active={view === "timeline"} onClick={() => setView("timeline")} icon={CalendarClock}>Timeline</SegmentButton>
          <SegmentButton active={view === "board"} onClick={() => setView("board")} icon={LayoutGrid}>Pitch board</SegmentButton>
          {canEdit ? (
            <div className="ml-0 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800 sm:ml-2">
              <MousePointer2 size={14} /> Drag the handle or select a fixture
            </div>
          ) : null}
        </div>

        {view === "timeline" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><SlidersHorizontal size={13} /> Zoom</span>
            {Object.values(MATCHDAY_PLANNER_ZOOM).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setZoom(mode.id)}
                className={`rounded-xl border px-3 py-2 text-xs font-black transition ${zoom === mode.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><Eye size={13} /> Overlays</span>
        {MATCHDAY_PLANNER_OVERLAYS.map((overlay) => (
          <button
            key={overlay.id}
            type="button"
            aria-pressed={activeOverlays.has(overlay.id)}
            onClick={() => toggleOverlay(overlay.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition ${activeOverlays.has(overlay.id) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}
          >
            <span className={`h-2 w-2 rounded-full ${activeOverlays.has(overlay.id) ? "bg-emerald-500" : "bg-slate-300"}`} />
            {overlay.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SegmentButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition ${active ? "border-slate-950 bg-slate-950 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      <Icon size={16} /> {children}
    </button>
  );
}

function PlannerHeader({ timeline, canvasWidth, overlayMetrics, activeOverlays }) {
  const visibleMetrics = overlayMetrics.filter((metric) => metric.value % 30 === 0);
  return (
    <div className="sticky top-0 z-40 grid border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur" style={{ gridTemplateColumns: `${PITCH_COLUMN_WIDTH}px ${canvasWidth}px` }}>
      <div className="sticky left-0 z-50 flex items-center border-r border-slate-200 bg-[#07121f] px-4 py-3 text-white">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Pitch plan</div>
          <div className="mt-1 text-sm font-black">Matchday</div>
        </div>
      </div>
      <div className="relative h-[72px] bg-white">
        <div className="absolute inset-x-0 top-0 h-9 border-b border-slate-100">
          {timeline.ticks.map((tick) => (
            <div key={tick.value} className="absolute top-2 -translate-x-1/2 text-[11px] font-black text-slate-500" style={{ left: `${((tick.value - timeline.start) / timeline.range) * 100}%` }}>
              {tick.label}
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-9">
          {visibleMetrics.map((metric) => {
            const showParking = activeOverlays.has("parking") && metric.parkingPercent > 0;
            const showOfficials = activeOverlays.has("officials") && metric.missingOfficials > 0;
            const showWarnings = activeOverlays.has("warnings") && metric.warningFixtures > 0;
            if (!showParking && !showOfficials && !showWarnings) return null;
            return (
              <div key={metric.value} className="absolute bottom-1 -translate-x-1/2" style={{ left: `${((metric.value - timeline.start) / timeline.range) * 100}%` }}>
                <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black text-slate-600 shadow-sm">
                  {showParking ? <span className={metric.parkingTone === "danger" ? "text-rose-700" : metric.parkingTone === "warning" ? "text-amber-700" : "text-emerald-700"}>{metric.parkingPercent}%</span> : null}
                  {showOfficials ? <Users size={10} className="text-amber-600" /> : null}
                  {showWarnings ? <AlertTriangle size={10} className="text-rose-600" /> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlannerRow({
  row,
  games,
  timeline,
  canvasWidth,
  closedPitches,
  activeOverlays,
  canEdit,
  isCompact,
  dragFixture,
  candidate,
  selected,
  slots,
  rowRefs,
  onFixtureSelect,
  onPointerDrag,
  onSlotSelect,
}) {
  const pitchState = dragFixture ? getTimelinePitchState({ pitch: row.pitch, fixture: dragFixture, closedPitches }) : null;
  const closed = getTimelinePitchState({ pitch: row.pitch, fixture: row.fixtures[0]?.source || {}, closedPitches }).tone === "closed";
  const isCandidateRow = candidate?.pitchId === row.pitch.id;
  const selectedFixtureId = selected?.fixture?.id || selected?.fixture?.fixtureId;
  const movingSelected = Boolean(selected && canEdit);
  const rowTone = dragFixture
    ? pitchState?.allowed
      ? isCandidateRow
        ? candidate?.blocked
          ? "bg-rose-50/80"
          : candidate?.advisory
            ? "bg-amber-50/80"
            : "bg-emerald-50/80"
        : "bg-emerald-50/30"
      : "bg-slate-100/80"
    : "bg-white";

  return (
    <div className={`grid border-b border-slate-200 ${rowTone}`} style={{ gridTemplateColumns: `${PITCH_COLUMN_WIDTH}px ${canvasWidth}px` }}>
      <div className="sticky left-0 z-30 border-r border-slate-200 bg-white px-3 py-3 shadow-[4px_0_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-slate-950">{formatPitchLabel(row.pitch.label || row.pitch.id)}</div>
            <div className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{formatPitchFormat(getPitchDisplayFormat(row.pitch))}</div>
          </div>
          {closed && activeOverlays.has("closures") ? <span className="rounded-full bg-rose-100 px-2 py-1 text-[9px] font-black uppercase text-rose-700">Closed</span> : null}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-500">
          <span>{row.fixtures.length} fixture{row.fixtures.length === 1 ? "" : "s"}</span>
          {pitchState ? <span className={pitchState.allowed ? "text-emerald-700" : "text-slate-400"}>· {pitchState.label}</span> : null}
        </div>
      </div>

      <div
        ref={(node) => {
          if (node) rowRefs.current.set(row.pitch.id, node);
          else rowRefs.current.delete(row.pitch.id);
        }}
        data-planner-pitch-id={row.pitch.id}
        className={`relative overflow-hidden ${closed && activeOverlays.has("closures") ? "bg-[repeating-linear-gradient(135deg,#fff1f2_0,#fff1f2_12px,#ffe4e6_12px,#ffe4e6_24px)]" : "bg-slate-50"}`}
        style={{ height: `${row.laneCount <= 1 ? (isCompact ? 52 : 58) : row.laneCount * 50 + 8}px` }}
        onClick={(event) => {
          if (!movingSelected || event.target.closest("[data-fixture-card]") || event.target.closest("button")) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) : 0;
          onSlotSelect(row.pitch.id, timeline.start + ratio * timeline.range);
        }}
      >
        {slots.map((slot) => (
          <div
            key={slot.value}
            className={`absolute top-0 h-full w-px ${slot.major ? "bg-slate-300" : slot.half ? "bg-slate-200" : "bg-slate-100"}`}
            style={{ left: `${((slot.value - timeline.start) / timeline.range) * 100}%` }}
          />
        ))}

        {activeOverlays.has("parking") ? <ParkingHeatStrip row={row} timeline={timeline} /> : null}

        {isCandidateRow && candidate?.patch ? <CandidateMarker candidate={candidate} timeline={timeline} /> : null}

        {row.fixtures.map((fixture) => {
          const fixtureIndex = games.indexOf(fixture.source);
          const sourceId = fixture.source.id || fixture.source.fixtureId;
          const isSelected = selectedFixtureId && sourceId === selectedFixtureId;
          const risk = getPlannerFixtureRisk(fixture.source);
          const colour = getGameColour(fixture);
          return (
            <div
              key={fixture.id}
              data-fixture-card
              className={`absolute z-10 flex overflow-hidden rounded-2xl border text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${colour} ${isSelected ? "ring-4 ring-sky-300 ring-offset-2" : ""}`}
              style={{
                left: `${fixture.leftPct}%`,
                width: `${fixture.displayWidthPct || fixture.widthPct}%`,
                top: `${7 + fixture.lane * 50}px`,
                height: "42px",
                minWidth: "0",
              }}
            >
              {canEdit ? (
                <button
                  type="button"
                  aria-label={`Move ${fixture.title} vs ${fixture.opposition}`}
                  title="Drag to move"
                  onPointerDown={(event) => onPointerDrag(event, fixture, fixtureIndex)}
                  className="flex w-8 shrink-0 touch-none items-center justify-center border-r border-white/20 bg-black/10 text-white/80 transition hover:bg-black/20 hover:text-white active:cursor-grabbing"
                >
                  <GripVertical size={15} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onFixtureSelect(fixture.source, fixtureIndex);
                }}
                className="min-w-0 flex-1 px-2.5 py-1.5 text-left"
                title={`${fixture.title} vs ${fixture.opposition} · ${fixture.koTime}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-black">{fixture.title}</span>
                  {activeOverlays.has("warnings") && risk.count ? <AlertTriangle size={11} className="shrink-0 text-amber-100" /> : null}
                </div>
                <div className="mt-0.5 truncate text-[9px] font-bold text-white/80">{fixture.koTime} · {fixture.opposition}</div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CandidateMarker({ candidate, timeline }) {
  const tone = getPlannerCandidateTone(candidate);
  const left = Math.max(2, Math.min(96, ((candidate.koMins - timeline.start) / timeline.range) * 100));
  const lineClass = tone === "danger" ? "bg-rose-500" : tone === "warning" ? "bg-amber-500" : tone === "success" ? "bg-emerald-500" : "bg-slate-500";
  const panelClass = tone === "danger" ? "border-rose-200 bg-rose-950" : tone === "warning" ? "border-amber-200 bg-amber-950" : tone === "success" ? "border-emerald-200 bg-emerald-950" : "border-slate-200 bg-slate-950";
  return (
    <div className="pointer-events-none absolute inset-y-0 z-30" style={{ left: `${left}%` }}>
      <div className={`h-full w-1 rounded-full ${lineClass}`} />
      <div className={`absolute top-1 w-64 -translate-x-1/2 rounded-2xl border px-3 py-2 text-white shadow-2xl ${panelClass}`}>
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em]">
          {tone === "danger" ? <ShieldX size={13} /> : tone === "warning" ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
          {getPlannerCandidateLabel(candidate)}
        </div>
        <div className="mt-1 text-xs font-black">{candidate.koTime} · {candidate.pitch?.label || candidate.pitchId}</div>
        <div className="mt-1 line-clamp-2 text-[10px] font-bold leading-4 text-white/75">{candidate.message || getTimelineCandidateSummary(candidate)}</div>
      </div>
    </div>
  );
}

function ParkingHeatStrip({ row, timeline }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-slate-100">
      {row.fixtures.map((fixture) => {
        const intensity = Math.min(1, Math.max(0.2, Number(fixture.cars || 0) / 30));
        return (
          <span
            key={`parking-${fixture.id}`}
            className="absolute bottom-0 h-full bg-amber-400"
            style={{ left: `${fixture.leftPct}%`, width: `${Math.max(2, fixture.widthPct)}%`, opacity: intensity }}
          />
        );
      })}
      <span className="sr-only">Parking contribution overlay from {formatTimelineTime(timeline.start)} to {formatTimelineTime(timeline.end)}</span>
    </div>
  );
}

function PitchBoard({ groups, closedPitches, selected, canEdit, onFixtureSelect, games }) {
  const closedSet = normaliseClosedPitchSet(closedPitches);
  return (
    <div className="bg-slate-50 p-4 sm:p-6">
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.flatMap((group) => group.rows).map((row) => (
          <section key={row.pitch.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
              <div>
                <div className="text-base font-black text-slate-950">{formatPitchLabel(row.pitch.label || row.pitch.id)}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">{formatPitchFormat(getPitchDisplayFormat(row.pitch))}</div>
              </div>
              <StatusChip variant={closedSet.has(row.pitch.id) ? "danger" : row.fixtures.length ? "success" : "neutral"}>
                {closedSet.has(row.pitch.id) ? "Closed" : `${row.fixtures.length} fixture${row.fixtures.length === 1 ? "" : "s"}`}
              </StatusChip>
            </div>
            <div className="space-y-2 p-3">
              {row.fixtures.length ? row.fixtures.map((fixture) => {
                const fixtureIndex = games.indexOf(fixture.source);
                const risk = getPlannerFixtureRisk(fixture.source);
                const selectedId = selected?.fixture?.id || selected?.fixture?.fixtureId;
                const fixtureId = fixture.source.id || fixture.source.fixtureId;
                return (
                  <button
                    key={fixture.id}
                    type="button"
                    onClick={() => onFixtureSelect(fixture.source, fixtureIndex)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 ${selectedId && selectedId === fixtureId ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"}`}
                  >
                    <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">{fixture.koTime}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-slate-950">{fixture.title}</div>
                      <div className="mt-0.5 truncate text-xs font-bold text-slate-500">vs {fixture.opposition}</div>
                    </div>
                    {risk.count ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black uppercase text-amber-800"><AlertTriangle size={10} /> {risk.count}</span> : <CheckCircle2 size={17} className="text-emerald-500" />}
                    {canEdit ? <ChevronRight size={16} className="text-slate-300" /> : null}
                  </button>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs font-bold text-slate-400">No fixtures assigned</div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function FixturePlannerDrawer({ selected, rankedPitches, timeline, candidate, canEdit, onClose, onPreview, onApply, onRecommendation, onOpenFixture }) {
  const fixture = selected?.fixture;
  const fixtureIndex = selected?.fixtureIndex ?? -1;
  const [pitchId, setPitchId] = useState("");
  const [koTime, setKoTime] = useState("");

  useEffect(() => {
    setPitchId(fixture?.pitchId || "");
    setKoTime(fixture?.koTime || (Number.isFinite(fixture?.koMins) ? formatTimelineTime(fixture.koMins) : ""));
  }, [fixture]);

  if (!fixture || fixtureIndex < 0) return null;
  const risk = getPlannerFixtureRisk(fixture);
  const tone = getPlannerCandidateTone(candidate);
  const candidateClass = tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-950" : tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className="fixed inset-0 z-[190] flex justify-end bg-slate-950/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-white shadow-2xl" aria-label="Selected fixture planner">
        <div className="sticky top-0 z-10 bg-[#07121f] px-5 py-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">Selected fixture</div>
              <h3 className="mt-2 text-xl font-black tracking-tight">{fixture.homeTeam || fixture.team || "Fixture"}</h3>
              <p className="mt-1 text-sm font-bold text-slate-400">vs {fixture.awayTeam || "TBC"}</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Close fixture planner"><X size={18} /></button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3">
            <DetailTile icon={Clock3} label="Kick-off" value={fixture.koTime || formatTimelineTime(fixture.koMins || 0)} />
            <DetailTile icon={MapPin} label="Pitch" value={fixture.pitchLabel || fixture.pitchId || "TBC"} />
            <DetailTile icon={Users} label="Official" value={fixture.referee || fixture.official || "Unassigned"} />
            <DetailTile icon={ParkingCircle} label="Estimated cars" value={String(fixture.cars || fixture.estimatedCars || 0)} />
          </div>

          {risk.count ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-amber-800"><AlertTriangle size={14} /> Operational watchlist</div>
              <div className="mt-2 flex flex-wrap gap-2">{risk.warnings.map((warning) => <span key={warning} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-amber-800 shadow-sm">{warning}</span>)}</div>
            </div>
          ) : null}

          {canEdit ? (
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-black text-slate-950"><MousePointer2 size={16} /> Move fixture</div>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">Choose a pitch and time. Ground Control validates the move before it can be applied.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-black text-slate-700">
                  Pitch
                  <select value={pitchId} onChange={(event) => setPitchId(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400">
                    {rankedPitches.map((item) => <option key={item.pitch.id} value={item.pitch.id} disabled={!item.state.allowed}>{item.pitch.label || item.pitch.id}{item.state.allowed ? "" : ` — ${item.state.label}`}</option>)}
                  </select>
                </label>
                <label className="text-xs font-black text-slate-700">
                  Kick-off
                  <input type="time" step="900" min={formatTimelineTime(timeline.start)} max={formatTimelineTime(timeline.end)} value={koTime} onChange={(event) => setKoTime(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-400" />
                </label>
              </div>
              <button type="button" onClick={() => onPreview({ pitchId, koMins: normalisePlannerTimeInput(koTime, fixture.koMins) })} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"><ShieldAlert size={16} /> Validate move</button>
            </section>
          ) : null}

          {candidate ? (
            <section className={`rounded-3xl border p-4 ${candidateClass}`}>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
                {tone === "danger" ? <ShieldX size={15} /> : tone === "warning" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                {getPlannerCandidateLabel(candidate)}
              </div>
              <div className="mt-2 text-sm font-black">{candidate.patch ? getTimelineCandidateSummary(candidate) : candidate.title}</div>
              <p className="mt-2 text-xs font-bold leading-5 opacity-80">{candidate.message}</p>
              {!candidate.blocked && !candidate.noChange ? (
                <button type="button" onClick={onApply} className={`mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-black ${candidate.advisory ? "bg-amber-500 text-slate-950" : "bg-emerald-600 text-white"}`}><Check size={16} /> {candidate.advisory ? "Continue with warning" : "Apply move"}</button>
              ) : null}
              {candidate.validatedRecommendations?.length ? (
                <div className="mt-4 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] opacity-70">Recommended alternatives</div>
                  {candidate.validatedRecommendations.slice(0, 3).map((item) => (
                    <button key={item.id} type="button" onClick={() => onRecommendation(item)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-left text-xs font-black text-slate-800 shadow-sm hover:bg-white">
                      <span>{item.actionTitle || item.title}</span><ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section>
            <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Best suitable pitches</div>
            <div className="mt-2 space-y-2">
              {rankedPitches.filter((item) => item.state.allowed).slice(0, 4).map((item, index) => (
                <button key={item.pitch.id} type="button" disabled={!canEdit} onClick={() => { setPitchId(item.pitch.id); onPreview({ pitchId: item.pitch.id, koMins: normalisePlannerTimeInput(koTime, fixture.koMins) }); }} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:bg-slate-50 disabled:cursor-default">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${index === 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-900">{item.pitch.label || item.pitch.id}</span><span className="mt-0.5 block truncate text-[10px] font-bold text-slate-500">{formatPitchFormat(item.format)} · validated suitability</span></span>
                </button>
              ))}
            </div>
          </section>

          <button type="button" onClick={onOpenFixture} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"><Eye size={16} /> Open full fixture record</button>
        </div>
      </aside>
    </div>
  );
}

function DetailTile({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-slate-400"><Icon size={12} /> {label}</div>
      <div className="mt-2 truncate text-sm font-black text-slate-900">{value}</div>
    </div>
  );
}

function DraftActionBar({ count, saving, canUndo, canRedo, onUndo, onRedo, onReview, onDiscard, onSave }) {
  return (
    <div className="sticky bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-16px_40px_rgba(15,23,42,0.12)] backdrop-blur sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><History size={19} /></div>
          <div><div className="text-sm font-black text-slate-950">{count} unpublished schedule change{count === 1 ? "" : "s"}</div><div className="mt-0.5 text-xs font-bold text-slate-500">Review the batch before saving the matchday plan.</div></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onUndo} disabled={!canUndo} className="planner-action-button"><Undo2 size={15} /> Undo</button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className="planner-action-button"><Redo2 size={15} /> Redo</button>
          <button type="button" onClick={onReview} className="planner-action-button"><ListRestart size={15} /> Review changes</button>
          <button type="button" onClick={onDiscard} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 transition hover:bg-rose-100"><RotateCcw size={15} /> Discard</button>
          {typeof onSave === "function" ? <button type="button" onClick={onSave} disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"><Save size={15} /> {saving ? "Saving…" : "Save schedule"}</button> : null}
        </div>
      </div>
    </div>
  );
}

function ChangeReviewDrawer({ open, changes, onClose, onUndo, onDiscard, onSave, saving }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex justify-end bg-slate-950/55 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#07121f] px-5 py-5 text-white">
          <div className="flex items-start justify-between gap-4"><div><div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">Draft schedule</div><h3 className="mt-2 text-xl font-black">Review {changes.length} change{changes.length === 1 ? "" : "s"}</h3></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"><X size={18} /></button></div>
        </div>
        <div className="space-y-3 p-5">
          {changes.length ? [...changes].reverse().map((change, index) => (
            <div key={change.id || `${change.fixtureId}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600">{changes.length - index}</span><div className="min-w-0 flex-1"><div className="text-sm font-black text-slate-950">{change.fixtureTitle}</div><div className="mt-2 space-y-1 text-xs font-bold text-slate-600">{change.changedTime ? <div><Clock3 size={12} className="mr-1 inline" /> {change.previousPatch?.koTime} → {change.patch?.koTime}</div> : null}{change.changedPitch ? <div><MapPin size={12} className="mr-1 inline" /> {change.previousPatch?.pitchLabel || change.previousPatch?.pitchId} → {change.patch?.pitchLabel || change.patch?.pitchId}</div> : null}</div>{change.warning ? <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800"><AlertTriangle size={11} className="mr-1 inline" /> {change.warning}</div> : null}</div></div>
            </div>
          )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">No planner changes to review.</div>}
        </div>
        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-slate-200 bg-white/95 p-4 backdrop-blur"><button type="button" onClick={onUndo} disabled={!changes.length} className="planner-action-button"><Undo2 size={15} /> Undo latest</button><button type="button" onClick={onDiscard} disabled={!changes.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-50"><RotateCcw size={15} /> Discard all</button>{typeof onSave === "function" ? <button type="button" onClick={onSave} disabled={!changes.length || saving} className="ml-auto inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-50"><Save size={15} /> {saving ? "Saving…" : "Save schedule"}</button> : null}</div>
      </aside>
    </div>
  );
}

function PlannerLegend({ activeOverlays }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 sm:px-6">
      <LegendItem colour="bg-emerald-600" label="Preferred" />
      <LegendItem colour="bg-amber-500" label="Alternative" />
      <LegendItem colour="bg-blue-600" label="Astro" />
      <LegendItem colour="bg-red-600" label="Emergency" />
      {activeOverlays.has("closures") ? <LegendItem colour="bg-rose-200" label="Closed area" /> : null}
      {activeOverlays.has("parking") ? <LegendItem colour="bg-amber-300" label="Parking load" /> : null}
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
  return <div className="flex items-center gap-2"><span className={`h-3 w-3 rounded ${colour}`} /><span>{label}</span></div>;
}

function formatPitchLabel(value) {
  return String(value || "Pitch").replace(/[.·,:;\-\s]+$/g, "").replace(/\s+/g, " ").trim();
}

function formatPitchFormat(value) {
  const text = String(value || "Unconfigured").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return text.split(" ").map((part) => (/^\d+v\d+$/i.test(part) ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())).join(" ");
}

function normaliseClosedPitchSet(closedPitches) {
  if (Array.isArray(closedPitches)) {
    return new Set(closedPitches.map((item) => (typeof item === "string" ? item : item?.pitchId || item?.id)).filter(Boolean));
  }
  return new Set(Object.entries(closedPitches || {}).filter(([, closed]) => Boolean(closed)).map(([pitchId]) => pitchId));
}
