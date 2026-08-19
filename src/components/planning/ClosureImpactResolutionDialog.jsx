import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { FULL_PITCH_AREA_ID, FULL_PITCH_AREA_LABEL, pitchAreaOptions } from "../../lib/planning/annualPlannerEngine.js";
import { PrimaryButton, SecondaryButton, inputClass, selectClass } from "../Settings/SettingsPrimitives.jsx";

function text(value) {
  return String(value ?? "").trim();
}

function localDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value).slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value).slice(11, 16);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function iso(date, time) {
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function normaliseSlot(row = {}) {
  return {
    id: text(row.id),
    siteId: text(row.site_id || row.siteId),
    label: text(row.label || row.name || "Winter slot"),
    dayOfWeek: Number(row.day_of_week ?? row.dayOfWeek ?? 1),
    startTime: text(row.start_time || row.startTime || "18:00").slice(0, 5),
    endTime: text(row.end_time || row.endTime || "19:00").slice(0, 5),
    areaId: text(row.pitch_area_id || row.pitchAreaId || row.space_id || row.spaceId),
    areaName: text(row.pitch_area_name || row.pitchAreaName || row.space_name || row.spaceName),
  };
}

export default function ClosureImpactResolutionDialog({
  impact,
  booking,
  pitches = [],
  winterSites = [],
  winterSlots = [],
  busy = false,
  onClose,
  onResolve,
}) {
  const [action, setAction] = useState("offer_alternative");
  const [resourceMode, setResourceMode] = useState(booking?.seasonPhase === "winter" ? "winter" : "club");
  const [date, setDate] = useState(localDate(booking?.startAt || impact?.booking_start_at));
  const [startTime, setStartTime] = useState(localTime(booking?.startAt || impact?.booking_start_at));
  const [endTime, setEndTime] = useState(localTime(booking?.endAt || impact?.booking_end_at));
  const [pitchId, setPitchId] = useState(text(booking?.pitchId || impact?.pitch_id));
  const [pitchAreaId, setPitchAreaId] = useState(text(booking?.pitchAreaId || FULL_PITCH_AREA_ID));
  const [siteId, setSiteId] = useState(text(booking?.siteInventoryId));
  const [slotId, setSlotId] = useState(text(booking?.siteSlotId));
  const [publicMessage, setPublicMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const selectedPitch = useMemo(() => pitches.find((row) => text(row.id) === pitchId) || null, [pitchId, pitches]);
  const areaOptions = useMemo(() => selectedPitch ? pitchAreaOptions(selectedPitch, { includeFullPitch: true }) : [{ id: FULL_PITCH_AREA_ID, label: FULL_PITCH_AREA_LABEL }], [selectedPitch]);
  const selectedSite = useMemo(() => winterSites.find((row) => text(row.id) === siteId) || null, [siteId, winterSites]);
  const siteSlots = useMemo(() => winterSlots.map(normaliseSlot).filter((row) => !siteId || row.siteId === siteId), [siteId, winterSlots]);
  const selectedSlot = useMemo(() => siteSlots.find((row) => row.id === slotId) || null, [siteSlots, slotId]);
  const needsAlternative = ["relocate", "offer_alternative"].includes(action);

  const submit = () => {
    const payload = {
      action,
      public_message: text(publicMessage) || null,
      internal_note: text(internalNote) || null,
    };

    if (needsAlternative) {
      const startAt = iso(date, startTime);
      const endAt = iso(date, endTime);
      if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
        toast.error("Choose a valid replacement slot", { description: "The finish time must be after the start time." });
        return;
      }
      if (resourceMode === "winter") {
        if (!selectedSite || !selectedSlot) {
          toast.error("Choose a winter site and fixed slot");
          return;
        }
        Object.assign(payload, {
          season_phase: "winter",
          site_inventory_id: selectedSite.id,
          site_slot_id: selectedSlot.id,
          venue_id: null,
          venue_name: selectedSite.name || selectedSite.label || "Winter site",
          pitch_id: null,
          pitch_name: selectedSlot.label,
          pitch_area_id: selectedSlot.areaId || null,
          pitch_area_name: selectedSlot.areaName || null,
          start_at: startAt,
          end_at: endAt,
        });
      } else {
        if (!selectedPitch) {
          toast.error("Choose a replacement pitch");
          return;
        }
        const selectedArea = areaOptions.find((row) => row.id === pitchAreaId) || areaOptions[0];
        Object.assign(payload, {
          season_phase: booking?.seasonPhase || "regular",
          site_inventory_id: null,
          site_slot_id: null,
          venue_id: selectedPitch.siteId || selectedPitch.venueId || null,
          venue_name: selectedPitch.siteLabel || selectedPitch.venueName || null,
          pitch_id: selectedPitch.id,
          pitch_name: selectedPitch.label || selectedPitch.name || selectedPitch.id,
          pitch_area_id: selectedArea?.id || FULL_PITCH_AREA_ID,
          pitch_area_name: selectedArea?.label || FULL_PITCH_AREA_LABEL,
          start_at: startAt,
          end_at: endAt,
        });
      }
    }

    onResolve?.(payload);
  };

  if (!impact) return null;

  return (
    <div className="fixed inset-0 z-[245] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-md sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Resolve affected booking">
      <section className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[30px] bg-white shadow-2xl">
        <div className="sticky top-0 z-20 flex items-start gap-3 border-b border-slate-200 bg-white/95 p-5 backdrop-blur sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><AlertTriangle size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Closure impact</div>
            <h2 className="mt-1 text-xl font-black text-slate-950">Resolve {impact.booking_title || booking?.title || "affected booking"}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{impact.team_name || booking?.teamName || impact.team_key || "Club-wide"} · {impact.blackout_title || "Facility unavailable"}</p>
          </div>
          <button disabled={busy} type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200"><X size={18} /></button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><CalendarClock size={15} /> Original slot</div><div className="mt-2 text-sm font-black text-slate-950">{localDate(booking?.startAt || impact.booking_start_at)} · {localTime(booking?.startAt || impact.booking_start_at)}–{localTime(booking?.endAt || impact.booking_end_at)}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500"><MapPin size={15} /> Original facility</div><div className="mt-2 text-sm font-black text-slate-950">{[booking?.venueName, booking?.pitchName || impact.pitch_name, booking?.pitchAreaName].filter(Boolean).join(" · ") || "Facility TBC"}</div></div>
          </div>

          <label className="block text-xs font-black text-slate-700">Resolution
            <select value={action} onChange={(event) => setAction(event.target.value)} className={`${selectClass} mt-2`}>
              <option value="offer_alternative">Offer coach an alternative</option>
              <option value="relocate">Relocate immediately</option>
              <option value="postpone">Postpone awaiting rearrangement</option>
              <option value="cancel">Cancel affected session</option>
              <option value="acknowledge">Acknowledge - no booking change</option>
            </select>
          </label>

          {needsAlternative ? <div className="rounded-[24px] border border-sky-200 bg-sky-50 p-4 sm:p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-800">Replacement allocation</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-black text-slate-700">Resource type<select className={`${selectClass} mt-2`} value={resourceMode} onChange={(event) => setResourceMode(event.target.value)}><option value="club">Club pitch</option><option value="winter">Winter site slot</option></select></label>
              <label className="text-xs font-black text-slate-700">Date<input type="date" className={`${inputClass} mt-2`} value={date} onChange={(event) => setDate(event.target.value)} /></label>
              <label className="text-xs font-black text-slate-700">Start<input type="time" step="1800" className={`${inputClass} mt-2`} value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
              <label className="text-xs font-black text-slate-700">Finish<input type="time" step="1800" className={`${inputClass} mt-2`} value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
              {resourceMode === "club" ? <>
                <label className="text-xs font-black text-slate-700">Pitch<select className={`${selectClass} mt-2`} value={pitchId} onChange={(event) => { setPitchId(event.target.value); setPitchAreaId(FULL_PITCH_AREA_ID); }}><option value="">Choose pitch</option>{pitches.map((row) => <option key={row.id} value={row.id}>{row.label || row.name || row.id}</option>)}</select></label>
                <label className="text-xs font-black text-slate-700">Pitch area<select className={`${selectClass} mt-2`} value={pitchAreaId} onChange={(event) => setPitchAreaId(event.target.value)}>{areaOptions.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
              </> : <>
                <label className="text-xs font-black text-slate-700">Winter site<select className={`${selectClass} mt-2`} value={siteId} onChange={(event) => { setSiteId(event.target.value); setSlotId(""); }}><option value="">Choose site</option>{winterSites.map((row) => <option key={row.id} value={row.id}>{row.name || row.label || row.id}</option>)}</select></label>
                <label className="text-xs font-black text-slate-700">Fixed slot<select className={`${selectClass} mt-2`} value={slotId} onChange={(event) => { const next = siteSlots.find((row) => row.id === event.target.value); setSlotId(event.target.value); if (next) { setStartTime(next.startTime); setEndTime(next.endTime); } }}><option value="">Choose slot</option>{siteSlots.map((row) => <option key={row.id} value={row.id}>{row.label} · {row.startTime}–{row.endTime}</option>)}</select></label>
              </>}
            </div>
          </div> : null}

          <label className="block text-xs font-black text-slate-700">Message to coach<textarea className={`${inputClass} mt-2 min-h-24 resize-y`} value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} placeholder="Explain the closure and what happens next." /></label>
          <label className="block text-xs font-black text-slate-700">Internal note<textarea className={`${inputClass} mt-2 min-h-20 resize-y`} value={internalNote} onChange={(event) => setInternalNote(event.target.value)} placeholder="Visible only to club operators and the audit record." /></label>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 p-5 backdrop-blur sm:flex-row sm:justify-end sm:p-6">
          <SecondaryButton type="button" onClick={onClose} disabled={busy}>Cancel</SecondaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={busy}>{busy ? "Saving..." : action === "offer_alternative" ? "Send alternative" : "Confirm resolution"}</PrimaryButton>
        </div>
      </section>
    </div>
  );
}
