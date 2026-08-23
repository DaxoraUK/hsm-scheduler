import React, { useEffect, useMemo, useState } from "react";
import Card from "@/ui/Card.jsx";
import StatusChip from "@/ui/StatusChip.jsx";
import { sortPitches } from "../../../lib/pitches.js";
import { createPitchRegistry } from "../../../lib/registry/pitchRegistry.js";
import {
  describePitchClosure,
  getActivePitchClosures,
  getUpcomingPitchClosures,
  todayDateValue,
} from "../../../lib/domain/pitchClosures.js";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  Plus,
  RotateCcw,
  ShieldOff,
  Wrench,
} from "lucide-react";

const ARTIFICIAL_SURFACES = new Set(["astro", "3g", "4g", "artificial"]);

const REASONS = [
  "Pitch recovery",
  "Waterlogged",
  "Maintenance",
  "Safety inspection",
  "Event or booking",
  "Other",
];

function formatDisplayDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "—";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPitchStatus({ pitch, registry, explicitClosures, allowArtificial }) {
  const linkedIds = registry.getLinkedPitchIds(pitch.id);
  const explicitClosure = explicitClosures.get(pitch.id) || null;
  const closureSources = linkedIds
    .filter((pitchId) => pitchId !== pitch.id && explicitClosures.has(pitchId))
    .map((pitchId) => explicitClosures.get(pitchId));
  const linkedClosed = !explicitClosure && closureSources.length > 0;
  const artificialDisabled =
    !allowArtificial && ARTIFICIAL_SURFACES.has(String(pitch.surface || "").toLowerCase());

  if (explicitClosure) {
    return {
      key: "closed",
      label: "Closed",
      detail: `${explicitClosure.reason}. ${describePitchClosure(explicitClosure)}.`,
      unavailable: true,
      linkedIds,
      closureSources: [explicitClosure],
    };
  }

  if (linkedClosed) {
    return {
      key: "linked",
      label: "Linked closure",
      detail: `Blocked by ${closureSources.map((record) => record.pitchId).join(", ")} because the layouts share one physical footprint.`,
      unavailable: true,
      linkedIds,
      closureSources,
    };
  }

  if (artificialDisabled) {
    return {
      key: "surface",
      label: "Artificial disabled",
      detail: "The pitch is open, but artificial surfaces are disabled for this schedule.",
      unavailable: true,
      linkedIds,
      closureSources: [],
    };
  }

  return {
    key: "open",
    label: "Open",
    detail: "Available when the fixture format, shared layout and concurrency rules allow it.",
    unavailable: false,
    linkedIds,
    closureSources: [],
  };
}

const STATUS_STYLES = {
  closed: {
    card: "border-red-200 bg-red-50",
    icon: "bg-red-100 text-red-700",
    chip: "danger",
    Icon: AlertTriangle,
  },
  linked: {
    card: "border-amber-200 bg-amber-50",
    icon: "bg-amber-100 text-amber-700",
    chip: "warning",
    Icon: Link2,
  },
  surface: {
    card: "border-slate-300 bg-slate-100",
    icon: "bg-slate-200 text-slate-700",
    chip: "neutral",
    Icon: ShieldOff,
  },
  open: {
    card: "border-slate-200 bg-slate-50",
    icon: "bg-emerald-100 text-emerald-700",
    chip: "success",
    Icon: CheckCircle2,
  },
};

export default function PitchClosuresCard({
  pitchCfg = [],
  pitchClosures = [],
  activeDate = todayDateValue(),
  addPitchClosure,
  reopenPitchClosures,
  toggleClosed,
  closeAllPitches,
  reopenAllPitches,
  allowArtificial = false,
}) {
  const sorted = useMemo(() => sortPitches(pitchCfg), [pitchCfg]);
  const registry = useMemo(() => createPitchRegistry(pitchCfg), [pitchCfg]);
  const [selectedPitchId, setSelectedPitchId] = useState(sorted[0]?.id || "");
  const [mode, setMode] = useState("matchday");
  const [fromDate, setFromDate] = useState(activeDate || todayDateValue());
  const [toDate, setToDate] = useState(activeDate || todayDateValue());
  const [reason, setReason] = useState(REASONS[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const date = activeDate || todayDateValue();
    setFromDate(date);
    setToDate(date);
  }, [activeDate]);

  useEffect(() => {
    if (!selectedPitchId && sorted[0]?.id) setSelectedPitchId(sorted[0].id);
    if (selectedPitchId && !sorted.some((pitch) => pitch.id === selectedPitchId)) {
      setSelectedPitchId(sorted[0]?.id || "");
    }
  }, [selectedPitchId, sorted]);

  const activeClosures = useMemo(
    () => getActivePitchClosures(pitchClosures, activeDate),
    [activeDate, pitchClosures]
  );
  const upcomingClosures = useMemo(
    () => getUpcomingPitchClosures(pitchClosures, activeDate),
    [activeDate, pitchClosures]
  );
  const explicitClosures = useMemo(
    () => new Map(activeClosures.map((record) => [record.pitchId, record])),
    [activeClosures]
  );

  const pitchStatuses = useMemo(
    () =>
      sorted.map((pitch) => ({
        pitch,
        status: getPitchStatus({
          pitch,
          registry,
          explicitClosures,
          allowArtificial,
        }),
      })),
    [allowArtificial, explicitClosures, registry, sorted]
  );

  const unavailableCount = pitchStatuses.filter(({ status }) => status.unavailable).length;
  const availableCount = Math.max(0, sorted.length - unavailableCount);
  const indefiniteCount = activeClosures.filter((record) => record.untilReopened).length;

  const createClosure = () => {
    if (!selectedPitchId || !fromDate) return;
    const effectiveTo = mode === "range" ? toDate || fromDate : mode === "matchday" ? fromDate : null;

    addPitchClosure?.({
      pitchId: selectedPitchId,
      mode,
      effectiveFrom: fromDate,
      effectiveTo,
      untilReopened: mode === "untilReopened",
      reason,
      notes,
    });

    setNotes("");
  };

  const reopenSources = (status) => {
    const sourceIds = status.closureSources.map((record) => record.pitchId);
    if (sourceIds.length && reopenPitchClosures) {
      reopenPitchClosures(sourceIds, activeDate);
      return;
    }
    if (toggleClosed) toggleClosed(selectedPitchId, status.linkedIds);
  };

  return (
    <Card
      eyebrow="Ground Status"
      title="Pitch Closure Management"
      subtitle={`Closures are evaluated against ${formatDisplayDate(activeDate)} and remain saved independently from the fixture schedule.`}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip variant={unavailableCount ? "warning" : "success"}>
            {unavailableCount ? `${unavailableCount} unavailable` : "All available"}
          </StatusChip>
          <button
            type="button"
            onClick={() => closeAllPitches?.(activeDate)}
            disabled={!sorted.length}
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:opacity-40"
          >
            Close all for this date
          </button>
          <button
            type="button"
            onClick={() => reopenAllPitches?.(activeDate)}
            disabled={!activeClosures.length}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
          >
            Reopen all active
          </button>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Available" value={`${availableCount}/${sorted.length}`} tone="emerald" />
        <Metric label="Active closures" value={activeClosures.length} tone="red" />
        <Metric label="Until reopened" value={indefiniteCount} tone="amber" />
        <Metric label="Upcoming" value={upcomingClosures.length} tone="blue" />
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-emerald-300">
            <Wrench size={19} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-black text-slate-950">Add or update a closure</div>
            <div className="mt-1 text-xs font-bold leading-5 text-slate-500">
              Choose a single matchday, a recovery date range, or keep the pitch closed until someone explicitly reopens it.
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <Field label="Pitch">
            <select value={selectedPitchId} onChange={(event) => setSelectedPitchId(event.target.value)} className="field-control">
              {sorted.map((pitch) => <option key={pitch.id} value={pitch.id}>{pitch.label}</option>)}
            </select>
          </Field>
          <Field label="Closure type">
            <select value={mode} onChange={(event) => setMode(event.target.value)} className="field-control">
              <option value="matchday">This matchday only</option>
              <option value="range">Date range</option>
              <option value="untilReopened">Until manually reopened</option>
            </select>
          </Field>
          <Field label={mode === "matchday" ? "Closure date" : "Effective from"}>
            <input type="date" value={fromDate} onChange={(event) => {
              setFromDate(event.target.value);
              if (mode === "matchday") setToDate(event.target.value);
            }} className="field-control" />
          </Field>
          <Field label="Effective to" muted={mode !== "range"}>
            <input type="date" value={toDate} min={fromDate} disabled={mode !== "range"} onChange={(event) => setToDate(event.target.value)} className="field-control disabled:bg-slate-100 disabled:text-slate-400" />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
          <Field label="Reason">
            <select value={reason} onChange={(event) => setReason(event.target.value)} className="field-control">
              {REASONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional recovery, inspection or maintenance note" className="field-control" />
          </Field>
          <button type="button" onClick={createClosure} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
            <Plus size={17} strokeWidth={2.7} /> Save closure
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pitchStatuses.map(({ pitch, status }) => {
          const style = STATUS_STYLES[status.key];
          const Icon = style.Icon;
          const reopenable = status.key === "closed" || status.key === "linked";

          return (
            <div key={pitch.id} className={`rounded-2xl border p-4 ${style.card}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-black text-slate-900">{pitch.label}</div>
                    <StatusChip variant={style.chip}>{status.label}</StatusChip>
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-500">{pitch.format || "Any"} · {pitch.surface || "Grass"}</div>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}>
                  <Icon size={19} strokeWidth={2.5} />
                </div>
              </div>

              <div className="mt-3 min-h-[40px] text-xs font-semibold leading-5 text-slate-600">{status.detail}</div>

              <div className="mt-4 flex flex-wrap gap-2">
                {reopenable ? (
                  <button type="button" onClick={() => reopenSources(status)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50">
                    <RotateCcw size={14} /> Reopen
                  </button>
                ) : status.key === "open" ? (
                  <button type="button" onClick={() => setSelectedPitchId(pitch.id)} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50">
                    <CalendarDays size={14} /> Plan closure
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {upcomingClosures.length ? (
        <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2 text-sm font-black text-blue-950">
            <Clock3 size={17} /> Upcoming closures
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {upcomingClosures.slice(0, 6).map((record) => (
              <div key={record.id} className="rounded-2xl border border-blue-200 bg-white/70 px-4 py-3">
                <div className="text-sm font-black text-slate-950">{record.pitchId} · {record.reason}</div>
                <div className="mt-1 text-xs font-bold text-slate-500">{describePitchClosure(record)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold leading-6 text-blue-900">
        Closures are saved immediately and are not cleared when schedules are rebuilt or reset. Linked layouts share one physical footprint, so a closure can make related pitch layouts unavailable too. Open pitches may still remain unused when another compatible pitch has higher priority, a linked layout is occupied, or the concurrent-game limit has been reached.
      </div>

      <style>{`.field-control{height:3rem;width:100%;border-radius:1rem;border:1px solid #cbd5e1;background:#fff;padding:0 0.95rem;font-size:.875rem;font-weight:800;color:#0f172a;outline:none}.field-control:focus{border-color:#6ee7b7;box-shadow:0 0 0 4px rgba(167,243,208,.45)}`}</style>
    </Card>
  );
}

function Field({ label, children, muted = false }) {
  return (
    <label className={muted ? "opacity-60" : ""}>
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value, tone }) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    red: "border-red-200 bg-red-50 text-red-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.blue}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
